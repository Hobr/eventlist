import { getEventRepository } from "../db/client";
import { getWorkerEnv } from "../env";
import type { EventRepository } from "./repository";
import { observedDay } from "./utils";

export async function recordEventView(input: {
    eventId: string;
    visitorHash: string;
    now?: Date;
    repository?: EventRepository;
}): Promise<boolean> {
    return (
        input.repository ?? getEventRepository(getWorkerEnv())
    ).recordEventView(input.eventId, input.visitorHash, observedDay(input.now));
}
