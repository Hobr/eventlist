import { STATUS, type EventStatus } from "./index";
import type { D1Database, D1Result } from "../../types/cloudflare";

export interface EventRecord {
    id: number;
    title: string;
    type: string;
    type_label: string | null;
    scale: string;
    scale_label: string | null;
    city_id: number;
    city_name: string | null;
    province: string | null;
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
    city_id: number;
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

export interface TagSummary {
    id: number;
    name: string;
    event_count: number;
}

export interface OptionRow {
    id?: number;
    name: string;
    label?: string;
    province?: string;
    sort: number;
}

export type AuditAction = "approve" | "reject" | "edit" | "offline" | "republish" | "merge";
export type StatusUpdateOutcome = "changed" | "already-target" | "conflict";
export type TagMergeOutcome = "changed" | "already-target" | "conflict";

const EVENT_SELECT = `
    SELECT
        events.*,
        cities.name AS city_name,
        cities.province AS province,
        event_types.label AS type_label,
        event_scales.label AS scale_label,
        group_concat(tags.name, '、') AS tags
    FROM events
    LEFT JOIN cities ON cities.id = events.city_id
    LEFT JOIN event_types ON event_types.name = events.type
    LEFT JOIN event_scales ON event_scales.name = events.scale
    LEFT JOIN event_tags ON event_tags.event_id = events.id
    LEFT JOIN tags ON tags.id = event_tags.tag_id AND tags.alias_of_id IS NULL
`;

function requireSuccess<T>(result: D1Result<T>, message: string) {
    if (!result.success) {
        throw new Error(result.error ?? message);
    }

    return result;
}

export async function listEventsByStatus(db: D1Database, status: EventStatus, page = 1, pageSize = 25) {
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
        .prepare(`${EVENT_SELECT} WHERE events.id = ? GROUP BY events.id LIMIT 1`)
        .bind(id)
        .first<EventRecord>();
}

export async function getEventStatus(db: D1Database, id: number) {
    const row = await db.prepare("SELECT status FROM events WHERE id = ? LIMIT 1").bind(id).first<{ status: EventStatus }>();
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
        fromStatus === STATUS.PENDING && toStatus === STATUS.PUBLISHED ? ", published_at = datetime('now')" : "";
    const rejectReason = toStatus === STATUS.REJECTED ? extra.rejectReason ?? null : null;
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
    if ((result.meta.changes ?? 0) > 0) return "changed" satisfies StatusUpdateOutcome;

    const currentStatus = await getEventStatus(db, id);
    if (currentStatus === toStatus) return "already-target" satisfies StatusUpdateOutcome;

    return "conflict" satisfies StatusUpdateOutcome;
}

export async function listCities(db: D1Database) {
    const result = await db
        .prepare("SELECT id, name, province, sort FROM cities ORDER BY sort ASC, name ASC")
        .all<OptionRow>();
    return requireSuccess(result, "Failed to list cities").results ?? [];
}

export async function listTypes(db: D1Database) {
    const result = await db
        .prepare("SELECT name, label, sort FROM event_types ORDER BY sort ASC, label ASC")
        .all<OptionRow>();
    return requireSuccess(result, "Failed to list event types").results ?? [];
}

export async function listScales(db: D1Database) {
    const result = await db
        .prepare("SELECT name, label, sort FROM event_scales ORDER BY sort ASC, label ASC")
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

export async function editEvent(db: D1Database, id: number, input: AdminEventInput) {
    const currentStatus = await getEventStatus(db, id);
    if (!currentStatus) return 0;

    const tagIds = await findOrCreateTagIds(db, input.tags);
    const statements = [
        db
            .prepare(
                `UPDATE events
                 SET title = ?, type = ?, scale = ?, city_id = ?, venue = ?, address = ?,
                     start_date = ?, end_date = ?, cover_url = ?, description = ?,
                     qq_group = ?, ticket_url = ?, source_url = ?, submitter_contact = ?,
                     updated_at = datetime('now')
                 WHERE id = ?`,
            )
            .bind(
                input.title,
                input.type,
                input.scale,
                input.city_id,
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
            db.prepare("INSERT OR IGNORE INTO event_tags(event_id, tag_id) VALUES (?, ?)").bind(id, tagId),
        ),
    ];
    const results = await db.batch(statements);

    for (const result of results) {
        requireSuccess(result, "Failed to update event");
    }

    return results[0]?.meta.changes ?? 0;
}

async function findOrCreateTag(db: D1Database, name: string) {
    const existing = await db.prepare("SELECT id FROM tags WHERE name = ? LIMIT 1").bind(name).first<{ id: number }>();
    if (existing) return existing.id;

    const inserted = await db.prepare("INSERT INTO tags(name) VALUES (?)").bind(name).run();
    requireSuccess(inserted, "Failed to create tag");
    if (!inserted.meta.last_row_id) throw new Error("Failed to create tag");
    return inserted.meta.last_row_id;
}

async function findOrCreateTagIds(db: D1Database, tags: string[]) {
    const normalized = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
    const tagIds: number[] = [];

    for (const tag of normalized) {
        tagIds.push(await findOrCreateTag(db, tag));
    }

    return tagIds;
}

export async function mergeTags(db: D1Database, from: number, to: number) {
    if (from === to) throw new Error("Source and target tags must be different");

    const source = await db
        .prepare("SELECT id, alias_of_id FROM tags WHERE id = ? LIMIT 1")
        .bind(from)
        .first<{ id: number; alias_of_id: number | null }>();
    if (!source) return "conflict" satisfies TagMergeOutcome;
    if (source.alias_of_id === to) return "already-target" satisfies TagMergeOutcome;
    if (source.alias_of_id !== null) return "conflict" satisfies TagMergeOutcome;

    const target = await db
        .prepare("SELECT id FROM tags WHERE id = ? AND alias_of_id IS NULL LIMIT 1")
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
        db.prepare("UPDATE event_tags SET tag_id = ? WHERE tag_id = ?").bind(to, from),
        db.prepare("UPDATE tags SET alias_of_id = ? WHERE id = ?").bind(to, from),
    ];
    const results = await db.batch(statements);

    for (const result of results) {
        requireSuccess(result, "Failed to merge tags");
    }

    return "changed" satisfies TagMergeOutcome;
}

export async function insertAudit(db: D1Database, action: AuditAction, targetId: number | null, meta: Record<string, unknown>) {
    const result = await db
        .prepare("INSERT INTO audit_logs(action, target_id, meta, at) VALUES (?, ?, ?, datetime('now'))")
        .bind(action, targetId, JSON.stringify(meta))
        .run();

    requireSuccess(result, "Failed to insert audit log");
}
