import type { PopularityWindow } from "../events/popularity";
import type {
    PublicEventDetail,
    PublicEventPage,
    PublicEventRow,
    PublishedEventFilters,
    SitemapEventRow
} from "../db/public-events";
import type { TagSummary } from "../db/tags";
import { isRegionCode } from "../divisions";
import { getChinaLocalDate, isCanonicalDate } from "../events/datetime";
import {
    isEventAdmissionMethod,
    isEventScale,
    isEventScheduleStatus,
    isEventType
} from "../events/options";
import type {
    PublicFeaturedEvent,
    PublicHomepageDiscovery,
    PublicHomepagePopularity,
    PublicPopularEvent
} from "../public/homepage";
import { openPublicDataCacheStore } from "./cloudflare";
import {
    buildPublicDataCacheRequest,
    loadPublicDataWithCache,
    parsePublicDataCacheScopes,
    PUBLIC_DATA_CACHE_TAGS,
    stablePublicDataCacheJitterMs,
    type PublicDataCacheLoadResult,
    type PublicDataCacheScope,
    type PublicDataCacheStore,
    type PublicDataCacheWaitUntil
} from "./public-data";

const POPULARITY_NORMAL_TTL_MS = 60_000;
const POPULARITY_FAULT_TTL_MS = 5 * 60_000;
const STANDARD_TTL_MS = 30 * 60_000;
const DETAIL_TTL_MS = 6 * 60 * 60_000;
const PUBLIC_DATA_FAULT_TTL_MS = 48 * 60 * 60_000;

interface PublicRouteCacheOptions<T> {
    origin: string | URL;
    configuredScopes: string | null | undefined;
    load: (asOfDate?: string) => Promise<T>;
    waitUntil: PublicDataCacheWaitUntil;
    getStore?: () => Promise<PublicDataCacheStore>;
    now?: () => number;
    asOfDate?: string;
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]) {
    const actualKeys = Object.keys(value);
    return actualKeys.length === keys.length && keys.every((key) => actualKeys.includes(key));
}

function isTagSummary(value: unknown): value is TagSummary {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const tag = value as Record<string, unknown>;
    return (
        hasOnlyKeys(tag, ["id", "name", "event_count"]) &&
        Number.isSafeInteger(tag.id) &&
        (tag.id as number) > 0 &&
        typeof tag.name === "string" &&
        Number.isSafeInteger(tag.event_count) &&
        (tag.event_count as number) >= 0
    );
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

function isSqliteDateTime(value: unknown): value is string {
    return (
        typeof value === "string" &&
        /^\d{4}-\d{2}-\d{2} (?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(value) &&
        isCanonicalDate(value.slice(0, 10))
    );
}

function isPositiveSafeInteger(value: unknown): value is number {
    return Number.isSafeInteger(value) && (value as number) > 0;
}

function isNonNegativeSafeInteger(value: unknown): value is number {
    return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isPublicEventRow(value: unknown): value is PublicEventRow {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const event = value as Record<string, unknown>;
    return (
        hasOnlyKeys(event, [
            "id",
            "title",
            "type",
            "scale",
            "division_code",
            "venue",
            "start_date",
            "end_date",
            "start_time",
            "end_time",
            "cover_url",
            "tags"
        ]) &&
        isPositiveSafeInteger(event.id) &&
        typeof event.title === "string" &&
        typeof event.type === "string" &&
        isEventType(event.type) &&
        typeof event.scale === "string" &&
        isEventScale(event.scale) &&
        typeof event.division_code === "string" &&
        isRegionCode(event.division_code) &&
        typeof event.venue === "string" &&
        typeof event.start_date === "string" &&
        isCanonicalDate(event.start_date) &&
        typeof event.end_date === "string" &&
        isCanonicalDate(event.end_date) &&
        isNullableCanonicalTime(event.start_time) &&
        isNullableCanonicalTime(event.end_time) &&
        isNullableString(event.cover_url) &&
        isNullableString(event.tags)
    );
}

function isPublicFeaturedEvent(value: unknown): value is PublicFeaturedEvent {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const event = value as Record<string, unknown>;
    return (
        hasOnlyKeys(event, [
            "id",
            "title",
            "scale",
            "start_date",
            "end_date",
            "start_time",
            "end_time",
            "cover_url"
        ]) &&
        isPositiveSafeInteger(event.id) &&
        typeof event.title === "string" &&
        typeof event.scale === "string" &&
        isEventScale(event.scale) &&
        typeof event.start_date === "string" &&
        isCanonicalDate(event.start_date) &&
        typeof event.end_date === "string" &&
        isCanonicalDate(event.end_date) &&
        isNullableCanonicalTime(event.start_time) &&
        isNullableCanonicalTime(event.end_time) &&
        isNullableString(event.cover_url)
    );
}

function isPublicPopularEvent(value: unknown): value is PublicPopularEvent {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const event = value as Record<string, unknown>;
    return (
        hasOnlyKeys(event, ["id", "title", "division_code", "start_date", "unique_visitors"]) &&
        isPositiveSafeInteger(event.id) &&
        typeof event.title === "string" &&
        typeof event.division_code === "string" &&
        isRegionCode(event.division_code) &&
        typeof event.start_date === "string" &&
        isCanonicalDate(event.start_date) &&
        isNonNegativeSafeInteger(event.unique_visitors)
    );
}

export function isPublicHomepageDiscovery(value: unknown): value is PublicHomepageDiscovery {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const discovery = value as Record<string, unknown>;
    return (
        hasOnlyKeys(discovery, ["featuredEvents", "today"]) &&
        Array.isArray(discovery.featuredEvents) &&
        discovery.featuredEvents.every(isPublicFeaturedEvent) &&
        Array.isArray(discovery.today) &&
        discovery.today.every(isPublicEventRow)
    );
}

export function isPublicHomepagePopularity(value: unknown): value is PublicHomepagePopularity {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const popularity = value as Record<string, unknown>;
    return (
        hasOnlyKeys(popularity, ["window", "local", "nationwide"]) &&
        (popularity.window === 3 || popularity.window === 7 || popularity.window === 30) &&
        Array.isArray(popularity.local) &&
        popularity.local.every(isPublicPopularEvent) &&
        Array.isArray(popularity.nationwide) &&
        popularity.nationwide.every(isPublicPopularEvent)
    );
}

export function isPublicEventPage(value: unknown): value is PublicEventPage {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const page = value as Record<string, unknown>;
    return (
        hasOnlyKeys(page, ["events", "page", "pageSize", "hasNext"]) &&
        Array.isArray(page.events) &&
        page.events.every(isPublicEventRow) &&
        isPositiveSafeInteger(page.page) &&
        isPositiveSafeInteger(page.pageSize) &&
        (page.pageSize as number) <= 50 &&
        typeof page.hasNext === "boolean"
    );
}

export function isPublicEventDetail(value: unknown): value is PublicEventDetail {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const event = value as Record<string, unknown>;
    if (
        !hasOnlyKeys(event, [
            "id",
            "title",
            "type",
            "scale",
            "division_code",
            "venue",
            "start_date",
            "end_date",
            "start_time",
            "end_time",
            "cover_url",
            "tags",
            "address",
            "description",
            "qq_group",
            "ticket_url",
            "source_url",
            "organizer",
            "schedule_status",
            "admission_method",
            "price_range",
            "admission_start_date",
            "admission_start_time",
            "status",
            "updated_at"
        ])
    ) {
        return false;
    }

    return (
        isPublicEventRow({
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
        }) &&
        isNullableString(event.address) &&
        isNullableString(event.description) &&
        isNullableString(event.qq_group) &&
        isNullableString(event.ticket_url) &&
        typeof event.source_url === "string" &&
        isNullableString(event.organizer) &&
        (event.schedule_status === null ||
            (typeof event.schedule_status === "string" &&
                isEventScheduleStatus(event.schedule_status))) &&
        (event.admission_method === null ||
            (typeof event.admission_method === "string" &&
                isEventAdmissionMethod(event.admission_method))) &&
        isNullableString(event.price_range) &&
        isNullableCanonicalDate(event.admission_start_date) &&
        isNullableCanonicalTime(event.admission_start_time) &&
        (event.admission_start_time === null || event.admission_start_date !== null) &&
        (event.status === "published" || event.status === "offline") &&
        isSqliteDateTime(event.updated_at)
    );
}

function hasBoundedCanonicalDate(value: string | undefined) {
    return value === undefined || isCanonicalDate(value);
}

function matchesDivisionCode(value: string, divisionCode: string) {
    return divisionCode.length === 6 || divisionCode.length === 12
        ? value === divisionCode
        : value.startsWith(divisionCode);
}

export function isPublicEventListCacheable(filters: PublishedEventFilters) {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    return (
        Number.isSafeInteger(page) &&
        page >= 1 &&
        page <= 3 &&
        Number.isSafeInteger(pageSize) &&
        pageSize >= 1 &&
        pageSize <= 50 &&
        (filters.timing === undefined ||
            filters.timing === "upcoming" ||
            filters.timing === "ended" ||
            filters.timing === "all") &&
        (filters.divisionCode === undefined || isRegionCode(filters.divisionCode)) &&
        (filters.type === undefined || isEventType(filters.type)) &&
        (filters.scale === undefined || isEventScale(filters.scale)) &&
        (filters.tag === undefined ||
            (filters.tag.trim().length >= 1 && filters.tag.trim().length <= 24)) &&
        hasBoundedCanonicalDate(filters.from) &&
        hasBoundedCanonicalDate(filters.to) &&
        hasBoundedCanonicalDate(filters.starts) &&
        hasBoundedCanonicalDate(filters.active) &&
        (filters.sort === undefined ||
            filters.sort === "start_asc" ||
            filters.sort === "start_desc" ||
            filters.sort === "end_desc")
    );
}

export function isTagSummaryList(value: unknown): value is TagSummary[] {
    return Array.isArray(value) && value.every(isTagSummary);
}

function isSitemapEventRow(value: unknown): value is SitemapEventRow {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const row = value as Record<string, unknown>;
    return (
        hasOnlyKeys(row, ["id", "updated_at"]) &&
        Number.isSafeInteger(row.id) &&
        (row.id as number) > 0 &&
        isSqliteDateTime(row.updated_at)
    );
}

export function isSitemapEventRowList(value: unknown): value is SitemapEventRow[] {
    return Array.isArray(value) && value.every(isSitemapEventRow);
}

export async function loadCachedHomepageDiscovery(
    options: PublicRouteCacheOptions<PublicHomepageDiscovery> & { divisionCode: string }
): Promise<PublicDataCacheLoadResult<PublicHomepageDiscovery>> {
    const asOfDate = options.asOfDate ?? getChinaLocalDate();
    const request = buildPublicDataCacheRequest(options.origin, {
        resource: "home-discovery",
        divisionCode: options.divisionCode,
        asOfDate
    });

    const isRequestedDiscovery = (value: unknown): value is PublicHomepageDiscovery =>
        isPublicHomepageDiscovery(value) &&
        value.today.every((event) =>
            matchesDivisionCode(event.division_code, options.divisionCode)
        );

    return loadPublicDataWithCache({
        scope: "homepage",
        scopes: parsePublicDataCacheScopes(options.configuredScopes),
        request,
        getStore: options.getStore ?? openPublicDataCacheStore,
        isValue: isRequestedDiscovery,
        cacheTags: [PUBLIC_DATA_CACHE_TAGS.homepage],
        ttl: {
            freshTtlMs: STANDARD_TTL_MS,
            normalTtlMs: STANDARD_TTL_MS,
            faultTtlMs: PUBLIC_DATA_FAULT_TTL_MS
        },
        load: () => options.load(asOfDate),
        waitUntil: options.waitUntil,
        now: options.now
    });
}

export async function loadCachedHomepagePopularity(
    options: PublicRouteCacheOptions<PublicHomepagePopularity> & {
        divisionCode: string;
        window: PopularityWindow;
    }
): Promise<PublicDataCacheLoadResult<PublicHomepagePopularity>> {
    const request = buildPublicDataCacheRequest(options.origin, {
        resource: "popularity",
        divisionCode: options.divisionCode,
        window: options.window
    });

    const isRequestedPopularity = (value: unknown): value is PublicHomepagePopularity =>
        isPublicHomepagePopularity(value) &&
        value.window === options.window &&
        value.local.every((event) =>
            matchesDivisionCode(event.division_code, options.divisionCode)
        );

    return loadPublicDataWithCache({
        scope: "popularity",
        scopes: parsePublicDataCacheScopes(options.configuredScopes),
        request,
        getStore: options.getStore ?? openPublicDataCacheStore,
        isValue: isRequestedPopularity,
        cacheTags: [PUBLIC_DATA_CACHE_TAGS.popularity],
        ttl: {
            freshTtlMs: stablePublicDataCacheJitterMs(request.url, 45_000, 55_000),
            normalTtlMs: POPULARITY_NORMAL_TTL_MS,
            faultTtlMs: POPULARITY_FAULT_TTL_MS
        },
        load: options.load,
        waitUntil: options.waitUntil,
        now: options.now
    });
}

export async function loadCachedPublicEventDetail(
    options: PublicRouteCacheOptions<PublicEventDetail | null> & { eventId: number }
): Promise<PublicDataCacheLoadResult<PublicEventDetail | null>> {
    const request = buildPublicDataCacheRequest(options.origin, {
        resource: "event-detail",
        eventId: options.eventId
    });

    const isRequestedDetail = (value: unknown): value is PublicEventDetail =>
        isPublicEventDetail(value) && value.id === options.eventId;
    const isRequestedNullableDetail = (value: unknown): value is PublicEventDetail | null =>
        value === null || isRequestedDetail(value);

    return loadPublicDataWithCache({
        scope: "detail",
        scopes: parsePublicDataCacheScopes(options.configuredScopes),
        request,
        getStore: options.getStore ?? openPublicDataCacheStore,
        isValue: isRequestedNullableDetail,
        isCacheValue: isRequestedDetail,
        shouldCache: isRequestedDetail,
        cacheTags: [PUBLIC_DATA_CACHE_TAGS.detail, `eventlist-detail-${options.eventId}`],
        ttl: {
            freshTtlMs: DETAIL_TTL_MS,
            normalTtlMs: DETAIL_TTL_MS,
            faultTtlMs: PUBLIC_DATA_FAULT_TTL_MS
        },
        load: options.load,
        waitUntil: options.waitUntil,
        now: options.now
    });
}

export async function loadCachedPublicEventList(
    options: PublicRouteCacheOptions<PublicEventPage> & { filters: PublishedEventFilters }
): Promise<PublicDataCacheLoadResult<PublicEventPage>> {
    const asOfDate = options.asOfDate ?? getChinaLocalDate();
    const request = buildPublicDataCacheRequest(options.origin, {
        resource: "event-list",
        filters: options.filters,
        asOfDate
    });
    const scopes = isPublicEventListCacheable(options.filters)
        ? parsePublicDataCacheScopes(options.configuredScopes)
        : new Set<PublicDataCacheScope>();

    const expectedPage = Math.max(1, options.filters.page ?? 1);
    const expectedPageSize = Math.min(50, Math.max(1, options.filters.pageSize ?? 20));
    const isRequestedPage = (value: unknown): value is PublicEventPage =>
        isPublicEventPage(value) &&
        value.page === expectedPage &&
        value.pageSize === expectedPageSize;

    return loadPublicDataWithCache({
        scope: "list",
        scopes,
        request,
        getStore: options.getStore ?? openPublicDataCacheStore,
        isValue: isRequestedPage,
        cacheTags: [PUBLIC_DATA_CACHE_TAGS.list],
        ttl: {
            freshTtlMs: STANDARD_TTL_MS,
            normalTtlMs: STANDARD_TTL_MS,
            faultTtlMs: PUBLIC_DATA_FAULT_TTL_MS
        },
        load: () => options.load(asOfDate),
        waitUntil: options.waitUntil,
        now: options.now
    });
}

export async function loadCachedPublicTags(
    options: PublicRouteCacheOptions<TagSummary[]> & { query: string; limit: number }
): Promise<PublicDataCacheLoadResult<TagSummary[]>> {
    const normalizedQuery = options.query.trim();
    const request = buildPublicDataCacheRequest(
        options.origin,
        normalizedQuery
            ? { resource: "tag-search", query: normalizedQuery, limit: options.limit }
            : { resource: "top-tags", limit: options.limit }
    );
    const scopes =
        normalizedQuery.length <= 24
            ? parsePublicDataCacheScopes(options.configuredScopes)
            : new Set<PublicDataCacheScope>();

    const isRequestedTagList = (value: unknown): value is TagSummary[] =>
        isTagSummaryList(value) && value.length <= options.limit;

    return loadPublicDataWithCache({
        scope: "tags",
        scopes,
        request,
        getStore: options.getStore ?? openPublicDataCacheStore,
        isValue: isRequestedTagList,
        cacheTags: [PUBLIC_DATA_CACHE_TAGS.tags],
        ttl: {
            freshTtlMs: STANDARD_TTL_MS,
            normalTtlMs: STANDARD_TTL_MS,
            faultTtlMs: PUBLIC_DATA_FAULT_TTL_MS
        },
        load: options.load,
        waitUntil: options.waitUntil,
        now: options.now
    });
}

export async function loadCachedSitemapRows(
    options: PublicRouteCacheOptions<SitemapEventRow[]> & { limit: number }
): Promise<PublicDataCacheLoadResult<SitemapEventRow[]>> {
    const request = buildPublicDataCacheRequest(options.origin, {
        resource: "sitemap",
        limit: options.limit
    });

    const isRequestedSitemap = (value: unknown): value is SitemapEventRow[] =>
        isSitemapEventRowList(value) && value.length <= options.limit;

    return loadPublicDataWithCache({
        scope: "sitemap",
        scopes: parsePublicDataCacheScopes(options.configuredScopes),
        request,
        getStore: options.getStore ?? openPublicDataCacheStore,
        isValue: isRequestedSitemap,
        cacheTags: [PUBLIC_DATA_CACHE_TAGS.sitemap],
        ttl: {
            freshTtlMs: DETAIL_TTL_MS,
            normalTtlMs: DETAIL_TTL_MS,
            faultTtlMs: PUBLIC_DATA_FAULT_TTL_MS
        },
        load: options.load,
        waitUntil: options.waitUntil,
        now: options.now
    });
}
