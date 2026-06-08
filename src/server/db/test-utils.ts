import { InMemoryEventRepository } from "../events/memory-repository";
import type { EventRepository } from "../events/repository";
import { requireBinding } from "./client";

export function createTestRepository(): EventRepository {
    return new InMemoryEventRepository();
}

export function assertRequiredBindings(env: Partial<Env>): void {
    requireBinding(env.DB, "DB");
    requireBinding(env.RATE_LIMIT, "RATE_LIMIT");
    requireBinding(env.BUCKET, "BUCKET");
}
