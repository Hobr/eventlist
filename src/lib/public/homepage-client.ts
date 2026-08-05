import { isRegionCode } from "../divisions";
import { isCanonicalDate } from "../events/datetime";
import { isEventScale } from "../events/options";
import { isPopularityWindow, type PopularityWindow } from "../events/popularity";
import type {
    PublicFeaturedEvent,
    PublicHomepageData,
    PublicHomepageDivision,
    PublicHomepagePopularity,
    PublicHomepageRankedEvent,
    PublicHomepageRankedScene
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

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]) {
    const actualKeys = Object.keys(value);
    return actualKeys.length === keys.length && keys.every((key) => actualKeys.includes(key));
}

function isNullableString(value: unknown): value is string | null {
    return value === null || typeof value === "string";
}

function isNullableCanonicalDate(value: unknown): value is string | null {
    return value === null || (typeof value === "string" && isCanonicalDate(value));
}

function isNullableCanonicalTime(value: unknown): value is string | null {
    return (
        value === null || (typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value))
    );
}

function readHomepageDivision(value: unknown): PublicHomepageDivision | null {
    if (!isRecord(value) || !hasOnlyKeys(value, ["code", "name", "label"])) return null;
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
    if (
        !isRecord(value) ||
        !hasOnlyKeys(value, [
            "id",
            "title",
            "scale",
            "division_code",
            "start_date",
            "end_date",
            "start_time",
            "end_time",
            "cover_url"
        ])
    ) {
        return null;
    }
    const {
        id,
        title,
        scale,
        division_code,
        start_date,
        end_date,
        start_time,
        end_time,
        cover_url
    } = value;
    if (
        !Number.isSafeInteger(id) ||
        (id as number) <= 0 ||
        typeof title !== "string" ||
        typeof scale !== "string" ||
        !isEventScale(scale) ||
        typeof division_code !== "string" ||
        !isRegionCode(division_code) ||
        typeof start_date !== "string" ||
        !isCanonicalDate(start_date) ||
        typeof end_date !== "string" ||
        !isCanonicalDate(end_date) ||
        !isNullableCanonicalTime(start_time) ||
        !isNullableCanonicalTime(end_time) ||
        !isNullableString(cover_url)
    ) {
        return null;
    }

    return {
        id: id as number,
        title,
        scale,
        division_code,
        start_date,
        end_date,
        start_time,
        end_time,
        cover_url
    };
}

function readRankedEvent(value: unknown): PublicHomepageRankedEvent | null {
    if (
        !isRecord(value) ||
        !hasOnlyKeys(value, [
            "id",
            "title",
            "division_code",
            "start_date",
            "end_date",
            "start_time",
            "end_time",
            "admission_start_date",
            "admission_start_time",
            "unique_visitors"
        ])
    ) {
        return null;
    }
    const {
        id,
        title,
        division_code,
        start_date,
        end_date,
        start_time,
        end_time,
        admission_start_date,
        admission_start_time,
        unique_visitors
    } = value;
    if (
        !Number.isSafeInteger(id) ||
        (id as number) <= 0 ||
        typeof title !== "string" ||
        typeof division_code !== "string" ||
        !isRegionCode(division_code) ||
        typeof start_date !== "string" ||
        !isCanonicalDate(start_date) ||
        typeof end_date !== "string" ||
        !isCanonicalDate(end_date) ||
        !isNullableCanonicalTime(start_time) ||
        !isNullableCanonicalTime(end_time) ||
        !isNullableCanonicalDate(admission_start_date) ||
        !isNullableCanonicalTime(admission_start_time) ||
        (admission_start_time !== null && admission_start_date === null) ||
        !Number.isSafeInteger(unique_visitors) ||
        (unique_visitors as number) < 0
    ) {
        return null;
    }

    return {
        id: id as number,
        title,
        division_code,
        start_date,
        end_date,
        start_time,
        end_time,
        admission_start_date,
        admission_start_time,
        unique_visitors: unique_visitors as number
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

function readRankedScene(value: unknown): PublicHomepageRankedScene | null {
    if (!isRecord(value) || !hasOnlyKeys(value, ["local", "nationwide"])) return null;
    const local = readArray(value.local, readRankedEvent);
    const nationwide = readArray(value.nationwide, readRankedEvent);
    return local && nationwide ? { local, nationwide } : null;
}

export function readPublicHomepagePopularity(
    value: unknown,
    expectedWindow: PopularityWindow
): PublicHomepagePopularity | null {
    if (
        !isRecord(value) ||
        !hasOnlyKeys(value, ["window", "unopened", "unended"]) ||
        !isPopularityWindow(value.window) ||
        value.window !== expectedWindow
    ) {
        return null;
    }

    const unopened = readRankedScene(value.unopened);
    const unended = readRankedScene(value.unended);
    return unopened && unended ? { window: value.window, unopened, unended } : null;
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
    if (!isRecord(value) || !hasOnlyKeys(value, ["division", "featuredEvents", "popularity"])) {
        return null;
    }

    const division = readHomepageDivision(value.division);
    const featuredEvents = readArray(value.featuredEvents, readFeaturedEvent);
    const popularity = readPublicHomepagePopularity(value.popularity, expectedWindow);
    if (!division || division.code !== expectedCity || !featuredEvents || !popularity) return null;

    return { division, featuredEvents, popularity };
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
