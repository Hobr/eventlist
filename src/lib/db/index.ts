import type { D1Database, D1Result, RuntimeEnv } from "../../types/cloudflare";

export const STATUS = {
    PENDING: "pending",
    PUBLISHED: "published",
    REJECTED: "rejected",
    OFFLINE: "offline"
} as const;

export type EventStatus = (typeof STATUS)[keyof typeof STATUS];

export function getDB(runtimeEnv: RuntimeEnv): D1Database {
    if (!runtimeEnv.DB) {
        throw new Error(
            "D1 binding DB is not configured. Check wrangler.jsonc d1_databases for binding DB."
        );
    }

    return runtimeEnv.DB;
}

export function requireD1Success<T>(result: D1Result<T>, message: string) {
    if (!result.success) {
        throw new Error(result.error ?? message);
    }

    return result;
}
