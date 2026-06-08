import { describe, expect, it } from "vitest";
import { validateSubmissionInput } from "../../../src/server/events/validation";

const validInput = {
    name: "测试活动",
    city: "上海",
    venue: "测试场馆",
    startsAt: "2026-07-01T10:00:00.000Z",
    endsAt: "2026-07-01T12:00:00.000Z",
    typeText: "同人展",
    eventIpText: "原创",
};

describe("submission validation", () => {
    it("accepts required fields without optional contact or cover data", () => {
        expect(validateSubmissionInput(validInput)).toEqual({});
    });

    it("returns field-level errors for missing and malformed fields", () => {
        const errors = validateSubmissionInput({
            ...validInput,
            name: "",
            endsAt: "2026-06-30T12:00:00.000Z",
            officialQqGroup: "abc",
            ticketUrl: "ftp://example.test/ticket",
        });

        expect(errors.name).toBeTruthy();
        expect(errors.endsAt).toContain("不能早于");
        expect(errors.officialQqGroup).toContain("QQ群号");
        expect(errors.ticketUrl).toContain("http");
    });
});
