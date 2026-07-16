import type { D1Database, RuntimeEnv } from "../../types/cloudflare";

export const STATUS = {
    PENDING: "pending",
    PUBLISHED: "published",
    REJECTED: "rejected",
    OFFLINE: "offline"
} as const;

export type EventStatus = (typeof STATUS)[keyof typeof STATUS];

export async function getDB(runtimeEnv: RuntimeEnv): Promise<D1Database> {
    if (!runtimeEnv.DB) {
        throw new Error(
            "D1 binding DB is not configured. Check wrangler.jsonc d1_databases for binding DB."
        );
    }

    await ensureFK(runtimeEnv.DB);
    return runtimeEnv.DB;
}

export async function ensureFK(db: D1Database) {
    await db.exec("PRAGMA foreign_keys = ON;");
}
