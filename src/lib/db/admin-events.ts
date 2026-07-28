import type { D1Database } from "../../types/cloudflare";
import type { EventScale, EventType } from "../events/options";
import { requireD1Success, STATUS, type EventStatus } from "./index";
import type { EventBaseInput } from "./submissions";

export interface EventRecord {
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
    submitter_contact: string;
    status: EventStatus;
    reject_reason: string | null;
    created_at: string;
    updated_at: string;
    published_at: string | null;
    tag_suggestions: string | null;
    tags: string | null;
}

export interface AdminEventInput extends EventBaseInput {
    tags: string[];
}

export type AuditAction =
    "create" | "approve" | "reject" | "edit" | "offline" | "republish" | "merge";
export type StatusUpdateOutcome = "changed" | "already-target" | "conflict";
export type TagMergeOutcome = "changed" | "already-target" | "conflict";

export interface MutationImpact {
    eventIds: number[];
    oldDivisionCodes: string[];
    newDivisionCodes: string[];
    oldStatus?: EventStatus;
    newStatus?: EventStatus;
    tagsChanged: boolean;
}

export type StatusTransitionConflict = "missing-canonical-tag" | "wrong-status" | "not-found";

export interface StatusTransitionResult {
    outcome: StatusUpdateOutcome;
    conflict?: StatusTransitionConflict;
    impact: MutationImpact;
}

export interface EditEventResult {
    outcome: "changed" | "conflict" | "not-found";
    impact: MutationImpact;
}

export interface TagMergeResult {
    outcome: TagMergeOutcome;
    impact: MutationImpact;
}

export interface AdminCreateAuditMeta {
    authMode: "access" | "token";
    email?: string;
}

export interface BulkEventDuplicateCandidate {
    id: number;
    title: string;
    start_date: string;
    venue: string;
}

export interface BulkPublishedEventInput {
    row: number;
    event: AdminEventInput;
}

export interface BulkPublishedEventResult {
    id: number;
    title: string;
}

function emptyMutationImpact(): MutationImpact {
    return {
        eventIds: [],
        oldDivisionCodes: [],
        newDivisionCodes: [],
        tagsChanged: false
    };
}

export class BulkEventIdConflictError extends Error {
    constructor() {
        super("活动 ID 已被其他请求占用，请重新预览后再提交");
        this.name = "BulkEventIdConflictError";
    }
}

export class AdminEventMutationValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "AdminEventMutationValidationError";
    }
}

const ADMIN_EVENT_SELECT = `
    SELECT
        events.*,
        group_concat(tags.name, '、') AS tags
    FROM events
    LEFT JOIN event_tags ON event_tags.event_id = events.id
    LEFT JOIN tags ON tags.id = event_tags.tag_id AND tags.alias_of_id IS NULL
`;

export async function listEventsByStatus(
    db: D1Database,
    status: EventStatus,
    page = 1,
    pageSize = 25
) {
    const offset = Math.max(0, page - 1) * pageSize;
    const result = await db
        .prepare(
            `${ADMIN_EVENT_SELECT}
             WHERE events.status = ?
             GROUP BY events.id
             ORDER BY events.created_at ASC
             LIMIT ? OFFSET ?`
        )
        .bind(status, pageSize, offset)
        .all<EventRecord>();

    return requireD1Success(result, "Failed to list events").results ?? [];
}

export async function getEvent(db: D1Database, id: number) {
    return db
        .prepare(`${ADMIN_EVENT_SELECT} WHERE events.id = ? GROUP BY events.id LIMIT 1`)
        .bind(id)
        .first<EventRecord>();
}

interface StatusTransitionProbe {
    status: EventStatus;
    division_code: string;
    has_canonical_tag: number;
}

function statusTransitionAction(fromStatus: EventStatus, toStatus: EventStatus): AuditAction {
    if (fromStatus === STATUS.PENDING && toStatus === STATUS.PUBLISHED) return "approve";
    if (fromStatus === STATUS.PENDING && toStatus === STATUS.REJECTED) return "reject";
    if (fromStatus === STATUS.PUBLISHED && toStatus === STATUS.OFFLINE) return "offline";
    if (fromStatus === STATUS.OFFLINE && toStatus === STATUS.PUBLISHED) return "republish";
    throw new Error(`Unsupported event status transition: ${fromStatus} -> ${toStatus}`);
}

export async function transitionEventStatus(
    db: D1Database,
    id: number,
    fromStatus: EventStatus,
    toStatus: EventStatus,
    extra: { rejectReason?: string } = {}
): Promise<StatusTransitionResult> {
    const action = statusTransitionAction(fromStatus, toStatus);
    const requiresCanonicalTag = action === "approve" || action === "republish";
    const setPublishedAt =
        fromStatus === STATUS.PENDING && toStatus === STATUS.PUBLISHED
            ? ", published_at = datetime('now')"
            : "";
    const rejectReason = toStatus === STATUS.REJECTED ? (extra.rejectReason?.trim() ?? null) : null;
    const rejectSet = toStatus === STATUS.REJECTED ? ", reject_reason = ?" : "";
    const values =
        toStatus === STATUS.REJECTED
            ? [toStatus, rejectReason, id, fromStatus]
            : [toStatus, id, fromStatus];
    const canonicalTagClause = requiresCanonicalTag
        ? `AND EXISTS (
               SELECT 1
               FROM event_tags
               JOIN tags ON tags.id = event_tags.tag_id
               WHERE event_tags.event_id = events.id
                 AND tags.alias_of_id IS NULL
           )`
        : "";
    const auditMeta =
        action === "reject"
            ? { reject_reason: rejectReason }
            : ({} satisfies Record<string, never>);
    const [updateResult, auditResult, probeResult] = await db.batch<StatusTransitionProbe>([
        db
            .prepare(
                `UPDATE events
                 SET status = ?${rejectSet}${setPublishedAt}, updated_at = datetime('now')
                 WHERE id = ?
                   AND status = ?
                   ${canonicalTagClause}`
            )
            .bind(...values),
        db
            .prepare(
                `INSERT INTO audit_logs(action, target_id, meta, at)
                 SELECT ?, ?, ?, datetime('now')
                 WHERE changes() > 0`
            )
            .bind(action, id, JSON.stringify(auditMeta)),
        db
            .prepare(
                `SELECT
                     events.status,
                     events.division_code,
                     EXISTS (
                         SELECT 1
                         FROM event_tags
                         JOIN tags ON tags.id = event_tags.tag_id
                         WHERE event_tags.event_id = events.id
                           AND tags.alias_of_id IS NULL
                     ) AS has_canonical_tag
                 FROM events
                 WHERE events.id = ?
                 LIMIT 1`
            )
            .bind(id)
    ]);

    requireD1Success(updateResult, "Failed to update event status");
    requireD1Success(auditResult, "Failed to insert status audit log");
    requireD1Success(probeResult, "Failed to inspect event status transition");

    const updateChanges = updateResult.meta.changes ?? 0;
    const auditChanges = auditResult.meta.changes ?? 0;
    if (auditChanges !== updateChanges) {
        throw new Error("Status transition audit result did not match the event update");
    }

    const probe = probeResult.results?.[0];
    if (updateChanges > 0) {
        if (!probe) throw new Error("Updated event disappeared during status transition");
        return {
            outcome: "changed",
            impact: {
                eventIds: [id],
                oldDivisionCodes: [probe.division_code],
                newDivisionCodes: [probe.division_code],
                oldStatus: fromStatus,
                newStatus: toStatus,
                tagsChanged: false
            }
        };
    }

    if (!probe) {
        return {
            outcome: "conflict",
            conflict: "not-found",
            impact: emptyMutationImpact()
        };
    }
    if (requiresCanonicalTag && probe.has_canonical_tag !== 1) {
        return {
            outcome: "conflict",
            conflict: "missing-canonical-tag",
            impact: emptyMutationImpact()
        };
    }
    if (probe.status === toStatus) {
        return {
            outcome: "already-target",
            impact: emptyMutationImpact()
        };
    }

    return {
        outcome: "conflict",
        conflict: "wrong-status",
        impact: emptyMutationImpact()
    };
}

function isEventIdConflict(error: unknown) {
    return (
        error instanceof Error &&
        /unique constraint failed:\s*events\.id|constraint failed[^\n]*events\.id/i.test(
            error.message
        )
    );
}

async function nextEventId(db: D1Database) {
    const row = await db
        .prepare("SELECT COALESCE(MAX(id), 0) + 1 AS id FROM events")
        .first<{ id: number }>();
    if (!row || !Number.isSafeInteger(row.id) || row.id < 1) {
        throw new Error("Failed to allocate event id");
    }
    return row.id;
}

export async function findBulkEventDuplicateCandidates(db: D1Database, startDates: string[]) {
    const dates = [...new Set(startDates)];
    if (dates.length === 0) return [];

    const result = await db
        .prepare(
            `SELECT id, title, start_date, venue
             FROM events
             WHERE start_date IN (
                 SELECT CAST(value AS TEXT)
                 FROM json_each(?)
             )
             ORDER BY id ASC`
        )
        .bind(JSON.stringify(dates))
        .all<BulkEventDuplicateCandidate>();

    return requireD1Success(result, "Failed to find duplicate event candidates").results ?? [];
}

export async function createBulkPublishedEvents(
    db: D1Database,
    items: BulkPublishedEventInput[],
    auditMeta: AdminCreateAuditMeta
): Promise<BulkPublishedEventResult[]> {
    if (items.length === 0) throw new Error("请至少提交一条活动");
    if (items.some(({ event }) => event.tags.length === 0)) {
        throw new Error("每条活动都必须至少包含一个规范标签");
    }

    const firstEventId = await nextEventId(db);
    const created = items.map(({ event }, index) => ({
        id: firstEventId + index,
        title: event.title
    }));
    const uniqueTags = [
        ...new Set(items.flatMap(({ event }) => event.tags.map((tag) => tag.trim())))
    ];
    const auditRows = items.map(({ row, event }, index) => ({
        target_id: firstEventId + index,
        meta: {
            source: "admin-bulk-create",
            csv_row: row,
            batch_size: items.length,
            tags: event.tags,
            auth_mode: auditMeta.authMode,
            ...(auditMeta.email ? { email: auditMeta.email } : {})
        }
    }));

    const statements = [
        db
            .prepare(
                `INSERT OR IGNORE INTO tags(name)
                 SELECT CAST(value AS TEXT)
                 FROM json_each(?)`
            )
            .bind(JSON.stringify(uniqueTags)),
        ...items.map(({ event }, index) =>
            db
                .prepare(
                    `INSERT INTO events(
                         id, title, type, scale, division_code, venue, address,
                         start_date, end_date, start_time, end_time, cover_url, description,
                         qq_group, ticket_url, source_url, submitter_contact, status, published_at
                     )
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
                )
                .bind(
                    firstEventId + index,
                    event.title,
                    event.type,
                    event.scale,
                    event.division_code,
                    event.venue,
                    event.address,
                    event.start_date,
                    event.end_date,
                    event.start_time,
                    event.end_time,
                    event.cover_url,
                    event.description,
                    event.qq_group,
                    event.ticket_url,
                    event.source_url,
                    event.submitter_contact,
                    STATUS.PUBLISHED
                )
        ),
        ...items.map(({ event }, index) =>
            db
                .prepare(
                    `INSERT OR IGNORE INTO event_tags(event_id, tag_id)
                     SELECT ?, COALESCE(tags.alias_of_id, tags.id)
                     FROM json_each(?) AS requested_tags
                     JOIN tags
                       ON tags.name = CAST(requested_tags.value AS TEXT) COLLATE NOCASE`
                )
                .bind(firstEventId + index, JSON.stringify(event.tags))
        ),
        db
            .prepare(
                `INSERT INTO audit_logs(action, target_id, meta, at)
                 SELECT
                     'create',
                     CAST(json_extract(value, '$.target_id') AS INTEGER),
                     json_extract(value, '$.meta'),
                     datetime('now')
                 FROM json_each(?)`
            )
            .bind(JSON.stringify(auditRows))
    ];

    try {
        const results = await db.batch(statements);
        for (const result of results) {
            requireD1Success(result, "Failed to create bulk published events");
        }
    } catch (error) {
        if (isEventIdConflict(error)) throw new BulkEventIdConflictError();
        throw error;
    }

    return created;
}

export async function createPublishedEvent(
    db: D1Database,
    input: AdminEventInput,
    auditMeta: AdminCreateAuditMeta
) {
    const normalizedTags = [...new Set(input.tags.map((tag) => tag.trim()).filter(Boolean))];
    if (normalizedTags.length === 0) throw new Error("请至少选择或新增一个规范标签");
    const tagsJson = JSON.stringify(normalizedTags);

    for (let attempt = 0; attempt < 3; attempt += 1) {
        const eventId = await nextEventId(db);
        const statements = [
            db
                .prepare(
                    `INSERT OR IGNORE INTO tags(name)
                     SELECT CAST(value AS TEXT)
                     FROM json_each(?)`
                )
                .bind(tagsJson),
            db
                .prepare(
                    `INSERT INTO events(
                         id, title, type, scale, division_code, venue, address,
                         start_date, end_date, start_time, end_time, cover_url, description,
                         qq_group, ticket_url, source_url, submitter_contact, status, published_at
                     )
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
                )
                .bind(
                    eventId,
                    input.title,
                    input.type,
                    input.scale,
                    input.division_code,
                    input.venue,
                    input.address,
                    input.start_date,
                    input.end_date,
                    input.start_time,
                    input.end_time,
                    input.cover_url,
                    input.description,
                    input.qq_group,
                    input.ticket_url,
                    input.source_url,
                    input.submitter_contact,
                    STATUS.PUBLISHED
                ),
            db
                .prepare(
                    `INSERT OR IGNORE INTO event_tags(event_id, tag_id)
                     SELECT DISTINCT ?, COALESCE(tags.alias_of_id, tags.id)
                     FROM json_each(?) AS requested_tags
                     JOIN tags
                       ON tags.name = CAST(requested_tags.value AS TEXT) COLLATE NOCASE`
                )
                .bind(eventId, tagsJson),
            db
                .prepare(
                    `INSERT INTO audit_logs(action, target_id, meta, at)
                     VALUES ('create', ?, ?, datetime('now'))`
                )
                .bind(
                    eventId,
                    JSON.stringify({
                        source: "admin-create",
                        tags: normalizedTags,
                        auth_mode: auditMeta.authMode,
                        ...(auditMeta.email ? { email: auditMeta.email } : {})
                    })
                )
        ];

        try {
            const results = await db.batch(statements);
            for (const result of results) {
                requireD1Success(result, "Failed to create published event");
            }
            return eventId;
        } catch (error) {
            if (attempt < 2 && isEventIdConflict(error)) continue;
            throw error;
        }
    }

    throw new Error("Failed to allocate event id");
}

interface EditEventSnapshot {
    status: EventStatus;
    division_code: string;
    tag_ids_json: string;
}

interface EditEventProbe {
    status: EventStatus;
}

export async function editEvent(
    db: D1Database,
    id: number,
    input: AdminEventInput
): Promise<EditEventResult> {
    const normalizedTags = [...new Set(input.tags.map((tag) => tag.trim()).filter(Boolean))];
    const tagsJson = JSON.stringify(normalizedTags);
    const snapshot = await db
        .prepare(
            `SELECT
                 events.status,
                 events.division_code,
                 COALESCE((
                     SELECT json_group_array(current_tags.tag_id)
                     FROM (
                         SELECT event_tags.tag_id
                         FROM event_tags
                         JOIN tags ON tags.id = event_tags.tag_id
                         WHERE event_tags.event_id = events.id
                           AND tags.alias_of_id IS NULL
                         ORDER BY event_tags.tag_id
                     ) AS current_tags
                 ), '[]') AS tag_ids_json
             FROM events
             WHERE events.id = ?
             LIMIT 1`
        )
        .bind(id)
        .first<EditEventSnapshot>();
    if (!snapshot) {
        return {
            outcome: "not-found",
            impact: emptyMutationImpact()
        };
    }

    if (
        normalizedTags.length === 0 &&
        (snapshot.status === STATUS.PUBLISHED || snapshot.status === STATUS.OFFLINE)
    ) {
        throw new AdminEventMutationValidationError("已发布或已下线活动必须至少保留一个规范标签");
    }
    JSON.parse(snapshot.tag_ids_json);

    const statements = [
        db
            .prepare(
                `UPDATE events
                 SET title = ?, type = ?, scale = ?, division_code = ?, venue = ?, address = ?,
                     start_date = ?, end_date = ?, start_time = ?, end_time = ?,
                     cover_url = ?, description = ?,
                     qq_group = ?, ticket_url = ?, source_url = ?, submitter_contact = ?,
                     updated_at = datetime('now')
                 WHERE id = ?
                   AND status = ?`
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
                input.start_time,
                input.end_time,
                input.cover_url,
                input.description,
                input.qq_group,
                input.ticket_url,
                input.source_url,
                input.submitter_contact,
                id,
                snapshot.status
            ),
        db
            .prepare(
                `INSERT INTO audit_logs(action, target_id, meta, at)
                 SELECT 'edit', ?, ?, datetime('now')
                 WHERE changes() > 0`
            )
            .bind(id, JSON.stringify({ fields: Object.keys(input) })),
        db
            .prepare(
                `INSERT OR IGNORE INTO tags(name)
                 SELECT CAST(value AS TEXT)
                 FROM json_each(?)
                 WHERE EXISTS (
                     SELECT 1
                     FROM events
                     WHERE events.id = ?
                       AND events.status = ?
                 )`
            )
            .bind(tagsJson, id, snapshot.status),
        db
            .prepare(
                `DELETE FROM event_tags
                 WHERE event_tags.event_id = ?
                   AND EXISTS (
                       SELECT 1
                       FROM events
                       WHERE events.id = ?
                         AND events.status = ?
                   )
                   AND event_tags.tag_id NOT IN (
                       SELECT DISTINCT COALESCE(tags.alias_of_id, tags.id)
                       FROM json_each(?) AS requested_tags
                       JOIN tags
                         ON tags.name = CAST(requested_tags.value AS TEXT) COLLATE NOCASE
                   )`
            )
            .bind(id, id, snapshot.status, tagsJson),
        db
            .prepare(
                `INSERT OR IGNORE INTO event_tags(event_id, tag_id)
                 SELECT DISTINCT ?, COALESCE(tags.alias_of_id, tags.id)
                 FROM json_each(?) AS requested_tags
                 JOIN tags
                   ON tags.name = CAST(requested_tags.value AS TEXT) COLLATE NOCASE
                 WHERE EXISTS (
                     SELECT 1
                     FROM events
                     WHERE events.id = ?
                       AND events.status = ?
                 )`
            )
            .bind(id, tagsJson, id, snapshot.status),
        db.prepare("SELECT status FROM events WHERE id = ? LIMIT 1").bind(id)
    ];
    const results = await db.batch<EditEventProbe>(statements);

    for (const result of results) {
        requireD1Success(result, "Failed to update event");
    }

    const updateChanges = results[0]?.meta.changes ?? 0;
    const auditChanges = results[1]?.meta.changes ?? 0;
    if (auditChanges !== updateChanges) {
        throw new Error("Edit audit result did not match the event update");
    }

    const current = results[5]?.results?.[0];
    if (updateChanges === 0) {
        return {
            outcome: current ? "conflict" : "not-found",
            impact: emptyMutationImpact()
        };
    }

    return {
        outcome: "changed",
        impact: {
            eventIds: [id],
            oldDivisionCodes: [snapshot.division_code],
            newDivisionCodes: [input.division_code],
            oldStatus: snapshot.status,
            newStatus: snapshot.status,
            tagsChanged: (results[3]?.meta.changes ?? 0) > 0 || (results[4]?.meta.changes ?? 0) > 0
        }
    };
}

interface TagMergeSnapshot {
    source_id: number;
    source_alias_of_id: number | null;
    target_id: number | null;
    target_alias_of_id: number | null;
    affected_event_ids_json: string;
}

interface TagMergeProbe {
    source_alias_of_id: number | null;
    target_alias_of_id: number | null;
}

function parseAffectedEventIds(value: string) {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.some((id) => !Number.isSafeInteger(id) || id < 1)) {
        throw new Error("Failed to inspect affected tag events");
    }
    return parsed as number[];
}

export async function mergeTags(db: D1Database, from: number, to: number): Promise<TagMergeResult> {
    if (from === to) throw new Error("Source and target tags must be different");

    const snapshot = await db
        .prepare(
            `SELECT
                 source.id AS source_id,
                 source.alias_of_id AS source_alias_of_id,
                 target.id AS target_id,
                 target.alias_of_id AS target_alias_of_id,
                 COALESCE((
                     SELECT json_group_array(affected_events.event_id)
                     FROM (
                         SELECT event_tags.event_id
                         FROM event_tags
                         WHERE event_tags.tag_id = source.id
                         ORDER BY event_tags.event_id
                     ) AS affected_events
                 ), '[]') AS affected_event_ids_json
             FROM tags AS source
             LEFT JOIN tags AS target ON target.id = ?
             WHERE source.id = ?
             LIMIT 1`
        )
        .bind(to, from)
        .first<TagMergeSnapshot>();
    if (!snapshot) {
        return { outcome: "conflict", impact: emptyMutationImpact() };
    }
    if (snapshot.source_alias_of_id === to) {
        return { outcome: "already-target", impact: emptyMutationImpact() };
    }
    if (
        snapshot.source_alias_of_id !== null ||
        snapshot.target_id === null ||
        snapshot.target_alias_of_id !== null
    ) {
        return { outcome: "conflict", impact: emptyMutationImpact() };
    }

    const affectedEventIds = parseAffectedEventIds(snapshot.affected_event_ids_json);
    const canonicalMergeClause = `EXISTS (
        SELECT 1
        FROM tags AS source
        JOIN tags AS target ON target.id = ? AND target.alias_of_id IS NULL
        WHERE source.id = ?
          AND source.alias_of_id IS NULL
    )`;

    const statements = [
        db
            .prepare(
                `DELETE FROM event_tags
                 WHERE tag_id = ?
                   AND event_id IN (SELECT event_id FROM event_tags WHERE tag_id = ?)
                   AND ${canonicalMergeClause}`
            )
            .bind(from, to, to, from),
        db
            .prepare(
                `UPDATE event_tags
                 SET tag_id = ?
                 WHERE tag_id = ?
                   AND ${canonicalMergeClause}`
            )
            .bind(to, from, to, from),
        db
            .prepare(
                `UPDATE tags
                 SET alias_of_id = ?
                 WHERE id = ?
                   AND alias_of_id IS NULL
                   AND EXISTS (
                       SELECT 1
                       FROM tags AS target
                       WHERE target.id = ?
                         AND target.alias_of_id IS NULL
                   )`
            )
            .bind(to, from, to),
        db
            .prepare(
                `INSERT INTO audit_logs(action, target_id, meta, at)
                 SELECT 'merge', ?, ?, datetime('now')
                 WHERE changes() > 0`
            )
            .bind(to, JSON.stringify({ from, to })),
        db
            .prepare(
                `SELECT
                     source.alias_of_id AS source_alias_of_id,
                     target.alias_of_id AS target_alias_of_id
                 FROM tags AS source
                 LEFT JOIN tags AS target ON target.id = ?
                 WHERE source.id = ?
                 LIMIT 1`
            )
            .bind(to, from)
    ];
    const results = await db.batch<TagMergeProbe>(statements);

    for (const result of results) {
        requireD1Success(result, "Failed to merge tags");
    }

    const aliasChanges = results[2]?.meta.changes ?? 0;
    const auditChanges = results[3]?.meta.changes ?? 0;
    if (auditChanges !== aliasChanges) {
        throw new Error("Tag merge audit result did not match the alias update");
    }
    if (aliasChanges > 0) {
        return {
            outcome: "changed",
            impact: {
                eventIds: affectedEventIds,
                oldDivisionCodes: [],
                newDivisionCodes: [],
                tagsChanged: true
            }
        };
    }

    const probe = results[4]?.results?.[0];
    return {
        outcome: probe?.source_alias_of_id === to ? "already-target" : "conflict",
        impact: emptyMutationImpact()
    };
}
