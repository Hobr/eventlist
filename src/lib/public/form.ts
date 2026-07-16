import type { SubmissionInput } from "../db/queries";
import { normalizeOptionalTime, validateEventSchedule } from "../events/datetime";

export interface ParsedSubmissionForm {
    input: SubmissionInput;
    turnstileToken: string | null;
}

const MAX_TAG_SUGGESTIONS_LENGTH = 240;

function readRequired(formData: FormData, name: string, label: string) {
    const value = formData.get(name);
    if (typeof value !== "string" || value.trim() === "") {
        throw new Error(`${label}为必填项`);
    }

    return value.trim();
}

function readOptional(formData: FormData, name: string) {
    const value = formData.get(name);
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
}

function readDivisionCode(formData: FormData) {
    const code = readRequired(formData, "division_code", "行政区");
    if (!/^\d{6}(\d{6})?$/.test(code)) {
        throw new Error("行政区无效");
    }

    return code;
}

function readDate(formData: FormData, name: string, label: string) {
    const value = readRequired(formData, name, label);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
        throw new Error(`${label}格式无效`);
    }

    const [, year, month, day] = match;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (date.toISOString().slice(0, 10) !== value) {
        throw new Error(`${label}格式无效`);
    }

    return value;
}

function readUrl(formData: FormData, name: string, label: string, required: true): string;
function readUrl(formData: FormData, name: string, label: string, required?: false): string | null;
function readUrl(formData: FormData, name: string, label: string, required = false) {
    const value = required ? readRequired(formData, name, label) : readOptional(formData, name);
    if (!value) return null;

    try {
        const url = new URL(value);
        if (url.protocol !== "http:" && url.protocol !== "https:") {
            throw new Error("invalid protocol");
        }
        return url.toString();
    } catch {
        throw new Error(`${label}必须是有效的 http(s) URL`);
    }
}

export function parseSubmissionForm(formData: FormData): ParsedSubmissionForm {
    const startDate = readDate(formData, "start_date", "开始日期");
    const endDate = readDate(formData, "end_date", "结束日期");
    if (endDate < startDate) {
        throw new Error("结束日期不能早于开始日期");
    }
    const startTime = normalizeOptionalTime(readOptional(formData, "start_time"), "开始时间");
    const endTime = normalizeOptionalTime(readOptional(formData, "end_time"), "结束时间");
    validateEventSchedule({
        start_date: startDate,
        end_date: endDate,
        start_time: startTime,
        end_time: endTime
    });
    const tagSuggestions =
        readOptional(formData, "tag_suggestions") ?? readOptional(formData, "tags");
    if (tagSuggestions && tagSuggestions.length > MAX_TAG_SUGGESTIONS_LENGTH) {
        throw new Error("标签描述不能超过 240 个字符");
    }

    return {
        input: {
            title: readRequired(formData, "title", "标题"),
            type: readRequired(formData, "type", "类型"),
            scale: readRequired(formData, "scale", "规模"),
            division_code: readDivisionCode(formData),
            venue: readRequired(formData, "venue", "地点"),
            address: readOptional(formData, "address"),
            start_date: startDate,
            end_date: endDate,
            start_time: startTime,
            end_time: endTime,
            cover_url: readUrl(formData, "cover_url", "封面 URL"),
            description: readOptional(formData, "description"),
            qq_group: readOptional(formData, "qq_group"),
            ticket_url: readUrl(formData, "ticket_url", "购票地址"),
            source_url: readUrl(formData, "source_url", "来源链接", true),
            submitter_contact: readRequired(formData, "submitter_contact", "联系方式"),
            tag_suggestions: tagSuggestions
        },
        turnstileToken: readOptional(formData, "cf-turnstile-response")
    };
}
