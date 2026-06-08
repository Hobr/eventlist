import { describe, expect, it } from "vitest";
import { checkSubmissionRateLimit } from "../../../src/server/security/rate-limit";

class FakeKV {
    private values = new Map<string, string>();

    async get(key: string): Promise<string | null> {
        return this.values.get(key) ?? null;
    }

    async put(key: string, value: string): Promise<void> {
        this.values.set(key, value);
    }
}

describe("submission rate limiting", () => {
    it("blocks repeated submissions during cooldown", async () => {
        const kv = new FakeKV() as unknown as KVNamespace;

        await expect(
            checkSubmissionRateLimit({ kv, ipHash: "hash-a" }),
        ).resolves.toMatchObject({ allowed: true });
        await expect(
            checkSubmissionRateLimit({ kv, ipHash: "hash-a" }),
        ).resolves.toMatchObject({ allowed: false, reason: "cooldown" });
    });
});
