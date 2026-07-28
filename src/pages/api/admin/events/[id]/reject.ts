import type { APIRoute } from "astro";
import { transitionEventStatus } from "../../../../../lib/db/admin-events";
import { getDB, STATUS } from "../../../../../lib/db";
import { jsonError, jsonOk } from "../../../../../lib/http/json";
import { getRuntimeEnv } from "../../../../../lib/runtime/env";
import { parseId } from "../../../../../lib/admin/validation";

export const prerender = false;

export const POST: APIRoute = async ({ request, params }) => {
    const id = parseId(params.id);
    if (!id) return jsonError("Invalid event id", 400);

    try {
        const formData = await request.formData();
        const rejectReason = formData.get("reject_reason");
        if (typeof rejectReason !== "string" || rejectReason.trim() === "") {
            return jsonError("reject_reason is required", 400);
        }

        const db = await getDB(getRuntimeEnv());
        const result = await transitionEventStatus(db, id, STATUS.PENDING, STATUS.REJECTED, {
            rejectReason: rejectReason.trim()
        });
        if (result.outcome === "conflict") return jsonError("Event is not pending", 409);

        return jsonOk();
    } catch (error) {
        return jsonError(error instanceof Error ? error.message : "Failed to reject event", 500);
    }
};
