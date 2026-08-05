import assert from "node:assert/strict";
import test from "node:test";
import { listHomepagePopularity } from "../src/lib/db/homepage";
import { SqliteD1TestDatabase } from "./helpers/sqlite-d1";

function insertEvent(
    database: SqliteD1TestDatabase,
    options: {
        id: number;
        division?: string;
        status?: string;
        startOffset: number;
        endOffset: number;
        admissionOffset?: number;
        admissionTimeSql?: string;
    }
) {
    const admissionDateSql =
        options.admissionOffset === undefined
            ? "NULL"
            : `date('now', '+8 hours', '${options.admissionOffset} days')`;
    database.run(
        `INSERT INTO events(
             id, title, scale, division_code, start_date, end_date, start_time, end_time,
             admission_start_date, admission_start_time, status
         ) VALUES (
             ?, ?, 'large', ?,
             date('now', '+8 hours', '${options.startOffset} days'),
             date('now', '+8 hours', '${options.endOffset} days'),
             NULL, NULL, ${admissionDateSql}, ${options.admissionTimeSql ?? "NULL"}, ?
         )`,
        options.id,
        `活动 ${options.id}`,
        options.division ?? "110101",
        options.status ?? "published"
    );
}

function addVisitors(database: SqliteD1TestDatabase, eventId: number, count: number) {
    for (let index = 0; index < count; index += 1) {
        database.run(
            "INSERT INTO event_visitors(event_id, visitor_key, last_seen_date) VALUES (?, ?, date('now', '+8 hours'))",
            eventId,
            `${eventId}-${index}`
        );
    }
}

test("首页四榜包含零热度活动并执行未开票和未结束边界", async () => {
    const database = new SqliteD1TestDatabase();
    try {
        database.execScript(`
            CREATE TABLE events (
                id INTEGER PRIMARY KEY,
                title TEXT NOT NULL,
                scale TEXT NOT NULL,
                division_code TEXT NOT NULL,
                start_date TEXT NOT NULL,
                end_date TEXT NOT NULL,
                start_time TEXT,
                end_time TEXT,
                admission_start_date TEXT,
                admission_start_time TEXT,
                status TEXT NOT NULL
            );
            CREATE TABLE event_visitors (
                event_id INTEGER NOT NULL,
                visitor_key TEXT NOT NULL,
                last_seen_date TEXT NOT NULL,
                PRIMARY KEY (event_id, visitor_key)
            );
            CREATE INDEX idx_event_visitors_recent
                ON event_visitors(last_seen_date, event_id);
        `);

        insertEvent(database, { id: 1, startOffset: 10, endOffset: 11, admissionOffset: 1 });
        insertEvent(database, { id: 2, startOffset: 5, endOffset: 6, admissionOffset: 0 });
        insertEvent(database, {
            id: 3,
            division: "310101",
            startOffset: 4,
            endOffset: 5,
            admissionOffset: 1
        });
        insertEvent(database, {
            id: 4,
            startOffset: -1,
            endOffset: 1,
            admissionOffset: 0,
            admissionTimeSql: "strftime('%H:%M', 'now', '+8 hours')"
        });
        insertEvent(database, { id: 5, startOffset: 1, endOffset: 2, admissionOffset: 15 });
        insertEvent(database, { id: 6, startOffset: -3, endOffset: -1, admissionOffset: 1 });
        insertEvent(database, {
            id: 7,
            status: "pending",
            startOffset: 1,
            endOffset: 2,
            admissionOffset: 1
        });
        insertEvent(database, { id: 8, startOffset: 2, endOffset: 3 });

        addVisitors(database, 1, 2);
        addVisitors(database, 3, 3);
        addVisitors(database, 4, 1);
        addVisitors(database, 6, 4);
        addVisitors(database, 7, 5);

        const result = await listHomepagePopularity(database.binding, "11", 7);

        assert.deepEqual(
            result.unopened.local.map(({ id, unique_visitors }) => ({ id, unique_visitors })),
            [
                { id: 1, unique_visitors: 2 },
                { id: 2, unique_visitors: 0 }
            ]
        );
        assert.deepEqual(
            result.unopened.nationwide
                .slice(0, 3)
                .map(({ id, unique_visitors }) => ({ id, unique_visitors })),
            [
                { id: 3, unique_visitors: 3 },
                { id: 1, unique_visitors: 2 },
                { id: 2, unique_visitors: 0 }
            ]
        );
        assert.deepEqual(
            result.unended.local.map(({ id, unique_visitors }) => ({ id, unique_visitors })),
            [
                { id: 1, unique_visitors: 2 },
                { id: 4, unique_visitors: 1 },
                { id: 5, unique_visitors: 0 },
                { id: 8, unique_visitors: 0 },
                { id: 2, unique_visitors: 0 }
            ]
        );
        assert.equal(
            result.unopened.local.some(({ id }) => id === 4),
            false
        );
        assert.equal(
            result.unopened.local.some(({ id }) => id === 5),
            false
        );
        assert.equal(
            result.unended.local.some(({ id }) => id === 6 || id === 7),
            false
        );
    } finally {
        database.close();
    }
});

test("首页四榜使用一个 batch 和受控稳定 SQL", async () => {
    const database = new SqliteD1TestDatabase();
    try {
        database.execScript(`
            CREATE TABLE events (
                id INTEGER PRIMARY KEY,
                title TEXT NOT NULL,
                scale TEXT NOT NULL,
                division_code TEXT NOT NULL,
                start_date TEXT NOT NULL,
                end_date TEXT NOT NULL,
                start_time TEXT,
                end_time TEXT,
                admission_start_date TEXT,
                admission_start_time TEXT,
                status TEXT NOT NULL
            );
            CREATE TABLE event_visitors (
                event_id INTEGER NOT NULL,
                visitor_key TEXT NOT NULL,
                last_seen_date TEXT NOT NULL
            );
        `);

        await listHomepagePopularity(database.binding, "1101", 30);

        assert.equal(database.prepared.length, 4);
        for (const statement of database.prepared) {
            assert.match(statement.sql, /LEFT JOIN recent_visitors/);
            assert.match(statement.sql, /COALESCE\(recent_visitors\.unique_visitors, 0\) DESC/);
            assert.match(statement.sql, /events\.id ASC\s+LIMIT 5\s*$/);
            assert.equal(statement.sql.match(/\bLIMIT\b/g)?.length, 1);
        }
        assert.match(database.prepared[0]!.sql, /admission_start_date IS NOT NULL/);
        assert.match(database.prepared[0]!.sql, /date\('now', '\+8 hours', '\+14 days'\)/);
        assert.match(
            database.prepared[0]!.sql,
            /admission_start_time > time\('now', '\+8 hours'\)/
        );
        assert.match(database.prepared[2]!.sql, /WHEN events\.start_date < date\('now'/);
        assert.deepEqual(database.prepared[0]!.values, ["-29 days", "published", "1101%"]);
        assert.deepEqual(database.prepared[1]!.values, ["-29 days", "published"]);
    } finally {
        database.close();
    }
});
