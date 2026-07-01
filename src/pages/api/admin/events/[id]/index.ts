import type { APIRoute } from "astro";
import { parseEventForm } from "../../../../../lib/admin/form";
import { editEvent, insertAudit } from "../../../../../lib/db/queries";
import { getDB } from "../../../../../lib/db";
import { jsonError, jsonOk } from "../../../../../lib/http/json";
import { getRuntimeEnv } from "../../../../../lib/runtime/env";
import { parseId } from "../../../../../lib/admin/validation";

export const prerender = false;

export const PATCH: APIRoute = async ({ request, params }) => {
    const id = parseId(params.id);
    if (!id) return jsonError("Invalid event id", 400);

    try {
        const formData = await request.formData();
        const input = parseEventForm(formData);
        const db = await getDB(getRuntimeEnv());
        const changes = await editEvent(db, id, input);
        if (changes === 0) return jsonError("Event not found", 404);

        await insertAudit(db, "edit", id, { fields: Object.keys(input) });
        return jsonOk();
    } catch (error) {
        return jsonError(error instanceof Error ? error.message : "Failed to update event", 400);
    }
};
