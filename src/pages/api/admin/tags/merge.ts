import type { APIRoute } from "astro";
import { mergeTags } from "../../../../lib/db/admin-events";
import { getDB } from "../../../../lib/db";
import { jsonError, jsonOk } from "../../../../lib/http/json";
import { getRuntimeEnv } from "../../../../lib/runtime/env";
import { parseId } from "../../../../lib/admin/validation";

export const prerender = false;

function readId(value: FormDataEntryValue | null) {
    return parseId(typeof value === "string" ? value : undefined);
}

export const POST: APIRoute = async ({ request }) => {
    let from: number;
    let to: number;
    try {
        const formData = await request.formData();
        const parsedFrom = readId(formData.get("from"));
        const parsedTo = readId(formData.get("to"));
        if (!parsedFrom || !parsedTo) return jsonError("from and to are required", 400);
        if (parsedFrom === parsedTo) {
            return jsonError("Source and target tags must be different", 400);
        }
        from = parsedFrom;
        to = parsedTo;
    } catch {
        return jsonError("Invalid form data", 400);
    }

    try {
        const db = await getDB(getRuntimeEnv());
        const result = await mergeTags(db, from, to);
        if (result.outcome === "conflict")
            return jsonError("Source and target tags must be canonical", 409);
        return jsonOk();
    } catch (error) {
        return jsonError(error instanceof Error ? error.message : "Failed to merge tags", 500);
    }
};
