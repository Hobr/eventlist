import type {
    AdminEvent,
    AdminEventPatch,
    AuditLog,
    EventCover,
    EventFilters,
    EventRecord,
    EventScale,
    PublicEvent,
    PublicEventWithHotness,
    SubmissionInput,
    SubmissionMeta,
    VocabularySnapshot,
    VocabularyTerm,
} from "./types";
import type {
    ApprovalInput,
    CreateScaleInput,
    CreateVocabularyInput,
    EventRepository,
} from "./repository";
import { toPublicEvent } from "./visibility";
import {
    addDays,
    booleanFromSql,
    createId,
    observedDay,
    parseJsonArray,
    slugify,
    uniqueSlug,
} from "./utils";

type SqlValue = string | number | null;

interface EventRow {
    id: string;
    slug: string;
    status: AdminEvent["status"];
    name: string;
    city: string;
    venue: string;
    address: string | null;
    starts_at: string;
    ends_at: string;
    type_id: string | null;
    event_ip_id: string | null;
    scale_id: string | null;
    raw_type_text: string | null;
    raw_event_ip_text: string | null;
    official_qq_group: string | null;
    ticket_url: string | null;
    description: string | null;
    internal_note: string | null;
    created_at: string;
    updated_at: string;
}

interface TermRow {
    id: string;
    kind: VocabularyTerm["kind"];
    slug: string;
    name: string;
    aliases: string;
    sort_order: number;
    is_active: number;
}

interface ScaleRow {
    id: string;
    slug: string;
    name: string;
    priority: number;
    is_active: number;
}

interface CoverRow {
    id: string;
    event_id: string;
    object_key: string;
    filename: string;
    mime_type: string;
    size_bytes: number;
    status: EventCover["status"];
    public_url: string | null;
}

interface SubmissionRow {
    id: string;
    event_id: string;
    submitter_contact: string | null;
    submitter_ip_hash: string;
    turnstile_outcome: string;
    created_at: string;
}

interface HotRow {
    event_id: string;
    hotness: number;
}

export class D1EventRepository implements EventRepository {
    constructor(private readonly db: D1Database) {}

    async listPublicEvents(
        filters: EventFilters = {},
        now = new Date(),
    ): Promise<PublicEvent[]> {
        const events = await this.listAdminEvents();
        return events
            .map((event) => toPublicEvent(event, now))
            .filter((event): event is PublicEvent => event !== null)
            .filter((event) => matchesPublicFilters(event, filters, now))
            .sort(sortPublicEvents);
    }

    async getPublicEventBySlug(
        slug: string,
        now = new Date(),
    ): Promise<PublicEvent | null> {
        const event = await this.getAdminEventByColumn("slug", slug);
        return event ? toPublicEvent(event, now) : null;
    }

    async getPublicEventById(
        id: string,
        now = new Date(),
    ): Promise<PublicEvent | null> {
        const event = await this.getAdminEvent(id);
        return event ? toPublicEvent(event, now) : null;
    }

    async listVocabularySnapshot({
        includeInactive = false,
    }: { includeInactive?: boolean } = {}): Promise<VocabularySnapshot> {
        const terms = await this.loadTerms(includeInactive);
        const scales = await this.loadScales(includeInactive);
        return {
            eventTypes: terms.filter((term) => term.kind === "event_type"),
            eventIps: terms.filter((term) => term.kind === "event_ip"),
            scales,
        };
    }

    async createPendingSubmission(
        input: SubmissionInput,
        meta: SubmissionMeta,
    ): Promise<{ event: EventRecord; cover?: EventCover }> {
        const now = new Date().toISOString();
        const id = createId("event");
        const slugs = await this.select<EventRow>("SELECT slug FROM events");
        const slug = uniqueSlug(
            input.name,
            slugs.map((row) => row.slug),
        );

        await this.db
            .prepare(
                `INSERT INTO events (
                    id, slug, status, name, city, venue, starts_at, ends_at,
                    raw_type_text, raw_event_ip_text, official_qq_group, ticket_url,
                    description, created_at, updated_at
                ) VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
                id,
                slug,
                input.name,
                input.city,
                input.venue,
                input.startsAt,
                input.endsAt,
                input.typeText,
                input.eventIpText,
                input.officialQqGroup ?? null,
                input.ticketUrl ?? null,
                input.description ?? null,
                now,
                now,
            )
            .run();

        await this.db
            .prepare(
                `INSERT INTO event_submissions (
                    id, event_id, submitter_contact, submitter_ip_hash,
                    turnstile_outcome, created_at
                ) VALUES (?, ?, ?, ?, ?, ?)`,
            )
            .bind(
                createId("sub"),
                id,
                input.submitterContact ?? null,
                meta.submitterIpHash,
                meta.turnstileOutcome,
                now,
            )
            .run();

        if (meta.cover) {
            await this.insertCover({ ...meta.cover, eventId: id });
        }

        await this.writeAudit({
            actorEmail: "public-submit",
            action: "submission.create",
            eventId: id,
        });

        const event = await this.getAdminEvent(id);
        if (!event) throw new Error("Created event could not be loaded");

        return {
            event,
            cover: meta.cover ? { ...meta.cover, eventId: id } : undefined,
        };
    }

    async listAdminEvents(
        filters: { status?: string; q?: string } = {},
    ): Promise<AdminEvent[]> {
        const where: string[] = [];
        const params: SqlValue[] = [];

        if (filters.status) {
            where.push("status = ?");
            params.push(filters.status);
        }

        if (filters.q) {
            where.push(
                "(name LIKE ? OR city LIKE ? OR venue LIKE ? OR raw_type_text LIKE ? OR raw_event_ip_text LIKE ?)",
            );
            const q = `%${filters.q}%`;
            params.push(q, q, q, q, q);
        }

        const rows = await this.select<EventRow>(
            `SELECT * FROM events ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC`,
            params,
        );
        return this.hydrateEvents(rows);
    }

    async getAdminEvent(id: string): Promise<AdminEvent | null> {
        return this.getAdminEventByColumn("id", id);
    }

    async updateAdminEvent(
        id: string,
        patch: AdminEventPatch,
        actorEmail: string,
    ): Promise<AdminEvent> {
        const columns = [
            ["name", patch.name],
            ["city", patch.city],
            ["venue", patch.venue],
            ["address", patch.address],
            ["starts_at", patch.startsAt],
            ["ends_at", patch.endsAt],
            ["type_id", patch.typeId],
            ["event_ip_id", patch.eventIpId],
            ["scale_id", patch.scaleId],
            ["official_qq_group", patch.officialQqGroup],
            ["ticket_url", patch.ticketUrl],
            ["description", patch.description],
            ["internal_note", patch.internalNote],
        ].filter((entry): entry is [string, string] => entry[1] !== undefined);

        if (columns.length) {
            const sets = columns.map(([column]) => `${column} = ?`).join(", ");
            await this.db
                .prepare(
                    `UPDATE events SET ${sets}, updated_at = ? WHERE id = ?`,
                )
                .bind(
                    ...columns.map(([, value]) => value ?? null),
                    new Date().toISOString(),
                    id,
                )
                .run();
        }

        await this.writeAudit({
            actorEmail,
            action: "event.update",
            eventId: id,
            note: patch.internalNote,
        });

        return this.requireAdminEvent(id);
    }

    async approveEvent(
        id: string,
        input: ApprovalInput,
        actorEmail: string,
    ): Promise<AdminEvent> {
        await this.db
            .prepare(
                `UPDATE events
                SET status = 'approved', type_id = ?, event_ip_id = ?, scale_id = ?, updated_at = ?
                WHERE id = ?`,
            )
            .bind(
                input.typeId,
                input.eventIpId,
                input.scaleId,
                new Date().toISOString(),
                id,
            )
            .run();
        await this.db
            .prepare(
                "UPDATE event_covers SET status = 'approved', updated_at = ? WHERE event_id = ? AND status = 'pending'",
            )
            .bind(new Date().toISOString(), id)
            .run();
        await this.writeAudit({
            actorEmail,
            action: "event.approve",
            eventId: id,
            note: input.note,
        });
        return this.requireAdminEvent(id);
    }

    async rejectEvent(
        id: string,
        actorEmail: string,
        note?: string,
    ): Promise<AdminEvent> {
        return this.setEventStatus(
            id,
            "rejected",
            actorEmail,
            "event.reject",
            note,
        );
    }

    async archiveEvent(
        id: string,
        actorEmail: string,
        note?: string,
    ): Promise<AdminEvent> {
        return this.setEventStatus(
            id,
            "archived",
            actorEmail,
            "event.archive",
            note,
        );
    }

    async restoreEvent(
        id: string,
        actorEmail: string,
        note?: string,
    ): Promise<AdminEvent> {
        return this.setEventStatus(
            id,
            "approved",
            actorEmail,
            "event.restore",
            note,
        );
    }

    async createVocabularyTerm(
        input: CreateVocabularyInput,
        actorEmail: string,
    ): Promise<VocabularyTerm> {
        const id = createId("term");
        const slug = input.slug ?? slugify(input.name);
        await this.db
            .prepare(
                `INSERT INTO vocabulary_terms
                (id, kind, slug, name, aliases, sort_order, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
                id,
                input.kind,
                slug,
                input.name,
                JSON.stringify(input.aliases ?? []),
                input.sortOrder ?? 0,
                input.isActive === false ? 0 : 1,
            )
            .run();
        await this.writeAudit({
            actorEmail,
            action: `vocabulary.${input.kind}.create`,
            note: input.name,
        });
        return this.requireTerm(id);
    }

    async updateVocabularyTerm(
        id: string,
        patch: Partial<CreateVocabularyInput>,
        actorEmail: string,
    ): Promise<VocabularyTerm> {
        const columns: Array<[string, SqlValue]> = [];
        if (patch.name !== undefined) columns.push(["name", patch.name]);
        if (patch.slug !== undefined) columns.push(["slug", patch.slug]);
        if (patch.aliases !== undefined)
            columns.push(["aliases", JSON.stringify(patch.aliases)]);
        if (patch.sortOrder !== undefined)
            columns.push(["sort_order", patch.sortOrder]);
        if (patch.isActive !== undefined)
            columns.push(["is_active", patch.isActive ? 1 : 0]);

        if (columns.length) {
            await this.db
                .prepare(
                    `UPDATE vocabulary_terms SET ${columns
                        .map(([column]) => `${column} = ?`)
                        .join(", ")}, updated_at = ? WHERE id = ?`,
                )
                .bind(
                    ...columns.map(([, value]) => value),
                    new Date().toISOString(),
                    id,
                )
                .run();
        }

        const term = await this.requireTerm(id);
        await this.writeAudit({
            actorEmail,
            action: `vocabulary.${term.kind}.update`,
            note: term.name,
        });
        return term;
    }

    async createScale(
        input: CreateScaleInput,
        actorEmail: string,
    ): Promise<EventScale> {
        const id = createId("scale");
        await this.db
            .prepare(
                `INSERT INTO event_scales (id, slug, name, priority, is_active)
                VALUES (?, ?, ?, ?, ?)`,
            )
            .bind(
                id,
                input.slug ?? slugify(input.name),
                input.name,
                input.priority ?? 0,
                input.isActive === false ? 0 : 1,
            )
            .run();
        await this.writeAudit({
            actorEmail,
            action: "scale.create",
            note: input.name,
        });
        return this.requireScale(id);
    }

    async updateScale(
        id: string,
        patch: Partial<CreateScaleInput>,
        actorEmail: string,
    ): Promise<EventScale> {
        const columns: Array<[string, SqlValue]> = [];
        if (patch.name !== undefined) columns.push(["name", patch.name]);
        if (patch.slug !== undefined) columns.push(["slug", patch.slug]);
        if (patch.priority !== undefined)
            columns.push(["priority", patch.priority]);
        if (patch.isActive !== undefined)
            columns.push(["is_active", patch.isActive ? 1 : 0]);

        if (columns.length) {
            await this.db
                .prepare(
                    `UPDATE event_scales SET ${columns
                        .map(([column]) => `${column} = ?`)
                        .join(", ")}, updated_at = ? WHERE id = ?`,
                )
                .bind(
                    ...columns.map(([, value]) => value),
                    new Date().toISOString(),
                    id,
                )
                .run();
        }

        const scale = await this.requireScale(id);
        await this.writeAudit({
            actorEmail,
            action: "scale.update",
            note: scale.name,
        });
        return scale;
    }

    async setCoverStatus(
        coverId: string,
        status: EventCover["status"],
        actorEmail: string,
        publicUrl?: string,
    ): Promise<EventCover> {
        await this.db
            .prepare(
                "UPDATE event_covers SET status = ?, public_url = COALESCE(?, public_url), updated_at = ? WHERE id = ?",
            )
            .bind(status, publicUrl ?? null, new Date().toISOString(), coverId)
            .run();
        const cover = await this.requireCover(coverId);
        await this.writeAudit({
            actorEmail,
            action: `cover.${status}`,
            eventId: cover.eventId,
            note: cover.filename,
        });
        return cover;
    }

    async recordEventView(
        eventId: string,
        visitorHash: string,
        day = observedDay(),
    ): Promise<boolean> {
        const publicEvent = await this.getPublicEventById(eventId);
        if (!publicEvent || publicEvent.isEnded) {
            return false;
        }

        const result = await this.db
            .prepare(
                `INSERT OR IGNORE INTO event_view_observations
                (id, event_id, visitor_hash, observed_on)
                VALUES (?, ?, ?, ?)`,
            )
            .bind(createId("view"), eventId, visitorHash, day)
            .run();

        return Boolean(result.meta.changes);
    }

    async listHotEvents(
        windowDays: 3 | 7 | 30,
        now = new Date(),
        limit = 5,
    ): Promise<PublicEventWithHotness[]> {
        const since = addDays(now, -windowDays + 1)
            .toISOString()
            .slice(0, 10);
        const rows = await this.select<HotRow>(
            `SELECT event_id, COUNT(DISTINCT visitor_hash) AS hotness
             FROM event_view_observations
             WHERE observed_on >= ?
             GROUP BY event_id`,
            [since],
        );
        const counts = new Map(rows.map((row) => [row.event_id, row.hotness]));
        const events = await this.listPublicEvents({ period: "upcoming" }, now);

        return events
            .map((event) => ({ ...event, hotness: counts.get(event.id) ?? 0 }))
            .filter((event) => event.hotness > 0)
            .sort(
                (a, b) =>
                    b.hotness - a.hotness ||
                    a.startsAt.localeCompare(b.startsAt) ||
                    a.id.localeCompare(b.id),
            )
            .slice(0, limit);
    }

    private async getAdminEventByColumn(
        column: "id" | "slug",
        value: string,
    ): Promise<AdminEvent | null> {
        const row = await this.first<EventRow>(
            `SELECT * FROM events WHERE ${column} = ?`,
            [value],
        );
        if (!row) return null;
        const [event] = await this.hydrateEvents([row]);
        return event;
    }

    private async requireAdminEvent(id: string): Promise<AdminEvent> {
        const event = await this.getAdminEvent(id);
        if (!event) throw new Error(`Event not found: ${id}`);
        return event;
    }

    private async setEventStatus(
        id: string,
        status: AdminEvent["status"],
        actorEmail: string,
        action: string,
        note?: string,
    ): Promise<AdminEvent> {
        await this.db
            .prepare(
                "UPDATE events SET status = ?, updated_at = ? WHERE id = ?",
            )
            .bind(status, new Date().toISOString(), id)
            .run();
        await this.writeAudit({ actorEmail, action, eventId: id, note });
        return this.requireAdminEvent(id);
    }

    private async hydrateEvents(rows: EventRow[]): Promise<AdminEvent[]> {
        const [terms, scales, covers, submissions] = await Promise.all([
            this.loadTerms(true),
            this.loadScales(true),
            this.select<CoverRow>("SELECT * FROM event_covers"),
            this.select<SubmissionRow>("SELECT * FROM event_submissions"),
        ]);
        const termMap = new Map(terms.map((term) => [term.id, term]));
        const scaleMap = new Map(scales.map((scale) => [scale.id, scale]));

        return rows.map((row) => {
            const event: AdminEvent = {
                id: row.id,
                slug: row.slug,
                status: row.status,
                name: row.name,
                city: row.city,
                venue: row.venue,
                address: row.address ?? undefined,
                startsAt: row.starts_at,
                endsAt: row.ends_at,
                typeId: row.type_id ?? undefined,
                eventIpId: row.event_ip_id ?? undefined,
                scaleId: row.scale_id ?? undefined,
                rawTypeText: row.raw_type_text ?? undefined,
                rawEventIpText: row.raw_event_ip_text ?? undefined,
                officialQqGroup: row.official_qq_group ?? undefined,
                ticketUrl: row.ticket_url ?? undefined,
                description: row.description ?? undefined,
                internalNote: row.internal_note ?? undefined,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
                type: row.type_id ? termMap.get(row.type_id) : undefined,
                eventIp: row.event_ip_id
                    ? termMap.get(row.event_ip_id)
                    : undefined,
                scale: row.scale_id ? scaleMap.get(row.scale_id) : undefined,
                covers: covers
                    .filter((cover) => cover.event_id === row.id)
                    .map(mapCoverRow),
                submission: submissions
                    .filter((submission) => submission.event_id === row.id)
                    .map(mapSubmissionRow)[0],
            };
            return event;
        });
    }

    private async loadTerms(
        includeInactive = false,
    ): Promise<VocabularyTerm[]> {
        const rows = await this.select<TermRow>(
            `SELECT * FROM vocabulary_terms ${includeInactive ? "" : "WHERE is_active = 1"}
             ORDER BY sort_order ASC, name ASC`,
        );
        return rows.map(mapTermRow);
    }

    private async loadScales(includeInactive = false): Promise<EventScale[]> {
        const rows = await this.select<ScaleRow>(
            `SELECT * FROM event_scales ${includeInactive ? "" : "WHERE is_active = 1"}
             ORDER BY priority DESC, name ASC`,
        );
        return rows.map(mapScaleRow);
    }

    private async requireTerm(id: string): Promise<VocabularyTerm> {
        const row = await this.first<TermRow>(
            "SELECT * FROM vocabulary_terms WHERE id = ?",
            [id],
        );
        if (!row) throw new Error(`Vocabulary term not found: ${id}`);
        return mapTermRow(row);
    }

    private async requireScale(id: string): Promise<EventScale> {
        const row = await this.first<ScaleRow>(
            "SELECT * FROM event_scales WHERE id = ?",
            [id],
        );
        if (!row) throw new Error(`Scale not found: ${id}`);
        return mapScaleRow(row);
    }

    private async requireCover(id: string): Promise<EventCover> {
        const row = await this.first<CoverRow>(
            "SELECT * FROM event_covers WHERE id = ?",
            [id],
        );
        if (!row) throw new Error(`Cover not found: ${id}`);
        return mapCoverRow(row);
    }

    private async insertCover(cover: EventCover): Promise<void> {
        await this.db
            .prepare(
                `INSERT INTO event_covers
                (id, event_id, object_key, filename, mime_type, size_bytes, status, public_url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
                cover.id,
                cover.eventId,
                cover.objectKey,
                cover.filename,
                cover.mimeType,
                cover.sizeBytes,
                cover.status,
                cover.publicUrl ?? null,
            )
            .run();
    }

    private async writeAudit(input: {
        actorEmail: string;
        action: string;
        eventId?: string;
        note?: string;
    }): Promise<void> {
        await this.db
            .prepare(
                "INSERT INTO audit_logs (id, event_id, actor_email, action, note) VALUES (?, ?, ?, ?, ?)",
            )
            .bind(
                createId("audit"),
                input.eventId ?? null,
                input.actorEmail,
                input.action,
                input.note ?? null,
            )
            .run();
    }

    private async select<T>(
        sql: string,
        params: SqlValue[] = [],
    ): Promise<T[]> {
        const result = await this.db
            .prepare(sql)
            .bind(...params)
            .all<T>();
        return result.results ?? [];
    }

    private async first<T>(
        sql: string,
        params: SqlValue[] = [],
    ): Promise<T | null> {
        return this.db
            .prepare(sql)
            .bind(...params)
            .first<T>();
    }
}

function mapTermRow(row: TermRow): VocabularyTerm {
    return {
        id: row.id,
        kind: row.kind,
        slug: row.slug,
        name: row.name,
        aliases: parseJsonArray(row.aliases),
        sortOrder: row.sort_order,
        isActive: booleanFromSql(row.is_active),
    };
}

function mapScaleRow(row: ScaleRow): EventScale {
    return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        priority: row.priority,
        isActive: booleanFromSql(row.is_active),
    };
}

function mapCoverRow(row: CoverRow): EventCover {
    return {
        id: row.id,
        eventId: row.event_id,
        objectKey: row.object_key,
        filename: row.filename,
        mimeType: row.mime_type,
        sizeBytes: row.size_bytes,
        status: row.status,
        publicUrl: row.public_url ?? undefined,
    };
}

function mapSubmissionRow(row: SubmissionRow): AdminEvent["submission"] {
    return {
        id: row.id,
        eventId: row.event_id,
        submitterContact: row.submitter_contact ?? undefined,
        submitterIpHash: row.submitter_ip_hash,
        turnstileOutcome: row.turnstile_outcome,
        createdAt: row.created_at,
    };
}

function sortPublicEvents(a: PublicEvent, b: PublicEvent): number {
    return (
        (b.scale?.priority ?? 0) - (a.scale?.priority ?? 0) ||
        a.startsAt.localeCompare(b.startsAt) ||
        a.name.localeCompare(b.name, "zh-CN")
    );
}

function matchesPublicFilters(
    event: PublicEvent,
    filters: EventFilters,
    now: Date,
): boolean {
    if ((filters.period ?? "upcoming") === "upcoming" && event.isEnded)
        return false;
    if (filters.period === "past" && !event.isEnded) return false;
    if (filters.period === "this-week" && !withinDays(event.startsAt, now, 7))
        return false;
    if (filters.period === "this-month" && !withinDays(event.startsAt, now, 31))
        return false;
    if (filters.city && event.city !== filters.city) return false;
    if (filters.typeId && event.type?.id !== filters.typeId) return false;
    if (filters.eventIpId && event.eventIp?.id !== filters.eventIpId)
        return false;
    if (filters.scaleId && event.scale?.id !== filters.scaleId) return false;

    if (filters.q) {
        const query = filters.q.toLowerCase();
        return [
            event.name,
            event.city,
            event.venue,
            event.type?.name,
            event.eventIp?.name,
        ]
            .filter(Boolean)
            .some((value) => value?.toLowerCase().includes(query));
    }

    return true;
}

function withinDays(startsAt: string, now: Date, days: number): boolean {
    const start = new Date(startsAt);
    const end = addDays(now, days);
    return start >= now && start <= end;
}
