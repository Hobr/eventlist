import { describe, expect, it } from "vitest";
import { hashVisitorIp } from "../../../src/server/security/ip-hash";

describe("IP hashing", () => {
    it("is stable for the same secret and changes across secrets", async () => {
        const first = await hashVisitorIp("203.0.113.8", "secret-secret-1");
        const second = await hashVisitorIp("203.0.113.8", "secret-secret-1");
        const different = await hashVisitorIp("203.0.113.8", "secret-secret-2");

        expect(first).toBe(second);
        expect(first).not.toBe(different);
        expect(first).not.toContain("203.0.113.8");
    });

    it("requires a configured secret", async () => {
        await expect(hashVisitorIp("203.0.113.8", "short")).rejects.toThrow(
            "IP hash secret",
        );
    });
});
