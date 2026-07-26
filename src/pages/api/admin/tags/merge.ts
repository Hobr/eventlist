import type { APIRoute } from "astro";
import { insertAudit, mergeTags } from "../../../../lib/db/queries";
import { getDB } from "../../../../lib/db";
import { jsonError, jsonOk } from "../../../../lib/http/json";
import { getRuntimeEnv } from "../../../../lib/runtime/env";
import { parseId } from "../../../../lib/admin/validation";

export const prerender = false;

function readId(value: FormDataEntryValue | null) {
    return parseId(typeof value === "string" ? value : undefined);
}

export const POST: APIRoute = async ({ request }) => {
    try {
        const formData = await request.formData();
        const from = readId(formData.get("from"));
        const to = readId(formData.get("to"));
        if (!from || !to) return jsonError("from and to are required", 400);

        const db = await getDB(getRuntimeEnv());
        const outcome = await mergeTags(db, from, to);
        if (outcome === "conflict")
            return jsonError("Source and target tags must be canonical", 409);
        if (outcome === "changed") {
            await insertAudit(db, "merge", to, { from, to });
        }
        return jsonOk();
    } catch (error) {
        return jsonError(error instanceof Error ? error.message : "Failed to merge tags", 400);
    }
};
