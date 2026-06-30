import type { APIRoute } from "astro";
import { insertAudit, updateEventStatus } from "../../../../../lib/db/queries";
import { getDB, STATUS } from "../../../../../lib/db";
import { jsonError, jsonOk } from "../../../../../lib/http/json";
import { getRuntimeEnv } from "../../../../../lib/runtime/env";

export const prerender = false;

function parseId(value: string | undefined) {
    const id = Number.parseInt(value ?? "", 10);
    return Number.isInteger(id) && id > 0 ? id : null;
}

export const POST: APIRoute = async ({ params }) => {
    const id = parseId(params.id);
    if (!id) return jsonError("Invalid event id", 400);

    try {
        const db = await getDB(getRuntimeEnv());
        const outcome = await updateEventStatus(db, id, STATUS.PUBLISHED, STATUS.OFFLINE);
        if (outcome === "conflict") return jsonError("Event is not published", 409);
        if (outcome === "already-target") return jsonOk();

        await insertAudit(db, "offline", id, {});
        return jsonOk();
    } catch (error) {
        return jsonError(error instanceof Error ? error.message : "Failed to offline event", 500);
    }
};
