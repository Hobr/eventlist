import type { D1Database } from "../../types/cloudflare";
import { listDivisionTree, type DivisionTree } from "../divisions";
import type { AdminEventInput } from "../events/input";
import { ADMIN_EVENT_FIELD_LABELS, type AdminEventField, type AdminEventRawInput } from "./form";
import {
    eventDuplicateKey,
    eventDuplicateWarningKey,
    findEventDuplicateCandidates,
    type EventDuplicateCandidate
} from "./event-duplicates";
import { findEventBySourceUrl } from "../db/admin-events";

export const BILIBILI_TICKET_PROVIDER = "bilibili-ticket";
export const BILIBILI_TICKET_API_URL = "https://show.bilibili.com/api/ticket/project/getV2";
export const MAX_BILIBILI_RESPONSE_BYTES = 512 * 1024;
export const BILIBILI_REQUEST_TIMEOUT_MS = 8_000;

type JsonObject = Record<string, unknown>;

export type BilibiliImportWarningCode =
    "type-suggestion" | "multiple-sessions" | "division-unmatched";

export interface BilibiliImportWarning {
    code: BilibiliImportWarningCode;
    message: string;
}

export interface BilibiliDuplicateWarning {
    key: string;
    event: EventDuplicateCandidate;
}

export interface BilibiliEventImportPreview {
    provider: typeof BILIBILI_TICKET_PROVIDER;
    projectId: number;
    canonicalSourceUrl: string;
    values: AdminEventRawInput;
    missingRequiredFields: AdminEventField[];
    warnings: BilibiliImportWarning[];
    exactDuplicate: { id: number; title: string } | null;
    duplicateCandidates: BilibiliDuplicateWarning[];
}

export interface BilibiliImportSubmission {
    projectId: number;
    canonicalSourceUrl: string;
    confirmedWarningKeys: Set<string>;
}

export class BilibiliImportError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "BilibiliImportError";
    }
}

function asObject(value: unknown): JsonObject | null {
    return value !== null && typeof value === "object" && !Array.isArray(value)
        ? (value as JsonObject)
        : null;
}

function asArray(value: unknown) {
    return Array.isArray(value) ? value : [];
}

function readString(object: JsonObject | null, key: string) {
    const value = object?.[key];
    return typeof value === "string" ? value.trim() : "";
}

function readNumber(object: JsonObject | null, key: string) {
    const value = object?.[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return null;
}

export function parseBilibiliProjectId(value: string | null | undefined) {
    const normalized = value?.trim() ?? "";
    if (!/^[1-9]\d*$/.test(normalized)) {
        throw new BilibiliImportError("会员购活动 ID 必须是正整数");
    }
    const projectId = Number(normalized);
    if (!Number.isSafeInteger(projectId)) {
        throw new BilibiliImportError("会员购活动 ID 超出支持范围");
    }
    return projectId;
}

export function canonicalBilibiliSourceUrl(projectId: number) {
    if (!Number.isSafeInteger(projectId) || projectId < 1) {
        throw new BilibiliImportError("会员购活动 ID 必须是正整数");
    }
    return `https://show.bilibili.com/platform/detail.html?id=${projectId}`;
}

export function createBilibiliTicketApiUrl(projectId: number) {
    canonicalBilibiliSourceUrl(projectId);
    const url = new URL(BILIBILI_TICKET_API_URL);
    url.searchParams.set("version", "134");
    url.searchParams.set("id", String(projectId));
    url.searchParams.set("project_id", String(projectId));
    url.searchParams.set("requestSource", "pc-new");
    return url;
}

function timestampParts(timestamp: number | null) {
    if (timestamp === null || !Number.isSafeInteger(timestamp) || timestamp <= 0) return null;
    const date = new Date(timestamp * 1000);
    if (Number.isNaN(date.getTime())) return null;

    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
    }).formatToParts(date);
    const value = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((part) => part.type === type)?.value ?? "";
    const day = `${value("year")}-${value("month")}-${value("day")}`;
    const time = `${value("hour")}:${value("minute")}`;
    return /^\d{4}-\d{2}-\d{2}$/.test(day) && /^\d{2}:\d{2}$/.test(time)
        ? { date: day, time }
        : null;
}

function normalizeDivisionName(value: string, level: "province" | "city" | "county") {
    const compact = value.replace(/[\s\u3000]+/g, "").trim();
    const suffixes =
        level === "province"
            ? ["维吾尔自治区", "壮族自治区", "回族自治区", "特别行政区", "自治区", "省", "市"]
            : level === "city"
              ? ["自治州", "地区", "市", "盟"]
              : ["自治县", "自治旗", "市辖区", "林区", "特区", "新区", "区", "县", "旗", "市"];
    return suffixes.reduce(
        (name, suffix) => (name.endsWith(suffix) ? name.slice(0, -suffix.length) : name),
        compact
    );
}

export function matchBilibiliDivisionCode(
    location: { provinceName?: string; cityName?: string; districtName?: string },
    tree: DivisionTree = listDivisionTree()
) {
    const districtName = normalizeDivisionName(location.districtName ?? "", "county");
    if (!districtName) return null;

    const provinceName = normalizeDivisionName(location.provinceName ?? "", "province");
    const cityName = normalizeDivisionName(location.cityName ?? "", "city");
    const provinces = provinceName
        ? tree.provinces.filter(
              (province) => normalizeDivisionName(province.name, "province") === provinceName
          )
        : tree.provinces;
    if (provinceName && provinces.length !== 1) return null;

    const cities = provinces.flatMap((province) =>
        cityName
            ? province.cities.filter(
                  (city) => normalizeDivisionName(city.name, "city") === cityName
              )
            : province.cities
    );
    if (cityName && cities.length !== 1) return null;

    const counties = cities.flatMap((city) =>
        city.counties.filter(
            (county) => normalizeDivisionName(county.name, "county") === districtName
        )
    );
    const unique = [...new Map(counties.map((county) => [county.code, county])).values()];
    return unique.length === 1 ? (unique[0]?.code ?? null) : null;
}

export function normalizeBilibiliImageUrl(value: unknown) {
    if (typeof value !== "string" || value.trim() === "") return "";
    const normalized = value.trim().startsWith("//") ? `https:${value.trim()}` : value.trim();
    try {
        const url = new URL(normalized);
        if (url.protocol !== "http:" && url.protocol !== "https:") return "";
        if (url.username || url.password) return "";
        url.protocol = "https:";
        return url.toString();
    } catch {
        return "";
    }
}

function readPerformanceImage(value: unknown) {
    if (typeof value === "string") {
        try {
            return asObject(JSON.parse(value));
        } catch {
            return null;
        }
    }
    return asObject(value);
}

function formatYuan(cents: number) {
    const yuan = cents / 100;
    return Number.isInteger(yuan)
        ? String(yuan)
        : yuan.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function formatBilibiliPrice(data: JsonObject) {
    if (data.is_free === true || readNumber(data, "is_free") === 1) return "免费";
    const low = readNumber(data, "price_low");
    const high = readNumber(data, "price_high");
    if (low === null && high === null) return "";
    const minimum = Math.max(0, low ?? high ?? 0);
    const maximum = Math.max(0, high ?? low ?? 0);
    if (minimum === maximum) return `${formatYuan(minimum)} 元`;
    return `${formatYuan(Math.min(minimum, maximum))}-${formatYuan(Math.max(minimum, maximum))} 元`;
}

function hasTicket(data: JsonObject) {
    return asArray(data.screen_list).some((screen) => {
        const object = asObject(screen);
        return asArray(object?.ticket_list).some((ticket) => asObject(ticket) !== null);
    });
}

function readStatus(data: JsonObject) {
    const text = ["status_name", "status_text", "project_status_name", "project_status_text"]
        .map((key) => readString(data, key))
        .filter(Boolean)
        .join(" ");
    if (text.includes("取消")) return "cancelled";
    if (text.includes("延期")) return "postponed";
    return "";
}

function sessionTimestamps(data: JsonObject) {
    return asArray(data.screen_list)
        .map(asObject)
        .filter((screen): screen is JsonObject => screen !== null)
        .map((screen) => ({
            start: readNumber(screen, "start_time"),
            end: readNumber(screen, "end_time")
        }));
}

function requiredMissingFields(values: AdminEventRawInput) {
    const required: AdminEventField[] = [
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
    ];
    return required.filter((field) => !values[field]?.trim());
}

export function normalizeBilibiliTicketResponse(
    payload: unknown,
    options: { projectId: number; submitterContact?: string; divisionTree?: DivisionTree }
): Omit<BilibiliEventImportPreview, "exactDuplicate" | "duplicateCandidates"> {
    const root = asObject(payload);
    const data = asObject(root?.data);
    if (root?.success !== true || readNumber(root, "code") !== 0) {
        throw new BilibiliImportError("会员购未返回可导入的活动，请检查 ID 后重试");
    }
    if (!data) throw new BilibiliImportError("会员购活动数据结构已变化，请手动录入");

    const responseId = readNumber(data, "id") ?? readNumber(data, "project_id");
    if (responseId !== options.projectId) {
        throw new BilibiliImportError("会员购活动 ID 与响应不一致，请检查后重试");
    }
    const title = readString(data, "name");
    if (!title) throw new BilibiliImportError("会员购活动缺少名称，请手动录入");

    const canonicalSourceUrl = canonicalBilibiliSourceUrl(options.projectId);
    const venueInfo = asObject(data.venue_info);
    const placeInfo = asObject(data.place_info);
    const merchant = asObject(data.merchant);
    const sessions = sessionTimestamps(data);
    const validStarts = sessions
        .map(({ start }) => start)
        .filter((value): value is number => value !== null && timestampParts(value) !== null);
    const validEnds = sessions
        .map(({ end }) => end)
        .filter((value): value is number => value !== null && timestampParts(value) !== null);
    const topLevelStart = readNumber(data, "start_time");
    const topLevelEnd = readNumber(data, "end_time");
    const hasMultipleSessions = sessions.length > 1;
    const startTimestamp = hasMultipleSessions
        ? ((validStarts.length ? Math.min(...validStarts) : null) ?? topLevelStart)
        : (topLevelStart ?? (validStarts.length ? Math.min(...validStarts) : null));
    const endTimestamp = hasMultipleSessions
        ? ((validEnds.length ? Math.max(...validEnds) : null) ?? topLevelEnd)
        : (topLevelEnd ?? (validEnds.length ? Math.max(...validEnds) : null));
    const start = timestampParts(startTimestamp);
    const end = timestampParts(endTimestamp);
    const admissionStart = timestampParts(
        readNumber(data, "sale_begin") ?? readNumber(data, "sale_start")
    );
    const divisionCode = matchBilibiliDivisionCode(
        {
            provinceName: readString(venueInfo, "province_name"),
            cityName: readString(venueInfo, "city_name"),
            districtName: readString(venueInfo, "district_name")
        },
        options.divisionTree
    );
    const performanceImage = readPerformanceImage(data.performance_image);
    const firstImage = asObject(performanceImage?.first);
    const typeSuggestion = /only\s*(?:展|专场)/i.test(title) ? "only" : "";

    const values: AdminEventRawInput = {
        title,
        type: typeSuggestion,
        scale: "",
        division_code: divisionCode ?? "",
        venue: readString(venueInfo, "name") || readString(placeInfo, "name"),
        address: readString(venueInfo, "address_detail"),
        start_date: start?.date ?? "",
        end_date: end?.date ?? "",
        start_time: start?.time ?? "",
        end_time: end?.time ?? "",
        cover_url:
            normalizeBilibiliImageUrl(data.cover) ||
            normalizeBilibiliImageUrl(firstImage?.url) ||
            normalizeBilibiliImageUrl(data.banner),
        description: "",
        qq_group: "",
        ticket_url: canonicalSourceUrl,
        source_url: canonicalSourceUrl,
        submitter_contact: options.submitterContact?.trim() ?? "",
        tags: "",
        organizer: readString(merchant, "company"),
        schedule_status: readStatus(data),
        admission_method: hasTicket(data) ? "ticket" : "",
        price_range: formatBilibiliPrice(data),
        admission_start_date: admissionStart?.date ?? "",
        admission_start_time: admissionStart?.time ?? ""
    };

    const warnings: BilibiliImportWarning[] = [];
    if (typeSuggestion) {
        warnings.push({
            code: "type-suggestion",
            message: "已根据活动名称建议为 ONLY 专场，请在发布前确认活动类型。"
        });
    }
    if (hasMultipleSessions) {
        const rangeStart = start ? `${start.date} ${start.time}` : "未知开始时间";
        const rangeEnd = end ? `${end.date} ${end.time}` : "未知结束时间";
        warnings.push({
            code: "multiple-sessions",
            message: `会员购包含 ${sessions.length} 个场次，已压缩为 ${rangeStart} 至 ${rangeEnd}，请核对活动说明和时间。`
        });
    }
    if (!divisionCode && readString(venueInfo, "district_name")) {
        warnings.push({
            code: "division-unmatched",
            message: "无法唯一匹配会员购地区，请手动选择区/县。"
        });
    }

    return {
        provider: BILIBILI_TICKET_PROVIDER,
        projectId: options.projectId,
        canonicalSourceUrl,
        values,
        missingRequiredFields: requiredMissingFields(values),
        warnings
    };
}

async function readBoundedResponse(response: Response) {
    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_BILIBILI_RESPONSE_BYTES) {
        throw new BilibiliImportError("会员购返回的数据过大，无法导入");
    }
    if (!response.body) return "";

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let total = 0;
    let text = "";
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_BILIBILI_RESPONSE_BYTES) {
            await reader.cancel();
            throw new BilibiliImportError("会员购返回的数据过大，无法导入");
        }
        text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
}

export async function fetchBilibiliTicketPreview(
    projectId: number,
    options: {
        fetchImpl?: typeof fetch;
        timeoutMs?: number;
        submitterContact?: string;
        divisionTree?: DivisionTree;
    } = {}
) {
    const controller = new AbortController();
    const timeout = setTimeout(
        () => controller.abort(),
        options.timeoutMs ?? BILIBILI_REQUEST_TIMEOUT_MS
    );

    try {
        const response = await (options.fetchImpl ?? fetch)(createBilibiliTicketApiUrl(projectId), {
            method: "GET",
            headers: { Accept: "application/json" },
            redirect: "error",
            signal: controller.signal
        });
        if (!response.ok) {
            throw new BilibiliImportError(`会员购服务暂时不可用（HTTP ${response.status}）`);
        }
        if (!response.headers.get("content-type")?.toLocaleLowerCase().includes("json")) {
            throw new BilibiliImportError("会员购返回了无法识别的数据，请手动录入");
        }
        const text = await readBoundedResponse(response);
        let payload: unknown;
        try {
            payload = JSON.parse(text);
        } catch {
            throw new BilibiliImportError("会员购返回了无法识别的数据，请手动录入");
        }
        return normalizeBilibiliTicketResponse(payload, {
            projectId,
            submitterContact: options.submitterContact,
            divisionTree: options.divisionTree
        });
    } catch (error) {
        if (error instanceof BilibiliImportError) throw error;
        if (controller.signal.aborted) {
            throw new BilibiliImportError("会员购请求超时，请稍后重试或手动录入");
        }
        throw new BilibiliImportError("暂时无法连接会员购，请稍后重试或手动录入");
    } finally {
        clearTimeout(timeout);
    }
}

function candidateWarnings(
    input: Pick<AdminEventInput, "title" | "start_date" | "venue">,
    candidates: EventDuplicateCandidate[]
) {
    const key = eventDuplicateKey(input);
    return candidates
        .filter((candidate) => eventDuplicateKey(candidate) === key)
        .map((event) => ({ key: eventDuplicateWarningKey(input, event.id), event }));
}

export async function buildBilibiliEventImportPreview(
    db: D1Database,
    projectId: number,
    options: { submitterContact?: string; fetchImpl?: typeof fetch; timeoutMs?: number } = {}
): Promise<BilibiliEventImportPreview> {
    const preview = await fetchBilibiliTicketPreview(projectId, options);
    const exactDuplicate = await findEventBySourceUrl(db, preview.canonicalSourceUrl);
    const startDate = preview.values.start_date?.trim();
    const candidates = startDate ? await findEventDuplicateCandidates(db, [startDate]) : [];
    const duplicateInput = {
        title: preview.values.title ?? "",
        start_date: startDate ?? "",
        venue: preview.values.venue ?? ""
    };

    return {
        ...preview,
        exactDuplicate,
        duplicateCandidates: candidateWarnings(duplicateInput, candidates).filter(
            ({ event }) => event.id !== exactDuplicate?.id
        )
    };
}

export function parseBilibiliImportSubmission(formData: FormData): BilibiliImportSubmission | null {
    const providerValue = formData.get("import_provider");
    const projectValue = formData.get("bilibili_project_id");
    if (providerValue === null && projectValue === null) return null;
    if (providerValue !== BILIBILI_TICKET_PROVIDER || typeof projectValue !== "string") {
        throw new BilibiliImportError("会员购导入信息无效，请重新导入");
    }

    const projectId = parseBilibiliProjectId(projectValue);
    return {
        projectId,
        canonicalSourceUrl: canonicalBilibiliSourceUrl(projectId),
        confirmedWarningKeys: new Set(
            formData
                .getAll("confirmed_warning_keys")
                .filter((value): value is string => typeof value === "string")
        )
    };
}

export function findBilibiliDuplicateWarnings(
    input: Pick<AdminEventInput, "title" | "start_date" | "venue">,
    candidates: EventDuplicateCandidate[]
) {
    return candidateWarnings(input, candidates);
}

export function missingBilibiliFieldLabels(fields: AdminEventField[]) {
    return fields.map((field) => ADMIN_EVENT_FIELD_LABELS[field]);
}
