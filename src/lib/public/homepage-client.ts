import { isRegionCode } from "../divisions";
import { isEventScale, isEventType } from "../events/options";
import { isPopularityWindow, type PopularityWindow } from "../events/popularity";
import type {
    PublicEventRow,
    PublicFeaturedEvent,
    PublicHomepageData,
    PublicHomepageDivision,
    PublicHomepagePopularity,
    PublicPopularEvent
} from "./homepage";

export const HOMEPAGE_DATA_EVENT = "eventlist:homepage-data";
const HOMEPAGE_HISTORY_KEY = "eventlistHomepage";

export interface HomepageDataEventDetail {
    homepage: PublicHomepageData;
}

export interface HomepageHistoryState {
    city: string;
    trend: PopularityWindow;
    sourceLabel: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
    return value === null || typeof value === "string";
}

function readHomepageDivision(value: unknown): PublicHomepageDivision | null {
    if (!isRecord(value)) return null;
    const { code, name, label } = value;
    if (
        typeof code !== "string" ||
        !isRegionCode(code) ||
        typeof name !== "string" ||
        typeof label !== "string"
    ) {
        return null;
    }

    return { code, name, label };
}

function readFeaturedEvent(value: unknown): PublicFeaturedEvent | null {
    if (!isRecord(value)) return null;
    const { id, title, scale, start_date, end_date, start_time, end_time, cover_url } = value;
    if (
        !Number.isSafeInteger(id) ||
        typeof title !== "string" ||
        typeof scale !== "string" ||
        !isEventScale(scale) ||
        typeof start_date !== "string" ||
        typeof end_date !== "string" ||
        !isNullableString(start_time) ||
        !isNullableString(end_time) ||
        !isNullableString(cover_url)
    ) {
        return null;
    }

    return {
        id: id as number,
        title,
        scale,
        start_date,
        end_date,
        start_time,
        end_time,
        cover_url
    };
}

function readEventRow(value: unknown): PublicEventRow | null {
    if (!isRecord(value)) return null;
    const {
        id,
        title,
        type,
        scale,
        division_code,
        venue,
        start_date,
        end_date,
        start_time,
        end_time,
        cover_url,
        tags
    } = value;
    if (
        !Number.isSafeInteger(id) ||
        typeof title !== "string" ||
        typeof type !== "string" ||
        !isEventType(type) ||
        typeof scale !== "string" ||
        !isEventScale(scale) ||
        typeof division_code !== "string" ||
        !isRegionCode(division_code) ||
        typeof venue !== "string" ||
        typeof start_date !== "string" ||
        typeof end_date !== "string" ||
        !isNullableString(start_time) ||
        !isNullableString(end_time) ||
        !isNullableString(cover_url) ||
        !isNullableString(tags)
    ) {
        return null;
    }

    return {
        id: id as number,
        title,
        type,
        scale,
        division_code,
        venue,
        start_date,
        end_date,
        start_time,
        end_time,
        cover_url,
        tags
    };
}

function readPopularEvent(value: unknown): PublicPopularEvent | null {
    if (!isRecord(value)) return null;
    const { id, title, division_code, start_date, unique_visitors } = value;
    if (
        !Number.isSafeInteger(id) ||
        typeof title !== "string" ||
        typeof division_code !== "string" ||
        !isRegionCode(division_code) ||
        typeof start_date !== "string" ||
        typeof unique_visitors !== "number" ||
        !Number.isFinite(unique_visitors)
    ) {
        return null;
    }

    return {
        id: id as number,
        title,
        division_code,
        start_date,
        unique_visitors
    };
}

function readArray<T>(value: unknown, readItem: (item: unknown) => T | null): T[] | null {
    if (!Array.isArray(value)) return null;
    const items: T[] = [];
    for (const item of value) {
        const parsed = readItem(item);
        if (!parsed) return null;
        items.push(parsed);
    }
    return items;
}

export function readPublicHomepagePopularity(
    value: unknown,
    expectedWindow: PopularityWindow
): PublicHomepagePopularity | null {
    if (!isRecord(value)) return null;
    const { window, local, nationwide } = value;
    if (!isPopularityWindow(window) || window !== expectedWindow) return null;

    const parsedLocal = readArray(local, readPopularEvent);
    const parsedNationwide = readArray(nationwide, readPopularEvent);
    if (!parsedLocal || !parsedNationwide) return null;

    return {
        window,
        local: parsedLocal,
        nationwide: parsedNationwide
    };
}

export function readPopularityResponse(
    body: unknown,
    expectedWindow: PopularityWindow
): PublicHomepagePopularity | null {
    if (!isRecord(body) || body.ok !== true || !isRecord(body.data)) return null;
    return readPublicHomepagePopularity(body.data.popularity, expectedWindow);
}

export function readHomepageResponse(
    body: unknown,
    expectedCity: string,
    expectedWindow: PopularityWindow
): PublicHomepageData | null {
    if (!isRecord(body) || body.ok !== true || !isRecord(body.data)) return null;
    const value = body.data.homepage;
    if (!isRecord(value)) return null;

    const division = readHomepageDivision(value.division);
    const featuredEvents = readArray(value.featuredEvents, readFeaturedEvent);
    const today = readArray(value.today, readEventRow);
    const popularity = readPublicHomepagePopularity(value.popularity, expectedWindow);
    if (!division || division.code !== expectedCity || !featuredEvents || !today || !popularity) {
        return null;
    }

    return { division, featuredEvents, today, popularity };
}

export function homepagePopularityCacheKey(city: string, window: PopularityWindow) {
    return `${city}:${window}`;
}

export function buildHomepageUrl(current: URL, city: string, window: PopularityWindow) {
    const next = new URL(current.href);
    next.searchParams.set("city", city);
    next.searchParams.set("trend", String(window));
    return next;
}

export function readHomepageHistoryState(value: unknown): HomepageHistoryState | null {
    if (!isRecord(value) || !isRecord(value[HOMEPAGE_HISTORY_KEY])) return null;
    const state = value[HOMEPAGE_HISTORY_KEY];
    const { city, trend, sourceLabel } = state;
    if (
        typeof city !== "string" ||
        !isRegionCode(city) ||
        !isPopularityWindow(trend) ||
        typeof sourceLabel !== "string"
    ) {
        return null;
    }

    return { city, trend, sourceLabel };
}

export function mergeHomepageHistoryState(
    current: unknown,
    homepage: HomepageHistoryState
): Record<string, unknown> {
    const base = isRecord(current) ? current : {};
    return {
        ...base,
        [HOMEPAGE_HISTORY_KEY]: homepage
    };
}
