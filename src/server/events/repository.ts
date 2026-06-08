import type {
    AdminEvent,
    AdminEventPatch,
    EventCover,
    EventFilters,
    EventRecord,
    EventScale,
    PublicEvent,
    PublicEventWithHotness,
    SubmissionInput,
    SubmissionMeta,
    TermKind,
    VocabularySnapshot,
    VocabularyTerm,
} from "./types";

export interface CreateVocabularyInput {
    kind: TermKind;
    name: string;
    slug?: string;
    aliases?: string[];
    sortOrder?: number;
    isActive?: boolean;
}

export interface CreateScaleInput {
    name: string;
    slug?: string;
    priority?: number;
    isActive?: boolean;
}

export interface ApprovalInput {
    typeId: string;
    eventIpId: string;
    scaleId: string;
    note?: string;
}

export interface EventRepository {
    listPublicEvents(
        filters?: EventFilters,
        now?: Date,
    ): Promise<PublicEvent[]>;
    getPublicEventBySlug(slug: string, now?: Date): Promise<PublicEvent | null>;
    getPublicEventById(id: string, now?: Date): Promise<PublicEvent | null>;
    listVocabularySnapshot(options?: {
        includeInactive?: boolean;
    }): Promise<VocabularySnapshot>;
    createPendingSubmission(
        input: SubmissionInput,
        meta: SubmissionMeta,
    ): Promise<{ event: EventRecord; cover?: EventCover }>;
    listAdminEvents(filters?: {
        status?: string;
        q?: string;
    }): Promise<AdminEvent[]>;
    getAdminEvent(id: string): Promise<AdminEvent | null>;
    updateAdminEvent(
        id: string,
        patch: AdminEventPatch,
        actorEmail: string,
    ): Promise<AdminEvent>;
    approveEvent(
        id: string,
        input: ApprovalInput,
        actorEmail: string,
    ): Promise<AdminEvent>;
    rejectEvent(
        id: string,
        actorEmail: string,
        note?: string,
    ): Promise<AdminEvent>;
    archiveEvent(
        id: string,
        actorEmail: string,
        note?: string,
    ): Promise<AdminEvent>;
    restoreEvent(
        id: string,
        actorEmail: string,
        note?: string,
    ): Promise<AdminEvent>;
    createVocabularyTerm(
        input: CreateVocabularyInput,
        actorEmail: string,
    ): Promise<VocabularyTerm>;
    updateVocabularyTerm(
        id: string,
        patch: Partial<CreateVocabularyInput>,
        actorEmail: string,
    ): Promise<VocabularyTerm>;
    createScale(
        input: CreateScaleInput,
        actorEmail: string,
    ): Promise<EventScale>;
    updateScale(
        id: string,
        patch: Partial<CreateScaleInput>,
        actorEmail: string,
    ): Promise<EventScale>;
    setCoverStatus(
        coverId: string,
        status: EventCover["status"],
        actorEmail: string,
        publicUrl?: string,
    ): Promise<EventCover>;
    recordEventView(
        eventId: string,
        visitorHash: string,
        observedOn: string,
    ): Promise<boolean>;
    listHotEvents(
        windowDays: 3 | 7 | 30,
        now?: Date,
        limit?: number,
    ): Promise<PublicEventWithHotness[]>;
}
