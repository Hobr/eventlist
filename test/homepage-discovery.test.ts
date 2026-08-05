import assert from "node:assert/strict";
import test from "node:test";
import { listHomepageDiscovery } from "../src/lib/db/homepage";
import type { PublicEventDatabaseRow } from "../src/lib/db/public-events";
import type { D1Database } from "../src/types/cloudflare";

class FakeStatement {
    values: unknown[] = [];

    constructor(
        readonly sql: string,
        private readonly results: PublicEventDatabaseRow[]
    ) {}

    bind(...values: unknown[]) {
        this.values = values;
        return this;
    }

    async all() {
        return { success: true, results: this.results, meta: {} };
    }
}

class FakeDatabase {
    prepared: FakeStatement[] = [];
    results: PublicEventDatabaseRow[] = [];

    prepare(sql: string) {
        const statement = new FakeStatement(sql, this.results);
        this.prepared.push(statement);
        return statement;
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

test("首页发现只查询最多五条进行中优先候选", async () => {
    const db = new FakeDatabase();
    db.results = [event(1), event(2), event(3)];

    const result = await listHomepageDiscovery(asD1(db), "11");

    assert.equal(db.prepared.length, 1);
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
    assert.doesNotMatch(featuredSql, /today/);
    assert.deepEqual(db.prepared[0]?.values, ["published", "11%"]);
    assert.deepEqual(
        result.featuredEvents.map((item) => item.id),
        [1, 2, 3]
    );
});

test("首页发现可以固定同一次缓存加载使用的中国日期", async () => {
    const db = new FakeDatabase();

    await listHomepageDiscovery(asD1(db), "11", "2026-08-01");

    assert.equal(db.prepared.length, 1);
    const statement = db.prepared[0]!;
    assert.match(statement.sql, /WITH cache_clock\(as_of_date\) AS \(VALUES \(\?\)\)/);
    assert.match(statement.sql, /SELECT as_of_date FROM cache_clock/);
    assert.deepEqual(statement.values, ["2026-08-01", "published", "11%"]);
    await assert.rejects(
        listHomepageDiscovery(asD1(new FakeDatabase()), "11", "2026-02-30"),
        /canonical date/
    );
});
