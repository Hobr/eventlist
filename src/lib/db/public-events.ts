import type { D1Database } from "../../types/cloudflare";
import type {
    EventAdmissionMethod,
    EventScale,
    EventScheduleStatus,
    EventType
} from "../events/options";
import { isCanonicalDate } from "../events/datetime";
import { requireD1Success, STATUS, type EventStatus } from "./index";

export type EventSort = "start_asc" | "start_desc" | "end_desc";
export type EventTiming = "upcoming" | "ended" | "all";

export interface PublishedEventFilters {
    timing?: EventTiming;
    divisionCode?: string;
    type?: string;
    scale?: string;
    tag?: string;
    from?: string;
    to?: string;
    starts?: string;
    active?: string;
    page?: number;
    pageSize?: number;
    sort?: EventSort;
}

export interface PublicEventRow {
    id: number;
    title: string;
    type: EventType;
    scale: EventScale;
    division_code: string;
    venue: string;
    start_date: string;
    end_date: string;
    start_time: string | null;
    end_time: string | null;
    cover_url: string | null;
    tags: string | null;
}

export type PublicEventStatus = typeof STATUS.PUBLISHED | typeof STATUS.OFFLINE;

export interface PublicEventDetail extends PublicEventRow {
    address: string | null;
    description: string | null;
    qq_group: string | null;
    ticket_url: string | null;
    source_url: string;
    organizer: string | null;
    schedule_status: EventScheduleStatus | null;
    admission_method: EventAdmissionMethod | null;
    price_range: string | null;
    admission_start_date: string | null;
    admission_start_time: string | null;
    status: PublicEventStatus;
    updated_at: string;
}

export interface PublicEventPage {
    events: PublicEventRow[];
    page: number;
    pageSize: number;
    hasNext: boolean;
}

export type PublishedEventPage = PublicEventPage;

export interface SitemapEventRow {
    id: number;
    updated_at: string;
}

export interface PublicEventDatabaseRow {
    id: number;
    title: string;
    type: EventType;
    scale: EventScale;
    division_code: string;
    venue: string;
    address: string | null;
    start_date: string;
    end_date: string;
    start_time: string | null;
    end_time: string | null;
    cover_url: string | null;
    description: string | null;
    qq_group: string | null;
    ticket_url: string | null;
    source_url: string;
    organizer: string | null;
    schedule_status: EventScheduleStatus | null;
    admission_method: EventAdmissionMethod | null;
    price_range: string | null;
    admission_start_date: string | null;
    admission_start_time: string | null;
    status: EventStatus;
    updated_at: string;
    tags: string | null;
}

export const PUBLIC_EVENT_COLUMNS = `
    events.id,
    events.title,
    events.type,
    events.scale,
    events.division_code,
    events.venue,
    events.address,
    events.start_date,
    events.end_date,
    events.start_time,
    events.end_time,
    events.cover_url,
    events.description,
    events.qq_group,
    events.ticket_url,
    events.source_url,
    events.organizer,
    events.schedule_status,
    events.admission_method,
    events.price_range,
    events.admission_start_date,
    events.admission_start_time,
    events.status,
    events.updated_at
`;

export const PUBLIC_EVENT_SELECT = `
    SELECT
        ${PUBLIC_EVENT_COLUMNS},
        group_concat(tags.name, '、') AS tags
    FROM events
    LEFT JOIN event_tags ON event_tags.event_id = events.id
    LEFT JOIN tags ON tags.id = event_tags.tag_id AND tags.alias_of_id IS NULL
`;

export function eventEndedClause(dateExpression = "date('now', '+8 hours')") {
    return `(
    events.end_date < ${dateExpression}
    OR (
        events.end_date = ${dateExpression}
        AND events.end_time IS NOT NULL
        AND events.end_time <= time('now', '+8 hours')
    )
)`;
}

export const EVENT_ENDED_CLAUSE = eventEndedClause();

export function divisionFilter(column: string, divisionCode: string) {
    if (divisionCode.length === 6 || divisionCode.length === 12) {
        return { clause: `${column} = ?`, value: divisionCode };
    }

    return { clause: `${column} LIKE ?`, value: `${divisionCode}%` };
}

export function mapPublicEventRow(event: PublicEventDatabaseRow): PublicEventRow {
    return {
        id: event.id,
        title: event.title,
        type: event.type,
        scale: event.scale,
        division_code: event.division_code,
        venue: event.venue,
        start_date: event.start_date,
        end_date: event.end_date,
        start_time: event.start_time,
        end_time: event.end_time,
        cover_url: event.cover_url,
        tags: event.tags
    };
}

export function mapPublicEventDetail(event: PublicEventDatabaseRow): PublicEventDetail {
    return {
        ...mapPublicEventRow(event),
        address: event.address,
        description: event.description,
        qq_group: event.qq_group,
        ticket_url: event.ticket_url,
        source_url: event.source_url,
        organizer: event.organizer,
        schedule_status: event.schedule_status,
        admission_method: event.admission_method,
        price_range: event.price_range,
        admission_start_date: event.admission_start_date,
        admission_start_time: event.admission_start_time,
        status: event.status as PublicEventStatus,
        updated_at: event.updated_at
    };
}

export async function getPublicEvent(db: D1Database, id: number) {
    const event = await db
        .prepare(
            `${PUBLIC_EVENT_SELECT}
             WHERE events.id = ?
               AND events.status IN (?, ?)
             GROUP BY events.id
             LIMIT 1`
        )
        .bind(id, STATUS.PUBLISHED, STATUS.OFFLINE)
        .first<PublicEventDatabaseRow>();

    return event ? mapPublicEventDetail(event) : null;
}

export async function listPublishedEvents(
    db: D1Database,
    filters: PublishedEventFilters = {},
    asOfDate?: string
): Promise<PublicEventPage> {
    if (asOfDate !== undefined && !isCanonicalDate(asOfDate)) {
        throw new RangeError("Event list date must be a canonical date");
    }
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 20));
    const offset = (page - 1) * pageSize;
    const clauses = ["events.status = ?"];
    const values: Array<number | string> = [
        ...(asOfDate === undefined ? [] : [asOfDate]),
        STATUS.PUBLISHED
    ];
    const clockPrefix =
        asOfDate === undefined ? "" : "WITH cache_clock(as_of_date) AS (VALUES (?))";
    const endedClause =
        asOfDate === undefined
            ? EVENT_ENDED_CLAUSE
            : eventEndedClause("(SELECT as_of_date FROM cache_clock)");

    if (filters.timing === "ended") {
        clauses.push(endedClause);
    } else if (filters.timing !== "all") {
        clauses.push(`NOT ${endedClause}`);
    }

    if (filters.divisionCode) {
        const division = divisionFilter("events.division_code", filters.divisionCode);
        clauses.push(division.clause);
        values.push(division.value);
    }

    if (filters.type) {
        clauses.push("events.type = ?");
        values.push(filters.type);
    }

    if (filters.scale) {
        clauses.push("events.scale = ?");
        values.push(filters.scale);
    }

    if (filters.from) {
        clauses.push("events.start_date >= ?");
        values.push(filters.from);
    }

    if (filters.to) {
        clauses.push("events.end_date <= ?");
        values.push(filters.to);
    }

    if (filters.starts) {
        clauses.push("events.start_date = ?");
        values.push(filters.starts);
    }

    if (filters.active) {
        clauses.push("events.start_date <= ?");
        clauses.push("events.end_date >= ?");
        values.push(filters.active, filters.active);
    }

    if (filters.tag) {
        clauses.push(
            `EXISTS (
                SELECT 1
                FROM event_tags filter_event_tags
                JOIN tags filter_tags ON filter_tags.id = filter_event_tags.tag_id
                WHERE filter_event_tags.event_id = events.id
                  AND filter_tags.alias_of_id IS NULL
                  AND filter_tags.name = ? COLLATE NOCASE
            )`
        );
        values.push(filters.tag.trim());
    }

    const effectiveSort = filters.sort ?? (filters.timing === "ended" ? "end_desc" : "start_asc");
    const orderBy =
        effectiveSort === "end_desc"
            ? "events.end_date DESC, events.id DESC"
            : `events.start_date ${effectiveSort === "start_desc" ? "DESC" : "ASC"}, events.id ${effectiveSort === "start_desc" ? "DESC" : "ASC"}`;
    const result = await db
        .prepare(
            `${clockPrefix}
             ${PUBLIC_EVENT_SELECT}
             WHERE ${clauses.join(" AND ")}
             GROUP BY events.id
             ORDER BY ${orderBy}
             LIMIT ? OFFSET ?`
        )
        .bind(...values, pageSize + 1, offset)
        .all<PublicEventDatabaseRow>();
    const rows = requireD1Success(result, "Failed to list published events").results ?? [];

    return {
        events: rows.slice(0, pageSize).map(mapPublicEventRow),
        page,
        pageSize,
        hasNext: rows.length > pageSize
    };
}

export async function listPublishedEventSitemapRows(db: D1Database, limit = 1000) {
    const result = await db
        .prepare(
            `SELECT id, updated_at
             FROM events
             WHERE status = ?
             ORDER BY updated_at DESC
             LIMIT ?`
        )
        .bind(STATUS.PUBLISHED, limit)
        .all<SitemapEventRow>();

    return requireD1Success(result, "Failed to list sitemap events").results ?? [];
}
