import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { PublicEventDetail } from "../src/lib/db/public-events";
import { getEventDetailOptionalContent } from "../src/lib/events/detail";
import { buildEventJsonLd } from "../src/lib/seo";

function event(overrides: Partial<PublicEventDetail> = {}): PublicEventDetail {
    return {
        id: 1,
        title: "测试活动",
        type: "comic",
        scale: "mid",
        division_code: "110101",
        venue: "测试场馆",
        address: "测试地址",
        start_date: "2026-08-01",
        end_date: "2026-08-02",
        start_time: "09:00",
        end_time: "18:00",
        cover_url: "https://example.com/cover.webp",
        tags: "同人展",
        description: "活动介绍",
        qq_group: "123456",
        ticket_url: "https://example.com/tickets",
        source_url: "https://private.example.com/review-source",
        status: "published",
        updated_at: "2026-07-31 00:00:00",
        ...overrides
    };
}

test("活动详情可选信息将 null、空字符串和纯空白统一为空分支", () => {
    for (const emptyValue of [null, "", " \n\t"]) {
        assert.deepEqual(
            getEventDetailOptionalContent({
                description: emptyValue,
                address: emptyValue,
                qq_group: emptyValue,
                ticket_url: emptyValue,
                source_url: emptyValue
            }),
            {
                description: null,
                address: null,
                qqGroup: null,
                ticketUrl: null,
                sourceUrl: null,
                hasAction: false,
                hasAsideContent: false,
                hasOptionalContent: false
            }
        );
    }
});

test("活动详情可选信息严格优先购票链接, 并在缺少购票链接时回退到来源", () => {
    assert.deepEqual(getEventDetailOptionalContent(event()), {
        description: "活动介绍",
        address: "测试地址",
        qqGroup: "123456",
        ticketUrl: "https://example.com/tickets",
        sourceUrl: null,
        hasAction: true,
        hasAsideContent: true,
        hasOptionalContent: true
    });

    assert.deepEqual(
        getEventDetailOptionalContent(
            event({ ticket_url: " \n", source_url: " https://example.com/source " })
        ),
        {
            description: "活动介绍",
            address: "测试地址",
            qqGroup: "123456",
            ticketUrl: null,
            sourceUrl: "https://example.com/source",
            hasAction: true,
            hasAsideContent: true,
            hasOptionalContent: true
        }
    );
});

test("活动详情可选信息区分仅介绍和仅侧栏内容, 避免空白列与孤立分隔线", () => {
    assert.deepEqual(getEventDetailOptionalContent({ description: "活动介绍" }), {
        description: "活动介绍",
        address: null,
        qqGroup: null,
        ticketUrl: null,
        sourceUrl: null,
        hasAction: false,
        hasAsideContent: false,
        hasOptionalContent: true
    });

    assert.deepEqual(getEventDetailOptionalContent({ address: "测试地址", qq_group: "123456" }), {
        description: null,
        address: "测试地址",
        qqGroup: "123456",
        ticketUrl: null,
        sourceUrl: null,
        hasAction: false,
        hasAsideContent: true,
        hasOptionalContent: true
    });
});

test("活动详情模板按可选内容模型移除空标题、容器和分隔线", async () => {
    const source = await readFile(
        new URL("../src/pages/events/[id].astro", import.meta.url),
        "utf8"
    );

    assert.match(source, /getEventDetailOptionalContent\(event \?\? \{\}\)/);
    assert.match(source, /\{hasOptionalContent \? \(/);
    assert.match(source, /\{description \? \([\s\S]*活动介绍[\s\S]*\{description\}/);
    assert.match(source, /\{hasAsideContent \? \(/);
    assert.match(source, /\{hasAction \? \([\s\S]*参加活动[\s\S]*\) : null\}/);
    assert.match(source, /\{address \|\| qqGroup \? \(/);
    assert.match(source, /\{address \? \([\s\S]*详细地址[\s\S]*\{address\}/);
    assert.match(source, /\{qqGroup \? \([\s\S]*官方交流群[\s\S]*\{qqGroup\}/);
    assert.match(
        source,
        /\{ticketUrl \? \([\s\S]*查看购票页[\s\S]*\) : sourceUrl \? \([\s\S]*活动来源[\s\S]*\) : null\}/
    );
    assert.match(source, /hasAction \? "mt-2 border-t border-border pt-5" : ""/);
    assert.match(
        source,
        /description[\s\S]*\? "border-t border-border\/80 pt-7 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8"[\s\S]*: "max-w-\[21rem\]"/
    );
    assert.match(
        source,
        /description=\{event \? \(description \?\? undefined\) : "活动不存在或尚未公开。"\}/
    );
    assert.doesNotMatch(source, /暂无活动介绍|未填写/);
    assert.doesNotMatch(source, /href=\{event\.source_url\}/);
});

test("JSON-LD 保留有效公开详情和购票链接, 但不公开审核来源", () => {
    const jsonLd = buildEventJsonLd(event(), "https://example.com/events/1");
    const location = jsonLd.location as Record<string, unknown>;
    const offers = jsonLd.offers as Record<string, unknown>;

    assert.equal(jsonLd.description, "活动介绍");
    assert.equal(location.address, "测试地址");
    assert.equal(offers.url, "https://example.com/tickets");
    assert.equal("organizer" in jsonLd, false);
    assert.doesNotMatch(JSON.stringify(jsonLd), /private\.example\.com|review-source/);
});

test("JSON-LD 将 null、空字符串和纯空白可选值视为空值", () => {
    for (const emptyValue of [null, "", " \n\t"]) {
        const jsonLd = buildEventJsonLd(
            event({
                address: emptyValue,
                description: emptyValue,
                ticket_url: emptyValue
            }),
            "https://example.com/events/1"
        );
        const location = jsonLd.location as Record<string, unknown>;

        assert.notEqual(location.address, emptyValue);
        assert.equal("description" in jsonLd, false);
        assert.equal("offers" in jsonLd, false);
        assert.equal("organizer" in jsonLd, false);
        assert.doesNotMatch(JSON.stringify(jsonLd), /private\.example\.com|review-source/);
    }
});
