import { getEventRepository } from "../db/client";
import { getWorkerEnv } from "../env";
import type { EventRepository } from "../events/repository";
import type { EventCover } from "../events/types";

export async function setCoverStatus(
    coverId: string,
    status: EventCover["status"],
    actorEmail: string,
    options: { repository?: EventRepository; publicUrl?: string } = {},
) {
    return (
        options.repository ?? getEventRepository(getWorkerEnv())
    ).setCoverStatus(coverId, status, actorEmail, options.publicUrl);
}
