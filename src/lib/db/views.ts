import type { D1Database } from "../../types/cloudflare";
import { requireD1Success, STATUS } from "./index";
import { EVENT_ENDED_CLAUSE } from "./public-events";

export type EventViewRecordOutcome = "changed" | "already-current" | "ignored";

export async function recordEventView(
    db: D1Database,
    eventId: number,
    visitorKey: string
): Promise<EventViewRecordOutcome> {
    const [writeResult, currentResult] = await db.batch<{ current: number }>([
        db
            .prepare(
                `INSERT INTO event_visitors(event_id, visitor_key, last_seen_date)
                 SELECT events.id, ?, date('now', '+8 hours')
                 FROM events
                 WHERE events.id = ?
                   AND events.status = ?
                   AND NOT ${EVENT_ENDED_CLAUSE}
                 ON CONFLICT(event_id, visitor_key) DO UPDATE SET
                    last_seen_date = excluded.last_seen_date
                 WHERE event_visitors.last_seen_date <> excluded.last_seen_date`
            )
            .bind(visitorKey, eventId, STATUS.PUBLISHED),
        db
            .prepare(
                `SELECT 1 AS current
                 FROM event_visitors
                 JOIN events ON events.id = event_visitors.event_id
                 WHERE event_visitors.event_id = ?
                   AND event_visitors.visitor_key = ?
                   AND event_visitors.last_seen_date = date('now', '+8 hours')
                   AND events.status = ?
                   AND NOT ${EVENT_ENDED_CLAUSE}
                 LIMIT 1`
            )
            .bind(eventId, visitorKey, STATUS.PUBLISHED)
    ]);

    requireD1Success(writeResult, "Failed to record event view");
    requireD1Success(currentResult, "Failed to verify event view");

    const isCurrent = currentResult.results?.[0]?.current === 1;
    if (!isCurrent) return "ignored";
    return (writeResult.meta.changes ?? 0) > 0 ? "changed" : "already-current";
}

export async function deleteExpiredEventVisitors(db: D1Database) {
    const result = await db
        .prepare(
            `DELETE FROM event_visitors
             WHERE last_seen_date < date('now', '+8 hours', '-29 days')`
        )
        .run();

    requireD1Success(result, "Failed to delete expired event visitors");
    return result.meta.changes ?? 0;
}
