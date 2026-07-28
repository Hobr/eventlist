import type { D1Database } from "../../types/cloudflare";
import { requireD1Success, STATUS } from "./index";
import { EVENT_ENDED_CLAUSE } from "./public-events";

export interface TagSummary {
    id: number;
    name: string;
    event_count: number;
}

function escapeLike(value: string) {
    return value.replace(/[\\%_]/g, "\\$&");
}

export async function listTags(db: D1Database) {
    const result = await db
        .prepare(
            `SELECT tags.id, tags.name, COUNT(event_tags.event_id) AS event_count
             FROM tags
             LEFT JOIN event_tags ON event_tags.tag_id = tags.id
             WHERE tags.alias_of_id IS NULL
             GROUP BY tags.id
             ORDER BY event_count DESC, tags.name ASC`
        )
        .all<TagSummary>();

    return requireD1Success(result, "Failed to list tags").results ?? [];
}

export async function topTags(db: D1Database, limit = 20) {
    const result = await db
        .prepare(
            `SELECT tags.id, tags.name, COUNT(event_tags.event_id) AS event_count
             FROM tags
             JOIN event_tags ON event_tags.tag_id = tags.id
             JOIN events ON events.id = event_tags.event_id
             WHERE tags.alias_of_id IS NULL
               AND events.status = ?
               AND NOT ${EVENT_ENDED_CLAUSE}
             GROUP BY tags.id
             ORDER BY event_count DESC, tags.name ASC
             LIMIT ?`
        )
        .bind(STATUS.PUBLISHED, limit)
        .all<TagSummary>();

    return requireD1Success(result, "Failed to list top tags").results ?? [];
}

export async function searchTags(db: D1Database, query: string, limit = 12) {
    const normalized = query.trim();
    if (!normalized) return topTags(db, limit);

    const result = await db
        .prepare(
            `SELECT tags.id, tags.name, COUNT(events.id) AS event_count
             FROM tags
             LEFT JOIN event_tags ON event_tags.tag_id = tags.id
             LEFT JOIN events
               ON events.id = event_tags.event_id
              AND events.status = ?
              AND NOT ${EVENT_ENDED_CLAUSE}
             WHERE tags.alias_of_id IS NULL
               AND tags.name LIKE ? ESCAPE '\\'
             GROUP BY tags.id
             ORDER BY COUNT(events.id) DESC, tags.name ASC
             LIMIT ?`
        )
        .bind(STATUS.PUBLISHED, `%${escapeLike(normalized)}%`, limit)
        .all<TagSummary>();

    return requireD1Success(result, "Failed to search tags").results ?? [];
}
