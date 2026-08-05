import type { HomepageDiscovery, HomepagePopularity, RankedHomepageEvent } from "../db/homepage";
import type { PublicEventRow as DatabasePublicEventRow } from "../db/public-events";
import type { RegionOption } from "../divisions";
import type { EventScale } from "../events/options";
import type { PopularityWindow } from "../events/popularity";

export interface PublicHomepageDivision {
    code: string;
    name: string;
    label: string;
}

export interface PublicFeaturedEvent {
    id: number;
    title: string;
    scale: EventScale;
    division_code: string;
    start_date: string;
    end_date: string;
    start_time: string | null;
    end_time: string | null;
    cover_url: string | null;
}

export interface PublicHomepageRankedEvent {
    id: number;
    title: string;
    division_code: string;
    start_date: string;
    end_date: string;
    start_time: string | null;
    end_time: string | null;
    admission_start_date: string | null;
    admission_start_time: string | null;
    unique_visitors: number;
}

export interface PublicHomepageRankedScene {
    local: PublicHomepageRankedEvent[];
    nationwide: PublicHomepageRankedEvent[];
}

export interface PublicHomepagePopularity {
    window: PopularityWindow;
    unopened: PublicHomepageRankedScene;
    unended: PublicHomepageRankedScene;
}

export type PublicEventRow = DatabasePublicEventRow;

export interface PublicHomepageDiscovery {
    featuredEvents: PublicFeaturedEvent[];
}

export interface PublicHomepageData {
    division: PublicHomepageDivision;
    featuredEvents: PublicFeaturedEvent[];
    popularity: PublicHomepagePopularity;
}

function toPublicFeaturedEvent(event: DatabasePublicEventRow): PublicFeaturedEvent {
    return {
        id: event.id,
        title: event.title,
        scale: event.scale,
        division_code: event.division_code,
        start_date: event.start_date,
        end_date: event.end_date,
        start_time: event.start_time,
        end_time: event.end_time,
        cover_url: event.cover_url
    };
}

function toPublicHomepageRankedEvent(event: RankedHomepageEvent): PublicHomepageRankedEvent {
    return {
        id: event.id,
        title: event.title,
        division_code: event.division_code,
        start_date: event.start_date,
        end_date: event.end_date,
        start_time: event.start_time,
        end_time: event.end_time,
        admission_start_date: event.admission_start_date,
        admission_start_time: event.admission_start_time,
        unique_visitors: event.unique_visitors
    };
}

function toPublicHomepageRankedScene(
    scene: HomepagePopularity["unopened"]
): PublicHomepageRankedScene {
    return {
        local: scene.local.map(toPublicHomepageRankedEvent),
        nationwide: scene.nationwide.map(toPublicHomepageRankedEvent)
    };
}

export function toPublicEventRow(event: DatabasePublicEventRow): PublicEventRow {
    return {
        id: event.id,
        title: event.title,
        type: event.type,
        scale: event.scale,
        division_code: event.division_code,
        venue: event.venue,
        start_date: event.start_date,
        end_date: event.end_date,
        start_time: event.start_time,
        end_time: event.end_time,
        cover_url: event.cover_url,
        tags: event.tags
    };
}

export function toPublicFeaturedEvents(
    events: readonly DatabasePublicEventRow[]
): PublicFeaturedEvent[] {
    return events.map(toPublicFeaturedEvent);
}

export function toPublicHomepageDiscovery(discovery: HomepageDiscovery): PublicHomepageDiscovery {
    return { featuredEvents: toPublicFeaturedEvents(discovery.featuredEvents) };
}

export function toPublicHomepagePopularity(
    popularity: HomepagePopularity
): PublicHomepagePopularity {
    return {
        window: popularity.window,
        unopened: toPublicHomepageRankedScene(popularity.unopened),
        unended: toPublicHomepageRankedScene(popularity.unended)
    };
}

export function toPublicHomepageData(
    division: RegionOption,
    discovery: HomepageDiscovery,
    popularity: HomepagePopularity
): PublicHomepageData {
    return {
        division: {
            code: division.code,
            name: division.name,
            label: division.label
        },
        ...toPublicHomepageDiscovery(discovery),
        popularity: toPublicHomepagePopularity(popularity)
    };
}
