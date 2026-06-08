import {
    sampleAuditLogs,
    sampleEvents,
    sampleScales,
    sampleTerms,
} from "./sample-data";
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
import { addDays, createId, observedDay, slugify, uniqueSlug } from "./utils";

interface ViewObservation {
    id: string;
    eventId: string;
    visitorHash: string;
    observedOn: string;
    createdAt: string;
}

export class InMemoryEventRepository implements EventRepository {
    private events: AdminEvent[];
    private terms: VocabularyTerm[];
    private scales: EventScale[];
    private audits: AuditLog[];
    private observations: ViewObservation[] = [];

    constructor(seed?: {
        events?: AdminEvent[];
        terms?: VocabularyTerm[];
        scales?: EventScale[];
        audits?: AuditLog[];
        observations?: ViewObservation[];
    }) {
        this.events = structuredClone(seed?.events ?? sampleEvents);
        this.terms = structuredClone(seed?.terms ?? sampleTerms);
        this.scales = structuredClone(seed?.scales ?? sampleScales);
        this.audits = structuredClone(seed?.audits ?? sampleAuditLogs);
        this.observations = structuredClone(seed?.observations ?? []);
        this.rehydrateRelations();
    }

    async listPublicEvents(
        filters: EventFilters = {},
        now = new Date(),
    ): Promise<PublicEvent[]> {
        const publicEvents = this.events
            .map((event) => toPublicEvent(event, now))
            .filter((event): event is PublicEvent => event !== null)
            .filter((event) => matchesFilters(event, filters, now));

        return sortPublicEvents(publicEvents);
    }

    async getPublicEventBySlug(
        slug: string,
        now = new Date(),
    ): Promise<PublicEvent | null> {
        const event = this.events.find((candidate) => candidate.slug === slug);
        return event ? toPublicEvent(event, now) : null;
    }

    async getPublicEventById(
        id: string,
        now = new Date(),
    ): Promise<PublicEvent | null> {
        const event = this.events.find((candidate) => candidate.id === id);
        return event ? toPublicEvent(event, now) : null;
    }

    async listVocabularySnapshot({
        includeInactive = false,
    }: { includeInactive?: boolean } = {}): Promise<VocabularySnapshot> {
        const terms = this.terms
            .filter((term) => includeInactive || term.isActive)
            .sort(
                (a, b) =>
                    a.sortOrder - b.sortOrder ||
                    a.name.localeCompare(b.name, "zh-CN"),
            );

        return {
            eventTypes: terms.filter((term) => term.kind === "event_type"),
            eventIps: terms.filter((term) => term.kind === "event_ip"),
            scales: this.scales
                .filter((scale) => includeInactive || scale.isActive)
                .sort(
                    (a, b) =>
                        b.priority - a.priority ||
                        a.name.localeCompare(b.name, "zh-CN"),
                ),
        };
    }

    async createPendingSubmission(
        input: SubmissionInput,
        meta: SubmissionMeta,
    ): Promise<{ event: EventRecord; cover?: EventCover }> {
        const now = new Date().toISOString();
        const id = createId("event");
        const slug = uniqueSlug(
            input.name,
            this.events.map((event) => event.slug),
        );
        const event: AdminEvent = {
            id,
            slug,
            status: "pending",
            name: input.name,
            city: input.city,
            venue: input.venue,
            startsAt: input.startsAt,
            endsAt: input.endsAt,
            rawTypeText: input.typeText,
            rawEventIpText: input.eventIpText,
            officialQqGroup: input.officialQqGroup,
            ticketUrl: input.ticketUrl,
            description: input.description,
            createdAt: now,
            updatedAt: now,
            covers: meta.cover ? [meta.cover] : [],
            submission: {
                id: createId("sub"),
                eventId: id,
                submitterContact: input.submitterContact,
                submitterIpHash: meta.submitterIpHash,
                turnstileOutcome: meta.turnstileOutcome,
                createdAt: now,
            },
        };

        this.events.push(event);
        this.writeAudit(undefined, "submission.create", "public-submit", id);

        return { event, cover: meta.cover };
    }

    async listAdminEvents(
        filters: { status?: string; q?: string } = {},
    ): Promise<AdminEvent[]> {
        const query = filters.q?.trim().toLowerCase();
        return this.events
            .filter(
                (event) => !filters.status || event.status === filters.status,
            )
            .filter((event) => {
                if (!query) return true;
                return [
                    event.name,
                    event.city,
                    event.venue,
                    event.rawEventIpText,
                    event.rawTypeText,
                ]
                    .filter(Boolean)
                    .some((value) => value?.toLowerCase().includes(query));
            })
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map((event) => structuredClone(event));
    }

    async getAdminEvent(id: string): Promise<AdminEvent | null> {
        const event = this.events.find((candidate) => candidate.id === id);
        return event ? structuredClone(event) : null;
    }

    async updateAdminEvent(
        id: string,
        patch: AdminEventPatch,
        actorEmail: string,
    ): Promise<AdminEvent> {
        const event = this.requireEvent(id);
        Object.assign(event, patch, { updatedAt: new Date().toISOString() });
        this.rehydrateEvent(event);
        this.writeAudit(actorEmail, "event.update", patch.internalNote, id);
        return structuredClone(event);
    }

    async approveEvent(
        id: string,
        input: ApprovalInput,
        actorEmail: string,
    ): Promise<AdminEvent> {
        const event = this.requireEvent(id);
        event.status = "approved";
        event.typeId = input.typeId;
        event.eventIpId = input.eventIpId;
        event.scaleId = input.scaleId;
        event.updatedAt = new Date().toISOString();
        event.covers = event.covers.map((cover) =>
            cover.status === "pending"
                ? { ...cover, status: "approved" }
                : cover,
        );
        this.rehydrateEvent(event);
        this.writeAudit(actorEmail, "event.approve", input.note, id);
        return structuredClone(event);
    }

    async rejectEvent(
        id: string,
        actorEmail: string,
        note?: string,
    ): Promise<AdminEvent> {
        return this.setStatus(id, "rejected", actorEmail, "event.reject", note);
    }

    async archiveEvent(
        id: string,
        actorEmail: string,
        note?: string,
    ): Promise<AdminEvent> {
        return this.setStatus(
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
        return this.setStatus(
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
        const term: VocabularyTerm = {
            id: createId("term"),
            kind: input.kind,
            slug:
                input.slug ??
                uniqueSlug(
                    input.name,
                    this.terms.map((item) => item.slug),
                ),
            name: input.name,
            aliases: input.aliases ?? [],
            sortOrder: input.sortOrder ?? this.terms.length + 1,
            isActive: input.isActive ?? true,
        };
        this.terms.push(term);
        this.rehydrateRelations();
        this.writeAudit(
            actorEmail,
            `vocabulary.${input.kind}.create`,
            input.name,
        );
        return structuredClone(term);
    }

    async updateVocabularyTerm(
        id: string,
        patch: Partial<CreateVocabularyInput>,
        actorEmail: string,
    ): Promise<VocabularyTerm> {
        const term = this.terms.find((candidate) => candidate.id === id);
        if (!term) throw new Error(`Vocabulary term not found: ${id}`);

        Object.assign(term, {
            name: patch.name ?? term.name,
            slug: patch.slug ?? term.slug,
            aliases: patch.aliases ?? term.aliases,
            sortOrder: patch.sortOrder ?? term.sortOrder,
            isActive: patch.isActive ?? term.isActive,
        });
        this.rehydrateRelations();
        this.writeAudit(
            actorEmail,
            `vocabulary.${term.kind}.update`,
            term.name,
        );
        return structuredClone(term);
    }

    async createScale(
        input: CreateScaleInput,
        actorEmail: string,
    ): Promise<EventScale> {
        const scale: EventScale = {
            id: createId("scale"),
            slug: input.slug ?? slugify(input.name),
            name: input.name,
            priority: input.priority ?? 0,
            isActive: input.isActive ?? true,
        };
        this.scales.push(scale);
        this.rehydrateRelations();
        this.writeAudit(actorEmail, "scale.create", input.name);
        return structuredClone(scale);
    }

    async updateScale(
        id: string,
        patch: Partial<CreateScaleInput>,
        actorEmail: string,
    ): Promise<EventScale> {
        const scale = this.scales.find((candidate) => candidate.id === id);
        if (!scale) throw new Error(`Scale not found: ${id}`);
        Object.assign(scale, {
            name: patch.name ?? scale.name,
            slug: patch.slug ?? scale.slug,
            priority: patch.priority ?? scale.priority,
            isActive: patch.isActive ?? scale.isActive,
        });
        this.rehydrateRelations();
        this.writeAudit(actorEmail, "scale.update", scale.name);
        return structuredClone(scale);
    }

    async setCoverStatus(
        coverId: string,
        status: EventCover["status"],
        actorEmail: string,
        publicUrl?: string,
    ): Promise<EventCover> {
        for (const event of this.events) {
            const cover = event.covers.find(
                (candidate) => candidate.id === coverId,
            );
            if (cover) {
                cover.status = status;
                cover.publicUrl = publicUrl ?? cover.publicUrl;
                this.writeAudit(
                    actorEmail,
                    `cover.${status}`,
                    cover.filename,
                    event.id,
                );
                return structuredClone(cover);
            }
        }
        throw new Error(`Cover not found: ${coverId}`);
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

        const exists = this.observations.some(
            (observation) =>
                observation.eventId === eventId &&
                observation.visitorHash === visitorHash &&
                observation.observedOn === day,
        );
        if (exists) return false;

        this.observations.push({
            id: createId("view"),
            eventId,
            visitorHash,
            observedOn: day,
            createdAt: new Date().toISOString(),
        });
        return true;
    }

    async listHotEvents(
        windowDays: 3 | 7 | 30,
        now = new Date(),
        limit = 5,
    ): Promise<PublicEventWithHotness[]> {
        const since = addDays(now, -windowDays + 1)
            .toISOString()
            .slice(0, 10);
        const counts = new Map<string, Set<string>>();

        for (const observation of this.observations) {
            if (observation.observedOn < since) continue;
            const set = counts.get(observation.eventId) ?? new Set<string>();
            set.add(observation.visitorHash);
            counts.set(observation.eventId, set);
        }

        const candidates = await this.listPublicEvents(
            { period: "upcoming" },
            now,
        );
        return candidates
            .map((event) => ({
                ...event,
                hotness: counts.get(event.id)?.size ?? 0,
            }))
            .filter((event) => event.hotness > 0)
            .sort(
                (a, b) =>
                    b.hotness - a.hotness ||
                    a.startsAt.localeCompare(b.startsAt) ||
                    a.id.localeCompare(b.id),
            )
            .slice(0, limit);
    }

    getAuditLogs(): AuditLog[] {
        return structuredClone(this.audits);
    }

    private setStatus(
        id: string,
        status: AdminEvent["status"],
        actorEmail: string,
        action: string,
        note?: string,
    ): AdminEvent {
        const event = this.requireEvent(id);
        event.status = status;
        event.updatedAt = new Date().toISOString();
        this.writeAudit(actorEmail, action, note, id);
        return structuredClone(event);
    }

    private requireEvent(id: string): AdminEvent {
        const event = this.events.find((candidate) => candidate.id === id);
        if (!event) throw new Error(`Event not found: ${id}`);
        return event;
    }

    private writeAudit(
        actorEmail = "system",
        action: string,
        note?: string,
        eventId?: string,
    ): void {
        this.audits.push({
            id: createId("audit"),
            eventId,
            actorEmail,
            action,
            note,
            createdAt: new Date().toISOString(),
        });
    }

    private rehydrateRelations(): void {
        for (const event of this.events) {
            this.rehydrateEvent(event);
        }
    }

    private rehydrateEvent(event: AdminEvent): void {
        event.type = this.terms.find((term) => term.id === event.typeId);
        event.eventIp = this.terms.find((term) => term.id === event.eventIpId);
        event.scale = this.scales.find((scale) => scale.id === event.scaleId);
    }
}

function sortPublicEvents(events: PublicEvent[]): PublicEvent[] {
    return events.sort(
        (a, b) =>
            (b.scale?.priority ?? 0) - (a.scale?.priority ?? 0) ||
            a.startsAt.localeCompare(b.startsAt) ||
            a.name.localeCompare(b.name, "zh-CN"),
    );
}

function matchesFilters(
    event: PublicEvent,
    filters: EventFilters,
    now: Date,
): boolean {
    if ((filters.period ?? "upcoming") === "upcoming" && event.isEnded) {
        return false;
    }

    if (filters.period === "past" && !event.isEnded) {
        return false;
    }

    if (filters.period === "this-week" && !withinDays(event.startsAt, now, 7)) {
        return false;
    }

    if (
        filters.period === "this-month" &&
        !withinDays(event.startsAt, now, 31)
    ) {
        return false;
    }

    if (filters.city && event.city !== filters.city) {
        return false;
    }

    if (filters.typeId && event.type?.id !== filters.typeId) {
        return false;
    }

    if (filters.eventIpId && event.eventIp?.id !== filters.eventIpId) {
        return false;
    }

    if (filters.scaleId && event.scale?.id !== filters.scaleId) {
        return false;
    }

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
