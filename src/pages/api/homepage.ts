import type { APIRoute } from "astro";
import { getDB } from "../../lib/db";
import { listHomepageDiscovery, listHomepagePopularity } from "../../lib/db/homepage";
import { getRegionOptionByCode, isRegionCode } from "../../lib/divisions";
import { isPopularityWindow } from "../../lib/events/popularity";
import { jsonError, jsonOk } from "../../lib/http/json";
import { toPublicHomepageData } from "../../lib/public/homepage";
import { getRuntimeEnv } from "../../lib/runtime/env";

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
    const city = url.searchParams.get("city")?.trim() ?? "";
    const trend = url.searchParams.get("trend") ?? "";
    const window = Number(trend);

    if (!city || !isRegionCode(city)) {
        return jsonError("行政区无效", 400);
    }
    if (!/^(?:3|7|30)$/.test(trend) || !isPopularityWindow(window)) {
        return jsonError("热度统计时间范围无效", 400);
    }

    const division = getRegionOptionByCode(city);
    if (!division) {
        return jsonError("行政区无效", 400);
    }

    try {
        const db = await getDB(getRuntimeEnv());
        const [discovery, popularity] = await Promise.all([
            listHomepageDiscovery(db, city),
            listHomepagePopularity(db, city, window)
        ]);
        return jsonOk({ homepage: toPublicHomepageData(division, discovery, popularity) });
    } catch {
        return jsonError("首页活动暂时无法加载，请稍后重试", 500);
    }
};
