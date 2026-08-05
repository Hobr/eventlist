import type { APIRoute } from "astro";
import { waitUntil } from "cloudflare:workers";
import {
    isPublicDataCacheEnabled,
    parsePublicDataCacheScopes,
    publicDataCacheResponseHeaders,
    type PublicDataCacheState
} from "../lib/cache/public-data";
import { loadCachedSitemapRows } from "../lib/cache/public-routes";
import { getDB } from "../lib/db";
import { listPublishedEventSitemapRows } from "../lib/db/public-events";
import { getRuntimeEnv } from "../lib/runtime/env";

export const prerender = false;

function escapeXml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function urlEntry(location: string, lastmod?: string) {
    return `<url><loc>${escapeXml(location)}</loc>${lastmod ? `<lastmod>${escapeXml(lastmod.slice(0, 10))}</lastmod>` : ""}</url>`;
}

export const GET: APIRoute = async ({ url }) => {
    const origin = url.origin;
    const runtimeEnv = getRuntimeEnv();
    const failureCacheState: PublicDataCacheState = isPublicDataCacheEnabled(
        parsePublicDataCacheScopes(runtimeEnv.PUBLIC_DATA_CACHE_SCOPES),
        "sitemap"
    )
        ? "MISS"
        : "BYPASS";
    const staticEntries = [
        urlEntry(`${origin}/`),
        urlEntry(`${origin}/events`),
        urlEntry(`${origin}/categories`),
        urlEntry(`${origin}/submit`)
    ];

    try {
        const result = await loadCachedSitemapRows({
            origin,
            configuredScopes: runtimeEnv.PUBLIC_DATA_CACHE_SCOPES,
            limit: 1000,
            load: () => listPublishedEventSitemapRows(getDB(runtimeEnv), 1000),
            waitUntil
        });
        const eventEntries = result.value.map((event) =>
            urlEntry(`${origin}/events/${event.id}`, event.updated_at)
        );

        return new Response(
            `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[
                ...staticEntries,
                ...eventEntries
            ].join("")}</urlset>`,
            {
                headers: {
                    "content-type": "application/xml; charset=utf-8",
                    ...publicDataCacheResponseHeaders(result.cacheState)
                }
            }
        );
    } catch {
        return new Response(
            `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${staticEntries.join("")}</urlset>`,
            {
                headers: {
                    "content-type": "application/xml; charset=utf-8",
                    ...publicDataCacheResponseHeaders(failureCacheState)
                }
            }
        );
    }
};
