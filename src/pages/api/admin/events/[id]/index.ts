import type { APIRoute } from "astro";
import { waitUntil } from "cloudflare:workers";
import { parseEventForm } from "../../../../../lib/admin/form";
import { schedulePublicDataInvalidation } from "../../../../../lib/cache/invalidation";
import { AdminEventMutationValidationError, editEvent } from "../../../../../lib/db/admin-events";
import { getDB } from "../../../../../lib/db";
import { jsonError, jsonOk } from "../../../../../lib/http/json";
import { getRuntimeEnv } from "../../../../../lib/runtime/env";
import { parseId } from "../../../../../lib/admin/validation";

export const prerender = false;

export const PATCH: APIRoute = async ({ request, params, url }) => {
    const id = parseId(params.id);
    if (!id) return jsonError("Invalid event id", 400);

    let input;
    try {
        input = parseEventForm(await request.formData());
    } catch (error) {
        return jsonError(error instanceof Error ? error.message : "活动信息无效", 400);
    }

    try {
        const runtimeEnv = getRuntimeEnv();
        const db = await getDB(runtimeEnv);
        const result = await editEvent(db, id, input);
        if (result.outcome === "not-found") return jsonError("Event not found", 404);
        if (result.outcome === "conflict") {
            return jsonError("Event status changed; reload and try again", 409);
        }

        schedulePublicDataInvalidation({
            origin: url,
            configuredScopes: runtimeEnv.PUBLIC_DATA_CACHE_SCOPES,
            kind: "edit",
            impact: result.impact,
            zoneId: runtimeEnv.CLOUDFLARE_ZONE_ID,
            purgeToken: runtimeEnv.CLOUDFLARE_CACHE_PURGE_TOKEN,
            waitUntil
        });
        return jsonOk();
    } catch (error) {
        if (error instanceof AdminEventMutationValidationError) {
            return jsonError(error.message, 400);
        }
        return jsonError(error instanceof Error ? error.message : "Failed to update event", 500);
    }
};
