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
        const result = await transitionEventStatus(db, id, STATUS.PENDING, STATUS.PUBLISHED);
        if (result.conflict === "missing-canonical-tag") {
            return jsonError("请先整理至少一个规范标签，再发布活动", 409);
        }
        if (result.outcome === "conflict") return jsonError("Event is not pending", 409);

        return jsonOk();
    } catch (error) {
        return jsonError(error instanceof Error ? error.message : "Failed to approve event", 500);
    }
};
