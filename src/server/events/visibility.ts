import type {
    AdminEvent,
    EventCover,
    EventScale,
    PublicEvent,
    VocabularyTerm,
} from "./types";
import { isEnded } from "./utils";

export function approvedCover(covers: EventCover[]): EventCover | undefined {
    return covers.find(
        (cover) => cover.status === "approved" && cover.publicUrl,
    );
}

export function toPublicTerm(
    term?: VocabularyTerm,
): PublicEvent["type"] | PublicEvent["eventIp"] {
    if (!term) {
        return undefined;
    }

    return {
        id: term.id,
        slug: term.slug,
        name: term.name,
    };
}

export function toPublicScale(
    scale?: EventScale,
): PublicEvent["scale"] | undefined {
    if (!scale) {
        return undefined;
    }

    return {
        id: scale.id,
        slug: scale.slug,
        name: scale.name,
        priority: scale.priority,
    };
}

export function toPublicEvent(
    event: AdminEvent,
    now = new Date(),
): PublicEvent | null {
    if (event.status !== "approved") {
        return null;
    }

    const cover = approvedCover(event.covers);

    return {
        id: event.id,
        slug: event.slug,
        name: event.name,
        city: event.city,
        venue: event.venue,
        address: event.address,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        type: toPublicTerm(event.type),
        eventIp: toPublicTerm(event.eventIp),
        scale: toPublicScale(event.scale),
        cover: cover
            ? {
                  id: cover.id,
                  publicUrl: cover.publicUrl,
                  filename: cover.filename,
                  mimeType: cover.mimeType,
              }
            : undefined,
        officialQqGroup: event.officialQqGroup,
        ticketUrl: event.ticketUrl,
        description: event.description,
        isEnded: isEnded(event, now),
    };
}
