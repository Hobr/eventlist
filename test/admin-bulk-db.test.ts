import assert from "node:assert/strict";
import test from "node:test";
import type { D1Database } from "../src/types/cloudflare";
import {
    BulkEventIdConflictError,
    createBulkPublishedEvents,
    findBulkEventDuplicateCandidates,
    type AdminEventInput
} from "../src/lib/db/admin-events";

const VALID_EVENT: AdminEventInput = {
    title: "测试活动",
    type: "comic",
    scale: "small",
    division_code: "110101",
    venue: "测试场馆",
    address: "测试地址",
    start_date: "2026-08-01",
    end_date: "2026-08-02",
    start_time: "09:00",
    end_time: "18:00",
    cover_url: "https://example.com/cover.jpg",
    description: "活动描述",
    qq_group: "123456",
    ticket_url: "https://example.com/tickets",
    source_url: "https://example.com/source",
    submitter_contact: "admin@example.com",
    organizer: "测试主办方",
    schedule_status: null,
    admission_method: "ticket",
    price_range: "免费",
    admission_start_date: "2026-07-20",
    admission_start_time: "09:30",
    tags: ["漫展", "北京"]
};

class FakeStatement {
    values: unknown[] = [];

    constructor(
        readonly db: FakeDatabase,
        readonly sql: string
    ) {}

    bind(...values: unknown[]) {
        this.values = values;
        return this;
    }

    async first<T>() {
        this.db.bindingCalls += 1;
        return this.db.firstResult as T | null;
    }

    async all<T>() {
        this.db.bindingCalls += 1;
        return {
            success: true,
            results: this.db.allResults as T[],
            meta: {}
        };
    }
}

class FakeDatabase {
    prepared: FakeStatement[] = [];
    batches: FakeStatement[][] = [];
    firstResult: unknown = { id: 100 };
    allResults: unknown[] = [];
    batchError: Error | null = null;
    bindingCalls = 0;

    prepare(sql: string) {
        const statement = new FakeStatement(this, sql);
        this.prepared.push(statement);
        return statement;
    }

    async batch(statements: FakeStatement[]) {
        this.bindingCalls += 1;
        this.batches.push(statements);
        if (this.batchError) throw this.batchError;
        return statements.map(() => ({ success: true, meta: { changes: 1 } }));
    }
}

function asD1(db: FakeDatabase) {
    return db as unknown as D1Database;
}

test("重复候选仅用一条查询并去重开始日期", async () => {
    const db = new FakeDatabase();
    db.allResults = [{ id: 8, title: "已有活动", start_date: "2026-08-01", venue: "已有场馆" }];

    const result = await findBulkEventDuplicateCandidates(asD1(db), [
        "2026-08-01",
        "2026-08-01",
        "2026-08-02"
    ]);

    assert.equal(db.prepared.length, 1);
    assert.equal(db.bindingCalls, 1);
    assert.deepEqual(JSON.parse(String(db.prepared[0]?.values[0])), ["2026-08-01", "2026-08-02"]);
    assert.equal(result[0]?.id, 8);
});

test("20 条活动只执行一次含 42 条语句的原子 batch", async () => {
    const db = new FakeDatabase();
    const items = Array.from({ length: 20 }, (_, index) => ({
        row: index + 2,
        event: { ...VALID_EVENT, title: `测试活动 ${index + 1}` }
    }));

    const created = await createBulkPublishedEvents(asD1(db), items, {
        authMode: "access",
        email: "admin@example.com"
    });

    assert.equal(db.batches.length, 1);
    assert.equal(db.batches[0]?.length, 42);
    assert.equal(db.bindingCalls, 2);
    assert.deepEqual(created.at(0), { id: 100, title: "测试活动 1" });
    assert.deepEqual(created.at(-1), { id: 119, title: "测试活动 20" });

    const auditRows = JSON.parse(String(db.batches[0]?.at(-1)?.values[0])) as Array<{
        target_id: number;
        meta: Record<string, unknown>;
    }>;
    assert.equal(auditRows.length, 20);
    assert.deepEqual(auditRows[0], {
        target_id: 100,
        meta: {
            source: "admin-bulk-create",
            csv_row: 2,
            batch_size: 20,
            tags: ["漫展", "北京"],
            auth_mode: "access",
            email: "admin@example.com"
        }
    });

    assert.deepEqual(db.batches[0]?.[1]?.values.slice(16, 22), [
        "测试主办方",
        null,
        "ticket",
        "免费",
        "2026-07-20",
        "09:30"
    ]);

    for (const relationship of db.batches[0]?.slice(21, 41) ?? []) {
        assert.match(relationship.sql, /json_each\(\?\)/);
        assert.match(relationship.sql, /COALESCE\(tags\.alias_of_id, tags\.id\)/);
    }
});

test("候选 ID 冲突转换为可识别的 409 冲突错误", async () => {
    const db = new FakeDatabase();
    db.batchError = new Error("D1_ERROR: UNIQUE constraint failed: events.id");

    await assert.rejects(
        () =>
            createBulkPublishedEvents(asD1(db), [{ row: 2, event: VALID_EVENT }], {
                authMode: "token"
            }),
        BulkEventIdConflictError
    );
    assert.equal(db.bindingCalls, 2);
    assert.equal(db.batches.length, 1);
});

test("普通 batch 失败保持原子边界且不重试", async () => {
    const db = new FakeDatabase();
    db.batchError = new Error("D1_ERROR: audit trigger failed");

    await assert.rejects(
        () =>
            createBulkPublishedEvents(asD1(db), [{ row: 2, event: VALID_EVENT }], {
                authMode: "token"
            }),
        /audit trigger failed/
    );
    assert.equal(db.bindingCalls, 2);
    assert.equal(db.batches.length, 1);
    assert.equal(db.batches[0]?.length, 4);
});
