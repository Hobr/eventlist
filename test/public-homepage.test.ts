import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type {
    HomepageDiscovery,
    HomepagePopularity,
    RankedHomepageEvent
} from "../src/lib/db/homepage";
import type { PublicEventRow } from "../src/lib/db/public-events";
import type { RegionOption } from "../src/lib/divisions";
import { isPopularityWindow, parsePopularityWindow } from "../src/lib/events/popularity";
import {
    toPublicEventRow,
    toPublicFeaturedEvents,
    toPublicHomepageData,
    toPublicHomepageDiscovery,
    toPublicHomepagePopularity
} from "../src/lib/public/homepage";
import {
    buildHomepageUrl,
    homepagePopularityCacheKey,
    mergeHomepageHistoryState,
    readHomepageHistoryState,
    readHomepageResponse,
    readPopularityResponse
} from "../src/lib/public/homepage-client";

function readSource(path: string) {
    return readFile(new URL(path, import.meta.url), "utf8");
}

function event(id: number) {
    const publicRow: PublicEventRow = {
        id,
        title: `活动 ${id}`,
        type: "comic",
        scale: "large",
        division_code: "110101",
        venue: "测试场馆",
        start_date: "2026-08-12",
        end_date: "2026-08-13",
        start_time: "09:00",
        end_time: "18:00",
        cover_url: "https://example.com/cover.webp",
        tags: "同人展"
    };

    return {
        ...publicRow,
        address: "测试地址",
        description: "内部描述",
        qq_group: "123456",
        ticket_url: "https://example.com/ticket",
        source_url: "https://example.com/source",
        submitter_contact: "secret@example.com",
        status: "published",
        reject_reason: "内部审核字段",
        created_at: "2026-07-01 00:00:00",
        updated_at: "2026-07-01 00:00:00",
        published_at: "2026-07-01 00:00:00",
        tag_suggestions: "内部标签建议"
    };
}

function rankedEvent(id: number, visitors: number): RankedHomepageEvent {
    return {
        id,
        title: `活动 ${id}`,
        scale: "large",
        division_code: "110101",
        start_date: "2026-08-12",
        end_date: "2026-08-13",
        start_time: "09:00",
        end_time: "18:00",
        admission_start_date: "2026-08-08",
        admission_start_time: "10:00",
        unique_visitors: visitors
    };
}

const division: RegionOption = {
    code: "11",
    name: "北京市",
    label: "北京市",
    level: "province",
    province: "北京市",
    city: null,
    sort: 0
};

function publicHomepageBody() {
    const discovery: HomepageDiscovery = { featuredEvents: [event(1)] };
    const popularity: HomepagePopularity = {
        window: 7,
        unopened: {
            local: [rankedEvent(2, 12)],
            nationwide: [rankedEvent(3, 34)]
        },
        unended: {
            local: [rankedEvent(4, 56)],
            nationwide: [rankedEvent(5, 78)]
        }
    };

    return {
        ok: true,
        data: { homepage: toPublicHomepageData(division, discovery, popularity) }
    };
}

test("首页公开主推荐投影只保留展示字段", () => {
    const projected = toPublicFeaturedEvents([event(1)]);

    assert.deepEqual(projected, [
        {
            id: 1,
            title: "活动 1",
            scale: "large",
            division_code: "110101",
            start_date: "2026-08-12",
            end_date: "2026-08-13",
            start_time: "09:00",
            end_time: "18:00",
            cover_url: "https://example.com/cover.webp"
        }
    ]);
    assert.doesNotMatch(
        JSON.stringify(projected),
        /submitter_contact|source_url|status|reject_reason|tag_suggestions/
    );
});

test("首页发现缓存投影只包含主推荐", () => {
    const discovery: HomepageDiscovery = { featuredEvents: [event(1)] };
    const projected = toPublicHomepageDiscovery(discovery);

    assert.deepEqual(projected, {
        featuredEvents: toPublicFeaturedEvents(discovery.featuredEvents)
    });
    assert.doesNotMatch(JSON.stringify(projected), /today|submitter_contact|source_url|status/);
});

test("首页四榜投影只保留场景展示字段", () => {
    const popularity: HomepagePopularity = {
        window: 7,
        unopened: { local: [rankedEvent(1, 12)], nationwide: [rankedEvent(2, 34)] },
        unended: { local: [rankedEvent(3, 56)], nationwide: [rankedEvent(4, 78)] }
    };
    const projected = toPublicHomepagePopularity(popularity);

    assert.deepEqual(projected.unopened.local[0], {
        id: 1,
        title: "活动 1",
        division_code: "110101",
        start_date: "2026-08-12",
        end_date: "2026-08-13",
        start_time: "09:00",
        end_time: "18:00",
        admission_start_date: "2026-08-08",
        admission_start_time: "10:00",
        unique_visitors: 12
    });
    assert.deepEqual(Object.keys(projected).sort(), ["unended", "unopened", "window"]);
    assert.doesNotMatch(
        JSON.stringify(projected),
        /scale|submitter_contact|source_url|status|reject_reason|tag_suggestions/
    );
});

test("首页完整快照不再包含旧今日活动合同", () => {
    const row = toPublicEventRow(event(5));
    assert.equal(row.id, 5);

    const homepage = publicHomepageBody().data.homepage;
    assert.equal(homepage.division.code, "11");
    assert.equal("today" in homepage, false);
    assert.doesNotMatch(
        JSON.stringify(homepage),
        /submitter_contact|source_url|status|reject_reason|tag_suggestions|description/
    );
});

test("首页浏览器响应严格拒绝地区窗口额外字段和非法时间", () => {
    const body = publicHomepageBody();
    const parsed = readHomepageResponse(body, "11", 7);
    assert.ok(parsed);
    assert.equal(parsed.division.label, "北京市");
    assert.equal(readHomepageResponse(body, "31", 7), null);
    assert.equal(readHomepageResponse(body, "11", 30), null);

    const extra = structuredClone(body) as typeof body & {
        data: { homepage: typeof body.data.homepage & { internal?: string } };
    };
    extra.data.homepage.internal = "不能进入客户端状态";
    assert.equal(readHomepageResponse(extra, "11", 7), null);

    const invalid = structuredClone(body);
    invalid.data.homepage.popularity.unopened.local[0]!.admission_start_time = "9:00";
    assert.equal(readHomepageResponse(invalid, "11", 7), null);

    assert.deepEqual(
        readPopularityResponse({ ok: true, data: { popularity: parsed.popularity } }, 7),
        parsed.popularity
    );
});

test("首页 URL, 榜单缓存和 history helper 保留无关浏览器状态", () => {
    assert.equal(homepagePopularityCacheKey("31", 30), "31:30");

    const nextUrl = buildHomepageUrl(
        new URL("https://example.com/?ref=nav&city=11&trend=7#intent-feed"),
        "31",
        30
    );
    assert.equal(nextUrl.href, "https://example.com/?ref=nav&city=31&trend=30#intent-feed");

    const merged = mergeHomepageHistoryState(
        { astro: { index: 2 }, untouched: true },
        { city: "31", trend: 30, sourceLabel: "手动选择" }
    );
    assert.deepEqual(merged.astro, { index: 2 });
    assert.equal(merged.untouched, true);
    assert.deepEqual(readHomepageHistoryState(merged), {
        city: "31",
        trend: 30,
        sourceLabel: "手动选择"
    });
    assert.equal(readHomepageHistoryState({ eventlistHomepage: { city: "31", trend: 9 } }), null);
});

test("热度窗口守卫只接受数值 3, 7, 30", () => {
    assert.equal(isPopularityWindow(3), true);
    assert.equal(isPopularityWindow(7), true);
    assert.equal(isPopularityWindow(30), true);
    assert.equal(isPopularityWindow("3"), false);
    assert.equal(isPopularityWindow(0), false);
    assert.equal(parsePopularityWindow("30"), 30);
    assert.equal(parsePopularityWindow("invalid"), 7);
    assert.equal(parsePopularityWindow(null), 7);
});

test("热门 API 使用共享校验, 投影和稳定 JSON 错误", async () => {
    const source = await readSource("../src/pages/api/popularity.ts");

    assert.match(source, /isRegionCode\(city\)/);
    assert.match(source, /isPopularityWindow\(window\)/);
    assert.match(source, /loadCachedHomepagePopularity\(\{/);
    assert.match(source, /toPublicHomepagePopularity\(await listHomepagePopularity/);
    assert.match(source, /\{ popularity: result\.value \}/);
    assert.match(source, /publicDataCacheResponseHeaders\(result\.cacheState/);
    assert.match(source, /jsonError\("热门活动暂时无法加载, 请稍后重试", 500\)/);
    assert.doesNotMatch(source, /error instanceof Error \? error\.message/);
});

test("首页快照 API 严格校验参数并以一次全有或全无响应提交", async () => {
    const source = await readSource("../src/pages/api/homepage.ts");

    assert.match(source, /isRegionCode\(city\)/);
    assert.match(source, /isPopularityWindow\(window\)/);
    assert.match(source, /getRegionOptionByCode\(city\)/);
    assert.match(source, /Promise\.all\(\[/);
    assert.match(source, /loadCachedHomepageDiscovery\(\{/);
    assert.match(source, /listHomepageDiscovery\(db, city, asOfDate\)/);
    assert.match(source, /loadCachedHomepagePopularity\(\{/);
    assert.match(source, /listHomepagePopularity\(db, city, window\)/);
    assert.match(source, /const homepage: PublicHomepageData =/);
    assert.match(source, /\{ homepage \}/);
    assert.match(source, /jsonError\("首页活动暂时无法加载, 请稍后重试", 500\)/);
});

test("地区快照请求丢弃过期响应并只在成功后提交历史和偏好", async () => {
    const nav = await readSource("../src/components/NavLocationPicker.svelte");

    assert.match(nav, /const requestId = \+\+requestSequence/);
    assert.match(nav, /requestController\?\.abort\(\)/);
    assert.match(nav, /requestId !== requestSequence/);
    assert.match(nav, /readHomepageResponse\(body, city, trend\)/);
    assert.match(nav, /historyMode: "push"/);
    assert.match(nav, /historyMode: "replace"/);
    assert.match(nav, /historyMode: "none"/);
    assert.match(nav, /window\.addEventListener\("popstate"/);
    assert.match(nav, /writeDivisionPreference\(homepage\.division\.code\)/);
    assert.match(nav, /HOMEPAGE_DATA_EVENT/);
    assert.match(nav, /使用普通页面导航打开该地区/);
});

test("首页快照岛独占 Hero 和双场景渲染且不发起第二组请求", async () => {
    const [content, indexPage, eventCard, intentFeed] = await Promise.all(
        [
            "../src/components/HomepageContent.svelte",
            "../src/pages/index.astro",
            "../src/components/EventCard.astro",
            "../src/components/HomepageIntentFeed.svelte"
        ].map(readSource)
    );

    assert.match(content, /homepage = detail\.homepage/);
    assert.match(content, /<FeaturedEventCarousel/);
    assert.match(content, /<HomepageIntentFeed/);
    assert.doesNotMatch(content, /HomepagePopularity|HomepageToday|fetch\(/);

    assert.match(indexPage, /<HomepageContent[\s\S]*client:load/);
    assert.doesNotMatch(indexPage, /<HomepageIntentFeed|<EventCard/);
    assert.match(eventCard, /<EventRow event=\{toPublicEventRow\(event\)\}/);
    assert.match(intentFeed, /popularity\.unopened\.local/);
    assert.match(intentFeed, /popularity\.unended\.nationwide/);
});

test("双场景组件隔离缓存, 共享窗口, 且无 JS 时保留两个场景", async () => {
    const [intentFeed, rankedList] = await Promise.all(
        [
            "../src/components/HomepageIntentFeed.svelte",
            "../src/components/HomepageRankedList.svelte"
        ].map(readSource)
    );

    assert.match(intentFeed, /homepagePopularityCacheKey\(requestCity, trend\)/);
    assert.match(intentFeed, /requestCity !== divisionCode/);
    assert.match(intentFeed, /history\.replaceState/);
    assert.match(intentFeed, /let hydrated = \$state\(false\)/);
    assert.match(intentFeed, /let mobileScene = \$state<"unended" \| "unopened">\("unended"\)/);
    assert.equal(intentFeed.match(/\{#each POPULARITY_WINDOWS/g)?.length, 1);
    assert.match(intentFeed, /id="unended-heading"/);
    assert.match(intentFeed, /id="unopened-heading"/);
    assert.match(intentFeed, /class:hidden=\{hydrated && mobileScene !== "unended"\}/);
    assert.match(intentFeed, /class:hidden=\{hydrated && mobileScene !== "unopened"\}/);
    assert.match(rankedList, /今日开票: 时间待定/);
    assert.match(rankedList, /href=\{`\/events\/\$\{event\.id\}`\}/);
});

test("地区选择外壳保留受控侧栏和默认导航行为", async () => {
    const [sidePanel, citySelector] = await Promise.all(
        ["../src/components/ui/side-panel.svelte", "../src/components/CitySelector.svelte"].map(
            readSource
        )
    );

    assert.match(sidePanel, /open = \$bindable\(false\)/);
    assert.match(citySelector, /navigateOnChange = true/);
    assert.match(citySelector, /if \(navigateOnChange\) navigateToDivision/);
});

test("地区切换后的新 Hero 复用稳定 reveal 容器", async () => {
    const [layout, content, carousel] = await Promise.all(
        [
            "../src/layouts/Layout.astro",
            "../src/components/HomepageContent.svelte",
            "../src/components/FeaturedEventCarousel.svelte"
        ].map(readSource)
    );

    assert.match(layout, /const intersectionObserver =/);
    assert.match(layout, /function registerRevealTree\(root: ParentNode\)/);
    assert.match(layout, /new MutationObserver/);
    assert.match(layout, /record\.addedNodes/);
    assert.match(layout, /registerRevealTree\(node\)/);
    assert.match(content, /<div data-reveal>\s*\{#key carouselKey\}/);
    assert.doesNotMatch(carousel, /data-reveal|out:fade/);
});
