import type { AdminEventInput } from "../db/queries";
import { isCountyDivisionCode } from "../divisions";
import { normalizeOptionalTime, validateEventSchedule } from "../events/datetime";
import { isEventScale, isEventType, type EventScale, type EventType } from "../events/options";

export const ADMIN_EVENT_FIELDS = [
    "title",
    "type",
    "scale",
    "division_code",
    "venue",
    "address",
    "start_date",
    "end_date",
    "start_time",
    "end_time",
    "cover_url",
    "description",
    "qq_group",
    "ticket_url",
    "source_url",
    "submitter_contact",
    "tags"
] as const;

export type AdminEventField = (typeof ADMIN_EVENT_FIELDS)[number];
export type AdminEventRawInput = Partial<Record<AdminEventField, string | null | undefined>>;

export const ADMIN_EVENT_FIELD_LABELS: Record<AdminEventField, string> = {
    title: "活动名称",
    type: "活动类型",
    scale: "活动规模",
    division_code: "行政区",
    venue: "场馆",
    address: "详细地址",
    start_date: "开始日期",
    end_date: "结束日期",
    start_time: "开始时间",
    end_time: "结束时间",
    cover_url: "封面 URL",
    description: "活动描述",
    qq_group: "QQ 群",
    ticket_url: "购票地址",
    source_url: "来源链接",
    submitter_contact: "联系信息",
    tags: "标签"
};

export interface AdminEventValidationOptions {
    requireTags?: boolean;
    tagSeparator?: RegExp;
}

export interface AdminEventValidationResult {
    input: AdminEventInput | null;
    errors: AdminEventValidationError[];
}

export class AdminEventValidationError extends Error {
    readonly field: AdminEventField;

    constructor(field: AdminEventField, message: string) {
        super(message);
        this.name = "AdminEventValidationError";
        this.field = field;
    }
}

function invalid(field: AdminEventField, message: string): never {
    throw new AdminEventValidationError(field, message);
}

function readRequired(input: AdminEventRawInput, field: AdminEventField) {
    const value = input[field];
    if (typeof value !== "string" || value.trim() === "") {
        invalid(field, `${ADMIN_EVENT_FIELD_LABELS[field]}为必填项`);
    }
    return value.trim();
}

function readOptional(input: AdminEventRawInput, field: AdminEventField) {
    const value = input[field];
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
}

function readEventType(input: AdminEventRawInput): EventType {
    const value = readRequired(input, "type");
    if (!isEventType(value)) invalid("type", "活动类型无效");
    return value;
}

function readEventScale(input: AdminEventRawInput): EventScale {
    const value = readRequired(input, "scale");
    if (!isEventScale(value)) invalid("scale", "活动规模无效");
    return value;
}

function readDate(input: AdminEventRawInput, field: "start_date" | "end_date") {
    const value = readRequired(input, field);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) invalid(field, `${ADMIN_EVENT_FIELD_LABELS[field]}格式无效`);

    const [, year, month, day] = match;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (date.toISOString().slice(0, 10) !== value) {
        invalid(field, `${ADMIN_EVENT_FIELD_LABELS[field]}格式无效`);
    }
    return value;
}

function readUrl(
    input: AdminEventRawInput,
    field: "cover_url" | "ticket_url" | "source_url",
    required = false
) {
    const value = required ? readRequired(input, field) : readOptional(input, field);
    if (!value) return null;

    try {
        const url = new URL(value);
        if (url.protocol !== "http:" && url.protocol !== "https:") {
            throw new Error("invalid protocol");
        }
        return url.toString();
    } catch {
        invalid(field, `${ADMIN_EVENT_FIELD_LABELS[field]}必须是有效的 http(s) URL`);
    }
}

function sqliteNoCaseKey(value: string) {
    return value.replace(/[A-Z]/g, (character) => character.toLowerCase());
}

function readTags(input: AdminEventRawInput, separator: RegExp) {
    const raw = readOptional(input, "tags") ?? "";
    const seen = new Set<string>();
    const tags: string[] = [];

    for (const value of raw.split(separator)) {
        const tag = value.trim();
        if (!tag) continue;
        if (tag.length > 24) invalid("tags", "标签不能超过 24 个字符");
        const key = sqliteNoCaseKey(tag);
        if (seen.has(key)) continue;
        seen.add(key);
        tags.push(tag);
    }

    if (tags.length > 12) invalid("tags", "最多只能添加 12 个标签");
    return tags;
}

function capture<T>(
    errors: AdminEventValidationError[],
    field: AdminEventField,
    read: () => T
): T | null {
    try {
        return read();
    } catch (error) {
        errors.push(
            error instanceof AdminEventValidationError
                ? error
                : new AdminEventValidationError(
                      field,
                      error instanceof Error
                          ? error.message
                          : `${ADMIN_EVENT_FIELD_LABELS[field]}无效`
                  )
        );
        return null;
    }
}

export function validateAdminEventInput(
    raw: AdminEventRawInput,
    options: AdminEventValidationOptions = {}
): AdminEventValidationResult {
    const errors: AdminEventValidationError[] = [];
    const title = capture(errors, "title", () => readRequired(raw, "title"));
    const type = capture(errors, "type", () => readEventType(raw));
    const scale = capture(errors, "scale", () => readEventScale(raw));
    const divisionCode = capture(errors, "division_code", () => {
        const value = readRequired(raw, "division_code");
        if (!isCountyDivisionCode(value)) invalid("division_code", "行政区无效");
        return value;
    });
    const venue = capture(errors, "venue", () => readRequired(raw, "venue"));
    const startDate = capture(errors, "start_date", () => readDate(raw, "start_date"));
    const endDate = capture(errors, "end_date", () => readDate(raw, "end_date"));
    const startTime = capture(errors, "start_time", () =>
        normalizeOptionalTime(readOptional(raw, "start_time"), "开始时间")
    );
    const endTime = capture(errors, "end_time", () =>
        normalizeOptionalTime(readOptional(raw, "end_time"), "结束时间")
    );
    const coverUrl = capture(errors, "cover_url", () => readUrl(raw, "cover_url"));
    const ticketUrl = capture(errors, "ticket_url", () => readUrl(raw, "ticket_url"));
    const sourceUrl = capture(errors, "source_url", () => readUrl(raw, "source_url", true));
    const submitterContact = capture(errors, "submitter_contact", () =>
        readRequired(raw, "submitter_contact")
    );
    const tags = capture(errors, "tags", () => readTags(raw, options.tagSeparator ?? /[,\n，、]/));

    if (startDate && endDate && endDate < startDate) {
        errors.push(new AdminEventValidationError("end_date", "结束日期不能早于开始日期"));
    }

    if (startDate && endDate && startTime !== null && endTime !== null) {
        try {
            validateEventSchedule({
                start_date: startDate,
                end_date: endDate,
                start_time: startTime,
                end_time: endTime
            });
        } catch (error) {
            errors.push(
                new AdminEventValidationError(
                    "end_time",
                    error instanceof Error ? error.message : "结束时间无效"
                )
            );
        }
    }

    if (options.requireTags && tags?.length === 0) {
        errors.push(new AdminEventValidationError("tags", "请至少选择或新增一个规范标签"));
    }

    if (
        errors.length > 0 ||
        !title ||
        !type ||
        !scale ||
        !divisionCode ||
        !venue ||
        !startDate ||
        !endDate ||
        !sourceUrl ||
        !submitterContact ||
        !tags
    ) {
        return { input: null, errors };
    }

    return {
        input: {
            title,
            type,
            scale,
            division_code: divisionCode,
            venue,
            address: readOptional(raw, "address"),
            start_date: startDate,
            end_date: endDate,
            start_time: startTime,
            end_time: endTime,
            cover_url: coverUrl,
            description: readOptional(raw, "description"),
            qq_group: readOptional(raw, "qq_group"),
            ticket_url: ticketUrl,
            source_url: sourceUrl,
            submitter_contact: submitterContact,
            tags
        },
        errors
    };
}

export function parseAdminEventInput(
    raw: AdminEventRawInput,
    options: AdminEventValidationOptions = {}
): AdminEventInput {
    const result = validateAdminEventInput(raw, options);
    if (!result.input) throw result.errors[0] ?? new Error("活动信息无效");
    return result.input;
}

export function parseEventForm(formData: FormData): AdminEventInput {
    const raw: AdminEventRawInput = {};
    for (const field of ADMIN_EVENT_FIELDS) {
        const value = formData.get(field);
        raw[field] = typeof value === "string" ? value : null;
    }
    return parseAdminEventInput(raw);
}
