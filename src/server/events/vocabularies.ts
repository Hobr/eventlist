import { getEventRepository } from "../db/client";
import { getWorkerEnv } from "../env";
import type {
    CreateScaleInput,
    CreateVocabularyInput,
    EventRepository,
} from "./repository";

export async function listVocabularySnapshot(
    options: {
        repository?: EventRepository;
        includeInactive?: boolean;
    } = {},
) {
    return (
        options.repository ?? getEventRepository(getWorkerEnv())
    ).listVocabularySnapshot({
        includeInactive: options.includeInactive,
    });
}

export async function createVocabularyTerm(
    input: CreateVocabularyInput,
    actorEmail: string,
    options: { repository?: EventRepository } = {},
) {
    return (
        options.repository ?? getEventRepository(getWorkerEnv())
    ).createVocabularyTerm(input, actorEmail);
}

export async function createScale(
    input: CreateScaleInput,
    actorEmail: string,
    options: { repository?: EventRepository } = {},
) {
    return (
        options.repository ?? getEventRepository(getWorkerEnv())
    ).createScale(input, actorEmail);
}
