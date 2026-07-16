import type { APIRoute } from "astro";
import { getDB } from "../../lib/db";
import { insertSubmission } from "../../lib/db/queries";
import { isCountyDivisionCode } from "../../lib/divisions";
import { jsonError, jsonOk } from "../../lib/http/json";
import { parseSubmissionForm } from "../../lib/public/form";
import { getRuntimeEnv } from "../../lib/runtime/env";
import { verifyTurnstile } from "../../lib/turnstile";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
    try {
        const formData = await request.formData();
        const { input, turnstileToken } = parseSubmissionForm(formData);
        const runtimeEnv = getRuntimeEnv();
        const verification = await verifyTurnstile(
            turnstileToken,
            runtimeEnv.TURNSTILE_SECRET_KEY,
            request.headers.get("CF-Connecting-IP")
        );
        if (!verification.success) {
            return jsonError("人机校验失败，请刷新后重试", 400);
        }

        const db = await getDB(runtimeEnv);
        if (!isCountyDivisionCode(input.division_code)) return jsonError("行政区无效", 400);

        const id = await insertSubmission(db, input);
        return jsonOk({ id }, { status: 201 });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to submit event";
        const status = message.includes("not configured")
            ? 500
            : message.includes("request failed") || message.includes("internal error; reference")
              ? 502
              : 400;
        return jsonError(message, status);
    }
};
