import type { APIRoute } from "astro";
import { insertAudit, mergeTags } from "../../../../lib/db/queries";
import { getDB } from "../../../../lib/db";
import { jsonError, jsonOk } from "../../../../lib/http/json";
import { getRuntimeEnv } from "../../../../lib/runtime/env";

export const prerender = false;

function parsePositiveInt(value: FormDataEntryValue | null) {
    if (typeof value !== "string") return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export const POST: APIRoute = async ({ request }) => {
    const formData = await request.formData();
    const from = parsePositiveInt(formData.get("from"));
    const to = parsePositiveInt(formData.get("to"));

    if (!from || !to) return jsonError("from and to are required", 400);

    try {
        const db = getDB(getRuntimeEnv());
        const outcome = await mergeTags(db, from, to);
        if (outcome === "conflict")
            return jsonError("Source and target tags must be canonical", 409);
        if (outcome === "changed") {
            await insertAudit(db, "merge", to, { from, to });
        }
        return jsonOk();
    } catch (error) {
        return jsonError(
            error instanceof Error ? error.message : "Failed to merge tags",
            400,
        );
    }
};
