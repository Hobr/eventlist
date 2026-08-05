import type { D1Database } from "../../types/cloudflare";
import { EVENT_SCALES, EVENT_TYPES } from "../events/options";
import { requireD1Success, STATUS } from "./index";

export interface PublicTaxonomySummary {
    name: string;
    event_count: number;
}

export interface PublicEventTaxonomy {
    tags: PublicTaxonomySummary[];
    types: PublicTaxonomySummary[];
    scales: PublicTaxonomySummary[];
}

interface PublicTaxonomyDatabaseRow extends PublicTaxonomySummary {
    kind: "tag" | "type" | "scale";
}

function orderedOptionSummaries(
    rows: PublicTaxonomyDatabaseRow[],
    kind: PublicTaxonomyDatabaseRow["kind"],
    options: readonly { name: string }[]
) {
    const counts = new Map(
        rows
            .filter((row) => row.kind === kind && row.event_count > 0)
            .map((row) => [row.name, row.event_count] as const)
    );

    return options.flatMap(({ name }) => {
        const eventCount = counts.get(name);
        return eventCount ? [{ name, event_count: eventCount }] : [];
    });
}

export async function listPublicEventTaxonomy(db: D1Database): Promise<PublicEventTaxonomy> {
    const result = await db
        .prepare(
            `WITH taxonomy_entries(kind, name, event_count) AS (
                 SELECT 'type', events.type, COUNT(*)
                 FROM events
                 WHERE events.status = ?
                 GROUP BY events.type

                 UNION ALL

                 SELECT 'scale', events.scale, COUNT(*)
                 FROM events
                 WHERE events.status = ?
                 GROUP BY events.scale

                 UNION ALL

                 SELECT 'tag', tags.name, COUNT(*)
                 FROM tags
                 JOIN event_tags ON event_tags.tag_id = tags.id
                 JOIN events ON events.id = event_tags.event_id
                 WHERE tags.alias_of_id IS NULL
                   AND events.status = ?
                 GROUP BY tags.id, tags.name
             )
             SELECT kind, name, event_count
             FROM taxonomy_entries
             ORDER BY kind ASC, event_count DESC, name COLLATE NOCASE ASC`
        )
        .bind(STATUS.PUBLISHED, STATUS.PUBLISHED, STATUS.PUBLISHED)
        .all<PublicTaxonomyDatabaseRow>();
    const rows = requireD1Success(result, "Failed to list public event taxonomy").results ?? [];

    return {
        tags: rows
            .filter((row) => row.kind === "tag" && row.event_count > 0)
            .map(({ name, event_count }) => ({ name, event_count })),
        types: orderedOptionSummaries(rows, "type", EVENT_TYPES),
        scales: orderedOptionSummaries(rows, "scale", EVENT_SCALES)
    };
}
