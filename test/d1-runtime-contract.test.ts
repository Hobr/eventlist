import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
    editEvent,
    mergeTags,
    transitionEventStatus,
    type AdminEventInput
} from "../src/lib/db/admin-events";
import { listHomepagePopularity } from "../src/lib/db/homepage";
import { STATUS, type EventStatus } from "../src/lib/db";
import { listPublishedEvents, listPublishedEventSitemapRows } from "../src/lib/db/public-events";
import { deleteExpiredEventVisitors, recordEventView } from "../src/lib/db/views";
import { isCanonicalDate } from "../src/lib/events/datetime";
import { SqliteD1TestDatabase } from "./helpers/sqlite-d1";

const VALID_EVENT: AdminEventInput = {
    title: "测试活动",
    type: "comic",
    scale: "large",
    division_code: "110101",
    venue: "测试场馆",
    address: "测试地址",
    start_date: "2099-08-01",
    end_date: "2099-08-02",
    start_time: "09:00",
    end_time: "18:00",
    cover_url: "https://example.com/cover.webp",
    description: "活动描述",
    qq_group: "123456",
    ticket_url: "https://example.com/tickets",
    source_url: "https://example.com/source",
    submitter_contact: "admin@example.com",
    tags: ["同人展"]
};

async function createDatabase() {
    const database = new SqliteD1TestDatabase();
    database.execScript(
        await readFile(new URL("../migrations/0001_init.sql", import.meta.url), "utf8")
    );
    return database;
}

async function createSeededDatabase() {
    const database = await createDatabase();
    database.execScript(
        await readFile(new URL("../docs/dev/seed-public-site.sql", import.meta.url), "utf8")
    );
    return database;
}

const LEGACY_EVENT_ENDED_CLAUSE = `(
    date(events.end_date) < date('now', '+8 hours')
    OR (
        date(events.end_date) = date('now', '+8 hours')
        AND events.end_time IS NOT NULL
        AND time(events.end_time) <= time('now', '+8 hours')
    )
)`;

function legacyListPage(
    database: SqliteD1TestDatabase,
    options: {
        timing: "upcoming" | "ended" | "all";
        divisionCode?: string;
        page: number;
        pageSize: number;
        sort: "start_asc" | "start_desc" | "end_desc";
    }
) {
    const clauses = ["events.status = ?"];
    const values: Array<string | number> = [STATUS.PUBLISHED];
    if (options.timing === "ended") clauses.push(LEGACY_EVENT_ENDED_CLAUSE);
    if (options.timing === "upcoming") clauses.push(`NOT ${LEGACY_EVENT_ENDED_CLAUSE}`);
    if (options.divisionCode) {
        const exact = options.divisionCode.length === 6 || options.divisionCode.length === 12;
        clauses.push(`events.division_code ${exact ? "=" : "LIKE"} ?`);
        values.push(exact ? options.divisionCode : `${options.divisionCode}%`);
    }

    const orderBy =
        options.sort === "end_desc"
            ? "date(events.end_date) DESC, events.id DESC"
            : `date(events.start_date) ${options.sort === "start_desc" ? "DESC" : "ASC"}, events.id ${options.sort === "start_desc" ? "DESC" : "ASC"}`;
    const rows = database.all<{ id: number }>(
        `SELECT events.id
         FROM events
         WHERE ${clauses.join(" AND ")}
         ORDER BY ${orderBy}
         LIMIT ? OFFSET ?`,
        ...values,
        options.pageSize + 1,
        (options.page - 1) * options.pageSize
    );

    return {
        ids: rows.slice(0, options.pageSize).map(({ id }) => id),
        hasNext: rows.length > options.pageSize
    };
}

function legacyPopularity(
    database: SqliteD1TestDatabase,
    window: 3 | 7 | 30,
    divisionCode?: string
) {
    const exact = divisionCode?.length === 6 || divisionCode?.length === 12;
    const divisionClause = divisionCode ? `AND events.division_code ${exact ? "=" : "LIKE"} ?` : "";
    const values: string[] = [`-${window - 1} days`, STATUS.PUBLISHED];
    if (divisionCode) values.push(exact ? divisionCode : `${divisionCode}%`);

    return database.all<{ id: number; unique_visitors: number }>(
        `WITH recent_visitors AS (
            SELECT event_id, COUNT(*) AS unique_visitors
            FROM event_visitors
            WHERE date(last_seen_date) BETWEEN date('now', '+8 hours', ?)
                AND date('now', '+8 hours')
            GROUP BY event_id
        )
        SELECT events.id, recent_visitors.unique_visitors
        FROM recent_visitors
        JOIN events ON events.id = recent_visitors.event_id
        LEFT JOIN event_tags ON event_tags.event_id = events.id
        LEFT JOIN tags ON tags.id = event_tags.tag_id AND tags.alias_of_id IS NULL
        WHERE events.status = ?
          AND NOT ${LEGACY_EVENT_ENDED_CLAUSE}
          ${divisionClause}
        GROUP BY events.id, recent_visitors.unique_visitors
        ORDER BY recent_visitors.unique_visitors DESC,
                 CASE events.scale
                     WHEN 'mega' THEN 4
                     WHEN 'large' THEN 3
                     WHEN 'mid' THEN 2
                     WHEN 'small' THEN 1
                     ELSE 0
                 END DESC,
                 date(events.start_date) ASC,
                 events.id ASC
        LIMIT 5`,
        ...values
    );
}

test("canonical date validation protects direct indexed filter comparisons", () => {
    assert.equal(isCanonicalDate("2024-02-29"), true);
    assert.equal(isCanonicalDate("2026-02-29"), false);
    assert.equal(isCanonicalDate("2026-02-31"), false);
    assert.equal(isCanonicalDate("2026-2-03"), false);
});

function seedEvent(database: SqliteD1TestDatabase, status: EventStatus = STATUS.PENDING) {
    database.run(
        `INSERT INTO events(
             id, title, type, scale, division_code, venue, start_date, end_date,
             source_url, submitter_contact, status
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        1,
        VALID_EVENT.title,
        VALID_EVENT.type,
        VALID_EVENT.scale,
        VALID_EVENT.division_code,
        VALID_EVENT.venue,
        VALID_EVENT.start_date,
        VALID_EVENT.end_date,
        VALID_EVENT.source_url,
        VALID_EVENT.submitter_contact,
        status
    );
}

test("real SQLite batch preserves transition audit idempotency and conflict classification", async () => {
    const database = await createDatabase();
    try {
        seedEvent(database);
        database.run("INSERT INTO tags(id, name) VALUES (1, '同人展')");
        database.run("INSERT INTO event_tags(event_id, tag_id) VALUES (1, 1)");

        const changed = await transitionEventStatus(
            database.binding,
            1,
            STATUS.PENDING,
            STATUS.PUBLISHED
        );
        assert.equal(changed.outcome, "changed");
        assert.equal(
            database.first<{ count: number }>("SELECT COUNT(*) AS count FROM audit_logs")?.count,
            1
        );

        const repeated = await transitionEventStatus(
            database.binding,
            1,
            STATUS.PENDING,
            STATUS.PUBLISHED
        );
        assert.equal(repeated.outcome, "already-target");
        assert.equal(
            database.first<{ count: number }>("SELECT COUNT(*) AS count FROM audit_logs")?.count,
            1
        );
    } finally {
        database.close();
    }
});

test("real SQLite batch rolls back event edits when the audit statement fails", async () => {
    const database = await createDatabase();
    try {
        seedEvent(database, STATUS.PUBLISHED);
        database.run("INSERT INTO tags(id, name) VALUES (1, '同人展')");
        database.run("INSERT INTO event_tags(event_id, tag_id) VALUES (1, 1)");
        database.execScript(`
            CREATE TRIGGER reject_edit_audit
            BEFORE INSERT ON audit_logs
            WHEN NEW.action = 'edit'
            BEGIN
                SELECT RAISE(ABORT, 'reject edit audit');
            END;
        `);

        await assert.rejects(
            () =>
                editEvent(database.binding, 1, {
                    ...VALID_EVENT,
                    title: "不得提交",
                    tags: ["新标签"]
                }),
            /reject edit audit/
        );
        assert.equal(
            database.first<{ title: string }>("SELECT title FROM events WHERE id = 1")?.title,
            VALID_EVENT.title
        );
        assert.deepEqual(
            database.all<{ name: string }>(
                `SELECT tags.name
                 FROM event_tags
                 JOIN tags ON tags.id = event_tags.tag_id
                 WHERE event_tags.event_id = 1
                 ORDER BY tags.id`
            ),
            [{ name: "同人展" }]
        );
        assert.equal(
            database.first<{ count: number }>("SELECT COUNT(*) AS count FROM tags")?.count,
            1
        );
    } finally {
        database.close();
    }
});

test("real SQLite tag merge normalizes aliases once and does not duplicate audits", async () => {
    const database = await createDatabase();
    try {
        seedEvent(database, STATUS.PUBLISHED);
        database.run("INSERT INTO tags(id, name) VALUES (1, '旧标签'), (2, '新标签')");
        database.run("INSERT INTO event_tags(event_id, tag_id) VALUES (1, 1), (1, 2)");

        const changed = await mergeTags(database.binding, 1, 2);
        assert.equal(changed.outcome, "changed");
        assert.deepEqual(changed.impact.eventIds, [1]);
        assert.deepEqual(database.all<{ tag_id: number }>("SELECT tag_id FROM event_tags"), [
            { tag_id: 2 }
        ]);

        const repeated = await mergeTags(database.binding, 1, 2);
        assert.equal(repeated.outcome, "already-target");
        assert.equal(
            database.first<{ count: number }>("SELECT COUNT(*) AS count FROM audit_logs")?.count,
            1
        );
    } finally {
        database.close();
    }
});

test("real SQLite view writes expose all three outcomes and keep cleanup off the request path", async () => {
    const database = await createDatabase();
    try {
        seedEvent(database, STATUS.PUBLISHED);
        const visitorKey = "a".repeat(64);
        assert.equal(await recordEventView(database.binding, 1, visitorKey), "changed");
        assert.equal(await recordEventView(database.binding, 1, visitorKey), "already-current");

        database.run("UPDATE events SET status = ? WHERE id = 1", STATUS.OFFLINE);
        assert.equal(await recordEventView(database.binding, 1, "b".repeat(64)), "ignored");

        database.run(
            "UPDATE event_visitors SET last_seen_date = date('now', '+8 hours', '-30 days') WHERE event_id = 1"
        );
        assert.equal(await deleteExpiredEventVisitors(database.binding), 1);
    } finally {
        database.close();
    }
});

test("real SQLite query plans use the required existing indexes", async () => {
    const database = await createDatabase();
    try {
        seedEvent(database, STATUS.PUBLISHED);
        database.run(
            "INSERT INTO event_visitors(event_id, visitor_key, last_seen_date) VALUES (1, ?, date('now', '+8 hours'))",
            "c".repeat(64)
        );

        database.resetPrepared();
        await listHomepagePopularity(database.binding, "110101", 7);
        const popularityPlan = database.explain(database.prepared[0]);
        assert.ok(
            popularityPlan.some(({ detail }) => detail.includes("idx_event_visitors_recent")),
            JSON.stringify(popularityPlan)
        );

        database.resetPrepared();
        await listPublishedEventSitemapRows(database.binding);
        const sitemapPlan = database.explain(database.prepared[0]);
        assert.ok(sitemapPlan.some(({ detail }) => detail.includes("idx_events_status_updated")));
        assert.ok(sitemapPlan.every(({ detail }) => !detail.includes("TEMP B-TREE FOR ORDER BY")));

        database.resetPrepared();
        await listPublishedEvents(database.binding, {
            timing: "all",
            divisionCode: "110101"
        });
        const divisionPlan = database.explain(database.prepared[0]);
        assert.ok(divisionPlan.some(({ detail }) => detail.includes("idx_events_public_division")));

        database.resetPrepared();
        await deleteExpiredEventVisitors(database.binding);
        const cleanupPlan = database.explain(database.prepared[0]);
        assert.ok(cleanupPlan.some(({ detail }) => detail.includes("idx_event_visitors_recent")));
    } finally {
        database.close();
    }
});

test("seeded indexed reads preserve legacy listing, pagination, and popularity semantics", async () => {
    const database = await createSeededDatabase();
    try {
        const listCases = [
            {
                timing: "upcoming",
                divisionCode: "3101",
                page: 1,
                pageSize: 17,
                sort: "start_asc"
            },
            {
                timing: "upcoming",
                divisionCode: "3101",
                page: 2,
                pageSize: 17,
                sort: "start_asc"
            },
            { timing: "all", page: 1, pageSize: 23, sort: "start_desc" },
            { timing: "ended", page: 1, pageSize: 20, sort: "end_desc" }
        ] as const;

        for (const options of listCases) {
            const current = await listPublishedEvents(database.binding, options);
            assert.deepEqual(
                {
                    ids: current.events.map(({ id }) => id),
                    hasNext: current.hasNext
                },
                legacyListPage(database, options)
            );
            assert.equal(current.page, options.page);
            assert.equal(current.pageSize, options.pageSize);
        }

        for (const window of [3, 7, 30] as const) {
            const current = await listHomepagePopularity(database.binding, "3101", window);
            assert.deepEqual(
                current.local.map(({ id, unique_visitors }) => ({ id, unique_visitors })),
                legacyPopularity(database, window, "3101")
            );
            assert.deepEqual(
                current.nationwide.map(({ id, unique_visitors }) => ({ id, unique_visitors })),
                legacyPopularity(database, window)
            );
        }
    } finally {
        database.close();
    }
});
