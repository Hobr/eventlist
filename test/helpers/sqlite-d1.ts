import { DatabaseSync, type SQLInputValue, type StatementResultingChanges } from "node:sqlite";
import type { D1Database, D1PreparedStatement, D1Result } from "../../src/types/cloudflare";

function asSqlValue(value: unknown): SQLInputValue {
    if (
        value === null ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "bigint" ||
        value instanceof Uint8Array
    ) {
        return value;
    }

    throw new TypeError(`Unsupported SQLite binding value: ${typeof value}`);
}

function mutationResult<T>(result: StatementResultingChanges): D1Result<T> {
    return {
        success: true,
        results: [],
        meta: {
            changes: Number(result.changes),
            last_row_id: Number(result.lastInsertRowid)
        }
    } as unknown as D1Result<T>;
}

function queryResult<T>(results: T[]): D1Result<T> {
    return {
        success: true,
        results,
        meta: { changes: 0 }
    } as unknown as D1Result<T>;
}

function plainRow<T>(row: T): T {
    return row && typeof row === "object" ? ({ ...row } as T) : row;
}

export class SqliteD1TestStatement {
    values: SQLInputValue[] = [];

    constructor(
        private readonly database: DatabaseSync,
        readonly sql: string
    ) {}

    bind(...values: unknown[]) {
        this.values = values.map(asSqlValue);
        return this as unknown as D1PreparedStatement;
    }

    async first<T>(columnName?: string): Promise<T | null> {
        const row = this.database.prepare(this.sql).get(...this.values) as
            Record<string, unknown> | undefined;
        if (!row) return null;
        return (columnName ? row[columnName] : plainRow(row)) as T;
    }

    async all<T>() {
        const rows = (this.database.prepare(this.sql).all(...this.values) as T[]).map(plainRow);
        return queryResult(rows);
    }

    async run<T>() {
        return mutationResult<T>(this.database.prepare(this.sql).run(...this.values));
    }

    executeBatch<T>() {
        const statement = this.database.prepare(this.sql);
        if (statement.columns().length > 0) {
            return queryResult((statement.all(...this.values) as T[]).map(plainRow));
        }
        return mutationResult<T>(statement.run(...this.values));
    }
}

export class SqliteD1TestDatabase {
    private readonly database = new DatabaseSync(":memory:");
    readonly prepared: SqliteD1TestStatement[] = [];

    get binding() {
        return this as unknown as D1Database;
    }

    execScript(sql: string) {
        this.database.exec(sql);
    }

    prepare(sql: string) {
        const statement = new SqliteD1TestStatement(this.database, sql);
        this.prepared.push(statement);
        return statement as unknown as D1PreparedStatement;
    }

    async batch<T>(statements: D1PreparedStatement[]) {
        this.database.exec("BEGIN IMMEDIATE");
        try {
            const results = statements.map((statement) =>
                (statement as unknown as SqliteD1TestStatement).executeBatch<T>()
            );
            this.database.exec("COMMIT");
            return results;
        } catch (error) {
            this.database.exec("ROLLBACK");
            throw error;
        }
    }

    all<T>(sql: string, ...values: SQLInputValue[]) {
        return (this.database.prepare(sql).all(...values) as T[]).map(plainRow);
    }

    first<T>(sql: string, ...values: SQLInputValue[]) {
        const row = this.database.prepare(sql).get(...values) as T | undefined;
        return row === undefined ? null : plainRow(row);
    }

    run(sql: string, ...values: SQLInputValue[]) {
        return this.database.prepare(sql).run(...values);
    }

    explain(statement: SqliteD1TestStatement) {
        return this.all<{ detail: string }>(
            `EXPLAIN QUERY PLAN ${statement.sql}`,
            ...statement.values
        );
    }

    resetPrepared() {
        this.prepared.length = 0;
    }

    close() {
        this.database.close();
    }
}
