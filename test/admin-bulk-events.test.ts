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
        活动类型: "综合商业展",
        活动规模: "小型 (100 - 1,000人)",
        行政区代码: "110101",
        场馆: "测试场馆",
        详细地址: "测试地址",
        开始日期: "2026-08-01",
        结束日期: "2026-08-02",
        开始时间: "09:00",
        结束时间: "18:00",
        封面URL: "https://example.com/cover.jpg",
        活动描述: '第一行, 包含逗号\n第二行包含"引号"',
        QQ群: "123456",
        购票地址: "https://example.com/tickets",
        来源链接: "https://example.com/source",
        联系信息: "admin@example.com",
        标签: "漫展、北京",
        主办方: "测试主办方",
        活动异常状态: "延期",
        入场方式: "预约",
        票价区间: "免费",
        "开始购票/预约/申请日期": "2026-07-20",
        "开始购票/预约/申请时间": "09:30",
        ...overrides
    };
    return BULK_EVENT_HEADERS.map((header) => values[header]);
}

test("模板包含 BOM、固定表头和一条有效示范活动", async () => {
    const template = createBulkEventTemplate();
    assert.ok(template.startsWith("\uFEFF"));
    assert.ok(template.slice(1).startsWith(`${BULK_EVENT_HEADERS.join(",")}\r\n`));

    const result = await parseBulkEventCsv(new File([template], "events.csv"));
    assert.equal(result.preview.valid, true);
    assert.equal(result.events.length, 1);
    assert.equal(result.events[0]?.event.title, "示例动漫嘉年华（导入前请修改或删除）");
    assert.equal(result.events[0]?.event.type, "comic");
    assert.equal(result.events[0]?.event.scale, "small");
    assert.deepEqual(result.events[0]?.event.tags, ["动漫", "漫展"]);
});

test("CSV 支持中文标签、逗号、引号和多行字段", async () => {
    const file = new File([makeCsv([validRow()])], "events.csv", { type: "text/csv" });
    const result = await parseBulkEventCsv(file);

    assert.equal(result.preview.valid, true);
    assert.equal(result.events.length, 1);
    assert.equal(result.events[0]?.event.type, "comic");
    assert.equal(result.events[0]?.event.scale, "small");
    assert.equal(result.events[0]?.event.schedule_status, "postponed");
    assert.equal(result.events[0]?.event.admission_method, "reservation");
    assert.equal(result.events[0]?.event.description, '第一行, 包含逗号\n第二行包含"引号"');
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
    const oldHeaders = BULK_EVENT_HEADERS.slice(0, 17);
    await assert.rejects(
        () => parseBulkEventCsv(new File(["wrong\r\nvalue"], "events.csv")),
        BulkEventCsvError
    );
    await assert.rejects(
        () => parseBulkEventCsv(new File([`${oldHeaders.join(",")}\r\n`], "events.csv")),
        /表头必须与下载模板完全一致/
    );
    await assert.rejects(
        () =>
            parseBulkEventCsv(
                new File([makeCsv(Array.from({ length: 21 }, () => validRow()))], "events.csv")
            ),
        /单次最多导入 20 条活动/
    );
});

test("CSV 拒绝无效 UTF-8、未闭合引号、无数据模板和非 CSV 扩展名", async () => {
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
        () =>
            parseBulkEventCsv(
                new File([`\uFEFF${BULK_EVENT_HEADERS.join(",")}\r\n`], "events.csv")
            ),
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
