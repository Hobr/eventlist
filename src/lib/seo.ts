import type { EventRecord } from "./db/queries";
import { getDivisionLabel } from "./divisions";

export function buildEventJsonLd(event: EventRecord, canonicalUrl: string) {
    const divisionLabel = getDivisionLabel(event.division_code);
    const jsonLd: Record<string, unknown> = {
        "@context": "https://schema.org",
        "@type": "Event",
        name: event.title,
        startDate: event.start_date,
        endDate: event.end_date,
        eventStatus:
            event.status === "offline"
                ? "https://schema.org/EventCancelled"
                : "https://schema.org/EventScheduled",
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        url: canonicalUrl,
        location: {
            "@type": "Place",
            name: event.venue,
            address: event.address ?? divisionLabel ?? undefined,
        },
        organizer: {
            "@type": "Organization",
            name: event.source_url,
            url: event.source_url,
        },
    };

    if (event.cover_url) jsonLd.image = [event.cover_url];
    if (event.description) jsonLd.description = event.description;
    if (event.ticket_url) {
        jsonLd.offers = {
            "@type": "Offer",
            url: event.ticket_url,
            availability: "https://schema.org/InStock",
        };
    }

    return jsonLd;
}
