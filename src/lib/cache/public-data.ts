import type {
    PublicEventDetail,
    PublicEventPage,
    PublishedEventFilters,
    SitemapEventRow
} from "../db/public-events";
import type { PublicEventTaxonomy } from "../db/public-taxonomy";
import type { TagSummary } from "../db/tags";
import { getChinaLocalDate, isCanonicalDate } from "../events/datetime";
import type { PublicHomepageDiscovery, PublicHomepagePopularity } from "../public/homepage";

export const PUBLIC_DATA_CACHE_NAMESPACE = "eventlist-public-data-v2";
export const PUBLIC_DATA_CACHE_SCHEMA = 2;
export const PUBLIC_DATA_CACHE_SCOPES = [
    "homepage",
    "popularity",
    "tags",
    "detail",
    "sitemap",
    "list"
] as const;

export type PublicDataCacheScope = (typeof PUBLIC_DATA_CACHE_SCOPES)[number];

export const PUBLIC_DATA_CACHE_TAGS: Readonly<Record<PublicDataCacheScope, string>> = {
    homepage: "eventlist-homepage",
    popularity: "eventlist-popularity",
    tags: "eventlist-tags",
    detail: "eventlist-detail",
    sitemap: "eventlist-sitemap",
    list: "eventlist-list"
};

export interface PublicDataCachePayloads {
    "home-discovery": PublicHomepageDiscovery;
    popularity: PublicHomepagePopularity;
    "event-list": PublicEventPage;
    "event-detail": PublicEventDetail;
    "event-taxonomy": PublicEventTaxonomy;
    "top-tags": TagSummary[];
    "tag-search": TagSummary[];
    sitemap: SitemapEventRow[];
}

export interface CachedEnvelope<T> {
    schema: typeof PUBLIC_DATA_CACHE_SCHEMA;
    generatedAt: number;
    freshUntil: number;
    normalUntil: number;
    errorUntil: number;
    value: T;
}

export interface CacheTtlBoundaries {
    generatedAt: number;
    freshTtlMs: number;
    normalTtlMs: number;
    faultTtlMs: number;
}

export type CachedEnvelopeAge = "fresh" | "normal-stale" | "fault-stale" | "hard-expired";

export interface PublicDataCacheStore {
    match(request: Request): Promise<Response | undefined>;
    put(request: Request, response: Response): Promise<void>;
}

export type PublicDataCacheReadResult<T> =
    | { cacheState: "bypass" | "miss" }
    | {
          cacheState: "cached";
          age: CachedEnvelopeAge;
          envelope: CachedEnvelope<T>;
      };

export type PublicDataCacheWriteResult = "bypass" | "stored" | "skipped" | "error";

export type PublicDataCacheState =
    "BYPASS" | "MISS" | "HIT" | "STALE-REFRESH" | "REFRESHED" | "STALE-IF-ERROR";

export interface PublicDataCacheTtlPolicy {
    freshTtlMs: number;
    normalTtlMs: number;
    faultTtlMs: number;
}

export interface PublicDataCacheLoadResult<T> {
    value: T;
    cacheState: PublicDataCacheState;
}

export type PublicDataCacheWaitUntil = (promise: Promise<unknown>) => void;
export type PublicDataCacheInFlight = Map<string, Promise<unknown>>;

export type PublicDataCacheKey =
    | { resource: "home-discovery"; divisionCode: string; asOfDate?: string }
    | { resource: "popularity"; divisionCode: string; window: 3 | 7 | 30 }
    | { resource: "event-list"; filters: PublishedEventFilters; asOfDate?: string }
    | { resource: "event-detail"; eventId: number }
    | { resource: "event-taxonomy" }
    | { resource: "top-tags"; limit: number }
    | { resource: "tag-search"; query: string; limit: number }
    | { resource: "sitemap"; limit: number };

const SYNTHETIC_CACHE_PREFIX = `/_eventlist_cache/v${PUBLIC_DATA_CACHE_SCHEMA}`;
const PUBLIC_DATA_CACHE_SCOPE_SET = new Set<string>(PUBLIC_DATA_CACHE_SCOPES);
const PUBLIC_DATA_IN_FLIGHT: PublicDataCacheInFlight = new Map();

function isNonNegativeFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isPublicDataCacheScope(value: string): value is PublicDataCacheScope {
    return PUBLIC_DATA_CACHE_SCOPE_SET.has(value);
}

export function parsePublicDataCacheScopes(
    value: string | null | undefined
): ReadonlySet<PublicDataCacheScope> {
    if (!value?.trim()) return new Set();

    const tokens = value.split(",").map((token) => token.trim());
    if (tokens.some((token) => !token)) return new Set();

    const scopes = new Set<PublicDataCacheScope>();
    for (const token of tokens) {
        if (!isPublicDataCacheScope(token)) return new Set();
        scopes.add(token);
    }

    return scopes;
}

export function isPublicDataCacheEnabled(
    scopes: ReadonlySet<PublicDataCacheScope> | undefined,
    scope: PublicDataCacheScope
) {
    return scopes?.has(scope) ?? false;
}

export function createCachedEnvelope<T>(
    value: T,
    boundaries: CacheTtlBoundaries
): CachedEnvelope<T> {
    const { generatedAt, freshTtlMs, normalTtlMs, faultTtlMs } = boundaries;
    const values = [generatedAt, freshTtlMs, normalTtlMs, faultTtlMs];
    if (values.some((entry) => !isNonNegativeFiniteNumber(entry))) {
        throw new RangeError("Cache timestamps and TTLs must be non-negative finite numbers");
    }
    if (freshTtlMs > normalTtlMs || normalTtlMs > faultTtlMs) {
        throw new RangeError("Cache TTLs must satisfy fresh <= normal <= fault");
    }

    const freshUntil = generatedAt + freshTtlMs;
    const normalUntil = generatedAt + normalTtlMs;
    const errorUntil = generatedAt + faultTtlMs;
    if (![freshUntil, normalUntil, errorUntil].every(isNonNegativeFiniteNumber)) {
        throw new RangeError("Cache TTL boundaries must be finite numbers");
    }

    return {
        schema: PUBLIC_DATA_CACHE_SCHEMA,
        generatedAt,
        freshUntil,
        normalUntil,
        errorUntil,
        value
    };
}

export function parseCachedEnvelope(input: unknown): CachedEnvelope<unknown> | null {
    let parsed = input;
    if (typeof input === "string") {
        try {
            parsed = JSON.parse(input) as unknown;
        } catch {
            return null;
        }
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const envelope = parsed as Record<string, unknown>;
    if (
        envelope.schema !== PUBLIC_DATA_CACHE_SCHEMA ||
        !isNonNegativeFiniteNumber(envelope.generatedAt) ||
        !isNonNegativeFiniteNumber(envelope.freshUntil) ||
        !isNonNegativeFiniteNumber(envelope.normalUntil) ||
        !isNonNegativeFiniteNumber(envelope.errorUntil) ||
        !Object.prototype.hasOwnProperty.call(envelope, "value") ||
        envelope.value === undefined
    ) {
        return null;
    }
    if (
        envelope.generatedAt > envelope.freshUntil ||
        envelope.freshUntil > envelope.normalUntil ||
        envelope.normalUntil > envelope.errorUntil
    ) {
        return null;
    }

    return envelope as unknown as CachedEnvelope<unknown>;
}

export function classifyCachedEnvelope(
    envelope: CachedEnvelope<unknown>,
    now = Date.now()
): CachedEnvelopeAge {
    if (now <= envelope.freshUntil) return "fresh";
    if (now <= envelope.normalUntil) return "normal-stale";
    if (now <= envelope.errorUntil) return "fault-stale";
    return "hard-expired";
}

function positiveInteger(value: number, fallback: number, maximum?: number) {
    if (!Number.isFinite(value)) return fallback;
    const integer = Math.max(1, Math.trunc(value));
    return maximum ? Math.min(maximum, integer) : integer;
}

function requirePositiveSafeInteger(value: number, label: string) {
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new RangeError(`${label} must be a positive safe integer`);
    }
    return value;
}

function requireCanonicalCacheDate(value: string) {
    if (!isCanonicalDate(value)) throw new RangeError("Cache date must be a canonical date");
    return value;
}

export function normalizePublicDataCacheTags(tags: readonly string[] | undefined): string[] | null {
    if (tags === undefined) return [];
    const normalized = [...new Set(tags)];
    if (normalized.some((tag) => !/^[A-Za-z0-9:_-]+$/.test(tag))) return null;
    return normalized;
}

function eventListSearchParams(filters: PublishedEventFilters) {
    const timing = filters.timing ?? "upcoming";
    const sort = filters.sort ?? (timing === "ended" ? "end_desc" : "start_asc");
    return new URLSearchParams([
        ["timing", timing],
        ["division", filters.divisionCode ?? ""],
        ["type", filters.type ?? ""],
        ["scale", filters.scale ?? ""],
        ["tag", filters.tag?.trim() ?? ""],
        ["from", filters.from ?? ""],
        ["to", filters.to ?? ""],
        ["starts", filters.starts ?? ""],
        ["active", filters.active ?? ""],
        ["sort", sort],
        ["page", String(positiveInteger(filters.page ?? 1, 1))],
        ["pageSize", String(positiveInteger(filters.pageSize ?? 20, 20, 50))]
    ]);
}

function syntheticCacheUrl(origin: string | URL, resource: string, params: URLSearchParams) {
    const source = new URL(origin.toString());
    if (source.protocol !== "http:" && source.protocol !== "https:") {
        throw new TypeError("Cache keys require an HTTP(S) origin");
    }

    const url = new URL(`${SYNTHETIC_CACHE_PREFIX}/${resource}`, source.origin);
    url.search = params.toString();
    return url;
}

export function buildPublicDataCacheRequest(origin: string | URL, key: PublicDataCacheKey) {
    let params: URLSearchParams;
    switch (key.resource) {
        case "home-discovery":
            params = new URLSearchParams([
                ["division", key.divisionCode],
                ["date", requireCanonicalCacheDate(key.asOfDate ?? getChinaLocalDate())]
            ]);
            break;
        case "popularity":
            params = new URLSearchParams([
                ["division", key.divisionCode],
                ["window", String(key.window)]
            ]);
            break;
        case "event-list":
            params = eventListSearchParams(key.filters);
            params.set("date", requireCanonicalCacheDate(key.asOfDate ?? getChinaLocalDate()));
            break;
        case "event-detail":
            params = new URLSearchParams([
                ["id", String(requirePositiveSafeInteger(key.eventId, "Event ID"))]
            ]);
            break;
        case "event-taxonomy":
            params = new URLSearchParams();
            break;
        case "top-tags":
            params = new URLSearchParams([["limit", String(positiveInteger(key.limit, 20))]]);
            break;
        case "tag-search":
            params = new URLSearchParams([
                ["q", key.query.trim()],
                ["limit", String(positiveInteger(key.limit, 12))]
            ]);
            break;
        case "sitemap":
            params = new URLSearchParams([["limit", String(positiveInteger(key.limit, 1000))]]);
            break;
    }

    return new Request(syntheticCacheUrl(origin, key.resource, params), { method: "GET" });
}

export function stablePublicDataCacheJitterMs(key: string, minimumMs: number, maximumMs: number) {
    if (
        !Number.isSafeInteger(minimumMs) ||
        !Number.isSafeInteger(maximumMs) ||
        minimumMs < 0 ||
        maximumMs < minimumMs
    ) {
        throw new RangeError("Cache jitter bounds must be non-negative safe integers");
    }

    let hash = 0x811c9dc5;
    for (let index = 0; index < key.length; index += 1) {
        hash ^= key.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }

    const range = maximumMs - minimumMs + 1;
    return minimumMs + ((hash >>> 0) % range);
}

function publicDataSingleFlight<T>(
    inFlight: PublicDataCacheInFlight | undefined,
    key: string,
    load: () => Promise<T>
): Promise<T> {
    const activeLoads = inFlight ?? PUBLIC_DATA_IN_FLIGHT;

    const existing = activeLoads.get(key);
    if (existing) return existing as Promise<T>;

    let promise!: Promise<T>;
    promise = (async () => {
        await Promise.resolve();
        try {
            return await load();
        } finally {
            if (activeLoads.get(key) === promise) {
                activeLoads.delete(key);
            }
        }
    })();
    activeLoads.set(key, promise);
    return promise;
}

function schedulePublicDataCacheWork(
    waitUntil: PublicDataCacheWaitUntil,
    promise: Promise<unknown>
) {
    try {
        waitUntil(promise);
    } catch {
        void promise.catch(() => undefined);
    }
}

export function publicDataCacheResponseHeaders(
    cacheState: PublicDataCacheState,
    cacheControl?: string
): Record<string, string> {
    return {
        "X-Eventlist-Cache": cacheState,
        ...(cacheState === "STALE-IF-ERROR"
            ? { "Server-Timing": 'eventlist-cache;desc="STALE-IF-ERROR"' }
            : {}),
        ...(cacheControl ? { "Cache-Control": cacheControl } : {})
    };
}

const PUBLIC_DATA_CACHE_STATE_PRIORITY: Record<PublicDataCacheState, number> = {
    BYPASS: 0,
    HIT: 1,
    "STALE-REFRESH": 2,
    REFRESHED: 3,
    MISS: 4,
    "STALE-IF-ERROR": 5
};

export function combinePublicDataCacheStates(
    states: readonly PublicDataCacheState[]
): PublicDataCacheState {
    return states.reduce<PublicDataCacheState>(
        (combined, state) =>
            PUBLIC_DATA_CACHE_STATE_PRIORITY[state] > PUBLIC_DATA_CACHE_STATE_PRIORITY[combined]
                ? state
                : combined,
        "BYPASS"
    );
}

export async function readPublicDataCache<T>(options: {
    scope: PublicDataCacheScope;
    scopes?: ReadonlySet<PublicDataCacheScope>;
    store: PublicDataCacheStore;
    request: Request;
    now?: number;
    isValue: (value: unknown) => value is T;
}): Promise<PublicDataCacheReadResult<T>> {
    if (!isPublicDataCacheEnabled(options.scopes, options.scope)) {
        return { cacheState: "bypass" };
    }

    try {
        const response = await options.store.match(options.request);
        if (!response?.ok) return { cacheState: "miss" };

        const envelope = parseCachedEnvelope(await response.text());
        if (!envelope || !options.isValue(envelope.value)) return { cacheState: "miss" };

        return {
            cacheState: "cached",
            age: classifyCachedEnvelope(envelope, options.now),
            envelope: envelope as CachedEnvelope<T>
        };
    } catch {
        return { cacheState: "miss" };
    }
}

export async function writePublicDataCache<T>(options: {
    scope: PublicDataCacheScope;
    scopes?: ReadonlySet<PublicDataCacheScope>;
    store: PublicDataCacheStore;
    request: Request;
    envelope: CachedEnvelope<T>;
    cacheTags?: readonly string[];
    now?: number;
}): Promise<PublicDataCacheWriteResult> {
    if (!isPublicDataCacheEnabled(options.scopes, options.scope)) return "bypass";

    const now = options.now ?? Date.now();
    if (!isNonNegativeFiniteNumber(now) || !parseCachedEnvelope(options.envelope)) {
        return "skipped";
    }
    const cacheTags = normalizePublicDataCacheTags(options.cacheTags);
    if (!cacheTags) return "skipped";
    const maxAge = Math.ceil((options.envelope.errorUntil - now) / 1000);
    if (maxAge <= 0) return "skipped";

    try {
        await options.store.put(
            options.request,
            new Response(JSON.stringify(options.envelope), {
                headers: {
                    "cache-control": `public, max-age=${maxAge}`,
                    "content-type": "application/json; charset=utf-8",
                    ...(cacheTags.length > 0 ? { "cache-tag": cacheTags.join(",") } : {})
                }
            })
        );
        return "stored";
    } catch {
        return "error";
    }
}

export async function loadPublicDataWithCache<T>(options: {
    scope: PublicDataCacheScope;
    scopes?: ReadonlySet<PublicDataCacheScope>;
    request: Request;
    getStore: () => Promise<PublicDataCacheStore>;
    isValue: (value: unknown) => value is T;
    isCacheValue?: (value: unknown) => value is T;
    shouldCache?: (value: T) => boolean;
    cacheTags?: readonly string[];
    ttl: PublicDataCacheTtlPolicy;
    load: () => Promise<T>;
    waitUntil: PublicDataCacheWaitUntil;
    inFlight?: PublicDataCacheInFlight;
    now?: () => number;
}): Promise<PublicDataCacheLoadResult<T>> {
    const readNow = options.now ?? Date.now;
    const isCacheValue = options.isCacheValue ?? options.isValue;
    const loadValue = async () => {
        const value = await options.load();
        if (!options.isValue(value)) {
            throw new TypeError("Public data loader returned an invalid DTO");
        }
        return value;
    };

    if (!isPublicDataCacheEnabled(options.scopes, options.scope)) {
        return { value: await loadValue(), cacheState: "BYPASS" };
    }

    const flightKey = `${PUBLIC_DATA_CACHE_NAMESPACE}:${options.request.url}`;
    let store: PublicDataCacheStore;
    try {
        store = await options.getStore();
    } catch {
        return {
            value: await publicDataSingleFlight(options.inFlight, flightKey, loadValue),
            cacheState: "MISS"
        };
    }

    const cached = await readPublicDataCache({
        scope: options.scope,
        scopes: options.scopes,
        store,
        request: options.request,
        now: readNow(),
        isValue: isCacheValue
    });

    if (cached.cacheState === "cached" && cached.age === "fresh") {
        return { value: cached.envelope.value, cacheState: "HIT" };
    }

    const refresh = (background: boolean) =>
        publicDataSingleFlight(options.inFlight, flightKey, async () => {
            const value = await loadValue();
            if (options.shouldCache && !options.shouldCache(value)) return value;

            const generatedAt = readNow();
            const envelope = createCachedEnvelope(value, {
                generatedAt,
                ...options.ttl
            });
            const cacheWrite = writePublicDataCache({
                scope: options.scope,
                scopes: options.scopes,
                store,
                request: options.request,
                envelope,
                cacheTags: options.cacheTags,
                now: generatedAt
            });
            if (background) {
                await cacheWrite;
            } else {
                schedulePublicDataCacheWork(options.waitUntil, cacheWrite);
            }
            return value;
        });

    if (cached.cacheState === "cached" && cached.age === "normal-stale") {
        const backgroundRefresh = refresh(true).then(
            () => undefined,
            () => undefined
        );
        schedulePublicDataCacheWork(options.waitUntil, backgroundRefresh);
        return { value: cached.envelope.value, cacheState: "STALE-REFRESH" };
    }

    try {
        return {
            value: await refresh(false),
            cacheState: cached.cacheState === "cached" ? "REFRESHED" : "MISS"
        };
    } catch (error) {
        if (cached.cacheState === "cached" && cached.age === "fault-stale") {
            return { value: cached.envelope.value, cacheState: "STALE-IF-ERROR" };
        }
        throw error;
    }
}
