import {
    sampleAuditLogs,
    sampleEvents,
    sampleScales,
    sampleTerms,
} from "../src/server/events/sample-data";

const tables = [
    "event_view_observations",
    "audit_logs",
    "event_covers",
    "event_submissions",
    "events",
    "vocabulary_terms",
    "event_scales",
];

for (const table of tables) {
    console.log(`DELETE FROM ${table};`);
}

for (const scale of sampleScales) {
    insert("event_scales", {
        id: scale.id,
        slug: scale.slug,
        name: scale.name,
        priority: scale.priority,
        is_active: scale.isActive ? 1 : 0,
    });
}

for (const term of sampleTerms) {
    insert("vocabulary_terms", {
        id: term.id,
        kind: term.kind,
        slug: term.slug,
        name: term.name,
        aliases: JSON.stringify(term.aliases),
        sort_order: term.sortOrder,
        is_active: term.isActive ? 1 : 0,
    });
}

for (const event of sampleEvents) {
    insert("events", {
        id: event.id,
        slug: event.slug,
        status: event.status,
        name: event.name,
        city: event.city,
        venue: event.venue,
        address: event.address,
        starts_at: event.startsAt,
        ends_at: event.endsAt,
        type_id: event.typeId,
        event_ip_id: event.eventIpId,
        scale_id: event.scaleId,
        raw_type_text: event.rawTypeText,
        raw_event_ip_text: event.rawEventIpText,
        official_qq_group: event.officialQqGroup,
        ticket_url: event.ticketUrl,
        description: event.description,
        internal_note: event.internalNote,
        created_at: event.createdAt,
        updated_at: event.updatedAt,
    });

    if (event.submission) {
        insert("event_submissions", {
            id: event.submission.id,
            event_id: event.submission.eventId,
            submitter_contact: event.submission.submitterContact,
            submitter_ip_hash: event.submission.submitterIpHash,
            turnstile_outcome: event.submission.turnstileOutcome,
            created_at: event.submission.createdAt,
        });
    }

    for (const cover of event.covers) {
        insert("event_covers", {
            id: cover.id,
            event_id: cover.eventId,
            object_key: cover.objectKey,
            filename: cover.filename,
            mime_type: cover.mimeType,
            size_bytes: cover.sizeBytes,
            status: cover.status,
            public_url: cover.publicUrl,
        });
    }
}

for (const audit of sampleAuditLogs) {
    insert("audit_logs", {
        id: audit.id,
        event_id: audit.eventId,
        actor_email: audit.actorEmail,
        action: audit.action,
        note: audit.note,
        created_at: audit.createdAt,
    });
}

function insert(
    table: string,
    values: Record<string, string | number | undefined>,
): void {
    const entries = Object.entries(values).filter(
        ([, value]) => value !== undefined,
    );
    const columns = entries.map(([column]) => column).join(", ");
    const sqlValues = entries.map(([, value]) => toSql(value)).join(", ");
    console.log(`INSERT INTO ${table} (${columns}) VALUES (${sqlValues});`);
}

function toSql(value: string | number | undefined): string {
    if (value === undefined) {
        return "NULL";
    }

    if (typeof value === "number") {
        return String(value);
    }

    return `'${value.replace(/'/g, "''")}'`;
}
