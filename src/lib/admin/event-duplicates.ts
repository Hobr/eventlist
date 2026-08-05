import type { D1Database } from "../../types/cloudflare";
import type { AdminEventInput } from "../events/input";
import { requireD1Success } from "../db";

export interface EventDuplicateCandidate {
    id: number;
    title: string;
    start_date: string;
    venue: string;
}

export function normalizeEventDuplicatePart(value: string) {
    return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("zh-CN");
}

export function eventDuplicateKey(event: Pick<AdminEventInput, "title" | "start_date" | "venue">) {
    return JSON.stringify([
        normalizeEventDuplicatePart(event.title),
        event.start_date,
        normalizeEventDuplicatePart(event.venue)
    ]);
}

export function eventDuplicateWarningKey(
    event: Pick<AdminEventInput, "title" | "start_date" | "venue">,
    candidateId: number
) {
    return JSON.stringify(["bilibili-ticket", eventDuplicateKey(event), candidateId]);
}

export async function findEventDuplicateCandidates(db: D1Database, startDates: string[]) {
    const dates = [...new Set(startDates)];
    if (dates.length === 0) return [];

    const result = await db
        .prepare(
            `SELECT id, title, start_date, venue
             FROM events
             WHERE start_date IN (
                 SELECT CAST(value AS TEXT)
                 FROM json_each(?)
             )
             ORDER BY id ASC`
        )
        .bind(JSON.stringify(dates))
        .all<EventDuplicateCandidate>();

    return requireD1Success(result, "Failed to find duplicate event candidates").results ?? [];
}
