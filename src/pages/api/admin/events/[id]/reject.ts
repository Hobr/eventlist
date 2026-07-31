import type { APIRoute } from "astro";
import { waitUntil } from "cloudflare:workers";
import { schedulePublicDataInvalidation } from "../../../../../lib/cache/invalidation";
import { transitionEventStatus } from "../../../../../lib/db/admin-events";
import { getDB, STATUS } from "../../../../../lib/db";
import { jsonError, jsonOk } from "../../../../../lib/http/json";
import { getRuntimeEnv } from "../../../../../lib/runtime/env";
import { parseId } from "../../../../../lib/admin/validation";

export const prerender = false;

export const POST: APIRoute = async ({ request, params, url }) => {
    const id = parseId(params.id);
    if (!id) return jsonError("Invalid event id", 400);

    try {
        const formData = await request.formData();
        const rejectReason = formData.get("reject_reason");
        if (typeof rejectReason !== "string" || rejectReason.trim() === "") {
            return jsonError("reject_reason is required", 400);
        }

        const runtimeEnv = getRuntimeEnv();
        const db = await getDB(runtimeEnv);
        const result = await transitionEventStatus(db, id, STATUS.PENDING, STATUS.REJECTED, {
            rejectReason: rejectReason.trim()
        });
        if (result.outcome === "conflict") return jsonError("Event is not pending", 409);

        if (result.outcome === "changed") {
            schedulePublicDataInvalidation({
                origin: url,
                configuredScopes: runtimeEnv.PUBLIC_DATA_CACHE_SCOPES,
                kind: "status",
                impact: result.impact,
                waitUntil
            });
        }
        return jsonOk();
    } catch (error) {
        return jsonError(error instanceof Error ? error.message : "Failed to reject event", 500);
    }
};
