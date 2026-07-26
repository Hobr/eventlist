import assert from "node:assert/strict";
import test from "node:test";
import {
    BULK_EVENT_HEADERS,
    BulkEventCsvError,
    createBulkEventTemplate,
    findBulkEventWarnings,
    parseBulkEventCsv
} from "../src/lib/admin/bulk-events";

function csvCell(value: string) {
    return `"${value.replaceAll('"', '""')}"`;
}

function makeCsv(rows: string[][]) {
    return [BULK_EVENT_HEADERS, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function validRow(overrides: Partial<Record<(typeof BULK_EVENT_HEADERS)[number], string>> = {}) {
    const values: Record<(typeof BULK_EVENT_HEADERS)[number], string> = {
        活动名称: "测试活动",
        活动类型: "漫展",
        活动规模: "小型(地区级)",
        行政区代码: "110101",
        场馆: "测试场馆",
        详细地址: "测试地址",
        开始日期: "2026-08-01",
        结束日期: "2026-08-02",
        开始时间: "09:00",
        结束时间: "18:00",
        封面URL: "https://example.com/cover.jpg",
        活动描述: '第一行，包含逗号\n第二行包含"引号"',
        QQ群: "123456",
        购票地址: "https://example.com/tickets",
        来源链接: "https://example.com/source",
        联系信息: "admin@example.com",
        标签: "漫展、北京",
        ...overrides
    };
    return BULK_EVENT_HEADERS.map((header) => values[header]);
}

test("模板只包含 BOM 和固定表头", () => {
    const template = createBulkEventTemplate();
    assert.ok(template.startsWith("\uFEFF"));
    assert.equal(template.slice(1), `${BULK_EVENT_HEADERS.join(",")}\r\n`);
});

test("CSV 支持中文标签、逗号、引号和多行字段", async () => {
    const file = new File([makeCsv([validRow()])], "events.csv", { type: "text/csv" });
    const result = await parseBulkEventCsv(file);

    assert.equal(result.preview.valid, true);
    assert.equal(result.events.length, 1);
    assert.equal(result.events[0]?.event.type, "comic");
    assert.equal(result.events[0]?.event.scale, "small");
    assert.equal(result.events[0]?.event.description, '第一行，包含逗号\n第二行包含"引号"');
    assert.deepEqual(result.events[0]?.event.tags, ["漫展", "北京"]);
});

test("CSV 返回逐记录字段错误且不接受逗号分隔标签", async () => {
    const file = new File(
        [
            makeCsv([
                validRow({ 活动名称: "", 标签: "漫展,北京" }),
                validRow({ 活动名称: "第二条", 来源链接: "invalid" })
            ])
        ],
        "events.csv"
    );
    const result = await parseBulkEventCsv(file);

    assert.equal(result.preview.valid, false);
    assert.ok(result.preview.errors.some(({ row, field }) => row === 2 && field === "活动名称"));
    assert.ok(result.preview.errors.some(({ row, field }) => row === 2 && field === "标签"));
    assert.ok(result.preview.errors.some(({ row, field }) => row === 3 && field === "来源链接"));
    assert.equal(result.events.length, 0);
});

test("CSV 强制使用模板表头和 20 条上限", async () => {
    await assert.rejects(
        () => parseBulkEventCsv(new File(["wrong\r\nvalue"], "events.csv")),
        BulkEventCsvError
    );
    await assert.rejects(
        () =>
            parseBulkEventCsv(
                new File([makeCsv(Array.from({ length: 21 }, () => validRow()))], "events.csv")
            ),
        /单次最多导入 20 条活动/
    );
});

test("CSV 拒绝无效 UTF-8、未闭合引号、空模板和非 CSV 扩展名", async () => {
    await assert.rejects(
        () => parseBulkEventCsv(new File([new Uint8Array([0xff, 0xfe, 0xfd])], "events.csv")),
        /UTF-8/
    );
    await assert.rejects(
        () =>
            parseBulkEventCsv(
                new File([`${BULK_EVENT_HEADERS.join(",")}\r\n\"unclosed`], "events.csv")
            ),
        /CSV 格式无效/
    );
    await assert.rejects(
        () => parseBulkEventCsv(new File([createBulkEventTemplate()], "events.csv")),
        /至少需要包含 1 条活动/
    );
    await assert.rejects(
        () => parseBulkEventCsv(new File([makeCsv([validRow()])], "events.txt")),
        /请选择 \.csv 文件/
    );
});

test("疑似重复警告区分 CSV 记录和数据库活动", async () => {
    const file = new File(
        [
            makeCsv([
                validRow({ 场馆: "测试 场馆" }),
                validRow({ 活动名称: "  测试活动 ", 场馆: "测试  场馆" })
            ])
        ],
        "events.csv"
    );
    const parsed = await parseBulkEventCsv(file);
    const warnings = findBulkEventWarnings(parsed.events, [
        { id: 42, title: "测试活动", start_date: "2026-08-01", venue: "测试 场馆" }
    ]);

    assert.equal(warnings.filter(({ source }) => source === "csv").length, 1);
    assert.equal(warnings.filter(({ source }) => source === "database").length, 2);
    assert.equal(new Set(warnings.map(({ key }) => key)).size, warnings.length);
});
