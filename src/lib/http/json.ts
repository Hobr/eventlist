export interface ApiErrorBody<T = never> {
    ok: false;
    error: string;
    details?: T;
}

export interface ApiSuccessBody<T extends Record<string, unknown> = Record<string, never>> {
    ok: true;
    data?: T;
}

export function jsonOk<T extends Record<string, unknown> = Record<string, never>>(
    data?: T,
    init?: ResponseInit
) {
    return Response.json({ ok: true, ...(data ? { data } : {}) } satisfies ApiSuccessBody<T>, init);
}

export function jsonError<T = never>(error: string, status = 400, details?: T) {
    const body = {
        ok: false,
        error,
        ...(details === undefined ? {} : { details })
    } satisfies ApiErrorBody<T>;

    return Response.json(body, {
        status
    });
}
