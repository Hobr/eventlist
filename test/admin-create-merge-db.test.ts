import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createPublishedEvent, mergeTags, type AdminEventInput } from "../src/lib/db/admin-events";
import type { D1Database } from "../src/types/cloudflare";

interface FakeResult {
    success: boolean;
    results?: unknown[];
    meta: { changes?: number };
}

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
        return (this.db.firstResults.shift() ?? null) as T | null;
    }
}

class FakeDatabase {
    prepared: FakeStatement[] = [];
    batches: FakeStatement[][] = [];
    bindingCalls = 0;
    firstResults: unknown[] = [];
    batchResponses: Array<FakeResult[] | Error> = [];

    prepare(sql: string) {
        const statement = new FakeStatement(this, sql);
        this.prepared.push(statement);
        return statement;
    }

    async batch(statements: FakeStatement[]) {
        this.bindingCalls += 1;
        this.batches.push(statements);
        const response = this.batchResponses.shift();
        if (response instanceof Error) throw response;
        return response ?? statements.map(() => result(1));
    }
}

function asD1(db: FakeDatabase) {
    return db as unknown as D1Database;
}

function result(changes = 0, results: unknown[] = []): FakeResult {
    return { success: true, results, meta: { changes } };
}

const VALID_EVENT: AdminEventInput = {
    title: "测试活动",
    type: "comic",
    scale: "large",
    division_code: "310101",
    venue: "测试场馆",
    address: "测试地址",
    start_date: "2026-08-01",
    end_date: "2026-08-02",
    start_time: "09:00",
    end_time: "18:00",
    cover_url: "https://example.com/cover.webp",
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
    tags: ["同人展"]
};

test("createPublishedEvent uses two calls and four statements regardless of tag count", async () => {
    for (const tags of [["同人展"], Array.from({ length: 12 }, (_, index) => `标签${index + 1}`)]) {
        const db = new FakeDatabase();
        db.firstResults = [{ id: 100 }];
        db.batchResponses = [[result(1), result(1), result(tags.length), result(1)]];

        const id = await createPublishedEvent(
            asD1(db),
            { ...VALID_EVENT, tags },
            {
                authMode: "access",
                email: "admin@example.com"
            }
        );

        assert.equal(id, 100);
        assert.equal(db.bindingCalls, 2);
        assert.equal(db.batches.length, 1);
        assert.equal(db.batches[0]?.length, 4);

        const [tagInsert, eventInsert, relationshipInsert, auditInsert] = db.batches[0] ?? [];
        const tagsJson = JSON.stringify(tags);
        assert.match(tagInsert?.sql ?? "", /INSERT OR IGNORE INTO tags\(name\)/);
        assert.match(tagInsert?.sql ?? "", /json_each\(\?\)/);
        assert.equal(tagInsert?.values[0], tagsJson);
        assert.match(eventInsert?.sql ?? "", /INSERT INTO events/);
        assert.equal(eventInsert?.values[0], 100);
        assert.deepEqual(eventInsert?.values.slice(16, 22), [
            "测试主办方",
            null,
            "ticket",
            "免费",
            "2026-07-20",
            "09:30"
        ]);
        assert.match(relationshipInsert?.sql ?? "", /SELECT DISTINCT \?/);
        assert.match(relationshipInsert?.sql ?? "", /json_each\(\?\)/);
        assert.match(relationshipInsert?.sql ?? "", /COALESCE\(tags\.alias_of_id, tags\.id\)/);
        assert.match(relationshipInsert?.sql ?? "", /COLLATE NOCASE/);
        assert.deepEqual(relationshipInsert?.values, [100, tagsJson]);
        assert.match(auditInsert?.sql ?? "", /INSERT INTO audit_logs/);
        assert.deepEqual(JSON.parse(String(auditInsert?.values[1])), {
            source: "admin-create",
            tags,
            auth_mode: "access",
            email: "admin@example.com"
        });
    }
});

test("createPublishedEvent serializes one trimmed tag set for facts, relationships, and audit", async () => {
    const db = new FakeDatabase();
    db.firstResults = [{ id: 100 }];
    db.batchResponses = [[result(1), result(1), result(2), result(1)]];

    await createPublishedEvent(
        asD1(db),
        { ...VALID_EVENT, tags: [" Canonical ", "Alias", "Canonical", ""] },
        { authMode: "token" }
    );

    const [tagInsert, , relationshipInsert, auditInsert] = db.batches[0] ?? [];
    const tagsJson = JSON.stringify(["Canonical", "Alias"]);
    assert.equal(tagInsert?.values[0], tagsJson);
    assert.equal(relationshipInsert?.values[1], tagsJson);
    assert.deepEqual(JSON.parse(String(auditInsert?.values[1])), {
        source: "admin-create",
        tags: ["Canonical", "Alias"],
        auth_mode: "token"
    });
});

test("createPublishedEvent retries the whole batch only after an event id collision", async () => {
    const db = new FakeDatabase();
    db.firstResults = [{ id: 100 }, { id: 101 }];
    db.batchResponses = [
        new Error("D1_ERROR: UNIQUE constraint failed: events.id"),
        [result(1), result(1), result(1), result(1)]
    ];

    const id = await createPublishedEvent(asD1(db), VALID_EVENT, { authMode: "token" });

    assert.equal(id, 101);
    assert.equal(db.bindingCalls, 4);
    assert.equal(db.batches.length, 2);
    assert.equal(db.batches[0]?.length, 4);
    assert.equal(db.batches[1]?.length, 4);
    assert.equal(db.batches[0]?.[1]?.values[0], 100);
    assert.equal(db.batches[1]?.[1]?.values[0], 101);
    assert.equal(db.batches[0]?.[3]?.values[0], 100);
    assert.equal(db.batches[1]?.[3]?.values[0], 101);
});

test("createPublishedEvent does not retry a non-id batch failure", async () => {
    const db = new FakeDatabase();
    db.firstResults = [{ id: 100 }, { id: 101 }];
    db.batchResponses = [new Error("D1_ERROR: audit trigger rejected the write")];

    await assert.rejects(
        () => createPublishedEvent(asD1(db), VALID_EVENT, { authMode: "token" }),
        /audit trigger rejected/
    );
    assert.equal(db.bindingCalls, 2);
    assert.equal(db.batches.length, 1);
});

function mergeSnapshot(
    overrides: Partial<{
        source_alias_of_id: number | null;
        target_id: number | null;
        target_alias_of_id: number | null;
        affected_event_ids_json: string;
    }> = {}
) {
    return {
        source_id: 1,
        source_alias_of_id: null,
        target_id: 2,
        target_alias_of_id: null,
        affected_event_ids_json: "[4,9,12]",
        ...overrides
    };
}

test("mergeTags uses two calls, returns stable affected ids, and keeps canonical guards atomic", async () => {
    const db = new FakeDatabase();
    db.firstResults = [mergeSnapshot()];
    db.batchResponses = [
        [
            result(1),
            result(2),
            result(1),
            result(1),
            result(0, [{ source_alias_of_id: 2, target_alias_of_id: null }])
        ]
    ];

    const merged = await mergeTags(asD1(db), 1, 2);

    assert.deepEqual(merged, {
        outcome: "changed",
        impact: {
            eventIds: [4, 9, 12],
            oldDivisionCodes: [],
            newDivisionCodes: [],
            tagsChanged: true
        }
    });
    assert.equal(db.bindingCalls, 2);
    assert.equal(db.batches.length, 1);
    assert.equal(db.batches[0]?.length, 5);
    assert.match(db.prepared[0]?.sql ?? "", /ORDER BY event_tags\.event_id/);

    const [deduplicate, redirect, alias, audit, probe] = db.batches[0] ?? [];
    assert.match(deduplicate?.sql ?? "", /DELETE FROM event_tags/);
    assert.match(
        deduplicate?.sql ?? "",
        /event_id IN \(SELECT event_id FROM event_tags WHERE tag_id = \?\)/
    );
    assert.match(deduplicate?.sql ?? "", /source\.alias_of_id IS NULL/);
    assert.match(deduplicate?.sql ?? "", /target\.alias_of_id IS NULL/);
    assert.deepEqual(deduplicate?.values, [1, 2, 2, 1]);
    assert.match(redirect?.sql ?? "", /UPDATE event_tags[\s\S]*SET tag_id = \?/);
    assert.match(redirect?.sql ?? "", /source\.alias_of_id IS NULL/);
    assert.match(redirect?.sql ?? "", /target\.alias_of_id IS NULL/);
    assert.deepEqual(redirect?.values, [2, 1, 2, 1]);
    assert.match(alias?.sql ?? "", /UPDATE tags[\s\S]*alias_of_id IS NULL/);
    assert.match(alias?.sql ?? "", /target\.alias_of_id IS NULL/);
    assert.deepEqual(alias?.values, [2, 1, 2]);
    assert.match(audit?.sql ?? "", /WHERE changes\(\) > 0/);
    assert.deepEqual(audit?.values, [2, JSON.stringify({ from: 1, to: 2 })]);
    assert.match(probe?.sql ?? "", /source\.alias_of_id AS source_alias_of_id/);
});

test("mergeTags resolves snapshot and concurrent idempotency without duplicate audits", async () => {
    const alreadyDb = new FakeDatabase();
    alreadyDb.firstResults = [mergeSnapshot({ source_alias_of_id: 2 })];
    assert.equal((await mergeTags(asD1(alreadyDb), 1, 2)).outcome, "already-target");
    assert.equal(alreadyDb.bindingCalls, 1);
    assert.equal(alreadyDb.batches.length, 0);

    const conflictDb = new FakeDatabase();
    conflictDb.firstResults = [mergeSnapshot({ target_alias_of_id: 3 })];
    assert.equal((await mergeTags(asD1(conflictDb), 1, 2)).outcome, "conflict");
    assert.equal(conflictDb.bindingCalls, 1);
    assert.equal(conflictDb.batches.length, 0);

    const concurrentDb = new FakeDatabase();
    concurrentDb.firstResults = [mergeSnapshot()];
    concurrentDb.batchResponses = [
        [
            result(0),
            result(0),
            result(0),
            result(0),
            result(0, [{ source_alias_of_id: 2, target_alias_of_id: null }])
        ]
    ];
    assert.equal((await mergeTags(asD1(concurrentDb), 1, 2)).outcome, "already-target");
    assert.equal(concurrentDb.bindingCalls, 2);
    assert.equal(concurrentDb.batches.length, 1);
    assert.equal(concurrentDb.batches[0]?.filter(({ sql }) => /audit_logs/.test(sql)).length, 1);
});

test("mergeTags keeps relationship facts, alias, audit, and probe in one rollback batch", async () => {
    const db = new FakeDatabase();
    db.firstResults = [mergeSnapshot()];
    db.batchResponses = [new Error("D1 batch rolled back")];

    await assert.rejects(() => mergeTags(asD1(db), 1, 2), /D1 batch rolled back/);

    assert.equal(db.bindingCalls, 2);
    assert.equal(db.batches.length, 1);
    assert.equal(db.batches[0]?.length, 5);
    assert.match(db.batches[0]?.[0]?.sql ?? "", /DELETE FROM event_tags/);
    assert.match(db.batches[0]?.[1]?.sql ?? "", /UPDATE event_tags/);
    assert.match(db.batches[0]?.[2]?.sql ?? "", /UPDATE tags/);
    assert.match(db.batches[0]?.[3]?.sql ?? "", /INSERT INTO audit_logs/);
});

test("tag merge route delegates audit ownership to mergeTags", async () => {
    const source = await readFile(
        new URL("../src/pages/api/admin/tags/merge.ts", import.meta.url),
        "utf8"
    );

    assert.match(source, /const result = await mergeTags\(db, from, to\)/);
    assert.match(source, /result\.outcome === "conflict"/);
    assert.match(source, /"Source and target tags must be canonical", 409/);
    assert.match(source, /error instanceof Error \? error\.message : "Failed to merge tags", 500/);
    assert.doesNotMatch(source, /insertAudit/);
});
