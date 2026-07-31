import type { PublicEventDetail } from "./db/public-events";
import { getDisplayCoverUrl } from "./events/cover";
import { getDivisionLabel } from "./divisions";
import { getEventDetailOptionalContent } from "./events/detail";
import { toEventIsoDateTime } from "./events/datetime";

export function buildEventJsonLd(event: PublicEventDetail, canonicalUrl: string) {
    const divisionLabel = getDivisionLabel(event.division_code);
    const { address, description, organizer, ticketUrl } = getEventDetailOptionalContent(event);
    const jsonLd: Record<string, unknown> = {
        "@context": "https://schema.org",
        "@type": "Event",
        name: event.title,
        startDate: toEventIsoDateTime(event.start_date, event.start_time),
        endDate: toEventIsoDateTime(event.end_date, event.end_time),
        eventStatus:
            event.status === "offline" || event.schedule_status === "cancelled"
                ? "https://schema.org/EventCancelled"
                : event.schedule_status === "postponed"
                  ? "https://schema.org/EventPostponed"
                  : "https://schema.org/EventScheduled",
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        url: canonicalUrl,
        location: {
            "@type": "Place",
            name: event.venue,
            address: address ?? divisionLabel ?? undefined
        }
    };

    const coverUrl = getDisplayCoverUrl(event.cover_url);
    if (coverUrl) jsonLd.image = [coverUrl];
    if (description) jsonLd.description = description;
    if (organizer) {
        jsonLd.organizer = {
            "@type": "Organization",
            name: organizer
        };
    }
    if (ticketUrl) {
        jsonLd.offers = {
            "@type": "Offer",
            url: ticketUrl,
            availability: "https://schema.org/InStock"
        };
    }

    return jsonLd;
}
