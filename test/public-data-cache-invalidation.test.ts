import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
    buildPublicDataInvalidationRequests,
    invalidatePublicDataAfterMutation,
    PUBLIC_DATA_CACHE_INVALIDATION_LIMIT,
    schedulePublicDataInvalidation
} from "../src/lib/cache/invalidation";
import { STATUS } from "../src/lib/db";
import { parsePublicDataCacheScopes } from "../src/lib/cache/public-data";

const publishedEditImpact = {
    eventIds: [42],
    oldDivisionCodes: ["110101"],
    newDivisionCodes: ["310101"],
    oldStatus: STATUS.PUBLISHED,
    newStatus: STATUS.PUBLISHED,
    tagsChanged: true
};

test("popularity invalidation covers both division ancestor sets within the subrequest budget", () => {
    const built = buildPublicDataInvalidationRequests({
        origin: "https://acg.example",
        scopes: parsePublicDataCacheScopes("tags,sitemap,popularity"),
        kind: "edit",
        impact: publishedEditImpact
    });
    const urls = built.requests.map(({ url }) => url);

    assert.equal(built.truncated, 0);
    assert.equal(urls.length, 21);
    assert.ok(urls.length <= PUBLIC_DATA_CACHE_INVALIDATION_LIMIT);
    for (const division of ["11", "1101", "110101", "31", "3101", "310101"]) {
        for (const window of [3, 7, 30]) {
            assert.ok(
                urls.includes(
                    `https://acg.example/_eventlist_cache/v2/popularity?division=${division}&window=${window}`
                )
            );
        }
    }
    assert.ok(urls.includes("https://acg.example/_eventlist_cache/v2/top-tags?limit=12"));
    assert.ok(urls.includes("https://acg.example/_eventlist_cache/v2/top-tags?limit=20"));
    assert.ok(urls.includes("https://acg.example/_eventlist_cache/v2/sitemap?limit=1000"));
});

test("all-scope invalidation is deduplicated and hard-capped at 24 deletes", () => {
    const built = buildPublicDataInvalidationRequests({
        origin: "https://acg.example",
        scopes: parsePublicDataCacheScopes("homepage,popularity,tags,detail,sitemap,list"),
        kind: "edit",
        impact: publishedEditImpact
    });
    const urls = built.requests.map(({ url }) => url);

    assert.equal(urls.length, PUBLIC_DATA_CACHE_INVALIDATION_LIMIT);
    assert.equal(new Set(urls).size, urls.length);
    assert.equal(built.truncated, 4);
    for (const division of ["11", "1101", "110101", "31", "3101", "310101"]) {
        assert.ok(
            urls.includes(
                `https://acg.example/_eventlist_cache/v2/home-discovery?division=${division}`
            )
        );
        for (const window of [3, 7, 30]) {
            assert.ok(
                urls.includes(
                    `https://acg.example/_eventlist_cache/v2/popularity?division=${division}&window=${window}`
                )
            );
        }
    }
    assert.ok(!urls.includes("https://acg.example/_eventlist_cache/v2/event-detail?id=42"));
    assert.ok(!urls.includes("https://acg.example/_eventlist_cache/v2/top-tags?limit=12"));
    assert.ok(!urls.includes("https://acg.example/_eventlist_cache/v2/top-tags?limit=20"));
    assert.ok(!urls.includes("https://acg.example/_eventlist_cache/v2/sitemap?limit=1000"));
});

test("repeated event and division impacts produce one delete per cache key", () => {
    const built = buildPublicDataInvalidationRequests({
        origin: "https://acg.example",
        scopes: parsePublicDataCacheScopes("homepage,popularity,tags,detail,sitemap,list"),
        kind: "edit",
        impact: {
            ...publishedEditImpact,
            eventIds: [42, 42],
            oldDivisionCodes: ["110101", "110101"],
            newDivisionCodes: ["110101"]
        }
    });
    const urls = built.requests.map(({ url }) => url);

    assert.equal(built.truncated, 0);
    assert.equal(urls.length, 16);
    assert.equal(new Set(urls).size, urls.length);
    assert.equal(urls.filter((url) => url.endsWith("/event-detail?id=42")).length, 1);
});

test("disabled and non-public mutations do not open Cache API or delete entries", async () => {
    let storeOpens = 0;
    const getStore = async () => {
        storeOpens += 1;
        return { delete: async () => true };
    };

    const disabled = await invalidatePublicDataAfterMutation({
        origin: "https://acg.example",
        configuredScopes: "homepage,unknown",
        kind: "edit",
        impact: publishedEditImpact,
        getStore
    });
    assert.deepEqual(disabled, { attempted: 0, deleted: 0, failed: 0, truncated: 0 });

    const rejected = await invalidatePublicDataAfterMutation({
        origin: "https://acg.example",
        configuredScopes: "homepage,popularity,tags,detail,sitemap,list",
        kind: "status",
        impact: {
            eventIds: [42],
            oldDivisionCodes: ["110101"],
            newDivisionCodes: ["110101"],
            oldStatus: STATUS.PENDING,
            newStatus: STATUS.REJECTED,
            tagsChanged: false
        },
        getStore
    });
    assert.deepEqual(rejected, { attempted: 0, deleted: 0, failed: 0, truncated: 0 });
    assert.equal(storeOpens, 0);
});

test("delete and cache-open failures never reject a committed mutation", async () => {
    let deletes = 0;
    const partialFailure = await invalidatePublicDataAfterMutation({
        origin: "https://acg.example",
        configuredScopes: "tags,sitemap",
        kind: "create",
        impact: {
            eventIds: [42],
            oldDivisionCodes: [],
            newDivisionCodes: ["110101"],
            newStatus: STATUS.PUBLISHED,
            tagsChanged: true
        },
        getStore: async () => ({
            delete: async () => {
                deletes += 1;
                if (deletes === 2) throw new Error("cache unavailable");
                return deletes === 1;
            }
        })
    });
    assert.deepEqual(partialFailure, { attempted: 3, deleted: 1, failed: 1, truncated: 0 });

    const openFailure = await invalidatePublicDataAfterMutation({
        origin: "https://acg.example",
        configuredScopes: "tags,sitemap",
        kind: "create",
        impact: {
            eventIds: [42],
            oldDivisionCodes: [],
            newDivisionCodes: ["110101"],
            newStatus: STATUS.PUBLISHED,
            tagsChanged: true
        },
        getStore: async () => {
            throw new Error("cache unavailable");
        }
    });
    assert.deepEqual(openFailure, { attempted: 3, deleted: 0, failed: 3, truncated: 0 });
});

test("waitUntil failures are contained after invalidation work is scheduled", async () => {
    let scheduled: Promise<unknown> | undefined;
    let deletes = 0;

    assert.doesNotThrow(() =>
        schedulePublicDataInvalidation({
            origin: "https://acg.example",
            configuredScopes: "tags,sitemap",
            kind: "create",
            impact: {
                eventIds: [42],
                oldDivisionCodes: [],
                newDivisionCodes: ["110101"],
                newStatus: STATUS.PUBLISHED,
                tagsChanged: true
            },
            getStore: async () => ({
                delete: async () => {
                    deletes += 1;
                    throw new Error("cache unavailable");
                }
            }),
            waitUntil: (promise) => {
                scheduled = promise;
                throw new Error("waitUntil unavailable");
            }
        })
    );

    assert.ok(scheduled);
    await scheduled;
    assert.equal(deletes, 3);
});

test("every public admin mutation schedules invalidation only after business success", async () => {
    const routes = [
        ["../src/pages/api/admin/events/index.ts", "createPublishedEvent("],
        ["../src/pages/api/admin/events/bulk/index.ts", "createBulkPublishedEvents("],
        ["../src/pages/api/admin/events/[id]/index.ts", "editEvent("],
        ["../src/pages/api/admin/events/[id]/approve.ts", "transitionEventStatus("],
        ["../src/pages/api/admin/events/[id]/reject.ts", "transitionEventStatus("],
        ["../src/pages/api/admin/events/[id]/offline.ts", "transitionEventStatus("],
        ["../src/pages/api/admin/events/[id]/republish.ts", "transitionEventStatus("],
        ["../src/pages/api/admin/tags/merge.ts", "mergeTags("]
    ];
    const sources = await Promise.all(
        routes.map(([path]) => readFile(new URL(path, import.meta.url), "utf8"))
    );

    for (const [index, source] of sources.entries()) {
        const mutationIndex = source.lastIndexOf(routes[index][1]);
        const invalidationIndex = source.lastIndexOf("schedulePublicDataInvalidation({");

        assert.ok(mutationIndex >= 0);
        assert.ok(invalidationIndex > mutationIndex);
        assert.match(source, /schedulePublicDataInvalidation\(\{/);
        assert.match(source, /configuredScopes: runtimeEnv\.PUBLIC_DATA_CACHE_SCOPES/);
        assert.match(source, /waitUntil/);
    }
    for (const source of sources.slice(3)) {
        assert.match(source, /result\.outcome === "changed"/);
    }

    const publicSubmission = await readFile(
        new URL("../src/pages/api/submit.ts", import.meta.url),
        "utf8"
    );
    assert.doesNotMatch(publicSubmission, /schedulePublicDataInvalidation/);
});
