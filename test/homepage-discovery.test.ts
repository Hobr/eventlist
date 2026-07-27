import assert from "node:assert/strict";
import test from "node:test";
import type { D1Database } from "../src/types/cloudflare";
import { listHomepageDiscovery, type EventRecord } from "../src/lib/db/queries";

class FakeStatement {
    values: unknown[] = [];

    constructor(readonly sql: string) {}

    bind(...values: unknown[]) {
        this.values = values;
        return this;
    }
}

class FakeDatabase {
    prepared: FakeStatement[] = [];
    batchResults: EventRecord[][] = [];

    prepare(sql: string) {
        const statement = new FakeStatement(sql);
        this.prepared.push(statement);
        return statement;
    }

    async batch(statements: FakeStatement[]) {
        return statements.map((_, index) => ({
            success: true,
            results: this.batchResults[index] ?? [],
            meta: {}
        }));
    }
}

function asD1(db: FakeDatabase) {
    return db as unknown as D1Database;
}

function event(id: number): EventRecord {
    return {
        id,
        title: `活动 ${id}`,
        type: "comic",
        scale: "large",
        division_code: "110101",
        venue: "测试场馆",
        address: null,
        start_date: "2026-07-27",
        end_date: "2026-07-27",
        start_time: "09:00",
        end_time: "18:00",
        cover_url: null,
        description: null,
        qq_group: null,
        ticket_url: null,
        source_url: "https://example.com/source",
        submitter_contact: "test@example.com",
        status: "published",
        reject_reason: null,
        created_at: "2026-07-01 00:00:00",
        updated_at: "2026-07-01 00:00:00",
        published_at: "2026-07-01 00:00:00",
        tag_suggestions: null,
        tags: null
    };
}

test("首页发现查询允许今日主推荐并完整返回今日活动", async () => {
    const db = new FakeDatabase();
    const featured = event(1);
    const today = [featured, event(2)];
    db.batchResults = [[featured], today];

    const result = await listHomepageDiscovery(asD1(db), "11");

    assert.equal(db.prepared.length, 2);
    assert.match(
        db.prepared[0]?.sql ?? "",
        /date\(events\.start_date\) BETWEEN date\('now', '\+8 hours'\)/
    );
    assert.match(db.prepared[0]?.sql ?? "", /AND NOT \(/);
    assert.match(db.prepared[1]?.sql ?? "", /date\(events\.start_date\) <=/);
    assert.match(db.prepared[1]?.sql ?? "", /date\(events\.end_date\) >=/);
    assert.doesNotMatch(db.prepared[1]?.sql ?? "", /events\.end_time IS NOT NULL/);
    assert.doesNotMatch(db.prepared[1]?.sql ?? "", /LIMIT/);
    assert.deepEqual(db.prepared[0]?.values, ["published", "11%"]);
    assert.deepEqual(db.prepared[1]?.values, ["published", "11%"]);
    assert.equal(result.featured?.id, featured.id);
    assert.deepEqual(
        result.today.map((item) => item.id),
        [featured.id, 2]
    );
});
