import type { APIRoute } from "astro";
import { waitUntil } from "cloudflare:workers";
import {
    isPublicDataCacheEnabled,
    parsePublicDataCacheScopes,
    publicDataCacheResponseHeaders,
    type PublicDataCacheState
} from "../../lib/cache/public-data";
import { loadCachedPublicTags } from "../../lib/cache/public-routes";
import { getDB } from "../../lib/db";
import { searchTags } from "../../lib/db/tags";
import { jsonError, jsonOk } from "../../lib/http/json";
import { getRuntimeEnv } from "../../lib/runtime/env";

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
    const runtimeEnv = getRuntimeEnv();
    const query = url.searchParams.get("q") ?? "";
    const failureCacheState: PublicDataCacheState =
        query.trim().length <= 24 &&
        isPublicDataCacheEnabled(
            parsePublicDataCacheScopes(runtimeEnv.PUBLIC_DATA_CACHE_SCOPES),
            "tags"
        )
            ? "MISS"
            : "BYPASS";

    try {
        const result = await loadCachedPublicTags({
            origin: url,
            configuredScopes: runtimeEnv.PUBLIC_DATA_CACHE_SCOPES,
            query,
            limit: 12,
            load: () => searchTags(getDB(runtimeEnv), query, 12),
            waitUntil
        });
        return jsonOk(
            { tags: result.value },
            {
                headers: publicDataCacheResponseHeaders(result.cacheState, "private, max-age=15")
            }
        );
    } catch (error) {
        const response = jsonError(
            error instanceof Error ? error.message : "Failed to search tags",
            500
        );
        const headers = publicDataCacheResponseHeaders(failureCacheState, "no-store");
        for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
        return response;
    }
};
