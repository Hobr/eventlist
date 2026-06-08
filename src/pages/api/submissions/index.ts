import type { APIRoute } from "astro";
import { getClientIp, getWorkerEnv } from "../../../server/env";
import { readOptional, readRequired } from "../../../server/events/utils";
import { hashVisitorIp } from "../../../server/security/ip-hash";
import { verifyTurnstileToken } from "../../../server/security/turnstile";
import {
    createSubmission,
    enforceSubmissionRateLimit,
} from "../../../server/submissions/create";
import { uploadSubmissionCover } from "../../../server/submissions/cover-upload";

export const POST: APIRoute = async ({ request }) => {
    const env = getWorkerEnv();
    const formData = await request.formData();
    const ipHash = await hashVisitorIp(
        getClientIp(request),
        env?.IP_HASH_SECRET || "development-ip-secret",
    );
    const token = readOptional(formData.get("turnstileToken"));
    const turnstile = await verifyTurnstileToken({
        token,
        secret: env?.TURNSTILE_SECRET_KEY ?? "",
        remoteIp: getClientIp(request),
    });

    if (!turnstile.success) {
        return json(
            { ok: false, errors: { turnstile: "人机验证失败，请重新验证。" } },
            400,
        );
    }

    if (env?.RATE_LIMIT) {
        const rateLimit = await enforceSubmissionRateLimit({ env, ipHash });
        if (!rateLimit.allowed) {
            return json(
                {
                    ok: false,
                    errors: {
                        form:
                            rateLimit.reason === "cooldown"
                                ? "提交过于频繁，请稍后再试。"
                                : "今日提交次数已达上限。",
                    },
                },
                429,
            );
        }
    }

    let cover;
    try {
        cover = await uploadSubmissionCover({
            file:
                formData.get("cover") instanceof File
                    ? (formData.get("cover") as File)
                    : null,
            bucket: env?.BUCKET,
            publicBaseUrl: env?.PUBLIC_COVER_BASE_URL,
        });
    } catch (error) {
        return json(
            {
                ok: false,
                errors: {
                    cover:
                        error instanceof Error
                            ? error.message
                            : "封面图上传失败。",
                },
            },
            400,
        );
    }

    const result = await createSubmission({
        fields: {
            name: readRequired(formData.get("name")),
            city: readRequired(formData.get("city")),
            venue: readRequired(formData.get("venue")),
            startsAt: readRequired(formData.get("startsAt")),
            endsAt: readRequired(formData.get("endsAt")),
            typeText: readRequired(formData.get("typeText")),
            eventIpText: readRequired(formData.get("eventIpText")),
            officialQqGroup: readOptional(formData.get("officialQqGroup")),
            ticketUrl: readOptional(formData.get("ticketUrl")),
            submitterContact: readOptional(formData.get("submitterContact")),
            description: readOptional(formData.get("description")),
        },
        submitterIpHash: ipHash,
        turnstileOutcome: "passed",
        cover,
    });

    return json(result, result.ok ? 201 : 400);
};

function json(payload: unknown, status: number): Response {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { "content-type": "application/json; charset=utf-8" },
    });
}
