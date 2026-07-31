import type { PublicEventDetail } from "./db/public-events";
import { getDivisionLabel } from "./divisions";
import { getEventDetailOptionalContent } from "./events/detail";
import { toEventIsoDateTime } from "./events/datetime";

export function buildEventJsonLd(event: PublicEventDetail, canonicalUrl: string) {
    const divisionLabel = getDivisionLabel(event.division_code);
    const { address, description, ticketUrl } = getEventDetailOptionalContent(event);
    const jsonLd: Record<string, unknown> = {
        "@context": "https://schema.org",
        "@type": "Event",
        name: event.title,
        startDate: toEventIsoDateTime(event.start_date, event.start_time),
        endDate: toEventIsoDateTime(event.end_date, event.end_time),
        eventStatus:
            event.status === "offline"
                ? "https://schema.org/EventCancelled"
                : "https://schema.org/EventScheduled",
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        url: canonicalUrl,
        location: {
            "@type": "Place",
            name: event.venue,
            address: address ?? divisionLabel ?? undefined
        }
    };

    if (event.cover_url) jsonLd.image = [event.cover_url];
    if (description) jsonLd.description = description;
    if (ticketUrl) {
        jsonLd.offers = {
            "@type": "Offer",
            url: ticketUrl,
            availability: "https://schema.org/InStock"
        };
    }

    return jsonLd;
}
