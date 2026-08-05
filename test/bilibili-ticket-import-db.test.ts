import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalBilibiliSourceUrl } from "../src/lib/admin/bilibili-ticket";
import {
    BilibiliExactDuplicateError,
    createBilibiliImportedPublishedEvent,
    findEventBySourceUrl,
    type AdminEventInput
} from "../src/lib/db/admin-events";
import type { D1Database } from "../src/types/cloudflare";
import { SqliteD1TestDatabase } from "./helpers/sqlite-d1";

const SOURCE_URL = canonicalBilibiliSourceUrl(1004224);
const VALID_EVENT: AdminEventInput = {
    title: "上海·芳文社同人ONLY展2.0~街角兔屋",
    type: "only",
    scale: "small",
    division_code: "310113",
    venue: "交运智慧湾科创园25号楼",
    address: "呼青路158号",
    start_date: "2026-08-16",
    end_date: "2026-08-16",
    start_time: "12:00",
    end_time: "21:00",
    cover_url: "https://i0.hdslb.com/bfs/openplatform/sample-cover.png",
    description: null,
    qq_group: null,
    ticket_url: SOURCE_URL,
    source_url: SOURCE_URL,
    submitter_contact: "admin@example.com",
    organizer: "上海樱动研文化传媒有限公司",
    schedule_status: null,
    admission_method: "ticket",
    price_range: "78-138 元",
    admission_start_date: "2026-07-23",
    admission_start_time: "00:00",
    tags: ["同人展"]
};

async function createDatabase() {
    const database = new SqliteD1TestDatabase();
    database.execScript(
        await readFile(new URL("../migrations/0001_init.sql", import.meta.url), "utf8")
    );
    return database;
}

interface FakeD1Result {
    success: true;
    results: unknown[];
    meta: { changes: number };
}

class RetryStatement {
    values: unknown[] = [];

    constructor(
        private readonly database: RetryDatabase,
        readonly sql: string
    ) {}

    bind(...values: unknown[]) {
        this.values = values;
        return this;
    }

    async first<T>() {
        return (this.database.ids.shift() ?? null) as T | null;
    }
}

class RetryDatabase {
    ids: Array<{ id: number }> = [{ id: 10 }, { id: 11 }];
    batches: RetryStatement[][] = [];
    responses: Array<FakeD1Result[] | Error> = [];

    prepare(sql: string) {
        return new RetryStatement(this, sql);
    }

    async batch(statements: RetryStatement[]) {
        this.batches.push(statements);
        const response = this.responses.shift();
        if (response instanceof Error) throw response;
        return response ?? [];
    }
}

function fakeResult(changes: number, results: unknown[] = []): FakeD1Result {
    return { success: true, results, meta: { changes } };
}

test("会员购创建立即发布并只审计来源、项目 ID 和确认键", async () => {
    const database = await createDatabase();
    try {
        const id = await createBilibiliImportedPublishedEvent(database.binding, VALID_EVENT, {
            authMode: "access",
            email: "admin@example.com",
            projectId: 1004224,
            confirmedWarningKeys: ["warning-key"]
        });

        assert.equal(id, 1);
        assert.deepEqual(await findEventBySourceUrl(database.binding, SOURCE_URL), {
            id: 1,
            title: VALID_EVENT.title
        });
        assert.deepEqual(
            database.first<{ status: string; published_at: string | null }>(
                "SELECT status, published_at FROM events WHERE id = 1"
            )?.status,
            "published"
        );
        assert.equal(
            database.first<{ count: number }>("SELECT COUNT(*) AS count FROM tags")?.count,
            1
        );
        assert.equal(
            database.first<{ count: number }>("SELECT COUNT(*) AS count FROM event_tags")?.count,
            1
        );
        const audit = database.first<{ meta: string }>(
            "SELECT meta FROM audit_logs WHERE action = 'create' AND target_id = 1"
        );
        assert.deepEqual(JSON.parse(audit?.meta ?? "{}"), {
            source: "admin-bilibili-import",
            project_id: 1004224,
            confirmed_warning_keys: ["warning-key"],
            tags: ["同人展"],
            auth_mode: "access",
            email: "admin@example.com"
        });
        assert.doesNotMatch(audit?.meta ?? "", /screen_list|venue_info|merchant|response/i);
    } finally {
        database.close();
    }
});

test("规范来源重复不留下新标签、活动、关系或审计", async () => {
    const database = await createDatabase();
    try {
        await createBilibiliImportedPublishedEvent(database.binding, VALID_EVENT, {
            authMode: "token",
            projectId: 1004224,
            confirmedWarningKeys: []
        });

        await assert.rejects(
            () =>
                createBilibiliImportedPublishedEvent(
                    database.binding,
                    { ...VALID_EVENT, title: "重复活动", tags: ["不应创建"] },
                    {
                        authMode: "token",
                        projectId: 1004224,
                        confirmedWarningKeys: []
                    }
                ),
            (error: unknown) =>
                error instanceof BilibiliExactDuplicateError && error.existingEvent.id === 1
        );

        assert.equal(
            database.first<{ count: number }>("SELECT COUNT(*) AS count FROM events")?.count,
            1
        );
        assert.equal(
            database.first<{ count: number }>("SELECT COUNT(*) AS count FROM tags")?.count,
            1
        );
        assert.equal(
            database.first<{ count: number }>("SELECT COUNT(*) AS count FROM event_tags")?.count,
            1
        );
        assert.equal(
            database.first<{ count: number }>("SELECT COUNT(*) AS count FROM audit_logs")?.count,
            1
        );
        assert.equal(
            database.first<{ count: number }>(
                "SELECT COUNT(*) AS count FROM tags WHERE name = '不应创建'"
            )?.count,
            0
        );
    } finally {
        database.close();
    }
});

test("会员购创建的任一 batch 失败会回滚全部写入", async () => {
    const database = await createDatabase();
    try {
        database.execScript(`
            CREATE TRIGGER fail_bilibili_audit
            BEFORE INSERT ON audit_logs
            WHEN json_extract(NEW.meta, '$.source') = 'admin-bilibili-import'
            BEGIN
                SELECT RAISE(ABORT, 'audit trigger failed');
            END;
        `);

        await assert.rejects(
            () =>
                createBilibiliImportedPublishedEvent(database.binding, VALID_EVENT, {
                    authMode: "token",
                    projectId: 1004224,
                    confirmedWarningKeys: []
                }),
            /audit trigger failed/
        );
        assert.equal(
            database.first<{ count: number }>("SELECT COUNT(*) AS count FROM events")?.count,
            0
        );
        assert.equal(
            database.first<{ count: number }>("SELECT COUNT(*) AS count FROM tags")?.count,
            0
        );
        assert.equal(
            database.first<{ count: number }>("SELECT COUNT(*) AS count FROM event_tags")?.count,
            0
        );
        assert.equal(
            database.first<{ count: number }>("SELECT COUNT(*) AS count FROM audit_logs")?.count,
            0
        );
    } finally {
        database.close();
    }
});

test("会员购创建在候选 ID 冲突后重新分配 ID 并重试完整 batch", async () => {
    const database = new RetryDatabase();
    database.responses = [
        new Error("D1_ERROR: UNIQUE constraint failed: events.id"),
        [
            fakeResult(1),
            fakeResult(1),
            fakeResult(1),
            fakeResult(1),
            fakeResult(0, [{ id: 11, title: VALID_EVENT.title }])
        ]
    ];

    const id = await createBilibiliImportedPublishedEvent(
        database as unknown as D1Database,
        VALID_EVENT,
        {
            authMode: "token",
            projectId: 1004224,
            confirmedWarningKeys: []
        }
    );

    assert.equal(id, 11);
    assert.equal(database.batches.length, 2);
    assert.equal(database.batches[0]?.length, 5);
    assert.equal(database.batches[1]?.length, 5);
    assert.equal(database.batches[0]?.[1]?.values[0], 10);
    assert.equal(database.batches[1]?.[1]?.values[0], 11);
    assert.equal(database.batches[0]?.[2]?.values[0], 10);
    assert.equal(database.batches[1]?.[2]?.values[0], 11);
});
