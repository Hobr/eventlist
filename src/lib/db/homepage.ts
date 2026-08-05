import type { D1Database, D1Result } from "../../types/cloudflare";
import { isCanonicalDate } from "../events/datetime";
import type { PopularityWindow } from "../events/popularity";
import { requireD1Success, STATUS } from "./index";
import {
    divisionFilter,
    EVENT_ENDED_CLAUSE,
    eventEndedClause,
    mapPublicEventRow,
    PUBLIC_EVENT_SELECT,
    type PublicEventDatabaseRow,
    type PublicEventRow
} from "./public-events";

export interface HomepageDiscovery {
    featuredEvents: PublicEventRow[];
}

export interface RankedHomepageEvent {
    id: number;
    title: string;
    scale: PublicEventRow["scale"];
    division_code: string;
    start_date: string;
    end_date: string;
    start_time: string | null;
    end_time: string | null;
    admission_start_date: string | null;
    admission_start_time: string | null;
    unique_visitors: number;
}

export interface HomepageRankedScene {
    local: RankedHomepageEvent[];
    nationwide: RankedHomepageEvent[];
}

export interface HomepagePopularity {
    window: PopularityWindow;
    unopened: HomepageRankedScene;
    unended: HomepageRankedScene;
}

type HomepageScene = "unopened" | "unended";

type RankedHomepageEventDatabaseRow = RankedHomepageEvent;

const EVENT_SCALE_ORDER = `CASE events.scale
    WHEN 'mega' THEN 4
    WHEN 'large' THEN 3
    WHEN 'mid' THEN 2
    WHEN 'small' THEN 1
    ELSE 0
END`;

const RANKED_EVENT_COLUMNS = `
    events.id,
    events.title,
    events.scale,
    events.division_code,
    events.start_date,
    events.end_date,
    events.start_time,
    events.end_time,
    events.admission_start_date,
    events.admission_start_time
`;

function mapRankedHomepageEvent(event: RankedHomepageEventDatabaseRow): RankedHomepageEvent {
    return {
        id: event.id,
        title: event.title,
        scale: event.scale,
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

export async function listHomepageDiscovery(
    db: D1Database,
    divisionCode: string,
    asOfDate?: string
): Promise<HomepageDiscovery> {
    if (asOfDate !== undefined && !isCanonicalDate(asOfDate)) {
        throw new RangeError("Homepage date must be a canonical date");
    }
    const division = divisionFilter("events.division_code", divisionCode);
    const clockPrefix =
        asOfDate === undefined ? "" : "WITH cache_clock(as_of_date) AS (VALUES (?))";
    const dateExpression =
        asOfDate === undefined ? "date('now', '+8 hours')" : "(SELECT as_of_date FROM cache_clock)";
    const futureDateExpression =
        asOfDate === undefined
            ? "date('now', '+8 hours', '+14 days')"
            : `date(${dateExpression}, '+14 days')`;
    const endedClause =
        asOfDate === undefined ? EVENT_ENDED_CLAUSE : eventEndedClause(dateExpression);
    const bindPrefix = asOfDate === undefined ? [] : [asOfDate];
    const featuredResult = await db
        .prepare(
            `${clockPrefix}
             ${PUBLIC_EVENT_SELECT}
             WHERE events.status = ?
               AND NOT ${endedClause}
               AND ${division.clause}
               AND events.start_date <= ${futureDateExpression}
             GROUP BY events.id
             ORDER BY CASE
                          WHEN events.start_date < ${dateExpression} THEN 0
                          WHEN events.start_date = ${dateExpression}
                           AND (
                               events.start_time IS NULL
                               OR events.start_time <= time('now', '+8 hours')
                           ) THEN 0
                          ELSE 1
                      END ASC,
                      ${EVENT_SCALE_ORDER} DESC,
                      events.start_date ASC,
                      CASE WHEN events.cover_url IS NULL OR trim(events.cover_url) = '' THEN 0 ELSE 1 END DESC,
                      events.id ASC
             LIMIT 5`
        )
        .bind(...bindPrefix, STATUS.PUBLISHED, division.value)
        .all<PublicEventDatabaseRow>();

    const featuredEvents =
        requireD1Success(featuredResult, "Failed to load homepage featured events").results ?? [];

    return { featuredEvents: featuredEvents.map(mapPublicEventRow) };
}

function popularityStatement(db: D1Database, scene: HomepageScene, divisionCode?: string) {
    const division = divisionCode ? divisionFilter("events.division_code", divisionCode) : null;
    const divisionClause = division ? `AND ${division.clause}` : "";
    const sceneClause =
        scene === "unopened"
            ? `AND events.admission_start_date IS NOT NULL
               AND events.admission_start_date <= date('now', '+8 hours', '+14 days')
               AND (
                   events.admission_start_date > date('now', '+8 hours')
                   OR (
                       events.admission_start_date = date('now', '+8 hours')
                       AND (
                           events.admission_start_time IS NULL
                           OR events.admission_start_time > time('now', '+8 hours')
                       )
                   )
               )`
            : "";
    const sceneOrder =
        scene === "unopened"
            ? `events.admission_start_date ASC,
               CASE WHEN events.admission_start_time IS NULL THEN 1 ELSE 0 END ASC,
               events.admission_start_time ASC`
            : `CASE
                   WHEN events.start_date < date('now', '+8 hours') THEN 0
                   WHEN events.start_date = date('now', '+8 hours')
                    AND (
                        events.start_time IS NULL
                        OR events.start_time <= time('now', '+8 hours')
                    ) THEN 0
                   ELSE 1
               END ASC,
               events.start_date ASC,
               CASE WHEN events.start_time IS NULL THEN 0 ELSE 1 END ASC,
               events.start_time ASC`;

    return {
        statement: db.prepare(
            `WITH recent_visitors AS (
                SELECT event_id, COUNT(*) AS unique_visitors
                FROM event_visitors
                WHERE last_seen_date BETWEEN date('now', '+8 hours', ?)
                    AND date('now', '+8 hours')
                GROUP BY event_id
            )
            SELECT
                ${RANKED_EVENT_COLUMNS},
                COALESCE(recent_visitors.unique_visitors, 0) AS unique_visitors
            FROM events
            LEFT JOIN recent_visitors ON recent_visitors.event_id = events.id
            WHERE events.status = ?
              AND NOT ${EVENT_ENDED_CLAUSE}
              ${sceneClause}
              ${divisionClause}
            ORDER BY COALESCE(recent_visitors.unique_visitors, 0) DESC,
                     ${sceneOrder},
                     ${EVENT_SCALE_ORDER} DESC,
                     events.id ASC
            LIMIT 5`
        ),
        divisionValue: division?.value
    };
}

export async function listHomepagePopularity(
    db: D1Database,
    divisionCode: string,
    window: PopularityWindow
): Promise<HomepagePopularity> {
    if (!divisionCode.trim()) throw new Error("Homepage division code is required");

    const offset = `-${window - 1} days`;
    const unopenedLocal = popularityStatement(db, "unopened", divisionCode);
    const unopenedNationwide = popularityStatement(db, "unopened");
    const unendedLocal = popularityStatement(db, "unended", divisionCode);
    const unendedNationwide = popularityStatement(db, "unended");
    if (!unopenedLocal.divisionValue || !unendedLocal.divisionValue) {
        throw new Error("Homepage division code is required");
    }

    const [
        unopenedLocalResult,
        unopenedNationwideResult,
        unendedLocalResult,
        unendedNationwideResult
    ] = await db.batch<RankedHomepageEventDatabaseRow>([
        unopenedLocal.statement.bind(offset, STATUS.PUBLISHED, unopenedLocal.divisionValue),
        unopenedNationwide.statement.bind(offset, STATUS.PUBLISHED),
        unendedLocal.statement.bind(offset, STATUS.PUBLISHED, unendedLocal.divisionValue),
        unendedNationwide.statement.bind(offset, STATUS.PUBLISHED)
    ]);

    const readEvents = (result: D1Result<RankedHomepageEventDatabaseRow>, message: string) =>
        (requireD1Success(result, message).results ?? []).map(mapRankedHomepageEvent);

    return {
        window,
        unopened: {
            local: readEvents(unopenedLocalResult, "Failed to load local unopened events"),
            nationwide: readEvents(
                unopenedNationwideResult,
                "Failed to load nationwide unopened events"
            )
        },
        unended: {
            local: readEvents(unendedLocalResult, "Failed to load local unended events"),
            nationwide: readEvents(
                unendedNationwideResult,
                "Failed to load nationwide unended events"
            )
        }
    };
}
