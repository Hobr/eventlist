import type { RuntimeEnv } from "../../types/cloudflare";
import { getDB } from "../db";
import { insertSubmission } from "../db/submissions";
import { isCountyDivisionCode } from "../divisions";
import { jsonError, jsonOk } from "../http/json";
import { verifyTurnstile } from "../turnstile";
import { parseSubmissionForm } from "./form";

export async function handleSubmissionRequest(request: Request, runtimeEnv: RuntimeEnv) {
    try {
        const formData = await request.formData();
        const { input, turnstileToken } = parseSubmissionForm(formData);
        const verification = await verifyTurnstile(
            turnstileToken,
            runtimeEnv.TURNSTILE_SECRET,
            request.headers.get("CF-Connecting-IP")
        );
        if (!verification.success) {
            return jsonError("人机校验失败, 请刷新后重试", 400);
        }

        const db = getDB(runtimeEnv);
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
}
