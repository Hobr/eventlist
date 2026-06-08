import { D1EventRepository } from "../events/d1-repository";
import { InMemoryEventRepository } from "../events/memory-repository";
import type { EventRepository } from "../events/repository";

let fallbackRepository: EventRepository | undefined;

export function getEventRepository(env?: Partial<Env>): EventRepository {
    if (env?.APP_ENV === "development" && env.USE_FIXTURE_DATA === "true") {
        fallbackRepository ??= new InMemoryEventRepository();
        return fallbackRepository;
    }

    if (env?.DB) {
        return new D1EventRepository(env.DB);
    }

    if (env?.APP_ENV === "production") {
        throw new Error("Missing required Cloudflare D1 binding: DB");
    }

    fallbackRepository ??= new InMemoryEventRepository();
    return fallbackRepository;
}

export function requireBinding<T>(value: T | undefined, name: string): T {
    if (!value) {
        throw new Error(`Missing required Cloudflare binding: ${name}`);
    }

    return value;
}
