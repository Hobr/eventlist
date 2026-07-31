import assert from "node:assert/strict";
import test from "node:test";
import {
    parseEventForm,
    validateAdminEventInput,
    type AdminEventRawInput
} from "../src/lib/admin/form";

const VALID_EVENT: AdminEventRawInput = {
    title: "测试活动",
    type: "comic",
    scale: "small",
    division_code: "110101",
    venue: "测试场馆",
    address: "测试地址",
    start_date: "2026-08-01",
    end_date: "2026-08-02",
    start_time: "09:00",
    end_time: "18:00",
    cover_url: "https://example.com/cover.jpg",
    description: "活动描述",
    qq_group: "123456",
    ticket_url: "https://example.com/tickets",
    source_url: "https://example.com/source",
    submitter_contact: "admin@example.com",
    tags: "漫展、北京",
    organizer: "测试主办方",
    schedule_status: "cancelled",
    admission_method: "reservation",
    price_range: "免费",
    admission_start_date: "2026-07-20",
    admission_start_time: "09:30"
};

test("管理员活动校验返回全部字段错误", () => {
    const result = validateAdminEventInput({}, { requireTags: true });
    assert.equal(result.input, null);
    assert.deepEqual(
        new Set(result.errors.map(({ field }) => field)),
        new Set([
            "title",
            "type",
            "scale",
            "division_code",
            "venue",
            "start_date",
            "end_date",
            "source_url",
            "submitter_contact",
            "tags"
        ])
    );
});

test("现有 FormData 适配器保持管理员字段合同", () => {
    const formData = new FormData();
    for (const [field, value] of Object.entries(VALID_EVENT)) {
        if (value !== null && value !== undefined) formData.set(field, value);
    }

    const parsed = parseEventForm(formData);
    assert.equal(parsed.title, "测试活动");
    assert.equal(parsed.type, "comic");
    assert.equal(parsed.organizer, "测试主办方");
    assert.equal(parsed.schedule_status, "cancelled");
    assert.equal(parsed.admission_method, "reservation");
    assert.equal(parsed.admission_start_time, "09:30");
    assert.deepEqual(parsed.tags, ["漫展", "北京"]);
});

test("管理员活动校验规范化新增空字段", () => {
    const result = validateAdminEventInput({
        ...VALID_EVENT,
        organizer: "  ",
        schedule_status: "",
        admission_method: "",
        price_range: "",
        admission_start_date: "",
        admission_start_time: ""
    });

    assert.ok(result.input);
    assert.equal(result.input?.organizer, null);
    assert.equal(result.input?.schedule_status, null);
    assert.equal(result.input?.admission_method, null);
    assert.equal(result.input?.price_range, null);
    assert.equal(result.input?.admission_start_date, null);
    assert.equal(result.input?.admission_start_time, null);
});

test("管理员活动校验返回新增字段的精确错误", () => {
    const result = validateAdminEventInput({
        ...VALID_EVENT,
        organizer: "主".repeat(201),
        schedule_status: "delayed",
        admission_method: "vip",
        price_range: "票".repeat(121),
        admission_start_date: "",
        admission_start_time: "09:30"
    });

    assert.deepEqual(
        result.errors.map(({ field }) => field),
        ["organizer", "schedule_status", "admission_method", "price_range", "admission_start_time"]
    );
});

test("日期、时间和 URL 错误带有对应字段", () => {
    const result = validateAdminEventInput({
        ...VALID_EVENT,
        start_date: "2026-02-30",
        start_time: "25:00",
        source_url: "javascript:alert(1)"
    });

    assert.deepEqual(
        result.errors.map(({ field }) => field),
        ["start_date", "start_time", "source_url"]
    );
});

test("管理员表单只接受 HTTPS 封面", () => {
    const result = validateAdminEventInput({
        ...VALID_EVENT,
        cover_url: "http://example.com/cover.jpg"
    });

    assert.equal(result.input, null);
    assert.deepEqual(
        result.errors.map(({ field, message }) => ({ field, message })),
        [{ field: "cover_url", message: "封面 URL 必须使用 HTTPS" }]
    );
});
