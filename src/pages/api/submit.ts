import type { APIRoute } from "astro";
import { getDB } from "../../lib/db";
import {
    insertSubmission,
    listCities,
    listScales,
    listTypes,
} from "../../lib/db/queries";
import { jsonError, jsonOk } from "../../lib/http/json";
import { parseSubmissionForm } from "../../lib/public/form";
import { getRuntimeEnv } from "../../lib/runtime/env";
import { verifyTurnstile } from "../../lib/turnstile";

export const prerender = false;

function hasName(rows: Array<{ name: string }>, name: string) {
    return rows.some((row) => row.name === name);
}

function hasCity(rows: Array<{ id?: number }>, id: number) {
    return rows.some((row) => row.id === id);
}

export const POST: APIRoute = async ({ request }) => {
    try {
        const formData = await request.formData();
        const { input, turnstileToken } = parseSubmissionForm(formData);
        const runtimeEnv = getRuntimeEnv();
        const verification = await verifyTurnstile(
            turnstileToken,
            runtimeEnv.TURNSTILE_SECRET_KEY,
            request.headers.get("CF-Connecting-IP"),
        );
        if (!verification.success) {
            return jsonError("人机校验失败，请刷新后重试", 400);
        }

        const db = await getDB(runtimeEnv);
        const [cities, types, scales] = await Promise.all([
            listCities(db),
            listTypes(db),
            listScales(db),
        ]);
        if (!hasCity(cities, input.city_id)) return jsonError("城市无效", 400);
        if (!hasName(types, input.type)) return jsonError("类型无效", 400);
        if (!hasName(scales, input.scale)) return jsonError("规模无效", 400);

        const id = await insertSubmission(db, input);
        return jsonOk({ id }, { status: 201 });
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Failed to submit event";
        const status = message.includes("not configured")
            ? 500
            : message.includes("request failed") ||
                message.includes("internal error; reference")
              ? 502
              : 400;
        return jsonError(message, status);
    }
};
