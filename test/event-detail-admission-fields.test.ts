import assert from "node:assert/strict";
import test from "node:test";
import { parseSubmissionForm } from "../src/lib/public/form";

function validSubmissionForm() {
    const form = new FormData();
    for (const [name, value] of Object.entries({
        title: "测试活动",
        type: "comic",
        scale: "small",
        division_code: "110101",
        venue: "测试场馆",
        start_date: "2026-08-01",
        end_date: "2026-08-02",
        source_url: "https://example.com/source",
        submitter_contact: "submitter@example.com"
    })) {
        form.set(name, value);
    }
    return form;
}

test("公开投稿规范化全部新增可选活动字段", () => {
    const form = validSubmissionForm();
    form.set("organizer", "  主办方甲、主办方乙  ");
    form.set("schedule_status", "postponed");
    form.set("admission_method", "reservation");
    form.set("price_range", "  免费预约  ");
    form.set("admission_start_date", "2026-07-20");
    form.set("admission_start_time", "09:30");

    const input = parseSubmissionForm(form).input;
    assert.deepEqual(
        {
            organizer: input.organizer,
            schedule_status: input.schedule_status,
            admission_method: input.admission_method,
            price_range: input.price_range,
            admission_start_date: input.admission_start_date,
            admission_start_time: input.admission_start_time
        },
        {
            organizer: "主办方甲、主办方乙",
            schedule_status: "postponed",
            admission_method: "reservation",
            price_range: "免费预约",
            admission_start_date: "2026-07-20",
            admission_start_time: "09:30"
        }
    );
});

test("公开投稿将新增空字段规范化为 null", () => {
    const input = parseSubmissionForm(validSubmissionForm()).input;
    assert.equal(input.organizer, null);
    assert.equal(input.schedule_status, null);
    assert.equal(input.admission_method, null);
    assert.equal(input.price_range, null);
    assert.equal(input.admission_start_date, null);
    assert.equal(input.admission_start_time, null);
});

test("公开投稿拒绝非法枚举、超长文本和缺少日期的入场时间", () => {
    const cases: Array<[string, string, RegExp]> = [
        ["schedule_status", "delayed", /活动异常状态无效/],
        ["admission_method", "vip", /入场方式无效/],
        ["organizer", "主".repeat(201), /主办方不能超过 200 个字符/],
        ["price_range", "票".repeat(121), /票价区间不能超过 120 个字符/],
        ["admission_start_time", "09:30", /填写开始购票\/预约\/申请时间前请先填写日期/]
    ];

    for (const [name, value, expected] of cases) {
        const form = validSubmissionForm();
        form.set(name, value);
        assert.throws(() => parseSubmissionForm(form), expected);
    }
});
