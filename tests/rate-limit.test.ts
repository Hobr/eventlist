import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit } from "../src/lib/rate-limit";

function createMockKV(): KVNamespace {
    const store = new Map<string, string>();
    return {
        get: (key: string) => Promise.resolve(store.get(key) ?? null),
        put: (key: string, value: string, _opts?: KVNamespacePutOptions) => {
            store.set(key, value);
            return Promise.resolve();
        },
        delete: (key: string) => {
            store.delete(key);
            return Promise.resolve();
        },
        list: () =>
            Promise.resolve({
                keys: [],
                list_complete: true,
                cacheStatus: null,
            }),
        getWithMetadata: () => Promise.resolve({ value: null, metadata: null }),
    } as unknown as KVNamespace;
}

describe("checkRateLimit", () => {
    let kv: KVNamespace;

    beforeEach(() => {
        kv = createMockKV();
    });

    it("allows first request", async () => {
        const result = await checkRateLimit(kv, "test-ip", 10, 30);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(9);
    });

    it("blocks after daily limit", async () => {
        for (let i = 0; i < 10; i++) {
            await checkRateLimit(kv, "test-ip", 10, 30);
        }
        const result = await checkRateLimit(kv, "test-ip", 10, 30);
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
    });

    it("blocks during cooldown period", async () => {
        await checkRateLimit(kv, "test-ip", 10, 30);
        const result = await checkRateLimit(kv, "test-ip", 10, 30);
        expect(result.allowed).toBe(false);
        expect(result.cooldown).toBe(true);
    });
});
