import type { FieldErrors, SubmissionInput } from "./types";

const qqGroupPattern = /^[1-9]\d{4,11}$/;
const supportedProtocols = new Set(["http:", "https:"]);

export function validateSubmissionInput(input: SubmissionInput): FieldErrors {
    const errors: FieldErrors = {};

    requireText(errors, "name", input.name, "请填写活动名称。");
    requireText(errors, "city", input.city, "请填写城市。");
    requireText(errors, "venue", input.venue, "请填写场馆或地点。");
    requireText(errors, "startsAt", input.startsAt, "请选择开始时间。");
    requireText(errors, "endsAt", input.endsAt, "请选择结束时间。");
    requireText(errors, "typeText", input.typeText, "请填写活动类型。");
    requireText(errors, "eventIpText", input.eventIpText, "请填写活动 IP。");

    if (input.startsAt && input.endsAt) {
        const start = new Date(input.startsAt);
        const end = new Date(input.endsAt);

        if (Number.isNaN(start.getTime())) {
            errors.startsAt = "开始时间格式无效。";
        }

        if (Number.isNaN(end.getTime())) {
            errors.endsAt = "结束时间格式无效。";
        }

        if (
            !errors.startsAt &&
            !errors.endsAt &&
            end.getTime() < start.getTime()
        ) {
            errors.endsAt = "结束时间不能早于开始时间。";
        }
    }

    if (input.officialQqGroup && !qqGroupPattern.test(input.officialQqGroup)) {
        errors.officialQqGroup = "QQ群号应为 5 到 12 位数字。";
    }

    if (input.ticketUrl) {
        try {
            const url = new URL(input.ticketUrl);

            if (!supportedProtocols.has(url.protocol)) {
                errors.ticketUrl = "购票地址只支持 http 或 https。";
            }
        } catch {
            errors.ticketUrl = "购票地址格式无效。";
        }
    }

    return errors;
}

export function hasFieldErrors(errors: FieldErrors): boolean {
    return Object.keys(errors).length > 0;
}

function requireText(
    errors: FieldErrors,
    field: keyof SubmissionInput,
    value: string | undefined,
    message: string,
): void {
    if (!value || value.trim() === "") {
        errors[field] = message;
    }
}
