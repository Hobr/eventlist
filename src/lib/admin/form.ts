import type { AdminEventInput } from "../db/queries";
import { isCountyDivisionCode } from "../divisions";
import { normalizeOptionalTime, validateEventSchedule } from "../events/datetime";
import { isEventScale, isEventType } from "../events/options";

function readRequired(formData: FormData, name: string) {
    const value = formData.get(name);
    if (typeof value !== "string" || value.trim() === "") {
        throw new Error(`${name} is required`);
    }

    return value.trim();
}

function readOptional(formData: FormData, name: string) {
    const value = formData.get(name);
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
}

function readEventType(formData: FormData) {
    const value = readRequired(formData, "type");
    if (!isEventType(value)) throw new Error("类型无效");
    return value;
}

function readEventScale(formData: FormData) {
    const value = readRequired(formData, "scale");
    if (!isEventScale(value)) throw new Error("规模无效");
    return value;
}

function readDate(formData: FormData, name: string, label: string) {
    const value = readRequired(formData, name);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) throw new Error(`${label}格式无效`);

    const [, year, month, day] = match;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (date.toISOString().slice(0, 10) !== value) throw new Error(`${label}格式无效`);
    return value;
}

function readUrl(formData: FormData, name: string, label: string, required: true): string;
function readUrl(formData: FormData, name: string, label: string, required?: false): string | null;
function readUrl(formData: FormData, name: string, label: string, required = false) {
    const value = required ? readRequired(formData, name) : readOptional(formData, name);
    if (!value) {
        if (required) throw new Error(`${label}为必填项`);
        return null;
    }

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

function sqliteNoCaseKey(value: string) {
    return value.replace(/[A-Z]/g, (character) => character.toLowerCase());
}

function readTags(formData: FormData) {
    const raw = readOptional(formData, "tags") ?? "";
    const seen = new Set<string>();
    const tags: string[] = [];

    for (const value of raw.split(/[,\n，、]/)) {
        const tag = value.trim();
        if (!tag) continue;
        if (tag.length > 24) throw new Error("标签不能超过 24 个字符");
        const key = sqliteNoCaseKey(tag);
        if (seen.has(key)) continue;
        seen.add(key);
        tags.push(tag);
    }

    if (tags.length > 12) throw new Error("最多只能添加 12 个标签");
    return tags;
}

export function parseEventForm(formData: FormData): AdminEventInput {
    const divisionCode = readRequired(formData, "division_code");
    if (!isCountyDivisionCode(divisionCode)) throw new Error("行政区无效");

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

    return {
        title: readRequired(formData, "title"),
        type: readEventType(formData),
        scale: readEventScale(formData),
        division_code: divisionCode,
        venue: readRequired(formData, "venue"),
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
        submitter_contact: readRequired(formData, "submitter_contact"),
        tags: readTags(formData)
    };
}
