import assert from "node:assert/strict";
import test from "node:test";
import type { D1Database } from "../src/types/cloudflare";
import { listHomepageDiscovery } from "../src/lib/db/homepage";
import type { PublicEventDatabaseRow } from "../src/lib/db/public-events";

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
    batchResults: PublicEventDatabaseRow[][] = [];

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

function event(id: number): PublicEventDatabaseRow {
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
        organizer: null,
        schedule_status: null,
        admission_method: null,
        price_range: null,
        admission_start_date: null,
        admission_start_time: null,
        status: "published",
        updated_at: "2026-07-01 00:00:00",
        tags: null
    };
}

test("首页发现查询返回最多五条进行中优先候选, 并将今日活动限制为 10 条", async () => {
    const db = new FakeDatabase();
    const featuredEvents = [event(1), event(2), event(3)];
    const today = [featuredEvents[0], event(4)];
    db.batchResults = [featuredEvents, today];

    const result = await listHomepageDiscovery(asD1(db), "11");

    assert.equal(db.prepared.length, 2);
    const featuredSql = db.prepared[0]?.sql ?? "";
    assert.match(featuredSql, /AND NOT \(/);
    assert.match(featuredSql, /events\.start_date <= date\('now', '\+8 hours', '\+14 days'\)/);
    assert.doesNotMatch(featuredSql, /events\.start_date >=/);
    assert.doesNotMatch(featuredSql, /\bBETWEEN\b/);
    assert.match(featuredSql, /WHEN events\.start_date < date\('now', '\+8 hours'\) THEN 0/);
    assert.match(featuredSql, /events\.start_time IS NULL/);
    assert.match(featuredSql, /events\.start_time <= time\('now', '\+8 hours'\)/);
    assert.match(featuredSql, /CASE events\.scale[\s\S]*END DESC,[\s\S]*events\.start_date ASC/);
    assert.match(featuredSql, /cover_url[\s\S]*DESC,[\s\S]*events\.id ASC\s+LIMIT 5\s*$/);
    const todaySql = db.prepared[1]?.sql ?? "";
    assert.match(todaySql, /events\.division_code LIKE \?/);
    assert.match(todaySql, /events\.start_date <=/);
    assert.match(todaySql, /events\.end_date >=/);
    assert.match(todaySql, /ORDER BY CASE/);
    assert.match(todaySql, /WHEN events\.start_date < date\('now', '\+8 hours'\) THEN 0/);
    assert.match(todaySql, /WHEN events\.start_date = date\('now', '\+8 hours'\)/);
    assert.match(todaySql, /CASE events\.scale/);
    assert.match(todaySql, /events\.id ASC\s+LIMIT 10\s*$/);
    assert.equal(todaySql.match(/\bLIMIT\b/g)?.length, 1);
    assert.doesNotMatch(todaySql, /events\.end_time IS NOT NULL/);
    assert.deepEqual(db.prepared[0]?.values, ["published", "11%"]);
    assert.deepEqual(db.prepared[1]?.values, ["published", "11%"]);
    assert.deepEqual(
        result.featuredEvents.map((item) => item.id),
        [1, 2, 3]
    );
    assert.deepEqual(
        result.today.map((item) => item.id),
        [1, 4]
    );
});
