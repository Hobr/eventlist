import type { D1Database } from "../../types/cloudflare";
import type { PopularityWindow } from "../events/popularity";
import { requireD1Success, STATUS } from "./index";
import {
    divisionFilter,
    EVENT_ENDED_CLAUSE,
    mapPublicEventRow,
    PUBLIC_EVENT_COLUMNS,
    PUBLIC_EVENT_SELECT,
    type PublicEventDatabaseRow,
    type PublicEventRow
} from "./public-events";

export interface HomepageDiscovery {
    featuredEvents: PublicEventRow[];
    today: PublicEventRow[];
}

export interface PopularEvent extends PublicEventRow {
    unique_visitors: number;
}

export interface HomepagePopularity {
    window: PopularityWindow;
    local: PopularEvent[];
    nationwide: PopularEvent[];
}

interface PopularEventDatabaseRow extends PublicEventDatabaseRow {
    unique_visitors: number;
}

const EVENT_SCALE_ORDER = `CASE events.scale
    WHEN 'mega' THEN 4
    WHEN 'large' THEN 3
    WHEN 'mid' THEN 2
    WHEN 'small' THEN 1
    ELSE 0
END`;

function mapPopularEvent(event: PopularEventDatabaseRow): PopularEvent {
    return {
        ...mapPublicEventRow(event),
        unique_visitors: event.unique_visitors
    };
}

export async function listHomepageDiscovery(
    db: D1Database,
    divisionCode: string
): Promise<HomepageDiscovery> {
    const division = divisionFilter("events.division_code", divisionCode);
    const [featuredResult, todayResult] = await db.batch<PublicEventDatabaseRow>([
        db
            .prepare(
                `${PUBLIC_EVENT_SELECT}
                 WHERE events.status = ?
                   AND NOT ${EVENT_ENDED_CLAUSE}
                   AND ${division.clause}
                   AND events.start_date <= date('now', '+8 hours', '+14 days')
                 GROUP BY events.id
                 ORDER BY CASE
                              WHEN events.start_date < date('now', '+8 hours') THEN 0
                              WHEN events.start_date = date('now', '+8 hours')
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
            .bind(STATUS.PUBLISHED, division.value),
        db
            .prepare(
                `${PUBLIC_EVENT_SELECT}
                 WHERE events.status = ?
                   AND ${division.clause}
                   AND events.start_date <= date('now', '+8 hours')
                   AND events.end_date >= date('now', '+8 hours')
                 GROUP BY events.id
                 ORDER BY CASE
                              WHEN events.start_date < date('now', '+8 hours') THEN 0
                              ELSE 1
                          END ASC,
                          CASE
                              WHEN events.start_date = date('now', '+8 hours')
                               AND events.start_time IS NOT NULL THEN 0
                              ELSE 1
                          END ASC,
                          CASE
                              WHEN events.start_date = date('now', '+8 hours')
                              THEN events.start_time
                          END ASC,
                          ${EVENT_SCALE_ORDER} DESC,
                          events.id ASC
                 LIMIT 10`
            )
            .bind(STATUS.PUBLISHED, division.value)
    ]);

    const featuredEvents =
        requireD1Success(featuredResult, "Failed to load homepage featured events").results ?? [];
    const today =
        requireD1Success(todayResult, "Failed to load today's homepage events").results ?? [];

    return {
        featuredEvents: featuredEvents.map(mapPublicEventRow),
        today: today.map(mapPublicEventRow)
    };
}

function popularityStatement(db: D1Database, divisionCode?: string) {
    const division = divisionCode ? divisionFilter("events.division_code", divisionCode) : null;
    const divisionClause = division ? `AND ${division.clause}` : "";

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
                ${PUBLIC_EVENT_COLUMNS},
                group_concat(tags.name, '、') AS tags,
                recent_visitors.unique_visitors
            FROM recent_visitors
            JOIN events ON events.id = recent_visitors.event_id
            LEFT JOIN event_tags ON event_tags.event_id = events.id
            LEFT JOIN tags ON tags.id = event_tags.tag_id AND tags.alias_of_id IS NULL
            WHERE events.status = ?
              AND NOT ${EVENT_ENDED_CLAUSE}
              ${divisionClause}
            GROUP BY events.id, recent_visitors.unique_visitors
            ORDER BY recent_visitors.unique_visitors DESC,
                     ${EVENT_SCALE_ORDER} DESC,
                     events.start_date ASC,
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
    const offset = `-${window - 1} days`;
    const local = popularityStatement(db, divisionCode);
    const nationwide = popularityStatement(db);
    if (!local.divisionValue) {
        throw new Error("Homepage division code is required");
    }
    const [localResult, nationwideResult] = await db.batch<PopularEventDatabaseRow>([
        local.statement.bind(offset, STATUS.PUBLISHED, local.divisionValue),
        nationwide.statement.bind(offset, STATUS.PUBLISHED)
    ]);

    const localEvents =
        requireD1Success(localResult, "Failed to load local popular events").results ?? [];
    const nationwideEvents =
        requireD1Success(nationwideResult, "Failed to load nationwide popular events").results ??
        [];

    return {
        window,
        local: localEvents.map(mapPopularEvent),
        nationwide: nationwideEvents.map(mapPopularEvent)
    };
}
