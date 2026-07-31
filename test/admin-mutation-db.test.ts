import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { editEvent, transitionEventStatus, type AdminEventInput } from "../src/lib/db/admin-events";
import { STATUS } from "../src/lib/db";
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
    batchResults: FakeResult[] = [];
    batchError: Error | null = null;

    prepare(sql: string) {
        const statement = new FakeStatement(this, sql);
        this.prepared.push(statement);
        return statement;
    }

    async batch(statements: FakeStatement[]) {
        this.bindingCalls += 1;
        this.batches.push(statements);
        if (this.batchError) throw this.batchError;
        return this.batchResults;
    }
}

function asD1(db: FakeDatabase) {
    return db as unknown as D1Database;
}

function result(changes = 0, results: unknown[] = []): FakeResult {
    return { success: true, results, meta: { changes } };
}

function transitionDatabase(
    updateChanges: number,
    auditChanges: number,
    probe?: { status: string; division_code: string; has_canonical_tag: number }
) {
    const db = new FakeDatabase();
    db.batchResults = [
        result(updateChanges),
        result(auditChanges),
        result(0, probe ? [probe] : [])
    ];
    return db;
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

test("transitionEventStatus preserves the complete state machine in one D1 batch", async () => {
    const changedDb = transitionDatabase(1, 1, {
        status: STATUS.PUBLISHED,
        division_code: "110101",
        has_canonical_tag: 1
    });
    const changed = await transitionEventStatus(
        asD1(changedDb),
        42,
        STATUS.PENDING,
        STATUS.PUBLISHED
    );
    assert.deepEqual(changed, {
        outcome: "changed",
        impact: {
            eventIds: [42],
            oldDivisionCodes: ["110101"],
            newDivisionCodes: ["110101"],
            oldStatus: STATUS.PENDING,
            newStatus: STATUS.PUBLISHED,
            tagsChanged: false
        }
    });

    const alreadyDb = transitionDatabase(0, 0, {
        status: STATUS.PUBLISHED,
        division_code: "110101",
        has_canonical_tag: 1
    });
    assert.deepEqual(
        await transitionEventStatus(asD1(alreadyDb), 42, STATUS.PENDING, STATUS.PUBLISHED),
        {
            outcome: "already-target",
            impact: {
                eventIds: [],
                oldDivisionCodes: [],
                newDivisionCodes: [],
                tagsChanged: false
            }
        }
    );

    const wrongStatusDb = transitionDatabase(0, 0, {
        status: STATUS.OFFLINE,
        division_code: "110101",
        has_canonical_tag: 1
    });
    assert.equal(
        (await transitionEventStatus(asD1(wrongStatusDb), 42, STATUS.PENDING, STATUS.PUBLISHED))
            .conflict,
        "wrong-status"
    );

    const missingTagDb = transitionDatabase(0, 0, {
        status: STATUS.PENDING,
        division_code: "110101",
        has_canonical_tag: 0
    });
    assert.equal(
        (await transitionEventStatus(asD1(missingTagDb), 42, STATUS.PENDING, STATUS.PUBLISHED))
            .conflict,
        "missing-canonical-tag"
    );

    const missingEventDb = transitionDatabase(0, 0);
    assert.equal(
        (await transitionEventStatus(asD1(missingEventDb), 42, STATUS.PENDING, STATUS.PUBLISHED))
            .conflict,
        "not-found"
    );

    for (const db of [changedDb, alreadyDb, wrongStatusDb, missingTagDb, missingEventDb]) {
        assert.equal(db.bindingCalls, 1);
        assert.equal(db.batches.length, 1);
        assert.equal(db.batches[0]?.length, 3);
    }

    const [update, audit, probe] = changedDb.batches[0] ?? [];
    assert.match(update?.sql ?? "", /AND status = \?/);
    assert.match(update?.sql ?? "", /AND EXISTS \([\s\S]*tags\.alias_of_id IS NULL/);
    assert.deepEqual(update?.values, [STATUS.PUBLISHED, 42, STATUS.PENDING]);
    assert.match(audit?.sql ?? "", /WHERE changes\(\) > 0/);
    assert.deepEqual(audit?.values, ["approve", 42, "{}"]);
    assert.match(probe?.sql ?? "", /AS has_canonical_tag/);
});

test("transitionEventStatus keeps reject metadata in the atomic audit", async () => {
    const db = transitionDatabase(1, 1, {
        status: STATUS.REJECTED,
        division_code: "110101",
        has_canonical_tag: 0
    });

    const transition = await transitionEventStatus(asD1(db), 9, STATUS.PENDING, STATUS.REJECTED, {
        rejectReason: "  来源无法核实  "
    });

    assert.equal(transition.outcome, "changed");
    assert.deepEqual(db.batches[0]?.[0]?.values, [
        STATUS.REJECTED,
        "来源无法核实",
        9,
        STATUS.PENDING
    ]);
    assert.doesNotMatch(db.batches[0]?.[0]?.sql ?? "", /event_tags/);
    assert.deepEqual(db.batches[0]?.[1]?.values, [
        "reject",
        9,
        JSON.stringify({ reject_reason: "来源无法核实" })
    ]);
});

function editDatabase(
    options: {
        status?: string;
        divisionCode?: string;
        updateChanges?: number;
        auditChanges?: number;
        deleteChanges?: number;
        insertChanges?: number;
        probeStatus?: string | null;
    } = {}
) {
    const db = new FakeDatabase();
    db.firstResults = [
        {
            status: options.status ?? STATUS.PUBLISHED,
            division_code: options.divisionCode ?? "110101",
            tag_ids_json: "[1]"
        }
    ];
    const probeStatus =
        options.probeStatus === undefined
            ? (options.status ?? STATUS.PUBLISHED)
            : options.probeStatus;
    db.batchResults = [
        result(options.updateChanges ?? 1),
        result(options.auditChanges ?? 1),
        result(0),
        result(options.deleteChanges ?? 0),
        result(options.insertChanges ?? 0),
        result(0, probeStatus ? [{ status: probeStatus }] : [])
    ];
    return db;
}

test("editEvent uses two fixed D1 calls and preserves unchanged relationships", async () => {
    for (const tags of [["同人展"], Array.from({ length: 12 }, (_, index) => `标签${index + 1}`)]) {
        const db = editDatabase();
        const edit = await editEvent(asD1(db), 42, { ...VALID_EVENT, tags });

        assert.equal(db.bindingCalls, 2);
        assert.equal(db.batches.length, 1);
        assert.equal(db.batches[0]?.length, 6);
        assert.equal(edit.outcome, "changed");
        assert.deepEqual(edit.impact, {
            eventIds: [42],
            oldDivisionCodes: ["110101"],
            newDivisionCodes: ["310101"],
            oldStatus: STATUS.PUBLISHED,
            newStatus: STATUS.PUBLISHED,
            tagsChanged: false
        });

        const [update, audit, tagUpsert, relationDelete, relationInsert] = db.batches[0] ?? [];
        const tagsJson = JSON.stringify(tags);
        assert.match(update?.sql ?? "", /WHERE id = \?[\s\S]*AND status = \?/);
        assert.deepEqual(update?.values.slice(15, 21), [
            "测试主办方",
            null,
            "ticket",
            "免费",
            "2026-07-20",
            "09:30"
        ]);
        assert.match(audit?.sql ?? "", /WHERE changes\(\) > 0/);
        assert.match(
            tagUpsert?.sql ?? "",
            /INSERT OR IGNORE INTO tags\(name\)[\s\S]*json_each\(\?\)/
        );
        assert.match(relationDelete?.sql ?? "", /tag_id NOT IN \([\s\S]*json_each\(\?\)/);
        assert.match(relationInsert?.sql ?? "", /COALESCE\(tags\.alias_of_id, tags\.id\)/);
        assert.equal(tagUpsert?.values[0], tagsJson);
        assert.equal(relationDelete?.values[3], tagsJson);
        assert.equal(relationInsert?.values[1], tagsJson);
        assert.doesNotMatch(
            relationDelete?.sql ?? "",
            /^\s*DELETE FROM event_tags WHERE event_id = \?\s*$/
        );
    }
});

test("editEvent reports only actual relationship diffs and handles conflicts", async () => {
    const changedTagsDb = editDatabase({ deleteChanges: 1, insertChanges: 1 });
    const changedTags = await editEvent(asD1(changedTagsDb), 42, {
        ...VALID_EVENT,
        tags: ["同人展", "新标签"]
    });
    assert.equal(changedTags.impact.tagsChanged, true);

    const conflictDb = editDatabase({
        updateChanges: 0,
        auditChanges: 0,
        probeStatus: STATUS.OFFLINE
    });
    const conflict = await editEvent(asD1(conflictDb), 42, VALID_EVENT);
    assert.equal(conflict.outcome, "conflict");
    assert.deepEqual(conflict.impact.eventIds, []);

    const missingDb = new FakeDatabase();
    missingDb.firstResults = [null];
    const missing = await editEvent(asD1(missingDb), 42, VALID_EVENT);
    assert.equal(missing.outcome, "not-found");
    assert.equal(missingDb.bindingCalls, 1);
    assert.equal(missingDb.batches.length, 0);

    const emptyPublishedDb = editDatabase();
    await assert.rejects(
        () => editEvent(asD1(emptyPublishedDb), 42, { ...VALID_EVENT, tags: [] }),
        /已发布或已下线活动必须至少保留一个规范标签/
    );
    assert.equal(emptyPublishedDb.bindingCalls, 1);
    assert.equal(emptyPublishedDb.batches.length, 0);
});

test("editEvent keeps facts, relationship diffs, and audit inside one rollback boundary", async () => {
    const db = editDatabase();
    db.batchError = new Error("D1 batch rolled back");

    await assert.rejects(() => editEvent(asD1(db), 42, VALID_EVENT), /D1 batch rolled back/);

    assert.equal(db.bindingCalls, 2);
    assert.equal(db.batches.length, 1);
    assert.equal(db.batches[0]?.length, 6);
    assert.match(db.batches[0]?.[0]?.sql ?? "", /UPDATE events/);
    assert.match(db.batches[0]?.[1]?.sql ?? "", /INSERT INTO audit_logs/);
    assert.match(db.batches[0]?.[3]?.sql ?? "", /DELETE FROM event_tags/);
    assert.match(db.batches[0]?.[4]?.sql ?? "", /INSERT OR IGNORE INTO event_tags/);
});

test("admin routes preserve HTTP outcome mapping without separate audit calls", async () => {
    const [approve, reject, offline, republish, edit] = await Promise.all(
        [
            "../src/pages/api/admin/events/[id]/approve.ts",
            "../src/pages/api/admin/events/[id]/reject.ts",
            "../src/pages/api/admin/events/[id]/offline.ts",
            "../src/pages/api/admin/events/[id]/republish.ts",
            "../src/pages/api/admin/events/[id]/index.ts"
        ].map((path) => readFile(new URL(path, import.meta.url), "utf8"))
    );

    for (const source of [approve, reject, offline, republish]) {
        assert.match(source, /transitionEventStatus\(/);
        assert.doesNotMatch(source, /hasCanonicalEventTag|updateEventStatus|insertAudit/);
        assert.match(source, /result\.outcome === "conflict"[\s\S]*409/);
    }
    assert.match(approve, /result\.conflict === "missing-canonical-tag"/);
    assert.match(republish, /result\.conflict === "missing-canonical-tag"/);
    assert.match(edit, /result\.outcome === "not-found"[\s\S]*404/);
    assert.match(edit, /result\.outcome === "conflict"[\s\S]*409/);
    assert.match(edit, /error instanceof AdminEventMutationValidationError[\s\S]*400/);
    assert.match(edit, /error instanceof Error \? error\.message : "Failed to update event", 500/);
    assert.doesNotMatch(edit, /insertAudit/);
});
