import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
    buildPublicDataCacheRequest,
    classifyCachedEnvelope,
    combinePublicDataCacheStates,
    createCachedEnvelope,
    loadPublicDataWithCache,
    normalizePublicDataCacheTags,
    parseCachedEnvelope,
    parsePublicDataCacheScopes,
    PUBLIC_DATA_CACHE_NAMESPACE,
    PUBLIC_DATA_CACHE_SCHEMA,
    PUBLIC_DATA_CACHE_TAGS,
    publicDataCacheResponseHeaders,
    readPublicDataCache,
    stablePublicDataCacheJitterMs,
    writePublicDataCache,
    type PublicDataCacheStore
} from "../src/lib/cache/public-data";
import {
    isPublicEventListCacheable,
    isPublicEventPage,
    isPublicEventDetail,
    isPublicEventTaxonomy,
    isPublicHomepageDiscovery,
    isPublicHomepagePopularity,
    isSitemapEventRowList,
    isTagSummaryList,
    loadCachedHomepageDiscovery,
    loadCachedHomepagePopularity,
    loadCachedPublicEventDetail,
    loadCachedPublicEventList,
    loadCachedPublicEventTaxonomy,
    loadCachedPublicTags,
    loadCachedSitemapRows
} from "../src/lib/cache/public-routes";

class FakeCacheStore implements PublicDataCacheStore {
    matches = 0;
    puts = 0;
    response: Response | undefined;
    writtenResponse: Response | undefined;
    matchedRequest: Request | undefined;
    writtenRequest: Request | undefined;
    matchError: unknown;
    putError: unknown;

    async match(request: Request) {
        this.matches += 1;
        this.matchedRequest = request;
        if (this.matchError) throw this.matchError;
        return this.response;
    }

    async put(request: Request, response: Response) {
        this.puts += 1;
        this.writtenRequest = request;
        if (this.putError) throw this.putError;
        this.writtenResponse = response;
    }
}

function isMessage(value: unknown): value is { message: string } {
    return (
        Boolean(value) &&
        typeof value === "object" &&
        typeof (value as { message?: unknown }).message === "string"
    );
}

test("cache scopes are disabled by default and invalid configuration fails closed", () => {
    assert.deepEqual([...parsePublicDataCacheScopes(undefined)], []);
    assert.deepEqual([...parsePublicDataCacheScopes(null)], []);
    assert.deepEqual([...parsePublicDataCacheScopes("")], []);
    assert.deepEqual([...parsePublicDataCacheScopes("unknown")], []);
    assert.deepEqual([...parsePublicDataCacheScopes("homepage,unknown")], []);
    assert.deepEqual([...parsePublicDataCacheScopes("tags,")], []);
    assert.deepEqual([...parsePublicDataCacheScopes("tags,,sitemap")], []);
    assert.deepEqual(
        [...parsePublicDataCacheScopes(" homepage, tags,homepage ")],
        ["homepage", "tags"]
    );
});

test("production configuration enables all approved public DTO cache scopes", async () => {
    const config = JSON.parse(
        await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8")
    ) as {
        workers_dev?: boolean;
        routes?: Array<{ pattern?: string; custom_domain?: boolean }>;
        vars?: { PUBLIC_DATA_CACHE_SCOPES?: string; CLOUDFLARE_ZONE_ID?: string };
    };

    assert.equal(config.workers_dev, false);
    assert.deepEqual(config.routes, [
        {
            pattern: "acg.hobr.site",
            custom_domain: true,
            enabled: true,
            previews_enabled: false
        }
    ]);
    assert.deepEqual(
        [...parsePublicDataCacheScopes(config.vars?.PUBLIC_DATA_CACHE_SCOPES)],
        ["homepage", "popularity", "tags", "detail", "sitemap", "list"]
    );
    assert.match(config.vars?.CLOUDFLARE_ZONE_ID ?? "", /^[a-f0-9]{32}$/);
    const devVarsExample = await readFile(new URL("../.dev.vars.example", import.meta.url), "utf8");
    assert.match(devVarsExample, /^CLOUDFLARE_CACHE_PURGE_TOKEN=$/m);
    await assert.rejects(
        readFile(new URL("../src/pages/eventlist-cache-probe-v1.ts", import.meta.url), "utf8"),
        { code: "ENOENT" }
    );
});

test("synthetic cache keys are versioned, normalized, and isolated", () => {
    assert.equal(PUBLIC_DATA_CACHE_NAMESPACE, "eventlist-public-data-v2");
    assert.equal(PUBLIC_DATA_CACHE_SCHEMA, 2);
    const origin = "https://acg.example/some/request/path?ignored=true";
    const homepage = buildPublicDataCacheRequest(origin, {
        resource: "home-discovery",
        divisionCode: "11",
        asOfDate: "2026-08-01"
    });
    const anotherDivision = buildPublicDataCacheRequest(origin, {
        resource: "home-discovery",
        divisionCode: "31",
        asOfDate: "2026-08-01"
    });
    const anotherDate = buildPublicDataCacheRequest(origin, {
        resource: "home-discovery",
        divisionCode: "11",
        asOfDate: "2026-08-02"
    });
    const popularity = buildPublicDataCacheRequest(origin, {
        resource: "popularity",
        divisionCode: "11",
        window: 7
    });
    const anotherWindow = buildPublicDataCacheRequest(origin, {
        resource: "popularity",
        divisionCode: "11",
        window: 30
    });
    const detail = buildPublicDataCacheRequest(origin, {
        resource: "event-detail",
        eventId: 42
    });
    const anotherDetail = buildPublicDataCacheRequest(origin, {
        resource: "event-detail",
        eventId: 43
    });
    const tagSearch = buildPublicDataCacheRequest(origin, {
        resource: "tag-search",
        query: "  同人展  ",
        limit: 12
    });
    const listA = buildPublicDataCacheRequest(origin, {
        resource: "event-list",
        filters: {
            divisionCode: "11",
            timing: "ended",
            tag: " 同人展 ",
            page: 2,
            pageSize: 20
        },
        asOfDate: "2026-08-01"
    });
    const listB = buildPublicDataCacheRequest(origin, {
        resource: "event-list",
        filters: {
            pageSize: 20,
            page: 2,
            tag: "同人展",
            timing: "ended",
            divisionCode: "11"
        },
        asOfDate: "2026-08-01"
    });
    const listNextPage = buildPublicDataCacheRequest(origin, {
        resource: "event-list",
        filters: { divisionCode: "11", timing: "ended", tag: "同人展", page: 3 },
        asOfDate: "2026-08-01"
    });
    const listAnotherSort = buildPublicDataCacheRequest(origin, {
        resource: "event-list",
        filters: {
            divisionCode: "11",
            timing: "ended",
            tag: "同人展",
            page: 2,
            sort: "start_desc"
        },
        asOfDate: "2026-08-01"
    });
    const listAnotherDate = buildPublicDataCacheRequest(origin, {
        resource: "event-list",
        filters: {
            divisionCode: "11",
            timing: "ended",
            tag: "同人展",
            page: 2
        },
        asOfDate: "2026-08-02"
    });

    assert.equal(homepage.method, "GET");
    assert.equal([...homepage.headers].length, 0);
    assert.equal(
        homepage.url,
        "https://acg.example/_eventlist_cache/v2/home-discovery?division=11&date=2026-08-01"
    );
    assert.equal(
        tagSearch.url,
        "https://acg.example/_eventlist_cache/v2/tag-search?q=%E5%90%8C%E4%BA%BA%E5%B1%95&limit=12"
    );
    assert.equal(listA.url, listB.url);
    assert.notEqual(homepage.url, anotherDivision.url);
    assert.notEqual(homepage.url, anotherDate.url);
    assert.notEqual(homepage.url, popularity.url);
    assert.notEqual(popularity.url, anotherWindow.url);
    assert.notEqual(popularity.url, detail.url);
    assert.notEqual(detail.url, anotherDetail.url);
    assert.notEqual(listA.url, listNextPage.url);
    assert.notEqual(listA.url, listAnotherSort.url);
    assert.notEqual(listA.url, listAnotherDate.url);
    assert.throws(
        () => buildPublicDataCacheRequest(origin, { resource: "event-detail", eventId: 0 }),
        /positive safe integer/
    );
    assert.throws(
        () => buildPublicDataCacheRequest(origin, { resource: "event-detail", eventId: 1.5 }),
        /positive safe integer/
    );
    assert.throws(
        () =>
            buildPublicDataCacheRequest(origin, {
                resource: "home-discovery",
                divisionCode: "11",
                asOfDate: "2026-02-30"
            }),
        /canonical date/
    );
});

test("envelope parsing rejects corrupt or inconsistent cache data", () => {
    const valid = createCachedEnvelope(
        { message: "ok" },
        { generatedAt: 1_000, freshTtlMs: 100, normalTtlMs: 200, faultTtlMs: 300 }
    );

    assert.deepEqual(parseCachedEnvelope(JSON.stringify(valid)), valid);
    assert.equal(parseCachedEnvelope("{"), null);
    assert.equal(parseCachedEnvelope({ ...valid, schema: 1 }), null);
    assert.equal(parseCachedEnvelope({ ...valid, value: undefined }), null);
    assert.equal(parseCachedEnvelope({ ...valid, normalUntil: valid.freshUntil - 1 }), null);
    assert.equal(parseCachedEnvelope({ ...valid, errorUntil: Number.POSITIVE_INFINITY }), null);
    assert.throws(
        () =>
            createCachedEnvelope("bad", {
                generatedAt: 1_000,
                freshTtlMs: 200,
                normalTtlMs: 100,
                faultTtlMs: 300
            }),
        /fresh <= normal <= fault/
    );
    assert.throws(
        () =>
            createCachedEnvelope("bad", {
                generatedAt: Number.MAX_VALUE,
                freshTtlMs: Number.MAX_VALUE,
                normalTtlMs: Number.MAX_VALUE,
                faultTtlMs: Number.MAX_VALUE
            }),
        /boundaries must be finite/
    );
});

test("cache age classification includes every TTL boundary", () => {
    const envelope = createCachedEnvelope("value", {
        generatedAt: 1_000,
        freshTtlMs: 100,
        normalTtlMs: 200,
        faultTtlMs: 300
    });

    assert.equal(classifyCachedEnvelope(envelope, 1_100), "fresh");
    assert.equal(classifyCachedEnvelope(envelope, 1_101), "normal-stale");
    assert.equal(classifyCachedEnvelope(envelope, 1_200), "normal-stale");
    assert.equal(classifyCachedEnvelope(envelope, 1_201), "fault-stale");
    assert.equal(classifyCachedEnvelope(envelope, 1_300), "fault-stale");
    assert.equal(classifyCachedEnvelope(envelope, 1_301), "hard-expired");
});

test("disabled cache access never invokes the injected store", async () => {
    const store = new FakeCacheStore();
    const request = buildPublicDataCacheRequest("https://acg.example", {
        resource: "event-detail",
        eventId: 42
    });
    const envelope = createCachedEnvelope(
        { message: "cached" },
        { generatedAt: 1_000, freshTtlMs: 100, normalTtlMs: 200, faultTtlMs: 300 }
    );

    assert.deepEqual(
        await readPublicDataCache({
            scope: "detail",
            store,
            request,
            now: 1_050,
            isValue: isMessage
        }),
        { cacheState: "bypass" }
    );
    assert.equal(
        await writePublicDataCache({ scope: "detail", store, request, envelope, now: 1_050 }),
        "bypass"
    );
    assert.equal(store.matches, 0);
    assert.equal(store.puts, 0);
});

test("enabled cache access classifies valid values and treats corrupt values as misses", async () => {
    const store = new FakeCacheStore();
    const scopes = parsePublicDataCacheScopes("detail");
    const request = buildPublicDataCacheRequest("https://acg.example", {
        resource: "event-detail",
        eventId: 42
    });
    const envelope = createCachedEnvelope(
        { message: "cached" },
        { generatedAt: 1_000, freshTtlMs: 100, normalTtlMs: 200, faultTtlMs: 300 }
    );
    store.response = new Response(JSON.stringify(envelope));

    const hit = await readPublicDataCache({
        scope: "detail",
        scopes,
        store,
        request,
        now: 1_150,
        isValue: isMessage
    });
    assert.equal(hit.cacheState, "cached");
    if (hit.cacheState === "cached") {
        assert.equal(hit.age, "normal-stale");
        assert.deepEqual(hit.envelope.value, { message: "cached" });
    }

    store.response = new Response(JSON.stringify({ ...envelope, value: { wrong: true } }));
    assert.deepEqual(
        await readPublicDataCache({
            scope: "detail",
            scopes,
            store,
            request,
            now: 1_150,
            isValue: isMessage
        }),
        { cacheState: "miss" }
    );

    assert.equal(
        await writePublicDataCache({
            scope: "detail",
            scopes,
            store,
            request,
            envelope,
            cacheTags: [PUBLIC_DATA_CACHE_TAGS.detail, PUBLIC_DATA_CACHE_TAGS.detail],
            now: 1_050
        }),
        "stored"
    );
    assert.equal(store.puts, 1);
    assert.equal(store.writtenResponse?.headers.get("cache-control"), "public, max-age=1");
    assert.equal(store.writtenResponse?.headers.get("cache-tag"), PUBLIC_DATA_CACHE_TAGS.detail);
    assert.deepEqual(normalizePublicDataCacheTags(["eventlist-tags", "eventlist-tags"]), [
        "eventlist-tags"
    ]);
    assert.equal(normalizePublicDataCacheTags(["eventlist-tags", "非法"]), null);
    assert.equal(normalizePublicDataCacheTags(["eventlist-tags,other"]), null);
});

test("enabled cache access fails closed when the store or write envelope is invalid", async () => {
    const store = new FakeCacheStore();
    const scopes = parsePublicDataCacheScopes("detail");
    const request = buildPublicDataCacheRequest("https://acg.example", {
        resource: "event-detail",
        eventId: 42
    });
    const envelope = createCachedEnvelope(
        { message: "cached" },
        { generatedAt: 1_000, freshTtlMs: 100, normalTtlMs: 200, faultTtlMs: 300 }
    );

    store.matchError = new Error("cache unavailable");
    assert.deepEqual(
        await readPublicDataCache({
            scope: "detail",
            scopes,
            store,
            request,
            isValue: isMessage
        }),
        { cacheState: "miss" }
    );

    store.putError = new Error("cache unavailable");
    assert.equal(
        await writePublicDataCache({
            scope: "detail",
            scopes,
            store,
            request,
            envelope,
            now: 1_050
        }),
        "error"
    );

    const putsAfterError = store.puts;
    assert.equal(
        await writePublicDataCache({
            scope: "detail",
            scopes,
            store,
            request,
            envelope: { ...envelope, errorUntil: Number.NaN },
            now: 1_050
        }),
        "skipped"
    );
    assert.equal(
        await writePublicDataCache({
            scope: "detail",
            scopes,
            store,
            request,
            envelope,
            cacheTags: ["eventlist-detail", "invalid tag"],
            now: 1_050
        }),
        "skipped"
    );
    assert.equal(
        await writePublicDataCache({
            scope: "detail",
            scopes,
            store,
            request,
            envelope,
            now: envelope.errorUntil + 1
        }),
        "skipped"
    );
    assert.equal(store.puts, putsAfterError);
});

const tagRows = [{ id: 1, name: "同人展", event_count: 3 }];
const taxonomyRows = {
    tags: [{ name: "同人展", event_count: 3 }],
    types: [{ name: "comic", event_count: 2 }],
    scales: [{ name: "large", event_count: 2 }]
};
const sitemapRows = [{ id: 42, updated_at: "2026-07-31 12:00:00" }];
const publicEventRow = {
    id: 42,
    title: "测试活动",
    type: "comic" as const,
    scale: "small" as const,
    division_code: "110101",
    venue: "测试场馆",
    start_date: "2026-08-01",
    end_date: "2026-08-02",
    start_time: "09:00",
    end_time: "18:00",
    cover_url: null,
    tags: "同人展"
};
const homepageDiscovery = {
    featuredEvents: [
        {
            id: publicEventRow.id,
            title: publicEventRow.title,
            scale: publicEventRow.scale,
            start_date: publicEventRow.start_date,
            end_date: publicEventRow.end_date,
            start_time: publicEventRow.start_time,
            end_time: publicEventRow.end_time,
            cover_url: publicEventRow.cover_url
        }
    ],
    today: [publicEventRow]
};
const homepagePopularity = {
    window: 7 as const,
    local: [
        {
            id: 42,
            title: "测试活动",
            division_code: "110101",
            start_date: "2026-08-01",
            unique_visitors: 12
        }
    ],
    nationwide: []
};
const publicEventPage = {
    events: [publicEventRow],
    page: 1,
    pageSize: 20,
    hasNext: false
};
const publicEventDetail = {
    ...publicEventRow,
    address: null,
    description: "活动描述",
    qq_group: null,
    ticket_url: "https://example.com/tickets",
    source_url: "https://example.com/source",
    organizer: "测试主办方",
    schedule_status: null,
    admission_method: "ticket" as const,
    price_range: "免费",
    admission_start_date: "2026-07-20",
    admission_start_time: "09:30",
    status: "published" as const,
    updated_at: "2026-07-31 00:00:00"
};

function cacheResponse<T>(value: T, now = 1_000) {
    return new Response(
        JSON.stringify(
            createCachedEnvelope(value, {
                generatedAt: 1_000,
                freshTtlMs: 100,
                normalTtlMs: 200,
                faultTtlMs: 300
            })
        )
    );
}

function tagCacheRequest(query = "同人展") {
    return buildPublicDataCacheRequest("https://acg.example", {
        resource: "tag-search",
        query,
        limit: 12
    });
}

test("stable jitter is deterministic and stays inside the configured window", () => {
    const key = tagCacheRequest().url;
    const first = stablePublicDataCacheJitterMs(key, 40_000, 50_000);
    const second = stablePublicDataCacheJitterMs(key, 40_000, 50_000);

    assert.equal(first, second);
    assert.ok(first >= 40_000 && first <= 50_000);
    assert.throws(() => stablePublicDataCacheJitterMs(key, 50_000, 40_000), /jitter bounds/);
});

test("read-through returns fresh hits without loading D1", async () => {
    const store = new FakeCacheStore();
    store.response = cacheResponse(tagRows);
    let loads = 0;

    const result = await loadPublicDataWithCache({
        scope: "tags",
        scopes: parsePublicDataCacheScopes("tags,sitemap"),
        request: tagCacheRequest(),
        getStore: async () => store,
        isValue: isTagSummaryList,
        ttl: { freshTtlMs: 100, normalTtlMs: 200, faultTtlMs: 300 },
        load: async () => {
            loads += 1;
            return tagRows;
        },
        waitUntil: () => assert.fail("fresh hits must not schedule refreshes"),
        now: () => 1_050
    });

    assert.deepEqual(result, { value: tagRows, cacheState: "HIT" });
    assert.equal(loads, 0);
    assert.equal(store.puts, 0);
});

test("normal stale data returns immediately and refreshes through waitUntil", async () => {
    const store = new FakeCacheStore();
    store.response = cacheResponse(tagRows);
    const refreshedRows = [{ id: 2, name: "音乐节", event_count: 5 }];
    const scheduled: Promise<unknown>[] = [];
    let loads = 0;

    const result = await loadPublicDataWithCache({
        scope: "tags",
        scopes: parsePublicDataCacheScopes("tags"),
        request: tagCacheRequest(),
        getStore: async () => store,
        isValue: isTagSummaryList,
        ttl: { freshTtlMs: 100, normalTtlMs: 200, faultTtlMs: 300 },
        load: async () => {
            loads += 1;
            return refreshedRows;
        },
        waitUntil: (promise) => scheduled.push(promise),
        now: () => 1_150
    });

    assert.deepEqual(result, { value: tagRows, cacheState: "STALE-REFRESH" });
    assert.equal(scheduled.length, 1);
    await scheduled[0];
    assert.equal(loads, 1);
    assert.equal(store.puts, 1);
    assert.equal(store.writtenRequest?.url, tagCacheRequest().url);
});

test("background refresh failures are handled and do not pin the single-flight key", async () => {
    const store = new FakeCacheStore();
    store.response = cacheResponse(tagRows);
    const scheduled: Promise<unknown>[] = [];
    let loads = 0;

    const stale = await loadPublicDataWithCache({
        scope: "tags",
        scopes: parsePublicDataCacheScopes("tags"),
        request: tagCacheRequest("失败重试"),
        getStore: async () => store,
        isValue: isTagSummaryList,
        ttl: { freshTtlMs: 100, normalTtlMs: 200, faultTtlMs: 300 },
        load: async () => {
            loads += 1;
            throw new Error("D1 unavailable");
        },
        waitUntil: (promise) => scheduled.push(promise),
        now: () => 1_150
    });

    assert.equal(stale.cacheState, "STALE-REFRESH");
    await scheduled[0];

    store.response = undefined;
    const retry = await loadPublicDataWithCache({
        scope: "tags",
        scopes: parsePublicDataCacheScopes("tags"),
        request: tagCacheRequest("失败重试"),
        getStore: async () => store,
        isValue: isTagSummaryList,
        ttl: { freshTtlMs: 100, normalTtlMs: 200, faultTtlMs: 300 },
        load: async () => {
            loads += 1;
            return tagRows;
        },
        waitUntil: () => assert.fail("misses refresh synchronously"),
        now: () => 1_150
    });

    assert.equal(retry.cacheState, "MISS");
    assert.equal(loads, 2);
});

test("fault-stale data refreshes synchronously and falls back only on D1 errors", async () => {
    const refreshedStore = new FakeCacheStore();
    refreshedStore.response = cacheResponse(tagRows);
    const refreshedRows = [{ id: 2, name: "音乐节", event_count: 5 }];

    const refreshed = await loadPublicDataWithCache({
        scope: "tags",
        scopes: parsePublicDataCacheScopes("tags"),
        request: tagCacheRequest("同步刷新"),
        getStore: async () => refreshedStore,
        isValue: isTagSummaryList,
        ttl: { freshTtlMs: 100, normalTtlMs: 200, faultTtlMs: 300 },
        load: async () => refreshedRows,
        waitUntil: () => assert.fail("fault-stale refreshes must block"),
        now: () => 1_250
    });
    assert.deepEqual(refreshed, { value: refreshedRows, cacheState: "REFRESHED" });

    const fallbackStore = new FakeCacheStore();
    fallbackStore.response = cacheResponse(tagRows);
    const fallback = await loadPublicDataWithCache({
        scope: "tags",
        scopes: parsePublicDataCacheScopes("tags"),
        request: tagCacheRequest("故障旧值"),
        getStore: async () => fallbackStore,
        isValue: isTagSummaryList,
        ttl: { freshTtlMs: 100, normalTtlMs: 200, faultTtlMs: 300 },
        load: async () => {
            throw new Error("D1 unavailable");
        },
        waitUntil: () => assert.fail("fault-stale refreshes must block"),
        now: () => 1_250
    });
    assert.deepEqual(fallback, { value: tagRows, cacheState: "STALE-IF-ERROR" });
});

test("hard-expired data never masks a D1 failure", async () => {
    const store = new FakeCacheStore();
    store.response = cacheResponse(tagRows);

    await assert.rejects(
        loadPublicDataWithCache({
            scope: "tags",
            scopes: parsePublicDataCacheScopes("tags"),
            request: tagCacheRequest("硬过期"),
            getStore: async () => store,
            isValue: isTagSummaryList,
            ttl: { freshTtlMs: 100, normalTtlMs: 200, faultTtlMs: 300 },
            load: async () => {
                throw new Error("D1 unavailable");
            },
            waitUntil: () => assert.fail("hard-expired refreshes must block"),
            now: () => 1_301
        }),
        /D1 unavailable/
    );
});

test("cache failures safely load D1 and cache write failures preserve success", async () => {
    const request = tagCacheRequest("缓存故障");
    let loads = 0;
    const unavailableStore = await loadPublicDataWithCache({
        scope: "tags",
        scopes: parsePublicDataCacheScopes("tags"),
        request,
        getStore: async () => {
            throw new Error("Cache API unavailable");
        },
        isValue: isTagSummaryList,
        ttl: { freshTtlMs: 100, normalTtlMs: 200, faultTtlMs: 300 },
        load: async () => {
            loads += 1;
            return tagRows;
        },
        waitUntil: () => assert.fail("misses refresh synchronously"),
        now: () => 1_000
    });
    assert.deepEqual(unavailableStore, { value: tagRows, cacheState: "MISS" });

    const writeFailureStore = new FakeCacheStore();
    writeFailureStore.putError = new Error("Cache put failed");
    const writeFailure = await loadPublicDataWithCache({
        scope: "tags",
        scopes: parsePublicDataCacheScopes("tags"),
        request,
        getStore: async () => writeFailureStore,
        isValue: isTagSummaryList,
        ttl: { freshTtlMs: 100, normalTtlMs: 200, faultTtlMs: 300 },
        load: async () => {
            loads += 1;
            return tagRows;
        },
        waitUntil: () => assert.fail("misses refresh synchronously"),
        now: () => 1_000
    });
    assert.deepEqual(writeFailure, { value: tagRows, cacheState: "MISS" });
    assert.equal(loads, 2);
});

test("waitUntil failures do not replace a successful D1 response", async () => {
    const store = new FakeCacheStore();
    const result = await loadPublicDataWithCache({
        scope: "tags",
        scopes: parsePublicDataCacheScopes("tags"),
        request: tagCacheRequest("调度故障"),
        getStore: async () => store,
        isValue: isTagSummaryList,
        ttl: { freshTtlMs: 100, normalTtlMs: 200, faultTtlMs: 300 },
        load: async () => tagRows,
        waitUntil: () => {
            throw new Error("waitUntil unavailable");
        },
        now: () => 1_000
    });

    assert.deepEqual(result, { value: tagRows, cacheState: "MISS" });
});

test("same-isolate misses share one loader while different keys remain independent", async () => {
    const store = new FakeCacheStore();
    const inFlight = new Map<string, Promise<unknown>>();
    let sameKeyLoads = 0;
    const sharedOptions = {
        scope: "tags" as const,
        scopes: parsePublicDataCacheScopes("tags"),
        request: tagCacheRequest("并发"),
        getStore: async () => store,
        isValue: isTagSummaryList,
        ttl: { freshTtlMs: 100, normalTtlMs: 200, faultTtlMs: 300 },
        load: async () => {
            sameKeyLoads += 1;
            await new Promise((resolve) => setTimeout(resolve, 5));
            return tagRows;
        },
        waitUntil: () => assert.fail("misses refresh synchronously"),
        inFlight,
        now: () => 1_000
    };

    const [first, second] = await Promise.all([
        loadPublicDataWithCache(sharedOptions),
        loadPublicDataWithCache(sharedOptions)
    ]);
    assert.equal(sameKeyLoads, 1);
    assert.equal(first.cacheState, "MISS");
    assert.equal(second.cacheState, "MISS");
    assert.equal(inFlight.size, 0);

    let differentKeyLoads = 0;
    await Promise.all(
        ["独立一", "独立二"].map((query) =>
            loadPublicDataWithCache({
                ...sharedOptions,
                request: tagCacheRequest(query),
                load: async () => {
                    differentKeyLoads += 1;
                    return tagRows;
                }
            })
        )
    );
    assert.equal(differentKeyLoads, 2);
});

test("tags adapter normalizes keys, enforces admission, and writes the approved TTLs", async () => {
    const store = new FakeCacheStore();
    let storeOpens = 0;
    const result = await loadCachedPublicTags({
        origin: "https://acg.example/api/tags?ignored=true",
        configuredScopes: "tags,sitemap",
        query: "  同人展  ",
        limit: 12,
        load: async () => tagRows,
        waitUntil: () => assert.fail("misses refresh synchronously"),
        getStore: async () => {
            storeOpens += 1;
            return store;
        },
        now: () => 10_000
    });

    assert.equal(result.cacheState, "MISS");
    assert.equal(storeOpens, 1);
    assert.equal(
        store.matchedRequest?.url,
        "https://acg.example/_eventlist_cache/v2/tag-search?q=%E5%90%8C%E4%BA%BA%E5%B1%95&limit=12"
    );
    const envelope = parseCachedEnvelope(await store.writtenResponse?.text());
    assert.ok(envelope);
    assert.equal(envelope.freshUntil - envelope.generatedAt, 30 * 60_000);
    assert.equal(envelope.normalUntil - envelope.generatedAt, 30 * 60_000);
    assert.equal(envelope.errorUntil - envelope.generatedAt, 48 * 60 * 60_000);
    assert.equal(store.writtenResponse?.headers.get("cache-tag"), PUBLIC_DATA_CACHE_TAGS.tags);

    const bypassStore = new FakeCacheStore();
    const bypass = await loadCachedPublicTags({
        origin: "https://acg.example",
        configuredScopes: "tags,sitemap",
        query: "x".repeat(25),
        limit: 12,
        load: async () => tagRows,
        waitUntil: () => assert.fail("bypass must not schedule work"),
        getStore: async () => bypassStore
    });
    assert.equal(bypass.cacheState, "BYPASS");
    assert.equal(bypassStore.matches, 0);
    assert.equal(bypassStore.puts, 0);
});

test("taxonomy adapter reuses the tags scope and validates its public DTO", async () => {
    const store = new FakeCacheStore();
    const result = await loadCachedPublicEventTaxonomy({
        origin: "https://acg.example/categories?ignored=true",
        configuredScopes: "tags",
        load: async () => taxonomyRows,
        waitUntil: () => assert.fail("misses refresh synchronously"),
        getStore: async () => store,
        now: () => 12_000
    });

    assert.equal(result.cacheState, "MISS");
    assert.equal(
        store.matchedRequest?.url,
        "https://acg.example/_eventlist_cache/v2/event-taxonomy"
    );
    const envelope = parseCachedEnvelope(await store.writtenResponse?.text());
    assert.ok(envelope);
    assert.equal(envelope.freshUntil - envelope.generatedAt, 30 * 60_000);
    assert.equal(envelope.normalUntil - envelope.generatedAt, 30 * 60_000);
    assert.equal(envelope.errorUntil - envelope.generatedAt, 48 * 60 * 60_000);
    assert.equal(store.writtenResponse?.headers.get("cache-tag"), PUBLIC_DATA_CACHE_TAGS.tags);
    assert.equal(isPublicEventTaxonomy(envelope.value), true);

    const bypassStore = new FakeCacheStore();
    const bypass = await loadCachedPublicEventTaxonomy({
        origin: "https://acg.example",
        configuredScopes: "list",
        load: async () => taxonomyRows,
        waitUntil: () => assert.fail("disabled scope must not schedule work"),
        getStore: async () => bypassStore
    });
    assert.equal(bypass.cacheState, "BYPASS");
    assert.equal(bypassStore.matches, 0);
    assert.equal(bypassStore.puts, 0);
});

test("route DTO guards reject unexpected fields before cached values reach responses", async () => {
    assert.equal(isTagSummaryList(tagRows), true);
    assert.equal(
        isTagSummaryList([{ ...tagRows[0], submitter_contact: "private@example.com" }]),
        false
    );
    assert.equal(isSitemapEventRowList(sitemapRows), true);
    assert.equal(isSitemapEventRowList([{ ...sitemapRows[0], reject_reason: "private" }]), false);

    const store = new FakeCacheStore();
    store.response = cacheResponse([{ ...tagRows[0], submitter_contact: "private@example.com" }]);
    let loads = 0;
    const result = await loadCachedPublicTags({
        origin: "https://acg.example",
        configuredScopes: "tags",
        query: "同人展",
        limit: 12,
        load: async () => {
            loads += 1;
            return tagRows;
        },
        waitUntil: () => assert.fail("misses refresh synchronously"),
        getStore: async () => store,
        now: () => 1_050
    });
    assert.equal(result.cacheState, "MISS");
    assert.equal(loads, 1);
});

test("homepage, popularity, and list guards enforce exact public DTO projections", () => {
    assert.equal(isPublicHomepageDiscovery(homepageDiscovery), true);
    assert.equal(
        isPublicHomepageDiscovery({
            ...homepageDiscovery,
            today: [{ ...publicEventRow, submitter_contact: "private@example.com" }]
        }),
        false
    );
    assert.equal(isPublicHomepagePopularity(homepagePopularity), true);
    assert.equal(
        isPublicHomepagePopularity({
            ...homepagePopularity,
            local: [{ ...homepagePopularity.local[0], source_url: "https://private.example" }]
        }),
        false
    );
    assert.equal(isPublicHomepagePopularity({ ...homepagePopularity, window: 14 }), false);
    assert.equal(isPublicEventPage(publicEventPage), true);
    assert.equal(
        isPublicEventPage({
            ...publicEventPage,
            events: [{ ...publicEventRow, reject_reason: "private" }]
        }),
        false
    );
    assert.equal(isPublicEventPage({ ...publicEventPage, pageSize: 51 }), false);
    assert.equal(
        isPublicHomepageDiscovery({
            ...homepageDiscovery,
            today: [{ ...publicEventRow, start_time: "9:00" }]
        }),
        false
    );
});

test("event detail cache guard requires the complete v2 static DTO and rejects dynamic heat", () => {
    assert.equal(isPublicEventDetail(publicEventDetail), true);
    assert.equal(isPublicEventDetail({ ...publicEventDetail, organizer: undefined }), false);
    assert.equal(isPublicEventDetail({ ...publicEventDetail, schedule_status: "delayed" }), false);
    assert.equal(
        isPublicEventDetail({ ...publicEventDetail, admission_start_date: "2026-02-30" }),
        false
    );
    assert.equal(
        isPublicEventDetail({ ...publicEventDetail, admission_start_time: "9:30" }),
        false
    );
    assert.equal(
        isPublicEventDetail({
            ...publicEventDetail,
            admission_start_date: null,
            admission_start_time: "09:30"
        }),
        false
    );
    assert.equal(isPublicEventDetail({ ...publicEventDetail, updated_at: "not-a-date" }), false);
    assert.equal(isPublicEventDetail({ ...publicEventDetail, recent_visitors: 12 }), false);
    assert.equal(isPublicEventDetail({ ...publicEventDetail, visitor_key: "secret" }), false);
});

test("homepage and popularity adapters use canonical keys and approved TTLs", async () => {
    const discoveryStore = new FakeCacheStore();
    let discoveryLoadDate: string | undefined;
    const discovery = await loadCachedHomepageDiscovery({
        origin: "https://acg.example/?city=ignored",
        configuredScopes: "homepage,popularity",
        divisionCode: "1101",
        asOfDate: "2026-08-01",
        load: async (asOfDate) => {
            discoveryLoadDate = asOfDate;
            return homepageDiscovery;
        },
        waitUntil: () => undefined,
        getStore: async () => discoveryStore,
        now: () => 10_000
    });
    assert.equal(discovery.cacheState, "MISS");
    assert.equal(
        discoveryStore.matchedRequest?.url,
        "https://acg.example/_eventlist_cache/v2/home-discovery?division=1101&date=2026-08-01"
    );
    assert.equal(discoveryLoadDate, "2026-08-01");
    const discoveryEnvelope = parseCachedEnvelope(await discoveryStore.writtenResponse?.text());
    assert.ok(discoveryEnvelope);
    assert.equal(discoveryEnvelope.freshUntil - discoveryEnvelope.generatedAt, 30 * 60_000);
    assert.equal(discoveryEnvelope.normalUntil - discoveryEnvelope.generatedAt, 30 * 60_000);
    assert.equal(discoveryEnvelope.errorUntil - discoveryEnvelope.generatedAt, 48 * 60 * 60_000);
    assert.equal(
        discoveryStore.writtenResponse?.headers.get("cache-tag"),
        PUBLIC_DATA_CACHE_TAGS.homepage
    );

    const popularityStore = new FakeCacheStore();
    const popularity = await loadCachedHomepagePopularity({
        origin: "https://acg.example/api/popularity?ignored=true",
        configuredScopes: "homepage,popularity",
        divisionCode: "1101",
        window: 7,
        load: async () => homepagePopularity,
        waitUntil: () => undefined,
        getStore: async () => popularityStore,
        now: () => 20_000
    });
    assert.equal(popularity.cacheState, "MISS");
    assert.equal(
        popularityStore.matchedRequest?.url,
        "https://acg.example/_eventlist_cache/v2/popularity?division=1101&window=7"
    );
    const popularityEnvelope = parseCachedEnvelope(await popularityStore.writtenResponse?.text());
    assert.ok(popularityEnvelope);
    assert.ok(popularityEnvelope.freshUntil - popularityEnvelope.generatedAt >= 45_000);
    assert.ok(popularityEnvelope.freshUntil - popularityEnvelope.generatedAt <= 55_000);
    assert.equal(popularityEnvelope.normalUntil - popularityEnvelope.generatedAt, 60_000);
    assert.equal(popularityEnvelope.errorUntil - popularityEnvelope.generatedAt, 5 * 60_000);
    assert.equal(
        popularityStore.writtenResponse?.headers.get("cache-tag"),
        PUBLIC_DATA_CACHE_TAGS.popularity
    );
});

test("integrated route miss paths stay below the ten-subrequest read budget", async () => {
    const homepageStores = [new FakeCacheStore(), new FakeCacheStore()];
    const homepageWrites: Promise<unknown>[] = [];
    let homepageD1Calls = 0;
    await Promise.all([
        loadCachedHomepageDiscovery({
            origin: "https://acg.example",
            configuredScopes: "homepage,popularity",
            divisionCode: "11",
            load: async () => {
                homepageD1Calls += 1;
                return homepageDiscovery;
            },
            waitUntil: (promise) => homepageWrites.push(promise),
            getStore: async () => homepageStores[0]
        }),
        loadCachedHomepagePopularity({
            origin: "https://acg.example",
            configuredScopes: "homepage,popularity",
            divisionCode: "11",
            window: 7,
            load: async () => {
                homepageD1Calls += 1;
                return homepagePopularity;
            },
            waitUntil: (promise) => homepageWrites.push(promise),
            getStore: async () => homepageStores[1]
        })
    ]);
    await Promise.all(homepageWrites);
    const homepageCalls =
        homepageD1Calls +
        homepageStores.reduce((total, store) => total + store.matches + store.puts, 0);
    assert.equal(homepageCalls, 6);
    assert.ok(homepageCalls <= 10);

    const listStores = [new FakeCacheStore(), new FakeCacheStore()];
    const listWrites: Promise<unknown>[] = [];
    let listD1Calls = 0;
    await Promise.all([
        loadCachedPublicTags({
            origin: "https://acg.example",
            configuredScopes: "tags,list",
            query: "",
            limit: 20,
            load: async () => {
                listD1Calls += 1;
                return tagRows;
            },
            waitUntil: (promise) => listWrites.push(promise),
            getStore: async () => listStores[0]
        }),
        loadCachedPublicEventList({
            origin: "https://acg.example",
            configuredScopes: "tags,list",
            filters: { page: 1, pageSize: 20 },
            load: async () => {
                listD1Calls += 1;
                return publicEventPage;
            },
            waitUntil: (promise) => listWrites.push(promise),
            getStore: async () => listStores[1]
        })
    ]);
    await Promise.all(listWrites);
    const listCalls =
        listD1Calls + listStores.reduce((total, store) => total + store.matches + store.puts, 0);
    assert.equal(listCalls, 6);
    assert.ok(listCalls <= 10);

    const detailStore = new FakeCacheStore();
    const detailWrites: Promise<unknown>[] = [];
    let detailD1Calls = 0;
    await Promise.all([
        loadCachedPublicEventDetail({
            origin: "https://acg.example",
            configuredScopes: "detail",
            eventId: 42,
            load: async () => {
                detailD1Calls += 1;
                return publicEventDetail;
            },
            waitUntil: (promise) => detailWrites.push(promise),
            getStore: async () => detailStore
        }),
        Promise.resolve().then(() => {
            detailD1Calls += 1;
        })
    ]);
    await Promise.all(detailWrites);
    const detailCalls = detailD1Calls + detailStore.matches + detailStore.puts;
    assert.equal(detailCalls, 4);
    assert.ok(detailCalls <= 10);
});

test("route adapters reject cached DTOs that do not match the requested key identity", async () => {
    const discoveryStore = new FakeCacheStore();
    discoveryStore.response = cacheResponse({
        ...homepageDiscovery,
        today: [{ ...publicEventRow, division_code: "310101" }]
    });
    let discoveryLoads = 0;
    const discovery = await loadCachedHomepageDiscovery({
        origin: "https://acg.example",
        configuredScopes: "homepage",
        divisionCode: "11",
        load: async () => {
            discoveryLoads += 1;
            return homepageDiscovery;
        },
        waitUntil: () => undefined,
        getStore: async () => discoveryStore,
        now: () => 1_050
    });
    assert.equal(discovery.cacheState, "MISS");
    assert.equal(discoveryLoads, 1);

    const popularityStore = new FakeCacheStore();
    popularityStore.response = cacheResponse({ ...homepagePopularity, window: 30 });
    let popularityLoads = 0;
    const popularity = await loadCachedHomepagePopularity({
        origin: "https://acg.example",
        configuredScopes: "popularity",
        divisionCode: "11",
        window: 7,
        load: async () => {
            popularityLoads += 1;
            return homepagePopularity;
        },
        waitUntil: () => undefined,
        getStore: async () => popularityStore,
        now: () => 1_050
    });
    assert.equal(popularity.cacheState, "MISS");
    assert.equal(popularityLoads, 1);

    const detailStore = new FakeCacheStore();
    detailStore.response = cacheResponse({ ...publicEventDetail, id: 43 });
    let detailLoads = 0;
    const detail = await loadCachedPublicEventDetail({
        origin: "https://acg.example",
        configuredScopes: "detail",
        eventId: 42,
        load: async () => {
            detailLoads += 1;
            return publicEventDetail;
        },
        waitUntil: () => undefined,
        getStore: async () => detailStore,
        now: () => 1_050
    });
    assert.equal(detail.cacheState, "MISS");
    assert.equal(detailLoads, 1);

    const listStore = new FakeCacheStore();
    listStore.response = cacheResponse({ ...publicEventPage, page: 2 });
    let listLoads = 0;
    const list = await loadCachedPublicEventList({
        origin: "https://acg.example",
        configuredScopes: "list",
        filters: { page: 1, pageSize: 20 },
        load: async () => {
            listLoads += 1;
            return publicEventPage;
        },
        waitUntil: () => undefined,
        getStore: async () => listStore,
        now: () => 1_050
    });
    assert.equal(list.cacheState, "MISS");
    assert.equal(listLoads, 1);
});

test("popularity faults use validated stale data and invalid scope configuration stays dark", async () => {
    const fallbackStore = new FakeCacheStore();
    fallbackStore.response = cacheResponse(homepagePopularity);
    const fallback = await loadCachedHomepagePopularity({
        origin: "https://acg.example",
        configuredScopes: "popularity",
        divisionCode: "1101",
        window: 7,
        load: async () => {
            throw new Error("D1 unavailable");
        },
        waitUntil: () => assert.fail("fault-stale refreshes must block"),
        getStore: async () => fallbackStore,
        now: () => 1_250
    });
    assert.deepEqual(fallback, {
        value: homepagePopularity,
        cacheState: "STALE-IF-ERROR"
    });

    const bypassStore = new FakeCacheStore();
    const bypass = await loadCachedHomepagePopularity({
        origin: "https://acg.example",
        configuredScopes: "popularity,unknown",
        divisionCode: "1101",
        window: 7,
        load: async () => homepagePopularity,
        waitUntil: () => assert.fail("bypass must not schedule work"),
        getStore: async () => bypassStore
    });
    assert.equal(bypass.cacheState, "BYPASS");
    assert.equal(bypassStore.matches, 0);
    assert.equal(bypassStore.puts, 0);
});

test("detail adapter never caches negative results or dynamic visitor heat", async () => {
    const negativeStore = new FakeCacheStore();
    const negative = await loadCachedPublicEventDetail({
        origin: "https://acg.example/events/999",
        configuredScopes: "detail",
        eventId: 999,
        load: async () => null,
        waitUntil: () => undefined,
        getStore: async () => negativeStore,
        now: () => 10_000
    });
    assert.deepEqual(negative, { value: null, cacheState: "MISS" });
    assert.equal(negativeStore.matches, 1);
    assert.equal(negativeStore.puts, 0);

    const staleStore = new FakeCacheStore();
    staleStore.response = cacheResponse(publicEventDetail);
    const confirmedMissing = await loadCachedPublicEventDetail({
        origin: "https://acg.example/events/42",
        configuredScopes: "detail",
        eventId: 42,
        load: async () => null,
        waitUntil: () => assert.fail("fault-stale refreshes must block"),
        getStore: async () => staleStore,
        now: () => 1_250
    });
    assert.deepEqual(confirmedMissing, { value: null, cacheState: "REFRESHED" });
    assert.equal(staleStore.puts, 0);

    const detailStore = new FakeCacheStore();
    const detail = await loadCachedPublicEventDetail({
        origin: "https://acg.example/events/42",
        configuredScopes: "detail",
        eventId: 42,
        load: async () => publicEventDetail,
        waitUntil: () => undefined,
        getStore: async () => detailStore,
        now: () => 20_000
    });
    assert.equal(detail.cacheState, "MISS");
    assert.equal(
        detailStore.matchedRequest?.url,
        "https://acg.example/_eventlist_cache/v2/event-detail?id=42"
    );
    const detailEnvelope = parseCachedEnvelope(await detailStore.writtenResponse?.text());
    assert.ok(detailEnvelope);
    assert.equal(detailEnvelope.freshUntil - detailEnvelope.generatedAt, 6 * 60 * 60_000);
    assert.equal(detailEnvelope.normalUntil - detailEnvelope.generatedAt, 6 * 60 * 60_000);
    assert.equal(detailEnvelope.errorUntil - detailEnvelope.generatedAt, 48 * 60 * 60_000);
    assert.equal(
        detailStore.writtenResponse?.headers.get("cache-tag"),
        `${PUBLIC_DATA_CACHE_TAGS.detail},eventlist-detail-42`
    );
    assert.equal(Object.hasOwn(detailEnvelope.value as object, "recentVisitorCount"), false);
});

test("list adapter admits only normalized bounded filters and pages one through three", async () => {
    const filters = {
        timing: "ended" as const,
        divisionCode: "11",
        type: "comic",
        scale: "small",
        tag: " 同人展 ",
        from: "2026-01-01",
        to: "2026-12-31",
        page: 3,
        pageSize: 20,
        sort: "end_desc" as const
    };
    assert.equal(isPublicEventListCacheable(filters), true);

    const store = new FakeCacheStore();
    let listLoadDate: string | undefined;
    const admitted = await loadCachedPublicEventList({
        origin: "https://acg.example/events?ignored=true",
        configuredScopes: "list",
        filters,
        asOfDate: "2026-08-01",
        load: async (asOfDate) => {
            listLoadDate = asOfDate;
            return { ...publicEventPage, page: 3 };
        },
        waitUntil: () => undefined,
        getStore: async () => store,
        now: () => 10_000
    });
    assert.equal(admitted.cacheState, "MISS");
    assert.equal(
        store.matchedRequest?.url,
        "https://acg.example/_eventlist_cache/v2/event-list?timing=ended&division=11&type=comic&scale=small&tag=%E5%90%8C%E4%BA%BA%E5%B1%95&from=2026-01-01&to=2026-12-31&starts=&active=&sort=end_desc&page=3&pageSize=20&date=2026-08-01"
    );
    assert.equal(listLoadDate, "2026-08-01");
    const envelope = parseCachedEnvelope(await store.writtenResponse?.text());
    assert.ok(envelope);
    assert.equal(envelope.freshUntil - envelope.generatedAt, 30 * 60_000);
    assert.equal(envelope.normalUntil - envelope.generatedAt, 30 * 60_000);
    assert.equal(envelope.errorUntil - envelope.generatedAt, 48 * 60 * 60_000);
    assert.equal(store.writtenResponse?.headers.get("cache-tag"), PUBLIC_DATA_CACHE_TAGS.list);

    for (const rejectedFilters of [
        { ...filters, page: 4 },
        { ...filters, tag: "x".repeat(25) },
        { ...filters, tag: "   " },
        { ...filters, type: "unknown" }
    ]) {
        assert.equal(isPublicEventListCacheable(rejectedFilters), false);
        const bypassStore = new FakeCacheStore();
        const bypass = await loadCachedPublicEventList({
            origin: "https://acg.example/events",
            configuredScopes: "list",
            filters: rejectedFilters,
            load: async () => ({
                ...publicEventPage,
                page: Math.max(1, rejectedFilters.page ?? 1),
                pageSize: Math.min(50, Math.max(1, rejectedFilters.pageSize ?? 20))
            }),
            waitUntil: () => assert.fail("bypass must not schedule work"),
            getStore: async () => bypassStore
        });
        assert.equal(bypass.cacheState, "BYPASS");
        assert.equal(bypassStore.matches, 0);
        assert.equal(bypassStore.puts, 0);
    }
});

test("sitemap adapter stores rows for six hours and retains them for 48-hour faults", async () => {
    const store = new FakeCacheStore();
    const miss = await loadCachedSitemapRows({
        origin: "https://acg.example",
        configuredScopes: "tags,sitemap",
        limit: 1000,
        load: async () => sitemapRows,
        waitUntil: () => assert.fail("misses refresh synchronously"),
        getStore: async () => store,
        now: () => 20_000
    });
    assert.equal(miss.cacheState, "MISS");
    const written = parseCachedEnvelope(await store.writtenResponse?.text());
    assert.ok(written);
    assert.equal(written.freshUntil - written.generatedAt, 6 * 60 * 60_000);
    assert.equal(written.normalUntil - written.generatedAt, 6 * 60 * 60_000);
    assert.equal(written.errorUntil - written.generatedAt, 48 * 60 * 60_000);
    assert.equal(store.writtenResponse?.headers.get("cache-tag"), PUBLIC_DATA_CACHE_TAGS.sitemap);

    const fallbackStore = new FakeCacheStore();
    fallbackStore.response = new Response(JSON.stringify(written));
    const fallback = await loadCachedSitemapRows({
        origin: "https://acg.example",
        configuredScopes: "sitemap",
        limit: 1000,
        load: async () => {
            throw new Error("D1 unavailable");
        },
        waitUntil: () => assert.fail("fault-stale refreshes must block"),
        getStore: async () => fallbackStore,
        now: () => written.normalUntil + 1
    });
    assert.deepEqual(fallback, { value: sitemapRows, cacheState: "STALE-IF-ERROR" });
});

test("cache response headers expose state and browser-cache policy", () => {
    assert.equal(combinePublicDataCacheStates([]), "BYPASS");
    assert.equal(combinePublicDataCacheStates(["BYPASS", "HIT"]), "HIT");
    assert.equal(combinePublicDataCacheStates(["STALE-REFRESH", "MISS"]), "MISS");
    assert.equal(combinePublicDataCacheStates(["REFRESHED", "STALE-IF-ERROR"]), "STALE-IF-ERROR");
    assert.deepEqual(publicDataCacheResponseHeaders("STALE-IF-ERROR"), {
        "X-Eventlist-Cache": "STALE-IF-ERROR",
        "Server-Timing": 'eventlist-cache;desc="STALE-IF-ERROR"'
    });
    assert.deepEqual(publicDataCacheResponseHeaders("HIT", "private, max-age=15"), {
        "X-Eventlist-Cache": "HIT",
        "Cache-Control": "private, max-age=15"
    });
});

test("public routes reuse cache adapters without changing route-specific isolation", async () => {
    const [homepagePage, homepageApi, popularityApi, eventsPage, detailPage] = await Promise.all(
        [
            "../src/pages/index.astro",
            "../src/pages/api/homepage.ts",
            "../src/pages/api/popularity.ts",
            "../src/pages/events/index.astro",
            "../src/pages/events/[id].astro"
        ].map((path) => readFile(new URL(path, import.meta.url), "utf8"))
    );

    assert.match(homepagePage, /Promise\.allSettled\(\[/);
    assert.match(homepagePage, /loadCachedHomepageDiscovery\(\{/);
    assert.match(homepagePage, /loadCachedHomepagePopularity\(\{/);
    assert.match(homepageApi, /Promise\.all\(\[/);
    assert.match(homepageApi, /loadCachedHomepageDiscovery\(\{/);
    assert.match(homepageApi, /loadCachedHomepagePopularity\(\{/);
    assert.match(popularityApi, /loadCachedHomepagePopularity\(\{/);
    assert.match(popularityApi, /publicDataCacheResponseHeaders\(result\.cacheState/);
    assert.match(popularityApi, /private, max-age=5/);

    assert.match(eventsPage, /loadCachedPublicTags\(\{/);
    assert.match(eventsPage, /query: ""/);
    assert.match(eventsPage, /loadCachedPublicEventList\(\{/);
    assert.match(eventsPage, /listPublishedEvents\(db, filters, asOfDate\)/);
    assert.match(detailPage, /loadCachedPublicEventDetail\(\{/);
    assert.match(detailPage, /getPublicEventRecentVisitorCount\(db, id\)/);
    assert.match(eventsPage, /tag: parseTag\(Astro\.url\.searchParams\.get\("tag"\)\)/);
    assert.match(detailPage, /Promise\.allSettled\(\[/);
    assert.match(detailPage, /活动热度暂时无法加载, 其他信息仍可正常查看/);
    assert.match(detailPage, /Astro\.response\.status = 404/);
    assert.match(detailPage, /data-event-view-endpoint/);
});
