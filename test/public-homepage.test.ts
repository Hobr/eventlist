import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { HomepageDiscovery, HomepagePopularity, PopularEvent } from "../src/lib/db/homepage";
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

function event(id: number) {
    const publicRow: PublicEventRow = {
        id,
        title: `活动 ${id}`,
        type: "comic",
        scale: "large",
        division_code: "110101",
        venue: "测试场馆",
        start_date: "2026-07-27",
        end_date: "2026-07-28",
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

function popularEvent(id: number, visitors: number): PopularEvent {
    return { ...event(id), unique_visitors: visitors };
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
    const discovery: HomepageDiscovery = {
        featuredEvents: [event(1)],
        today: [event(2)]
    };
    const popularity: HomepagePopularity = {
        window: 7,
        local: [popularEvent(3, 12)],
        nationwide: [popularEvent(4, 34)]
    };

    return {
        ok: true,
        data: {
            homepage: toPublicHomepageData(division, discovery, popularity)
        }
    };
}

test("首页公开主推荐投影只保留展示字段", () => {
    const projected = toPublicFeaturedEvents([event(1)]);

    assert.deepEqual(projected, [
        {
            id: 1,
            title: "活动 1",
            scale: "large",
            start_date: "2026-07-27",
            end_date: "2026-07-28",
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

test("首页发现缓存投影复用主推荐和今日活动白名单", () => {
    const discovery: HomepageDiscovery = {
        featuredEvents: [event(1)],
        today: [event(2)]
    };
    const projected = toPublicHomepageDiscovery(discovery);

    assert.deepEqual(projected.featuredEvents, toPublicFeaturedEvents(discovery.featuredEvents));
    assert.deepEqual(projected.today, discovery.today.map(toPublicEventRow));
    assert.doesNotMatch(
        JSON.stringify(projected),
        /submitter_contact|source_url|status|reject_reason|tag_suggestions/
    );
});

test("首页公开热门投影只保留排行展示字段", () => {
    const popularity: HomepagePopularity = {
        window: 7,
        local: [popularEvent(1, 12)],
        nationwide: [popularEvent(2, 34)]
    };
    const projected = toPublicHomepagePopularity(popularity);

    assert.deepEqual(projected, {
        window: 7,
        local: [
            {
                id: 1,
                title: "活动 1",
                division_code: "110101",
                start_date: "2026-07-27",
                unique_visitors: 12
            }
        ],
        nationwide: [
            {
                id: 2,
                title: "活动 2",
                division_code: "110101",
                start_date: "2026-07-27",
                unique_visitors: 34
            }
        ]
    });
    assert.doesNotMatch(
        JSON.stringify(projected),
        /submitter_contact|source_url|status|reject_reason|tag_suggestions/
    );
});

test("首页今日行和完整快照只逐字段投影公开展示数据", () => {
    const row = toPublicEventRow(event(5));
    assert.deepEqual(row, {
        id: 5,
        title: "活动 5",
        type: "comic",
        scale: "large",
        division_code: "110101",
        venue: "测试场馆",
        start_date: "2026-07-27",
        end_date: "2026-07-28",
        start_time: "09:00",
        end_time: "18:00",
        cover_url: "https://example.com/cover.webp",
        tags: "同人展"
    });

    const homepage = publicHomepageBody().data.homepage;
    assert.equal(homepage.division.code, "11");
    assert.deepEqual(homepage.today, [toPublicEventRow(event(2))]);
    assert.doesNotMatch(
        JSON.stringify(homepage),
        /submitter_contact|source_url|status|reject_reason|tag_suggestions|description/
    );
});

test("首页浏览器响应校验要求地区和窗口一致, 并重建字段白名单", () => {
    const body = publicHomepageBody();
    const rawHomepage = body.data.homepage as typeof body.data.homepage & {
        internal?: string;
    };
    rawHomepage.internal = "不能进入客户端状态";

    const parsed = readHomepageResponse(body, "11", 7);
    assert.ok(parsed);
    assert.equal(parsed.division.label, "北京市");
    assert.equal("internal" in parsed, false);
    assert.equal(readHomepageResponse(body, "31", 7), null);
    assert.equal(readHomepageResponse(body, "11", 30), null);

    const invalid = structuredClone(body);
    invalid.data.homepage.today[0]!.type = "invalid" as "comic";
    assert.equal(readHomepageResponse(invalid, "11", 7), null);

    assert.deepEqual(
        readPopularityResponse({ ok: true, data: { popularity: parsed.popularity } }, 7),
        {
            window: 7,
            local: parsed.popularity.local,
            nationwide: parsed.popularity.nationwide
        }
    );
});

test("首页 URL、热门缓存和 history 元数据 helper 保留无关浏览器状态", () => {
    assert.equal(homepagePopularityCacheKey("31", 30), "31:30");

    const nextUrl = buildHomepageUrl(
        new URL("https://example.com/?ref=nav&city=11&trend=7#today"),
        "31",
        30
    );
    assert.equal(nextUrl.href, "https://example.com/?ref=nav&city=31&trend=30#today");

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

test("热度窗口守卫只接受数值 3、7、30, URL 解析无效值回退到 7", () => {
    assert.equal(isPopularityWindow(3), true);
    assert.equal(isPopularityWindow(7), true);
    assert.equal(isPopularityWindow(30), true);
    assert.equal(isPopularityWindow("3"), false);
    assert.equal(isPopularityWindow(0), false);
    assert.equal(isPopularityWindow(31), false);
    assert.equal(parsePopularityWindow("30"), 30);
    assert.equal(parsePopularityWindow("invalid"), 7);
    assert.equal(parsePopularityWindow(null), 7);
});

test("热门 API 使用共享校验、投影和稳定 JSON 错误", async () => {
    const source = await readFile(
        new URL("../src/pages/api/popularity.ts", import.meta.url),
        "utf8"
    );

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
    const source = await readFile(new URL("../src/pages/api/homepage.ts", import.meta.url), "utf8");

    assert.match(source, /isRegionCode\(city\)/);
    assert.match(source, /isPopularityWindow\(window\)/);
    assert.match(source, /getRegionOptionByCode\(city\)/);
    assert.match(source, /Promise\.all\(\[/);
    assert.match(source, /loadCachedHomepageDiscovery\(\{/);
    assert.match(source, /listHomepageDiscovery\(db, city\)/);
    assert.match(source, /loadCachedHomepagePopularity\(\{/);
    assert.match(source, /listHomepagePopularity\(db, city, window\)/);
    assert.match(source, /const homepage: PublicHomepageData =/);
    assert.match(source, /\{ homepage \}/);
    assert.match(source, /jsonError\("首页活动暂时无法加载, 请稍后重试", 500\)/);
    assert.doesNotMatch(source, /error instanceof Error \? error\.message/);
});

test("首页客户端由单一快照事件提交, 并保持地区化缓存、竞态和历史合同", async () => {
    const [nav, content, popularity, indexPage, eventCard, today, sidePanel, citySelector] =
        await Promise.all(
            [
                "../src/components/NavLocationPicker.svelte",
                "../src/components/HomepageContent.svelte",
                "../src/components/HomepagePopularity.svelte",
                "../src/pages/index.astro",
                "../src/components/EventCard.astro",
                "../src/components/HomepageToday.svelte",
                "../src/components/ui/side-panel.svelte",
                "../src/components/CitySelector.svelte"
            ].map((path) => readFile(new URL(path, import.meta.url), "utf8"))
        );

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

    assert.match(content, /homepage = detail\.homepage/);
    assert.match(content, /<FeaturedEventCarousel/);
    assert.match(content, /<HomepagePopularity/);
    assert.match(content, /<HomepageToday/);
    assert.doesNotMatch(content, /fetch\(/);

    assert.match(popularity, /homepagePopularityCacheKey\(requestCity, trend\)/);
    assert.match(popularity, /requestCity !== divisionCode/);
    assert.match(popularity, /mergeHomepageHistoryState/);
    assert.match(popularity, /history\.replaceState/);

    assert.match(indexPage, /<HomepageContent[\s\S]*client:load/);
    assert.doesNotMatch(indexPage, /<HomepagePopularity/);
    assert.doesNotMatch(indexPage, /<EventCard/);
    assert.match(eventCard, /<EventRow event=\{toPublicEventRow\(event\)\}/);
    assert.match(today, /<EventRow \{event\}/);
    assert.match(sidePanel, /open = \$bindable\(false\)/);
    assert.match(citySelector, /navigateOnChange = true/);
    assert.match(citySelector, /if \(navigateOnChange\) navigateToDivision/);
});

test("地区切换后的新 Hero 复用稳定 reveal 容器, 动态 reveal 节点也会被注册", async () => {
    const [layout, content, carousel] = await Promise.all(
        [
            "../src/layouts/Layout.astro",
            "../src/components/HomepageContent.svelte",
            "../src/components/FeaturedEventCarousel.svelte"
        ].map((path) => readFile(new URL(path, import.meta.url), "utf8"))
    );

    assert.match(layout, /const intersectionObserver =/);
    assert.match(layout, /function registerRevealTree\(root: ParentNode\)/);
    assert.match(layout, /new MutationObserver/);
    assert.match(layout, /record\.addedNodes/);
    assert.match(layout, /registerRevealTree\(node\)/);
    assert.match(
        layout,
        /mutationObserver\.observe\(document\.body, \{ childList: true, subtree: true \}\)/
    );

    assert.match(content, /<div data-reveal>\s*\{#key carouselKey\}/);
    assert.doesNotMatch(carousel, /data-reveal/);
    assert.doesNotMatch(carousel, /out:fade/);
});
