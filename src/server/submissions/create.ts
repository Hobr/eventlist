import { getEventRepository, requireBinding } from "../db/client";
import { getWorkerEnv } from "../env";
import type { EventRepository } from "../events/repository";
import type { SubmissionInput } from "../events/types";
import { hasFieldErrors, validateSubmissionInput } from "../events/validation";
import { checkSubmissionRateLimit } from "../security/rate-limit";

export interface CreateSubmissionResult {
    ok: boolean;
    eventId?: string;
    slug?: string;
    errors?: Record<string, string>;
}

export async function createSubmission(input: {
    fields: SubmissionInput;
    submitterIpHash: string;
    turnstileOutcome: string;
    cover?: Awaited<
        ReturnType<typeof import("./cover-upload").uploadSubmissionCover>
    >;
    repository?: EventRepository;
}): Promise<CreateSubmissionResult> {
    const errors = validateSubmissionInput(input.fields);
    if (hasFieldErrors(errors)) {
        return { ok: false, errors };
    }

    const { event } = await (
        input.repository ?? getEventRepository(getWorkerEnv())
    ).createPendingSubmission(input.fields, {
        submitterIpHash: input.submitterIpHash,
        turnstileOutcome: input.turnstileOutcome,
        cover: input.cover,
    });

    return { ok: true, eventId: event.id, slug: event.slug };
}

export async function enforceSubmissionRateLimit(input: {
    env: Partial<Env>;
    ipHash: string;
}) {
    return checkSubmissionRateLimit({
        kv: requireBinding(input.env.RATE_LIMIT, "RATE_LIMIT"),
        ipHash: input.ipHash,
    });
}
