import { normalizePublicDataCacheTags } from "./public-data";

const CLOUDFLARE_API_ORIGIN = "https://api.cloudflare.com";
const CLOUDFLARE_ZONE_ID_PATTERN = /^[a-f0-9]{32}$/i;

export type PublicDataCachePurgeStatus = "purged" | "skipped" | "failed";

export interface PublicDataCachePurgeResult {
    status: PublicDataCachePurgeStatus;
}

export type PublicDataCachePurgeFetch = (input: string, init?: RequestInit) => Promise<Response>;

export type PublicDataCachePurgeLogger = (record: Record<string, unknown>) => void;

function defaultPurgeLogger(record: Record<string, unknown>) {
    console.error(record);
}

function logPurgeFailure(logger: PublicDataCachePurgeLogger, fields: Record<string, unknown>) {
    try {
        logger({ event: "public_cache_global_purge", ...fields });
    } catch {
        // Cache observability must never affect a committed admin mutation.
    }
}

export async function purgePublicDataCacheTags(options: {
    zoneId?: string;
    token?: string;
    tags: readonly string[];
    kind: string;
    fetchImpl?: PublicDataCachePurgeFetch;
    logger?: PublicDataCachePurgeLogger;
}): Promise<PublicDataCachePurgeResult> {
    const logger = options.logger ?? defaultPurgeLogger;
    const tags = normalizePublicDataCacheTags(options.tags);
    if (!tags || tags.length === 0) {
        logPurgeFailure(logger, {
            status: "skipped",
            reason: tags ? "no-tags" : "invalid-tags",
            kind: options.kind
        });
        return { status: "skipped" };
    }

    const zoneId = options.zoneId?.trim();
    const token = options.token?.trim();
    if (!zoneId || !token || !CLOUDFLARE_ZONE_ID_PATTERN.test(zoneId)) {
        logPurgeFailure(logger, {
            status: "skipped",
            reason: "missing-or-invalid-config",
            kind: options.kind,
            tags
        });
        return { status: "skipped" };
    }

    const fetchImpl = options.fetchImpl ?? globalThis.fetch;
    try {
        const response = await fetchImpl(
            `${CLOUDFLARE_API_ORIGIN}/client/v4/zones/${zoneId}/purge_cache`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ tags })
            }
        );

        if (!response.ok) {
            logPurgeFailure(logger, {
                status: "failed",
                reason: "http-error",
                kind: options.kind,
                tags,
                code: response.status
            });
            return { status: "failed" };
        }

        let payload: unknown;
        try {
            payload = JSON.parse(await response.text()) as unknown;
        } catch {
            logPurgeFailure(logger, {
                status: "failed",
                reason: "invalid-response",
                kind: options.kind,
                tags,
                code: response.status
            });
            return { status: "failed" };
        }

        if (
            !payload ||
            typeof payload !== "object" ||
            Array.isArray(payload) ||
            (payload as { success?: unknown }).success !== true
        ) {
            logPurgeFailure(logger, {
                status: "failed",
                reason: "api-rejected",
                kind: options.kind,
                tags,
                code: response.status
            });
            return { status: "failed" };
        }

        return { status: "purged" };
    } catch (error) {
        logPurgeFailure(logger, {
            status: "failed",
            reason: "request-error",
            kind: options.kind,
            tags,
            errorType: error instanceof Error ? error.name : "unknown"
        });
        return { status: "failed" };
    }
}
