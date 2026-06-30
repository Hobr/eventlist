import type { APIRoute } from "astro";
import { getDB } from "../../lib/db";
import { searchTags } from "../../lib/db/queries";
import { jsonError, jsonOk } from "../../lib/http/json";
import { getRuntimeEnv } from "../../lib/runtime/env";

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
    try {
        const db = await getDB(getRuntimeEnv());
        const tags = await searchTags(db, url.searchParams.get("q") ?? "", 12);
        return jsonOk({ tags });
    } catch (error) {
        return jsonError(error instanceof Error ? error.message : "Failed to search tags", 500);
    }
};
