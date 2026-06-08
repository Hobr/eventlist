import {
    integer,
    sqliteTable,
    text,
    uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const eventScales = sqliteTable("event_scales", {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    priority: integer("priority").notNull().default(0),
    isActive: integer("is_active").notNull().default(1),
    createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
    updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
});

export const vocabularyTerms = sqliteTable(
    "vocabulary_terms",
    {
        id: text("id").primaryKey(),
        kind: text("kind", { enum: ["event_type", "event_ip"] }).notNull(),
        slug: text("slug").notNull(),
        name: text("name").notNull(),
        aliases: text("aliases").notNull().default("[]"),
        sortOrder: integer("sort_order").notNull().default(0),
        isActive: integer("is_active").notNull().default(1),
        createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
        updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
    },
    (table) => [
        uniqueIndex("vocabulary_terms_kind_slug").on(table.kind, table.slug),
    ],
);

export const events = sqliteTable("events", {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    status: text("status", {
        enum: ["pending", "approved", "rejected", "archived"],
    }).notNull(),
    name: text("name").notNull(),
    city: text("city").notNull(),
    venue: text("venue").notNull(),
    address: text("address"),
    startsAt: text("starts_at").notNull(),
    endsAt: text("ends_at").notNull(),
    typeId: text("type_id"),
    eventIpId: text("event_ip_id"),
    scaleId: text("scale_id"),
    rawTypeText: text("raw_type_text"),
    rawEventIpText: text("raw_event_ip_text"),
    officialQqGroup: text("official_qq_group"),
    ticketUrl: text("ticket_url"),
    description: text("description"),
    internalNote: text("internal_note"),
    createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
    updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
});

export const eventSubmissions = sqliteTable("event_submissions", {
    id: text("id").primaryKey(),
    eventId: text("event_id").notNull(),
    submitterContact: text("submitter_contact"),
    submitterIpHash: text("submitter_ip_hash").notNull(),
    turnstileOutcome: text("turnstile_outcome").notNull().default("passed"),
    createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
});

export const eventCovers = sqliteTable("event_covers", {
    id: text("id").primaryKey(),
    eventId: text("event_id").notNull(),
    objectKey: text("object_key").notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    status: text("status", {
        enum: ["pending", "approved", "rejected", "removed"],
    }).notNull(),
    publicUrl: text("public_url"),
    createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
    updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
});

export const auditLogs = sqliteTable("audit_logs", {
    id: text("id").primaryKey(),
    eventId: text("event_id"),
    actorEmail: text("actor_email").notNull(),
    action: text("action").notNull(),
    note: text("note"),
    createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
});

export const eventViewObservations = sqliteTable(
    "event_view_observations",
    {
        id: text("id").primaryKey(),
        eventId: text("event_id").notNull(),
        visitorHash: text("visitor_hash").notNull(),
        observedOn: text("observed_on").notNull(),
        createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
    },
    (table) => [
        uniqueIndex("event_view_observations_unique").on(
            table.eventId,
            table.visitorHash,
            table.observedOn,
        ),
    ],
);
