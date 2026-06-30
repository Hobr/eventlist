export type D1Row = Record<string, unknown>;

export interface D1Result<T = D1Row> {
    success: boolean;
    meta: {
        changes?: number;
        duration?: number;
        last_row_id?: number;
        rows_read?: number;
        rows_written?: number;
    };
    results?: T[];
    error?: string;
}

export interface D1PreparedStatement {
    bind(...values: unknown[]): D1PreparedStatement;
    first<T = D1Row>(colName?: string): Promise<T | null>;
    run<T = D1Row>(): Promise<D1Result<T>>;
    all<T = D1Row>(): Promise<D1Result<T>>;
}

export interface D1Database {
    prepare(query: string): D1PreparedStatement;
    batch<T = D1Row>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
    exec(query: string): Promise<unknown>;
}

export interface RuntimeEnv {
    DB?: D1Database;
    AUTH_MODE?: "access" | "token";
    ACCESS_TEAM?: string;
    ACCESS_AUD?: string;
    ADMIN_TOKEN?: string;
}
