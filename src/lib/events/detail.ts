import {
    getEventAdmissionMethodLabel,
    isEventAdmissionMethod,
    type EventAdmissionMethod,
    type EventScheduleStatus
} from "./options";

export interface EventDetailOptionalFields {
    description?: string | null;
    address?: string | null;
    qq_group?: string | null;
    ticket_url?: string | null;
    source_url?: string | null;
    organizer?: string | null;
    admission_method?: EventAdmissionMethod | string | null;
    price_range?: string | null;
    admission_start_date?: string | null;
    admission_start_time?: string | null;
}

export interface EventUserStatusFields {
    status: "published" | "offline";
    schedule_status: EventScheduleStatus | null;
    start_date: string;
    end_date: string;
    start_time: string | null;
    end_time: string | null;
}

function optionalText(value: string | null | undefined) {
    return value?.trim() || null;
}

function optionalHttpUrl(value: string | null | undefined) {
    const text = optionalText(value);
    if (!text) return null;

    try {
        const url = new URL(text);
        return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
    } catch {
        return null;
    }
}

function formatCanonicalDate(date: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!match) throw new Error("活动日期格式无效");
    return `${Number(match[1])}年${Number(match[2])}月${Number(match[3])}日`;
}

export function formatAdmissionStart(date: string, time: string | null) {
    return `${formatCanonicalDate(date)}${time ? ` ${time}` : ""}（北京时间）`;
}

export function formatSqliteUpdatedAt(value: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(value);
    if (!match) throw new Error("活动更新时间格式无效");

    const timestamp = Date.UTC(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
        Number(match[4]),
        Number(match[5]),
        Number(match[6])
    );
    const chinaTime = new Date(timestamp + 8 * 60 * 60 * 1000);
    const hour = String(chinaTime.getUTCHours()).padStart(2, "0");
    const minute = String(chinaTime.getUTCMinutes()).padStart(2, "0");
    return `${chinaTime.getUTCFullYear()}年${chinaTime.getUTCMonth() + 1}月${chinaTime.getUTCDate()}日 ${hour}:${minute}`;
}

function chinaLocalDateTime(now: Date) {
    const chinaTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const year = chinaTime.getUTCFullYear();
    const month = String(chinaTime.getUTCMonth() + 1).padStart(2, "0");
    const day = String(chinaTime.getUTCDate()).padStart(2, "0");
    const hour = String(chinaTime.getUTCHours()).padStart(2, "0");
    const minute = String(chinaTime.getUTCMinutes()).padStart(2, "0");
    return { date: `${year}-${month}-${day}`, time: `${hour}:${minute}` };
}

export function getEventUserStatus(event: EventUserStatusFields, now = new Date()) {
    if (event.status === "offline") return "已下线" as const;
    if (event.schedule_status === "cancelled") return "已取消" as const;
    if (event.schedule_status === "postponed") return "已延期" as const;

    const current = chinaLocalDateTime(now);
    if (
        current.date < event.start_date ||
        (current.date === event.start_date && event.start_time && current.time < event.start_time)
    ) {
        return "未开始" as const;
    }
    if (
        current.date > event.end_date ||
        (current.date === event.end_date && event.end_time && current.time >= event.end_time)
    ) {
        return "已结束" as const;
    }
    return "进行中" as const;
}

export function getEventDetailOptionalContent(event: EventDetailOptionalFields) {
    const description = optionalText(event.description);
    const address = optionalText(event.address);
    const qqGroup = optionalText(event.qq_group);
    const ticketUrl = optionalHttpUrl(event.ticket_url);
    const normalizedSourceUrl = optionalHttpUrl(event.source_url);
    const sourceUrl = normalizedSourceUrl === ticketUrl ? null : normalizedSourceUrl;
    const organizer = optionalText(event.organizer);
    const admissionMethod = optionalText(event.admission_method);
    const admissionMethodLabel =
        admissionMethod && isEventAdmissionMethod(admissionMethod)
            ? getEventAdmissionMethodLabel(admissionMethod)
            : null;
    const priceRange = optionalText(event.price_range);
    const admissionStartDate = optionalText(event.admission_start_date);
    const admissionStartTime = optionalText(event.admission_start_time);
    const admissionStart = admissionStartDate
        ? formatAdmissionStart(admissionStartDate, admissionStartTime)
        : null;
    const hasAction = Boolean(ticketUrl || sourceUrl);
    const hasDetailFacts = Boolean(
        address || qqGroup || organizer || admissionMethodLabel || priceRange || admissionStart
    );
    const hasAsideContent = Boolean(hasAction || hasDetailFacts);

    return {
        description,
        address,
        qqGroup,
        ticketUrl,
        sourceUrl,
        organizer,
        admissionMethodLabel,
        priceRange,
        admissionStart,
        hasAction,
        hasDetailFacts,
        hasAsideContent,
        hasOptionalContent: Boolean(description || hasAsideContent)
    };
}
