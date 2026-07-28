import type { APIRoute } from "astro";
import { transitionEventStatus } from "../../../../../lib/db/admin-events";
import { getDB, STATUS } from "../../../../../lib/db";
import { jsonError, jsonOk } from "../../../../../lib/http/json";
import { getRuntimeEnv } from "../../../../../lib/runtime/env";
import { parseId } from "../../../../../lib/admin/validation";

export const prerender = false;

export const POST: APIRoute = async ({ params }) => {
    const id = parseId(params.id);
    if (!id) return jsonError("Invalid event id", 400);

    try {
        const db = await getDB(getRuntimeEnv());
        const result = await transitionEventStatus(db, id, STATUS.PUBLISHED, STATUS.OFFLINE);
        if (result.outcome === "conflict") return jsonError("Event is not published", 409);

        return jsonOk();
    } catch (error) {
        return jsonError(error instanceof Error ? error.message : "Failed to offline event", 500);
    }
};
