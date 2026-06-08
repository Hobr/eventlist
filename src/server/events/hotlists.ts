import { getEventRepository } from "../db/client";
import { getWorkerEnv } from "../env";
import type { EventRepository } from "./repository";
import type { HotWindowDays } from "./types";

export async function listHotEvents(input: {
    windowDays: HotWindowDays;
    now?: Date;
    limit?: number;
    repository?: EventRepository;
}) {
    return (
        input.repository ?? getEventRepository(getWorkerEnv())
    ).listHotEvents(input.windowDays, input.now, input.limit);
}
