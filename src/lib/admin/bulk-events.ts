import { parse } from "csv-parse/browser/esm/sync";
import type { D1Database } from "../../types/cloudflare";
import type { AdminEventInput } from "../events/input";
import {
    EVENT_ADMISSION_METHODS,
    EVENT_SCALES,
    EVENT_SCHEDULE_STATUSES,
    EVENT_TYPES,
    type EventOption
} from "../events/options";
import {
    ADMIN_EVENT_FIELD_LABELS,
    validateAdminEventInput,
    type AdminEventField,
    type AdminEventRawInput
} from "./form";
import {
    eventDuplicateKey,
    findEventDuplicateCandidates,
    normalizeEventDuplicatePart,
    type EventDuplicateCandidate
} from "./event-duplicates";

export const MAX_BULK_EVENT_FILE_BYTES = 1024 * 1024;
export const MAX_BULK_EVENT_ROWS = 20;

export const BULK_EVENT_COLUMNS = [
    { header: "活动名称", field: "title" },
    { header: "活动类型", field: "type" },
    { header: "活动规模", field: "scale" },
    { header: "行政区代码", field: "division_code" },
    { header: "场馆", field: "venue" },
    { header: "详细地址", field: "address" },
    { header: "开始日期", field: "start_date" },
    { header: "结束日期", field: "end_date" },
    { header: "开始时间", field: "start_time" },
    { header: "结束时间", field: "end_time" },
    { header: "封面URL", field: "cover_url" },
    { header: "活动描述", field: "description" },
    { header: "QQ群", field: "qq_group" },
    { header: "购票地址", field: "ticket_url" },
    { header: "来源链接", field: "source_url" },
    { header: "联系信息", field: "submitter_contact" },
    { header: "标签", field: "tags" },
    { header: "主办方", field: "organizer" },
    { header: "活动异常状态", field: "schedule_status" },
    { header: "入场方式", field: "admission_method" },
    { header: "票价区间", field: "price_range" },
    { header: "开始购票/预约/申请日期", field: "admission_start_date" },
    { header: "开始购票/预约/申请时间", field: "admission_start_time" }
] as const satisfies ReadonlyArray<{ header: string; field: AdminEventField }>;

export const BULK_EVENT_HEADERS = BULK_EVENT_COLUMNS.map(({ header }) => header);

const BULK_EVENT_EXAMPLE: Record<AdminEventField, string> = {
    title: "示例动漫嘉年华(导入前请修改或删除)",
    type: "综合商业展",
    scale: "小型 (100 - 1,000人)",
    division_code: "110105",
    venue: "示例国际会展中心",
    address: "北京市朝阳区示例路 88 号",
    start_date: "2026-10-01",
    end_date: "2026-10-02",
    start_time: "09:00",
    end_time: "18:00",
    cover_url: "https://example.com/cover.jpg",
    description: "这是一条示范活动, 请按实际情况修改",
    qq_group: "123456789",
    ticket_url: "https://example.com/tickets",
    source_url: "https://example.com/source",
    submitter_contact: "admin@example.com",
    tags: "动漫、漫展",
    organizer: "示例文化有限公司",
    schedule_status: "",
    admission_method: "购票",
    price_range: "80-120 元",
    admission_start_date: "2026-09-01",
    admission_start_time: "10:00"
};

export interface BulkEventError {
    row: number | null;
    field: string | null;
    message: string;
}

export interface BulkEventPreviewRow {
    row: number;
    valid: boolean;
    title: string;
    type: string;
    scale: string;
    divisionCode: string;
    venue: string;
    startDate: string;
    endDate: string;
    tags: string[];
}

export interface ParsedBulkEvent {
    row: number;
    event: AdminEventInput;
    duplicateKey: string;
}

export interface BulkEventWarningMatch {
    id?: number;
    row?: number;
    title: string;
}

export interface BulkEventWarning {
    key: string;
    row: number;
    source: "csv" | "database";
    matches: BulkEventWarningMatch[];
}

export interface BulkPreviewData {
    valid: boolean;
    rows: BulkEventPreviewRow[];
    errors: BulkEventError[];
    warnings: BulkEventWarning[];
}

export interface ParsedBulkEventCsv {
    events: ParsedBulkEvent[];
    preview: BulkPreviewData;
}

export class BulkEventCsvError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "BulkEventCsvError";
    }
}

export function createBulkEventErrorPreview(message: string): BulkPreviewData {
    return {
        valid: false,
        rows: [],
        errors: [{ row: null, field: null, message }],
        warnings: []
    };
}

function resolveOption(value: string | null | undefined, options: readonly EventOption[]) {
    const normalized = value?.trim() ?? "";
    return (
        options.find(({ name, label }) => normalized === name || normalized === label)?.name ??
        normalized
    );
}

function csvFieldLabel(field: AdminEventField) {
    return (
        BULK_EVENT_COLUMNS.find((column) => column.field === field)?.header ??
        ADMIN_EVENT_FIELD_LABELS[field]
    );
}

function decodeCsv(bytes: ArrayBuffer) {
    try {
        return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
        throw new BulkEventCsvError("CSV 文件必须使用 UTF-8 编码");
    }
}

function parseCsvRecords(text: string): string[][] {
    try {
        return parse(text, {
            bom: true,
            max_record_size: MAX_BULK_EVENT_FILE_BYTES,
            relax_column_count: false,
            skip_empty_lines: true
        }) as string[][];
    } catch (error) {
        throw new BulkEventCsvError(
            `CSV 格式无效：${error instanceof Error ? error.message : "无法解析文件"}`
        );
    }
}

function assertHeaders(headers: string[]) {
    if (
        headers.length !== BULK_EVENT_HEADERS.length ||
        headers.some((header, index) => header !== BULK_EVENT_HEADERS[index])
    ) {
        throw new BulkEventCsvError("CSV 表头必须与下载模板完全一致, 且顺序不能改变");
    }
}

function toRawInput(record: string[]) {
    const raw: AdminEventRawInput = {};
    for (const [index, column] of BULK_EVENT_COLUMNS.entries()) {
        raw[column.field] = record[index] ?? "";
    }
    raw.type = resolveOption(raw.type, EVENT_TYPES);
    raw.scale = resolveOption(raw.scale, EVENT_SCALES);
    raw.schedule_status = resolveOption(raw.schedule_status, EVENT_SCHEDULE_STATUSES);
    raw.admission_method = resolveOption(raw.admission_method, EVENT_ADMISSION_METHODS);
    return raw;
}

function displayTags(value: string | null | undefined) {
    return (value ?? "")
        .split("、")
        .map((tag) => tag.trim())
        .filter(Boolean);
}

export function normalizeBulkDuplicatePart(value: string) {
    return normalizeEventDuplicatePart(value);
}

export function bulkEventDuplicateKey(
    event: Pick<AdminEventInput, "title" | "start_date" | "venue">
) {
    return eventDuplicateKey(event);
}

function serializeCsvRow(values: readonly string[]) {
    return values
        .map((value) => (/[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value))
        .join(",");
}

export function createBulkEventTemplate() {
    const example = BULK_EVENT_COLUMNS.map(({ field }) => BULK_EVENT_EXAMPLE[field]);
    return `\uFEFF${serializeCsvRow(BULK_EVENT_HEADERS)}\r\n${serializeCsvRow(example)}\r\n`;
}

export async function parseBulkEventCsv(file: File): Promise<ParsedBulkEventCsv> {
    if (!file.name.toLocaleLowerCase().endsWith(".csv")) {
        throw new BulkEventCsvError("请选择 .csv 文件");
    }
    if (file.size > MAX_BULK_EVENT_FILE_BYTES) {
        throw new BulkEventCsvError("CSV 文件不能超过 1 MiB");
    }

    const records = parseCsvRecords(decodeCsv(await file.arrayBuffer()));
    if (records.length === 0) throw new BulkEventCsvError("CSV 文件为空");
    assertHeaders(records[0] ?? []);

    const dataRecords = records.slice(1);
    if (dataRecords.length === 0) throw new BulkEventCsvError("CSV 至少需要包含 1 条活动");
    if (dataRecords.length > MAX_BULK_EVENT_ROWS) {
        throw new BulkEventCsvError(`单次最多导入 ${MAX_BULK_EVENT_ROWS} 条活动`);
    }

    const events: ParsedBulkEvent[] = [];
    const rows: BulkEventPreviewRow[] = [];
    const errors: BulkEventError[] = [];

    for (const [index, record] of dataRecords.entries()) {
        const row = index + 2;
        const raw = toRawInput(record);
        const rowErrors: BulkEventError[] = [];

        if (/[,，\n\r]/.test(raw.tags ?? "")) {
            rowErrors.push({ row, field: "标签", message: "多个标签请使用中文顿号“、”分隔" });
        }

        const validation = validateAdminEventInput(raw, {
            requireTags: true,
            tagSeparator: /、/
        });
        rowErrors.push(
            ...validation.errors.map((error) => ({
                row,
                field: csvFieldLabel(error.field),
                message: error.message
            }))
        );
        errors.push(...rowErrors);

        rows.push({
            row,
            valid: rowErrors.length === 0,
            title: raw.title?.trim() ?? "",
            type: raw.type?.trim() ?? "",
            scale: raw.scale?.trim() ?? "",
            divisionCode: raw.division_code?.trim() ?? "",
            venue: raw.venue?.trim() ?? "",
            startDate: raw.start_date?.trim() ?? "",
            endDate: raw.end_date?.trim() ?? "",
            tags: displayTags(raw.tags)
        });

        if (rowErrors.length === 0 && validation.input) {
            events.push({
                row,
                event: validation.input,
                duplicateKey: bulkEventDuplicateKey(validation.input)
            });
        }
    }

    return {
        events,
        preview: {
            valid: errors.length === 0,
            rows,
            errors,
            warnings: []
        }
    };
}

export function findBulkEventWarnings(
    events: ParsedBulkEvent[],
    candidates: EventDuplicateCandidate[]
): BulkEventWarning[] {
    const warnings: BulkEventWarning[] = [];
    const csvGroups = new Map<string, ParsedBulkEvent[]>();

    for (const item of events) {
        const group = csvGroups.get(item.duplicateKey) ?? [];
        group.push(item);
        csvGroups.set(item.duplicateKey, group);
    }

    for (const [duplicateKey, group] of csvGroups) {
        if (group.length < 2) continue;
        const sorted = [...group].sort((left, right) => left.row - right.row);
        warnings.push({
            key: JSON.stringify(["csv", duplicateKey, ...sorted.map(({ row }) => row)]),
            row: sorted[0]?.row ?? 0,
            source: "csv",
            matches: sorted.map(({ row, event }) => ({ row, title: event.title }))
        });
    }

    const candidateKeys = candidates.map((candidate) => ({
        candidate,
        key: bulkEventDuplicateKey(candidate)
    }));

    for (const item of events) {
        for (const { candidate, key } of candidateKeys) {
            if (key !== item.duplicateKey) continue;
            warnings.push({
                key: JSON.stringify(["database", item.duplicateKey, item.row, candidate.id]),
                row: item.row,
                source: "database",
                matches: [{ id: candidate.id, title: candidate.title }]
            });
        }
    }

    return warnings.sort(
        (left, right) => left.row - right.row || left.source.localeCompare(right.source)
    );
}

export async function buildBulkEventPreview(
    db: D1Database,
    file: File
): Promise<ParsedBulkEventCsv> {
    const parsed = await parseBulkEventCsv(file);
    if (!parsed.preview.valid) return parsed;

    const candidates = await findEventDuplicateCandidates(
        db,
        parsed.events.map(({ event }) => event.start_date)
    );
    const warnings = findBulkEventWarnings(parsed.events, candidates);

    return {
        events: parsed.events,
        preview: {
            ...parsed.preview,
            warnings
        }
    };
}
