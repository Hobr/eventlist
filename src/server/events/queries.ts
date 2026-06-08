import { getEventRepository } from "../db/client";
import { getWorkerEnv } from "../env";
import type { EventRepository } from "./repository";
import type { EventFilters } from "./types";

export async function listPublicEvents(
    filters: EventFilters = {},
    options: { now?: Date; repository?: EventRepository } = {},
) {
    return (
        options.repository ?? getEventRepository(getWorkerEnv())
    ).listPublicEvents(filters, options.now);
}

export async function getPublicEventBySlug(
    slug: string,
    options: { now?: Date; repository?: EventRepository } = {},
) {
    return (
        options.repository ?? getEventRepository(getWorkerEnv())
    ).getPublicEventBySlug(slug, options.now);
}

export async function listPublicVocabulary(
    options: { repository?: EventRepository } = {},
) {
    return (
        options.repository ?? getEventRepository(getWorkerEnv())
    ).listVocabularySnapshot();
}
