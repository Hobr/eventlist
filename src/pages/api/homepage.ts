import type { APIRoute } from "astro";
import { waitUntil } from "cloudflare:workers";
import {
    combinePublicDataCacheStates,
    isPublicDataCacheEnabled,
    parsePublicDataCacheScopes,
    publicDataCacheResponseHeaders,
    type PublicDataCacheState
} from "../../lib/cache/public-data";
import {
    loadCachedHomepageDiscovery,
    loadCachedHomepagePopularity
} from "../../lib/cache/public-routes";
import { getDB } from "../../lib/db";
import { listHomepageDiscovery, listHomepagePopularity } from "../../lib/db/homepage";
import { getRegionOptionByCode, isRegionCode } from "../../lib/divisions";
import { isPopularityWindow } from "../../lib/events/popularity";
import { jsonError, jsonOk } from "../../lib/http/json";
import {
    toPublicHomepageDiscovery,
    toPublicHomepagePopularity,
    type PublicHomepageData
} from "../../lib/public/homepage";
import { getRuntimeEnv } from "../../lib/runtime/env";

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
    const city = url.searchParams.get("city")?.trim() ?? "";
    const trend = url.searchParams.get("trend") ?? "";
    const window = Number(trend);

    if (!city || !isRegionCode(city)) {
        const response = jsonError("行政区无效", 400);
        const headers = publicDataCacheResponseHeaders("BYPASS", "no-store");
        for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
        return response;
    }
    if (!/^(?:3|7|30)$/.test(trend) || !isPopularityWindow(window)) {
        const response = jsonError("热度统计时间范围无效", 400);
        const headers = publicDataCacheResponseHeaders("BYPASS", "no-store");
        for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
        return response;
    }

    const division = getRegionOptionByCode(city);
    if (!division) {
        const response = jsonError("行政区无效", 400);
        const headers = publicDataCacheResponseHeaders("BYPASS", "no-store");
        for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
        return response;
    }

    const runtimeEnv = getRuntimeEnv();
    const scopes = parsePublicDataCacheScopes(runtimeEnv.PUBLIC_DATA_CACHE_SCOPES);
    const failureCacheState = combinePublicDataCacheStates(
        (["homepage", "popularity"] as const).map<PublicDataCacheState>((scope) =>
            isPublicDataCacheEnabled(scopes, scope) ? "MISS" : "BYPASS"
        )
    );

    try {
        const db = await getDB(runtimeEnv);
        const [discoveryResult, popularityResult] = await Promise.all([
            loadCachedHomepageDiscovery({
                origin: url,
                configuredScopes: runtimeEnv.PUBLIC_DATA_CACHE_SCOPES,
                divisionCode: city,
                load: async (asOfDate) =>
                    toPublicHomepageDiscovery(await listHomepageDiscovery(db, city, asOfDate)),
                waitUntil
            }),
            loadCachedHomepagePopularity({
                origin: url,
                configuredScopes: runtimeEnv.PUBLIC_DATA_CACHE_SCOPES,
                divisionCode: city,
                window,
                load: async () =>
                    toPublicHomepagePopularity(await listHomepagePopularity(db, city, window)),
                waitUntil
            })
        ]);

        const homepage: PublicHomepageData = {
            division: { code: division.code, name: division.name, label: division.label },
            ...discoveryResult.value,
            popularity: popularityResult.value
        };
        return jsonOk(
            { homepage },
            {
                headers: publicDataCacheResponseHeaders(
                    combinePublicDataCacheStates([
                        discoveryResult.cacheState,
                        popularityResult.cacheState
                    ]),
                    "private, max-age=15"
                )
            }
        );
    } catch {
        const response = jsonError("首页活动暂时无法加载, 请稍后重试", 500);
        const headers = publicDataCacheResponseHeaders(failureCacheState, "no-store");
        for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
        return response;
    }
};
