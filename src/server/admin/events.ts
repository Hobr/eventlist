import { getEventRepository } from "../db/client";
import { getWorkerEnv } from "../env";
import type { AdminEventPatch } from "../events/types";
import type { ApprovalInput, EventRepository } from "../events/repository";

export async function listAdminEvents(
    options: {
        repository?: EventRepository;
        status?: string;
        q?: string;
    } = {},
) {
    return (
        options.repository ?? getEventRepository(getWorkerEnv())
    ).listAdminEvents({
        status: options.status,
        q: options.q,
    });
}

export async function getAdminEvent(
    id: string,
    options: { repository?: EventRepository } = {},
) {
    return (
        options.repository ?? getEventRepository(getWorkerEnv())
    ).getAdminEvent(id);
}

export async function updateAdminEvent(
    id: string,
    patch: AdminEventPatch,
    actorEmail: string,
    options: { repository?: EventRepository } = {},
) {
    return (
        options.repository ?? getEventRepository(getWorkerEnv())
    ).updateAdminEvent(id, patch, actorEmail);
}

export async function approveAdminEvent(
    id: string,
    input: ApprovalInput,
    actorEmail: string,
    options: { repository?: EventRepository } = {},
) {
    return (
        options.repository ?? getEventRepository(getWorkerEnv())
    ).approveEvent(id, input, actorEmail);
}

export async function rejectAdminEvent(
    id: string,
    actorEmail: string,
    note?: string,
    options: { repository?: EventRepository } = {},
) {
    return (
        options.repository ?? getEventRepository(getWorkerEnv())
    ).rejectEvent(id, actorEmail, note);
}

export async function archiveAdminEvent(
    id: string,
    actorEmail: string,
    note?: string,
    options: { repository?: EventRepository } = {},
) {
    return (
        options.repository ?? getEventRepository(getWorkerEnv())
    ).archiveEvent(id, actorEmail, note);
}

export async function restoreAdminEvent(
    id: string,
    actorEmail: string,
    note?: string,
    options: { repository?: EventRepository } = {},
) {
    return (
        options.repository ?? getEventRepository(getWorkerEnv())
    ).restoreEvent(id, actorEmail, note);
}
