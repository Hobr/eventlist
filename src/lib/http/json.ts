export interface ApiErrorBody {
    ok: false;
    error: string;
}

export interface ApiSuccessBody<T extends Record<string, unknown> = Record<string, never>> {
    ok: true;
    data?: T;
}

export function jsonOk<T extends Record<string, unknown> = Record<string, never>>(
    data?: T,
    init?: ResponseInit,
) {
    return Response.json({ ok: true, ...(data ? { data } : {}) } satisfies ApiSuccessBody<T>, init);
}

export function jsonError(error: string, status = 400) {
    return Response.json({ ok: false, error } satisfies ApiErrorBody, { status });
}
