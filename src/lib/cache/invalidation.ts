import { STATUS } from "../db";
import type { MutationImpact } from "../db/admin-events";
import { isRegionCode } from "../divisions";
import {
    openPublicDataCacheInvalidationStore,
    type PublicDataCacheInvalidationStore
} from "./cloudflare";
import {
    buildPublicDataCacheRequest,
    isPublicDataCacheEnabled,
    parsePublicDataCacheScopes,
    type PublicDataCacheScope,
    type PublicDataCacheWaitUntil
} from "./public-data";

export const PUBLIC_DATA_CACHE_INVALIDATION_LIMIT = 24;

export type PublicDataMutationKind = "create" | "edit" | "status" | "merge";

export interface PublicDataCacheInvalidationResult {
    attempted: number;
    deleted: number;
    failed: number;
    truncated: number;
}

interface PublicDataCacheInvalidationOptions {
    origin: string | URL;
    configuredScopes: string | null | undefined;
    kind: PublicDataMutationKind;
    impact: MutationImpact;
    getStore?: () => Promise<PublicDataCacheInvalidationStore>;
}

interface ScheduledPublicDataCacheInvalidationOptions extends PublicDataCacheInvalidationOptions {
    waitUntil: PublicDataCacheWaitUntil;
}

function divisionCacheKeys(code: string) {
    if (!isRegionCode(code)) return [];
    return [...new Set([code.slice(0, 2), code.slice(0, 4), code])];
}

function affectsPublicDetail(impact: MutationImpact) {
    return [impact.oldStatus, impact.newStatus].some(
        (status) => status === STATUS.PUBLISHED || status === STATUS.OFFLINE
    );
}

function affectsPublishedAggregates(impact: MutationImpact) {
    return impact.oldStatus === STATUS.PUBLISHED || impact.newStatus === STATUS.PUBLISHED;
}

function addRequest(requests: Map<string, Request>, request: Request) {
    requests.set(request.url, request);
}

export function buildPublicDataInvalidationRequests(options: {
    origin: string | URL;
    scopes: ReadonlySet<PublicDataCacheScope>;
    kind: PublicDataMutationKind;
    impact: MutationImpact;
}) {
    const requests = new Map<string, Request>();
    const { impact, kind, origin, scopes } = options;
    const invalidateDetail =
        kind === "merge" || ((kind === "edit" || kind === "status") && affectsPublicDetail(impact));
    const invalidatePublishedAggregates = kind === "create" || affectsPublishedAggregates(impact);

    // Region aggregates have priority because an old/new county move can consume the full
    // 24-delete budget required by the parent task's ancestor invalidation contract.
    if (invalidatePublishedAggregates) {
        const divisionCodes = [
            ...new Set(
                [...impact.oldDivisionCodes, ...impact.newDivisionCodes].flatMap(divisionCacheKeys)
            )
        ];
        for (const divisionCode of divisionCodes) {
            if (isPublicDataCacheEnabled(scopes, "homepage")) {
                addRequest(
                    requests,
                    buildPublicDataCacheRequest(origin, {
                        resource: "home-discovery",
                        divisionCode
                    })
                );
            }
            if (isPublicDataCacheEnabled(scopes, "popularity")) {
                for (const window of [3, 7, 30] as const) {
                    addRequest(
                        requests,
                        buildPublicDataCacheRequest(origin, {
                            resource: "popularity",
                            divisionCode,
                            window
                        })
                    );
                }
            }
        }
    }

    if (invalidateDetail && isPublicDataCacheEnabled(scopes, "detail")) {
        for (const eventId of impact.eventIds) {
            if (!Number.isSafeInteger(eventId) || eventId <= 0) continue;
            addRequest(
                requests,
                buildPublicDataCacheRequest(origin, { resource: "event-detail", eventId })
            );
        }
    }

    if (
        (kind === "merge" || invalidatePublishedAggregates) &&
        isPublicDataCacheEnabled(scopes, "tags")
    ) {
        for (const limit of [12, 20]) {
            addRequest(
                requests,
                buildPublicDataCacheRequest(origin, { resource: "top-tags", limit })
            );
        }
    }

    if (invalidatePublishedAggregates && isPublicDataCacheEnabled(scopes, "sitemap")) {
        addRequest(
            requests,
            buildPublicDataCacheRequest(origin, { resource: "sitemap", limit: 1000 })
        );
    }

    const candidates = [...requests.values()];
    return {
        requests: candidates.slice(0, PUBLIC_DATA_CACHE_INVALIDATION_LIMIT),
        truncated: Math.max(0, candidates.length - PUBLIC_DATA_CACHE_INVALIDATION_LIMIT)
    };
}

export async function invalidatePublicDataAfterMutation(
    options: PublicDataCacheInvalidationOptions
): Promise<PublicDataCacheInvalidationResult> {
    const scopes = parsePublicDataCacheScopes(options.configuredScopes);
    const built = buildPublicDataInvalidationRequests({
        origin: options.origin,
        scopes,
        kind: options.kind,
        impact: options.impact
    });
    if (built.requests.length === 0) {
        return { attempted: 0, deleted: 0, failed: 0, truncated: built.truncated };
    }

    let store: PublicDataCacheInvalidationStore;
    try {
        store = await (options.getStore ?? openPublicDataCacheInvalidationStore)();
    } catch {
        return {
            attempted: built.requests.length,
            deleted: 0,
            failed: built.requests.length,
            truncated: built.truncated
        };
    }

    const results = await Promise.allSettled(
        built.requests.map((request) => store.delete(request))
    );
    let deleted = 0;
    let failed = 0;
    for (const result of results) {
        if (result.status === "fulfilled") {
            if (result.value) deleted += 1;
        } else {
            failed += 1;
        }
    }

    return {
        attempted: built.requests.length,
        deleted,
        failed,
        truncated: built.truncated
    };
}

export function schedulePublicDataInvalidation(
    options: ScheduledPublicDataCacheInvalidationOptions
) {
    const work = invalidatePublicDataAfterMutation(options).then(
        () => undefined,
        () => undefined
    );
    try {
        options.waitUntil(work);
    } catch {
        void work.catch(() => undefined);
    }
}
