import type { EventRecord, HomepagePopularity, PopularEvent } from "../db/queries";
import type { EventScale } from "../events/options";
import type { PopularityWindow } from "../events/popularity";

export interface PublicFeaturedEvent {
    id: number;
    title: string;
    scale: EventScale;
    start_date: string;
    end_date: string;
    start_time: string | null;
    end_time: string | null;
    cover_url: string | null;
}

export interface PublicPopularEvent {
    id: number;
    title: string;
    division_code: string;
    start_date: string;
    unique_visitors: number;
}

export interface PublicHomepagePopularity {
    window: PopularityWindow;
    local: PublicPopularEvent[];
    nationwide: PublicPopularEvent[];
}

function toPublicFeaturedEvent(event: EventRecord): PublicFeaturedEvent {
    return {
        id: event.id,
        title: event.title,
        scale: event.scale,
        start_date: event.start_date,
        end_date: event.end_date,
        start_time: event.start_time,
        end_time: event.end_time,
        cover_url: event.cover_url
    };
}

function toPublicPopularEvent(event: PopularEvent): PublicPopularEvent {
    return {
        id: event.id,
        title: event.title,
        division_code: event.division_code,
        start_date: event.start_date,
        unique_visitors: event.unique_visitors
    };
}

export function toPublicFeaturedEvents(events: readonly EventRecord[]): PublicFeaturedEvent[] {
    return events.map(toPublicFeaturedEvent);
}

export function toPublicHomepagePopularity(
    popularity: HomepagePopularity
): PublicHomepagePopularity {
    return {
        window: popularity.window,
        local: popularity.local.map(toPublicPopularEvent),
        nationwide: popularity.nationwide.map(toPublicPopularEvent)
    };
}
