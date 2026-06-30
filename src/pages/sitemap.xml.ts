import type { APIRoute } from "astro";
import { getDB } from "../lib/db";
import { listPublishedEventSitemapRows } from "../lib/db/queries";
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
    const staticEntries = [
        urlEntry(`${origin}/`),
        urlEntry(`${origin}/events`),
        urlEntry(`${origin}/submit`),
    ];

    try {
        const db = await getDB(getRuntimeEnv());
        const events = await listPublishedEventSitemapRows(db);
        const eventEntries = events.map((event) =>
            urlEntry(`${origin}/events/${event.id}`, event.updated_at),
        );

        return new Response(
            `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[
                ...staticEntries,
                ...eventEntries,
            ].join("")}</urlset>`,
            {
                headers: {
                    "content-type": "application/xml; charset=utf-8",
                },
            },
        );
    } catch {
        return new Response(
            `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${staticEntries.join("")}</urlset>`,
            {
                headers: {
                    "content-type": "application/xml; charset=utf-8",
                },
            },
        );
    }
};
