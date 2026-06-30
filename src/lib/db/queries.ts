import { STATUS, type EventStatus } from "./index";
import type { D1Database, D1Result } from "../../types/cloudflare";

export interface EventRecord {
    id: number;
    title: string;
    type: string;
    type_label: string | null;
    scale: string;
    scale_label: string | null;
    division_code: string;
    venue: string;
    address: string | null;
    start_date: string;
    end_date: string;
    cover_url: string | null;
    description: string | null;
    qq_group: string | null;
    ticket_url: string | null;
    source_url: string;
    submitter_contact: string;
    status: EventStatus;
    reject_reason: string | null;
    created_at: string;
    updated_at: string;
    published_at: string | null;
    tags: string | null;
}

export interface AdminEventInput {
    title: string;
    type: string;
    scale: string;
    division_code: string;
    venue: string;
    address: string | null;
    start_date: string;
    end_date: string;
    cover_url: string | null;
    description: string | null;
    qq_group: string | null;
    ticket_url: string | null;
    source_url: string;
    submitter_contact: string;
    tags: string[];
}

export type SubmissionInput = AdminEventInput;
export type EventSort = "start_asc" | "start_desc";

export interface PublishedEventFilters {
    divisionCode?: string;
    type?: string;
    scale?: string;
    tag?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
    sort?: EventSort;
}

export interface PublishedEventPage {
    events: EventRecord[];
    page: number;
    pageSize: number;
    hasNext: boolean;
}

export interface SitemapEventRow {
    id: number;
    updated_at: string;
}

export interface TagSummary {
    id: number;
    name: string;
    event_count: number;
}

export interface OptionRow {
    id?: number;
    name: string;
    label?: string;
    sort: number;
}

export type AuditAction =
    "approve" | "reject" | "edit" | "offline" | "republish" | "merge";
export type StatusUpdateOutcome = "changed" | "already-target" | "conflict";
export type TagMergeOutcome = "changed" | "already-target" | "conflict";

const EVENT_SELECT = `
    SELECT
        events.*,
        event_types.label AS type_label,
        event_scales.label AS scale_label,
        group_concat(tags.name, '、') AS tags
    FROM events
    LEFT JOIN event_types ON event_types.name = events.type
    LEFT JOIN event_scales ON event_scales.name = events.scale
    LEFT JOIN event_tags ON event_tags.event_id = events.id
    LEFT JOIN tags ON tags.id = event_tags.tag_id AND tags.alias_of_id IS NULL
`;

function escapeLike(value: string) {
    return value.replace(/[\\%_]/g, "\\$&");
}

function requireSuccess<T>(result: D1Result<T>, message: string) {
    if (!result.success) {
        throw new Error(result.error ?? message);
    }

    return result;
}

export async function listEventsByStatus(
    db: D1Database,
    status: EventStatus,
    page = 1,
    pageSize = 25,
) {
    const offset = Math.max(0, page - 1) * pageSize;
    const result = await db
        .prepare(
            `${EVENT_SELECT}
            WHERE events.status = ?
            GROUP BY events.id
            ORDER BY events.created_at ASC
            LIMIT ? OFFSET ?`,
        )
        .bind(status, pageSize, offset)
        .all<EventRecord>();

    return requireSuccess(result, "Failed to list events").results ?? [];
}

export async function getEvent(db: D1Database, id: number) {
    return db
        .prepare(
            `${EVENT_SELECT} WHERE events.id = ? GROUP BY events.id LIMIT 1`,
        )
        .bind(id)
        .first<EventRecord>();
}

export async function getPublicEvent(db: D1Database, id: number) {
    const event = await getEvent(db, id);
    if (!event) return null;
    if (event.status !== STATUS.PUBLISHED && event.status !== STATUS.OFFLINE) {
        return null;
    }

    return event;
}

export async function getEventStatus(db: D1Database, id: number) {
    const row = await db
        .prepare("SELECT status FROM events WHERE id = ? LIMIT 1")
        .bind(id)
        .first<{ status: EventStatus }>();
    return row?.status ?? null;
}

export async function updateEventStatus(
    db: D1Database,
    id: number,
    fromStatus: EventStatus,
    toStatus: EventStatus,
    extra: { rejectReason?: string } = {},
) {
    const setPublishedAt =
        fromStatus === STATUS.PENDING && toStatus === STATUS.PUBLISHED
            ? ", published_at = datetime('now')"
            : "";
    const rejectReason =
        toStatus === STATUS.REJECTED ? (extra.rejectReason ?? null) : null;
    const rejectSet = toStatus === STATUS.REJECTED ? ", reject_reason = ?" : "";
    const values =
        toStatus === STATUS.REJECTED
            ? [toStatus, rejectReason, id, fromStatus]
            : [toStatus, id, fromStatus];
    const result = await db
        .prepare(
            `UPDATE events
             SET status = ?${rejectSet}${setPublishedAt}, updated_at = datetime('now')
             WHERE id = ? AND status = ?`,
        )
        .bind(...values)
        .run();

    requireSuccess(result, "Failed to update event status");
    if ((result.meta.changes ?? 0) > 0)
        return "changed" satisfies StatusUpdateOutcome;

    const currentStatus = await getEventStatus(db, id);
    if (currentStatus === toStatus)
        return "already-target" satisfies StatusUpdateOutcome;

    return "conflict" satisfies StatusUpdateOutcome;
}

export async function listTypes(db: D1Database) {
    const result = await db
        .prepare(
            "SELECT name, label, sort FROM event_types ORDER BY sort ASC, label ASC",
        )
        .all<OptionRow>();
    return requireSuccess(result, "Failed to list event types").results ?? [];
}

export async function listScales(db: D1Database) {
    const result = await db
        .prepare(
            "SELECT name, label, sort FROM event_scales ORDER BY sort ASC, label ASC",
        )
        .all<OptionRow>();
    return requireSuccess(result, "Failed to list event scales").results ?? [];
}

export async function listTags(db: D1Database) {
    const result = await db
        .prepare(
            `SELECT tags.id, tags.name, COUNT(event_tags.event_id) AS event_count
             FROM tags
             LEFT JOIN event_tags ON event_tags.tag_id = tags.id
             WHERE tags.alias_of_id IS NULL
             GROUP BY tags.id
             ORDER BY event_count DESC, tags.name ASC`,
        )
        .all<TagSummary>();

    return requireSuccess(result, "Failed to list tags").results ?? [];
}

export async function topTags(db: D1Database, limit = 20) {
    const result = await db
        .prepare(
            `SELECT tags.id, tags.name, COUNT(event_tags.event_id) AS event_count
             FROM tags
             JOIN event_tags ON event_tags.tag_id = tags.id
             JOIN events ON events.id = event_tags.event_id
             WHERE tags.alias_of_id IS NULL
               AND events.status = ?
               AND date(events.end_date) >= date('now')
             GROUP BY tags.id
             ORDER BY event_count DESC, tags.name ASC
             LIMIT ?`,
        )
        .bind(STATUS.PUBLISHED, limit)
        .all<TagSummary>();

    return requireSuccess(result, "Failed to list top tags").results ?? [];
}

export async function searchTags(db: D1Database, query: string, limit = 12) {
    const normalized = query.trim();
    if (!normalized) return topTags(db, limit);

    const result = await db
        .prepare(
            `SELECT tags.id, tags.name, COUNT(events.id) AS event_count
             FROM tags
             LEFT JOIN event_tags ON event_tags.tag_id = tags.id
             LEFT JOIN events
               ON events.id = event_tags.event_id
              AND events.status = ?
              AND date(events.end_date) >= date('now')
             WHERE tags.alias_of_id IS NULL
               AND tags.name LIKE ? ESCAPE '\\'
             GROUP BY tags.id
             ORDER BY COUNT(events.id) DESC, tags.name ASC
             LIMIT ?`,
        )
        .bind(STATUS.PUBLISHED, `%${escapeLike(normalized)}%`, limit)
        .all<TagSummary>();

    return requireSuccess(result, "Failed to search tags").results ?? [];
}

export async function listPublishedEvents(
    db: D1Database,
    filters: PublishedEventFilters = {},
): Promise<PublishedEventPage> {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? 20));
    const offset = (page - 1) * pageSize;
    const clauses = [
        "events.status = ?",
        "date(events.end_date) >= date('now')",
    ];
    const values: Array<number | string> = [STATUS.PUBLISHED];

    if (filters.divisionCode) {
        if (
            filters.divisionCode.length === 6 ||
            filters.divisionCode.length === 12
        ) {
            clauses.push("events.division_code = ?");
            values.push(filters.divisionCode);
        } else {
            clauses.push("events.division_code LIKE ?");
            values.push(`${filters.divisionCode}%`);
        }
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
        clauses.push("date(events.start_date) >= date(?)");
        values.push(filters.from);
    }

    if (filters.to) {
        clauses.push("date(events.end_date) <= date(?)");
        values.push(filters.to);
    }

    if (filters.tag) {
        clauses.push(
            `EXISTS (
                SELECT 1
                FROM event_tags filter_event_tags
                JOIN tags filter_tags ON filter_tags.id = filter_event_tags.tag_id
                WHERE filter_event_tags.event_id = events.id
                  AND filter_tags.alias_of_id IS NULL
                  AND filter_tags.name LIKE ? ESCAPE '\\'
            )`,
        );
        values.push(`%${escapeLike(filters.tag)}%`);
    }

    const direction = filters.sort === "start_desc" ? "DESC" : "ASC";
    const result = await db
        .prepare(
            `${EVENT_SELECT}
            WHERE ${clauses.join(" AND ")}
            GROUP BY events.id
            ORDER BY date(events.start_date) ${direction}, events.id ${direction}
            LIMIT ? OFFSET ?`,
        )
        .bind(...values, pageSize + 1, offset)
        .all<EventRecord>();
    const rows =
        requireSuccess(result, "Failed to list published events").results ?? [];

    return {
        events: rows.slice(0, pageSize),
        page,
        pageSize,
        hasNext: rows.length > pageSize,
    };
}

export async function listPublishedEventSitemapRows(
    db: D1Database,
    limit = 1000,
) {
    const result = await db
        .prepare(
            `SELECT id, updated_at
             FROM events
             WHERE status = ?
             ORDER BY datetime(updated_at) DESC
             LIMIT ?`,
        )
        .bind(STATUS.PUBLISHED, limit)
        .all<SitemapEventRow>();

    return (
        requireSuccess(result, "Failed to list sitemap events").results ?? []
    );
}

export async function insertSubmission(db: D1Database, input: SubmissionInput) {
    const tagIds = await findOrCreateTagIds(db, input.tags);
    const inserted = await db
        .prepare(
            `INSERT INTO events(
                 title, type, scale, division_code, venue, address,
                 start_date, end_date, cover_url, description,
                 qq_group, ticket_url, source_url, submitter_contact, status
             )
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
            input.title,
            input.type,
            input.scale,
            input.division_code,
            input.venue,
            input.address,
            input.start_date,
            input.end_date,
            input.cover_url,
            input.description,
            input.qq_group,
            input.ticket_url,
            input.source_url,
            input.submitter_contact,
            STATUS.PENDING,
        )
        .run();
    requireSuccess(inserted, "Failed to insert submission");
    if (!inserted.meta.last_row_id) {
        throw new Error("Failed to insert submission");
    }

    const eventId = inserted.meta.last_row_id;
    if (tagIds.length === 0) return eventId;

    const results = await db.batch(
        tagIds.map((tagId) =>
            db
                .prepare(
                    "INSERT OR IGNORE INTO event_tags(event_id, tag_id) VALUES (?, ?)",
                )
                .bind(eventId, tagId),
        ),
    );

    for (const result of results) {
        requireSuccess(result, "Failed to attach submission tags");
    }

    return eventId;
}

export async function editEvent(
    db: D1Database,
    id: number,
    input: AdminEventInput,
) {
    const currentStatus = await getEventStatus(db, id);
    if (!currentStatus) return 0;

    const tagIds = await findOrCreateTagIds(db, input.tags);
    const statements = [
        db
            .prepare(
                `UPDATE events
                 SET title = ?, type = ?, scale = ?, division_code = ?, venue = ?, address = ?,
                     start_date = ?, end_date = ?, cover_url = ?, description = ?,
                     qq_group = ?, ticket_url = ?, source_url = ?, submitter_contact = ?,
                     updated_at = datetime('now')
                 WHERE id = ?`,
            )
            .bind(
                input.title,
                input.type,
                input.scale,
                input.division_code,
                input.venue,
                input.address,
                input.start_date,
                input.end_date,
                input.cover_url,
                input.description,
                input.qq_group,
                input.ticket_url,
                input.source_url,
                input.submitter_contact,
                id,
            ),
        db.prepare("DELETE FROM event_tags WHERE event_id = ?").bind(id),
        ...tagIds.map((tagId) =>
            db
                .prepare(
                    "INSERT OR IGNORE INTO event_tags(event_id, tag_id) VALUES (?, ?)",
                )
                .bind(id, tagId),
        ),
    ];
    const results = await db.batch(statements);

    for (const result of results) {
        requireSuccess(result, "Failed to update event");
    }

    return results[0]?.meta.changes ?? 0;
}

async function findOrCreateTag(db: D1Database, name: string) {
    const existing = await db
        .prepare("SELECT id, alias_of_id FROM tags WHERE name = ? LIMIT 1")
        .bind(name)
        .first<{ id: number; alias_of_id: number | null }>();
    if (existing) return existing.alias_of_id ?? existing.id;

    const inserted = await db
        .prepare("INSERT INTO tags(name) VALUES (?)")
        .bind(name)
        .run();
    requireSuccess(inserted, "Failed to create tag");
    if (!inserted.meta.last_row_id) throw new Error("Failed to create tag");
    return inserted.meta.last_row_id;
}

async function findOrCreateTagIds(db: D1Database, tags: string[]) {
    const normalized = [
        ...new Set(tags.map((tag) => tag.trim()).filter(Boolean)),
    ];
    const tagIds: number[] = [];

    for (const tag of normalized) {
        tagIds.push(await findOrCreateTag(db, tag));
    }

    return tagIds;
}

export async function mergeTags(db: D1Database, from: number, to: number) {
    if (from === to)
        throw new Error("Source and target tags must be different");

    const source = await db
        .prepare("SELECT id, alias_of_id FROM tags WHERE id = ? LIMIT 1")
        .bind(from)
        .first<{ id: number; alias_of_id: number | null }>();
    if (!source) return "conflict" satisfies TagMergeOutcome;
    if (source.alias_of_id === to)
        return "already-target" satisfies TagMergeOutcome;
    if (source.alias_of_id !== null)
        return "conflict" satisfies TagMergeOutcome;

    const target = await db
        .prepare(
            "SELECT id FROM tags WHERE id = ? AND alias_of_id IS NULL LIMIT 1",
        )
        .bind(to)
        .first<{ id: number }>();
    if (!target) return "conflict" satisfies TagMergeOutcome;

    const statements = [
        db
            .prepare(
                `DELETE FROM event_tags
                 WHERE tag_id = ?
                   AND event_id IN (SELECT event_id FROM event_tags WHERE tag_id = ?)`,
            )
            .bind(from, to),
        db
            .prepare("UPDATE event_tags SET tag_id = ? WHERE tag_id = ?")
            .bind(to, from),
        db
            .prepare("UPDATE tags SET alias_of_id = ? WHERE id = ?")
            .bind(to, from),
    ];
    const results = await db.batch(statements);

    for (const result of results) {
        requireSuccess(result, "Failed to merge tags");
    }

    return "changed" satisfies TagMergeOutcome;
}

export async function insertAudit(
    db: D1Database,
    action: AuditAction,
    targetId: number | null,
    meta: Record<string, unknown>,
) {
    const result = await db
        .prepare(
            "INSERT INTO audit_logs(action, target_id, meta, at) VALUES (?, ?, ?, datetime('now'))",
        )
        .bind(action, targetId, JSON.stringify(meta))
        .run();

    requireSuccess(result, "Failed to insert audit log");
}
