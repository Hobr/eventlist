import type { APIRoute } from "astro";
import { getDB } from "../../lib/db";
import { listCities } from "../../lib/db/queries";
import { jsonError, jsonOk } from "../../lib/http/json";
import { getRuntimeEnv } from "../../lib/runtime/env";

export const prerender = false;

export const GET: APIRoute = async () => {
    try {
        const db = await getDB(getRuntimeEnv());
        const cities = await listCities(db);
        return jsonOk({ cities });
    } catch (error) {
        return jsonError(
            error instanceof Error ? error.message : "Failed to list cities",
            500,
        );
    }
};
