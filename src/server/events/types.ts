export type EventStatus = "pending" | "approved" | "rejected" | "archived";
export type TermKind = "event_type" | "event_ip";
export type CoverStatus = "pending" | "approved" | "rejected" | "removed";
export type HotWindowDays = 3 | 7 | 30;

export interface EventScale {
    id: string;
    slug: string;
    name: string;
    priority: number;
    isActive: boolean;
}

export interface VocabularyTerm {
    id: string;
    kind: TermKind;
    slug: string;
    name: string;
    aliases: string[];
    sortOrder: number;
    isActive: boolean;
}

export interface EventCover {
    id: string;
    eventId: string;
    objectKey: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    status: CoverStatus;
    publicUrl?: string;
}

export interface EventSubmission {
    id: string;
    eventId: string;
    submitterContact?: string;
    submitterIpHash: string;
    turnstileOutcome: string;
    createdAt: string;
}

export interface AuditLog {
    id: string;
    eventId?: string;
    actorEmail: string;
    action: string;
    note?: string;
    createdAt: string;
}

export interface EventRecord {
    id: string;
    slug: string;
    status: EventStatus;
    name: string;
    city: string;
    venue: string;
    address?: string;
    startsAt: string;
    endsAt: string;
    typeId?: string;
    eventIpId?: string;
    scaleId?: string;
    rawTypeText?: string;
    rawEventIpText?: string;
    officialQqGroup?: string;
    ticketUrl?: string;
    description?: string;
    internalNote?: string;
    createdAt: string;
    updatedAt: string;
}

export interface AdminEvent extends EventRecord {
    type?: VocabularyTerm;
    eventIp?: VocabularyTerm;
    scale?: EventScale;
    covers: EventCover[];
    submission?: EventSubmission;
}

export interface PublicEvent {
    id: string;
    slug: string;
    name: string;
    city: string;
    venue: string;
    address?: string;
    startsAt: string;
    endsAt: string;
    type?: Pick<VocabularyTerm, "id" | "slug" | "name">;
    eventIp?: Pick<VocabularyTerm, "id" | "slug" | "name">;
    scale?: Pick<EventScale, "id" | "slug" | "name" | "priority">;
    cover?: Pick<EventCover, "id" | "publicUrl" | "filename" | "mimeType">;
    officialQqGroup?: string;
    ticketUrl?: string;
    description?: string;
    isEnded: boolean;
}

export interface PublicEventWithHotness extends PublicEvent {
    hotness: number;
}

export interface EventFilters {
    city?: string;
    period?: "upcoming" | "this-week" | "this-month" | "past" | "all";
    typeId?: string;
    eventIpId?: string;
    scaleId?: string;
    q?: string;
}

export interface SubmissionInput {
    name: string;
    city: string;
    venue: string;
    startsAt: string;
    endsAt: string;
    typeText: string;
    eventIpText: string;
    officialQqGroup?: string;
    ticketUrl?: string;
    submitterContact?: string;
    description?: string;
}

export interface FieldErrors {
    [field: string]: string;
}

export interface SubmissionMeta {
    submitterIpHash: string;
    turnstileOutcome: string;
    cover?: EventCover;
}

export interface VocabularySnapshot {
    eventTypes: VocabularyTerm[];
    eventIps: VocabularyTerm[];
    scales: EventScale[];
}

export interface AdminEventPatch {
    name?: string;
    city?: string;
    venue?: string;
    address?: string;
    startsAt?: string;
    endsAt?: string;
    typeId?: string;
    eventIpId?: string;
    scaleId?: string;
    officialQqGroup?: string;
    ticketUrl?: string;
    description?: string;
    internalNote?: string;
}
