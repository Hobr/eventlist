import { describe, it, expect, vi, beforeEach } from "vitest";
import { verifyTurnstile } from "../src/lib/turnstile";

describe("verifyTurnstile", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("returns true for valid token", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                json: () => Promise.resolve({ success: true }),
            }),
        );

        const result = await verifyTurnstile(
            "valid-token",
            "secret",
            "1.2.3.4",
        );
        expect(result).toBe(true);
        expect(fetch).toHaveBeenCalledWith(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            expect.objectContaining({ method: "POST" }),
        );
    });

    it("returns false for invalid token", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                json: () =>
                    Promise.resolve({
                        success: false,
                        "error-codes": ["invalid-input-response"],
                    }),
            }),
        );

        const result = await verifyTurnstile("bad-token", "secret");
        expect(result).toBe(false);
    });
});
