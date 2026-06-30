export type D1Row = Record<string, unknown>;

export type D1Result<T = D1Row> = globalThis.D1Result<T>;
export type D1PreparedStatement = globalThis.D1PreparedStatement;
export type D1Database = globalThis.D1Database;

export interface RuntimeEnv {
    DB?: D1Database;
    AUTH_MODE?: "access" | "token";
    ACCESS_TEAM?: string;
    ACCESS_AUD?: string;
    ADMIN_TOKEN?: string;
    DEFAULT_CITY_ID?: string;
    TURNSTILE_SITE_KEY?: string;
    TURNSTILE_SECRET_KEY?: string;
}
