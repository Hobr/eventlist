import type { APIRoute } from "astro";
import { insertAudit, updateEventStatus } from "../../../../../lib/db/queries";
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
        const outcome = await updateEventStatus(db, id, STATUS.OFFLINE, STATUS.PUBLISHED);
        if (outcome === "conflict") return jsonError("Event is not offline", 409);
        if (outcome === "already-target") return jsonOk();

        await insertAudit(db, "republish", id, {});
        return jsonOk();
    } catch (error) {
        return jsonError(error instanceof Error ? error.message : "Failed to republish event", 500);
    }
};
