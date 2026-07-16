import type { APIRoute } from "astro";
import {
    hasCanonicalEventTag,
    insertAudit,
    updateEventStatus
} from "../../../../../lib/db/queries";
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
        if (!(await hasCanonicalEventTag(db, id))) {
            return jsonError("请先整理至少一个规范标签，再重新发布活动", 409);
        }
        const outcome = await updateEventStatus(db, id, STATUS.OFFLINE, STATUS.PUBLISHED);
        if (outcome === "conflict") return jsonError("Event is not offline", 409);
        if (outcome === "already-target") return jsonOk();

        await insertAudit(db, "republish", id, {});
        return jsonOk();
    } catch (error) {
        return jsonError(error instanceof Error ? error.message : "Failed to republish event", 500);
    }
};
