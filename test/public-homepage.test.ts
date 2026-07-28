import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { EventRecord, HomepagePopularity, PopularEvent } from "../src/lib/db/queries";
import { isPopularityWindow, parsePopularityWindow } from "../src/lib/events/popularity";
import { toPublicFeaturedEvents, toPublicHomepagePopularity } from "../src/lib/public/homepage";

function event(id: number): EventRecord {
    return {
        id,
        title: `活动 ${id}`,
        type: "comic",
        scale: "large",
        division_code: "110101",
        venue: "测试场馆",
        address: "测试地址",
        start_date: "2026-07-27",
        end_date: "2026-07-28",
        start_time: "09:00",
        end_time: "18:00",
        cover_url: "https://example.com/cover.webp",
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
        tag_suggestions: "内部标签建议",
        tags: "同人展"
    };
}

function popularEvent(id: number, visitors: number): PopularEvent {
    return { ...event(id), unique_visitors: visitors };
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

test("热度窗口守卫只接受数值 3、7、30，URL 解析无效值回退到 7", () => {
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
    assert.match(source, /toPublicHomepagePopularity\(popularity\)/);
    assert.match(source, /jsonOk\(\{ popularity: publicPopularity \}\)/);
    assert.match(source, /jsonError\("热门活动暂时无法加载，请稍后重试", 500\)/);
    assert.doesNotMatch(source, /error instanceof Error \? error\.message/);
});
