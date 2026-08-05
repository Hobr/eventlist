import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getDB } from "../src/lib/db";
import { listHomepageDiscovery, listHomepagePopularity } from "../src/lib/db/homepage";
import {
    getPublicEvent,
    listPublishedEvents,
    listPublishedEventSitemapRows,
    type PublicEventDatabaseRow,
    type PublicEventDetail,
    type PublicEventRow
} from "../src/lib/db/public-events";
import * as compatibilityQueries from "../src/lib/db/queries";
import {
    deleteExpiredEventVisitors,
    getPublicEventRecentVisitorCount,
    recordEventView
} from "../src/lib/db/views";
import type { D1Database } from "../src/types/cloudflare";

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
        return this.db.firstResult as T | null;
    }

    async all<T>() {
        return this.db.allResult as {
            success: boolean;
            results: T[];
            meta: Record<string, unknown>;
        };
    }

    async run() {
        return this.db.runResult;
    }
}

class FakeDatabase {
    prepared: FakeStatement[] = [];
    batches: FakeStatement[][] = [];
    execCalls = 0;
    firstResult: unknown = null;
    allResult: {
        success: boolean;
        results: unknown[];
        meta: Record<string, unknown>;
    } = { success: true, results: [], meta: {} };
    runResult = { success: true, meta: { changes: 0 } };
    batchResults: Array<{
        success: boolean;
        results?: unknown[];
        meta: { changes?: number };
    }> = [];

    prepare(sql: string) {
        const statement = new FakeStatement(this, sql);
        this.prepared.push(statement);
        return statement;
    }

    async exec() {
        this.execCalls += 1;
        throw new Error("getDB must not execute statements");
    }

    async batch(statements: FakeStatement[]) {
        this.batches.push(statements);
        return this.batchResults;
    }
}

function asD1(db: FakeDatabase) {
    return db as unknown as D1Database;
}

interface UnsafePublicEventDatabaseRow extends PublicEventDatabaseRow {
    submitter_contact: string;
    tag_suggestions: string;
    reject_reason: string;
    created_at: string;
    published_at: string;
    visitor_key: string;
    last_seen_date: string;
    audit_action: string;
    audit_meta: string;
}

const PRIVATE_OUTPUT_FIELDS = [
    "submitter_contact",
    "tag_suggestions",
    "reject_reason",
    "created_at",
    "published_at",
    "visitor_key",
    "last_seen_date",
    "audit_action",
    "audit_meta"
] as const;

function databaseEvent(id = 42): UnsafePublicEventDatabaseRow {
    return {
        id,
        title: `活动 ${id}`,
        type: "comic",
        scale: "large",
        division_code: "110101",
        venue: "测试场馆",
        address: "测试地址",
        start_date: "2026-07-28",
        end_date: "2026-07-29",
        start_time: "09:00",
        end_time: "18:00",
        cover_url: "https://example.com/cover.webp",
        description: "公开活动介绍",
        qq_group: "123456",
        ticket_url: "https://example.com/tickets",
        source_url: "https://example.com/source",
        organizer: "测试主办方",
        schedule_status: "postponed",
        admission_method: "reservation",
        price_range: "免费",
        admission_start_date: "2026-07-20",
        admission_start_time: "09:30",
        status: "published",
        updated_at: "2026-07-28 08:00:00",
        tags: "同人展、游戏展",
        submitter_contact: "secret@example.com",
        tag_suggestions: "内部标签建议",
        reject_reason: "内部审核原因",
        created_at: "2026-07-01 00:00:00",
        published_at: "2026-07-02 00:00:00",
        visitor_key: "private-visitor-key",
        last_seen_date: "2026-07-28",
        audit_action: "approve",
        audit_meta: '{"actor":"private"}'
    };
}

function expectedPublicRow(id = 42): PublicEventRow {
    return {
        id,
        title: `活动 ${id}`,
        type: "comic",
        scale: "large",
        division_code: "110101",
        venue: "测试场馆",
        start_date: "2026-07-28",
        end_date: "2026-07-29",
        start_time: "09:00",
        end_time: "18:00",
        cover_url: "https://example.com/cover.webp",
        tags: "同人展、游戏展"
    };
}

function expectedPublicDetail(id = 42): PublicEventDetail {
    return {
        ...expectedPublicRow(id),
        address: "测试地址",
        description: "公开活动介绍",
        qq_group: "123456",
        ticket_url: "https://example.com/tickets",
        source_url: "https://example.com/source",
        organizer: "测试主办方",
        schedule_status: "postponed",
        admission_method: "reservation",
        price_range: "免费",
        admission_start_date: "2026-07-20",
        admission_start_time: "09:30",
        status: "published",
        updated_at: "2026-07-28 08:00:00"
    };
}

function expectedRankedEvent(id: number, visitors: number) {
    return {
        id,
        title: `活动 ${id}`,
        scale: "large",
        division_code: "110101",
        start_date: "2026-07-28",
        end_date: "2026-07-29",
        start_time: "09:00",
        end_time: "18:00",
        admission_start_date: "2026-07-20",
        admission_start_time: "09:30",
        unique_visitors: visitors
    };
}

function assertJsonRoundTrip(value: unknown) {
    assert.deepEqual(JSON.parse(JSON.stringify(value)), value);
}

function assertPrivateFieldsAbsent(value: unknown) {
    const json = JSON.stringify(value);
    for (const field of PRIVATE_OUTPUT_FIELDS) {
        assert.doesNotMatch(json, new RegExp(`"${field}"`));
    }
}

function assertExplicitPublicEventSql(sql: string) {
    assert.doesNotMatch(sql, /events\s*\.\s*\*/i);
    assert.doesNotMatch(
        sql,
        /events\.(?:submitter_contact|tag_suggestions|reject_reason|created_at|published_at)\b/i
    );
}

test("getDB synchronously returns the binding without executing a statement", () => {
    const db = new FakeDatabase();
    const binding = asD1(db);

    const result = getDB({ DB: binding });

    assert.equal(result, binding);
    assert.equal(db.execCalls, 0);
    assert.equal(result instanceof Promise, false);
    assert.throws(() => getDB({}), /D1 binding DB is not configured/);
});

test("public loaders whitelist list, homepage, popularity, and detail DTOs", async () => {
    const listDb = new FakeDatabase();
    listDb.allResult.results = [databaseEvent(1)];
    const page = await listPublishedEvents(asD1(listDb), { timing: "all" });
    assert.deepEqual(page.events, [expectedPublicRow(1)]);

    const detailDb = new FakeDatabase();
    detailDb.firstResult = databaseEvent(2);
    const detail = await getPublicEvent(asD1(detailDb), 2);
    assert.deepEqual(detail, expectedPublicDetail(2));

    const discoveryDb = new FakeDatabase();
    discoveryDb.allResult.results = [databaseEvent(3)];
    const discovery = await listHomepageDiscovery(asD1(discoveryDb), "110101");
    assert.deepEqual(discovery, { featuredEvents: [expectedPublicRow(3)] });
    assert.equal(discoveryDb.batches.length, 0);

    const popularityDb = new FakeDatabase();
    popularityDb.batchResults = [
        {
            success: true,
            results: [{ ...databaseEvent(5), unique_visitors: 12 }],
            meta: {}
        },
        {
            success: true,
            results: [{ ...databaseEvent(6), unique_visitors: 34 }],
            meta: {}
        },
        {
            success: true,
            results: [{ ...databaseEvent(7), unique_visitors: 56 }],
            meta: {}
        },
        {
            success: true,
            results: [{ ...databaseEvent(8), unique_visitors: 78 }],
            meta: {}
        }
    ];
    const popularity = await listHomepagePopularity(asD1(popularityDb), "110101", 7);
    assert.deepEqual(popularity, {
        window: 7,
        unopened: {
            local: [expectedRankedEvent(5, 12)],
            nationwide: [expectedRankedEvent(6, 34)]
        },
        unended: {
            local: [expectedRankedEvent(7, 56)],
            nationwide: [expectedRankedEvent(8, 78)]
        }
    });
    assert.equal(popularityDb.batches.length, 1);
    assert.equal(popularityDb.batches[0]?.length, 4);

    for (const value of [page, detail, discovery, popularity]) {
        assertJsonRoundTrip(value);
        assertPrivateFieldsAbsent(value);
    }
});

test("public SQL uses explicit safe projections and detail filters public statuses in SQL", async () => {
    const listDb = new FakeDatabase();
    await listPublishedEvents(asD1(listDb), {
        timing: "ended",
        divisionCode: "110101",
        from: "2026-07-01",
        to: "2026-07-31",
        starts: "2026-07-28",
        active: "2026-07-28",
        sort: "end_desc"
    });
    const listSql = listDb.prepared[0]?.sql ?? "";
    assert.match(listSql, /events\.start_date >= \?/);
    assert.match(listSql, /events\.end_date <= \?/);
    assert.match(listSql, /events\.start_date = \?/);
    assert.match(listSql, /events\.start_date <= \?/);
    assert.match(listSql, /events\.end_date >= \?/);
    assert.match(listSql, /ORDER BY events\.end_date DESC, events\.id DESC/);

    const discoveryDb = new FakeDatabase();
    await listHomepageDiscovery(asD1(discoveryDb), "110101");

    const popularityDb = new FakeDatabase();
    popularityDb.batchResults = [
        { success: true, results: [], meta: {} },
        { success: true, results: [], meta: {} },
        { success: true, results: [], meta: {} },
        { success: true, results: [], meta: {} }
    ];
    await listHomepagePopularity(asD1(popularityDb), "110101", 7);
    for (const statement of popularityDb.prepared) {
        assert.match(statement.sql, /WHERE last_seen_date BETWEEN date\('now', '\+8 hours', \?\)/);
        assert.match(statement.sql, /LEFT JOIN recent_visitors/);
        assert.match(statement.sql, /COALESCE\(recent_visitors\.unique_visitors, 0\)/);
    }
    assert.match(popularityDb.prepared[0]?.sql ?? "", /events\.admission_start_date ASC/);
    assert.match(popularityDb.prepared[2]?.sql ?? "", /events\.start_date ASC/);

    const detailDb = new FakeDatabase();
    await getPublicEvent(asD1(detailDb), 42);
    const detailSql = detailDb.prepared[0]?.sql ?? "";
    assert.match(detailSql, /events\.status IN \(\?, \?\)/);
    assert.deepEqual(detailDb.prepared[0]?.values, [42, "published", "offline"]);

    const heatDb = new FakeDatabase();
    heatDb.firstResult = { unique_visitors: 0 };
    assert.equal(await getPublicEventRecentVisitorCount(asD1(heatDb), 42), 0);
    const heatSql = heatDb.prepared[0]?.sql ?? "";
    assert.match(
        heatSql,
        /last_seen_date BETWEEN date\('now', '\+8 hours', '-29 days'\)\s+AND date\('now', '\+8 hours'\)/
    );
    assert.doesNotMatch(heatSql, /SELECT[\s\S]*visitor_key/i);
    assert.deepEqual(heatDb.prepared[0]?.values, [42, "published", "offline"]);

    for (const statement of [
        ...listDb.prepared,
        ...discoveryDb.prepared,
        ...popularityDb.prepared,
        ...detailDb.prepared,
        ...heatDb.prepared
    ]) {
        assertExplicitPublicEventSql(statement.sql);
    }

    const sitemapDb = new FakeDatabase();
    await listPublishedEventSitemapRows(asD1(sitemapDb));
    assert.match(sitemapDb.prepared[0]?.sql ?? "", /ORDER BY updated_at DESC/);

    const [publicEventsSource, homepageSource, viewsSource] = await Promise.all(
        [
            "../src/lib/db/public-events.ts",
            "../src/lib/db/homepage.ts",
            "../src/lib/db/views.ts"
        ].map((path) => readFile(new URL(path, import.meta.url), "utf8"))
    );
    const publicQuerySources = `${publicEventsSource}\n${homepageSource}\n${viewsSource}`;
    assert.doesNotMatch(publicQuerySources, /date\(events\.(?:start_date|end_date)\)/);
    assert.doesNotMatch(publicQuerySources, /time\(events\.(?:start_time|end_time)\)/);
    assert.doesNotMatch(publicQuerySources, /date\(last_seen_date\)/);
    assert.doesNotMatch(publicQuerySources, /datetime\(updated_at\)/);
});

test("queries compatibility entrypoint contains only re-exports", async () => {
    const source = await readFile(new URL("../src/lib/db/queries.ts", import.meta.url), "utf8");
    const lines = source
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    assert.deepEqual(lines, [
        'export * from "./admin-events";',
        'export * from "./homepage";',
        'export * from "./public-events";',
        'export * from "./submissions";',
        'export * from "./tags";',
        'export * from "./views";'
    ]);
    assert.equal(compatibilityQueries.listPublishedEvents, listPublishedEvents);
    assert.equal(compatibilityQueries.listHomepageDiscovery, listHomepageDiscovery);
    assert.equal(compatibilityQueries.recordEventView, recordEventView);
});

test("route loaders preserve independent parallel reads", async () => {
    const [homepagePage, homepageApi, eventsPage] = await Promise.all(
        [
            "../src/pages/index.astro",
            "../src/pages/api/homepage.ts",
            "../src/pages/events/index.astro"
        ].map((path) => readFile(new URL(path, import.meta.url), "utf8"))
    );

    assert.match(homepagePage, /Promise\.allSettled\(\[/);
    assert.match(homepageApi, /Promise\.all\(\[/);
    assert.match(eventsPage, /Promise\.all\(\[/);
});

function viewDatabase(changes: number, current: boolean) {
    const db = new FakeDatabase();
    db.batchResults = [
        { success: true, meta: { changes } },
        {
            success: true,
            results: current ? [{ current: 1 }] : [],
            meta: {}
        }
    ];
    return db;
}

test("recordEventView returns changed, already-current, and ignored without request cleanup", async () => {
    const changedDb = viewDatabase(1, true);
    assert.equal(await recordEventView(asD1(changedDb), 42, "a".repeat(64)), "changed");

    const currentDb = viewDatabase(0, true);
    assert.equal(await recordEventView(asD1(currentDb), 42, "b".repeat(64)), "already-current");

    const ignoredDb = viewDatabase(0, false);
    assert.equal(await recordEventView(asD1(ignoredDb), 42, "c".repeat(64)), "ignored");

    assert.equal(changedDb.batches.length, 1);
    assert.equal(changedDb.batches[0]?.length, 2);
    assert.doesNotMatch(changedDb.prepared.map(({ sql }) => sql).join("\n"), /DELETE FROM/);
    assert.match(changedDb.prepared[0]?.sql ?? "", /INSERT INTO event_visitors/);
    assert.match(changedDb.prepared[1]?.sql ?? "", /event_visitors\.last_seen_date = date/);
    assert.match(changedDb.prepared[1]?.sql ?? "", /events\.status = \?/);
});

test("deleteExpiredEventVisitors uses the recent-date index comparison boundary", async () => {
    const db = new FakeDatabase();
    db.runResult = { success: true, meta: { changes: 7 } };

    const deleted = await deleteExpiredEventVisitors(asD1(db));

    assert.equal(deleted, 7);
    assert.match(
        db.prepared[0]?.sql ?? "",
        /WHERE last_seen_date < date\('now', '\+8 hours', '-29 days'\)/
    );
    assert.doesNotMatch(db.prepared[0]?.sql ?? "", /date\(last_seen_date\)/);
});

test("custom Worker entrypoint delegates fetch and schedules one daily cleanup", async () => {
    const [workerSource, wranglerSource] = await Promise.all([
        readFile(new URL("../src/worker.ts", import.meta.url), "utf8"),
        readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8")
    ]);

    assert.match(workerSource, /import \{ handle \} from "@astrojs\/cloudflare\/handler"/);
    assert.match(workerSource, /fetch: handle/);
    assert.match(workerSource, /async scheduled/);
    assert.match(workerSource, /deleteExpiredEventVisitors\(getDB\(\{ DB: env\.DB \}\)\)/);
    assert.match(workerSource, /event_visitors_cleanup/);
    assert.doesNotMatch(workerSource, /visitorKey|CF-Connecting-IP|VIEW_HASH_SECRET/);
    assert.match(wranglerSource, /"main": "\.\/src\/worker\.ts"/);
    assert.match(wranglerSource, /"crons"\s*:\s*\[\s*"5 16 \* \* \*"\s*\]/);
});
