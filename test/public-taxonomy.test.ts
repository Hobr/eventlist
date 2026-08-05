import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { isPublicEventTaxonomy } from "../src/lib/cache/public-routes";
import { buildPublicDataCacheRequest } from "../src/lib/cache/public-data";
import { listPublicEventTaxonomy } from "../src/lib/db/public-taxonomy";
import { STATUS } from "../src/lib/db";
import { SqliteD1TestDatabase } from "./helpers/sqlite-d1";

async function createDatabase() {
    const database = new SqliteD1TestDatabase();
    database.execScript(
        await readFile(new URL("../migrations/0001_init.sql", import.meta.url), "utf8")
    );
    return database;
}

function insertEvent(
    database: SqliteD1TestDatabase,
    id: number,
    status: string,
    type: string,
    scale: string
) {
    database.run(
        `INSERT INTO events(
             id, title, type, scale, division_code, venue, start_date, end_date,
             source_url, submitter_contact, status
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        `活动 ${id}`,
        type,
        scale,
        "110101",
        "测试场馆",
        "2026-01-01",
        "2026-01-02",
        `https://example.com/${id}`,
        "tester@example.com",
        status
    );
}

test("public taxonomy counts all published events and excludes aliases and other statuses", async () => {
    const database = await createDatabase();
    try {
        database.run("INSERT INTO tags(id, name) VALUES (1, '同人展'), (2, '北京')");
        database.run("INSERT INTO tags(id, name, alias_of_id) VALUES (3, '别名', 1)");
        insertEvent(database, 1, STATUS.PUBLISHED, "comic", "large");
        insertEvent(database, 2, STATUS.PUBLISHED, "doujin", "large");
        insertEvent(database, 3, STATUS.OFFLINE, "concert", "mega");
        insertEvent(database, 4, STATUS.PENDING, "concert", "mega");
        insertEvent(database, 5, STATUS.REJECTED, "only", "small");
        database.run(
            "INSERT INTO event_tags(event_id, tag_id) VALUES (1, 1), (1, 2), (2, 1), (3, 2), (4, 3), (5, 3)"
        );

        assert.deepEqual(await listPublicEventTaxonomy(database.binding), {
            tags: [
                { name: "同人展", event_count: 2 },
                { name: "北京", event_count: 1 }
            ],
            types: [
                { name: "comic", event_count: 1 },
                { name: "doujin", event_count: 1 }
            ],
            scales: [{ name: "large", event_count: 2 }]
        });
        assert.match(database.prepared[0]?.sql ?? "", /events\.status = \?/g);
        assert.match(database.prepared[0]?.sql ?? "", /tags\.alias_of_id IS NULL/);
    } finally {
        database.close();
    }
});

test("public taxonomy cache keys are stable and DTO guards reject malformed values", () => {
    const request = buildPublicDataCacheRequest("https://example.com/categories", {
        resource: "event-taxonomy"
    });
    assert.equal(request.url, "https://example.com/_eventlist_cache/v2/event-taxonomy");
    assert.equal(request.method, "GET");

    assert.equal(
        isPublicEventTaxonomy({
            tags: [{ name: "同人展", event_count: 2 }],
            types: [{ name: "comic", event_count: 1 }],
            scales: [{ name: "large", event_count: 2 }]
        }),
        true
    );
    assert.equal(
        isPublicEventTaxonomy({
            tags: [{ name: " 同人展", event_count: 2 }],
            types: [],
            scales: []
        }),
        false
    );
    assert.equal(
        isPublicEventTaxonomy({
            tags: [],
            types: [{ name: "unknown", event_count: 1 }],
            scales: []
        }),
        false
    );
});

test("categories page links use the all-published event list and public navigation exposes it", async () => {
    const [page, layout, mobileNav, sitemap] = await Promise.all([
        readFile(new URL("../src/pages/categories.astro", import.meta.url), "utf8"),
        readFile(new URL("../src/layouts/Layout.astro", import.meta.url), "utf8"),
        readFile(new URL("../src/components/PublicMobileNav.svelte", import.meta.url), "utf8"),
        readFile(new URL("../src/pages/sitemap.xml.ts", import.meta.url), "utf8")
    ]);

    assert.match(page, /new URLSearchParams\(\{ status: "all", \[parameter\]: name \}\)/);
    assert.match(page, /facetHref\("tag", item\.name\)/);
    assert.match(page, /facetHref\("type", item\.name\)/);
    assert.match(page, /facetHref\("scale", item\.name\)/);
    assert.match(layout, /href="\/categories"/);
    assert.match(mobileNav, /href: "\/categories", label: "分类"/);
    assert.match(sitemap, /urlEntry\(`\$\{origin\}\/categories`\)/);
});
