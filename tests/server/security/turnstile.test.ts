import { describe, expect, it } from "vitest";
import { verifyTurnstileToken } from "../../../src/server/security/turnstile";

describe("Turnstile verification", () => {
    it("rejects missing tokens", async () => {
        await expect(
            verifyTurnstileToken({ secret: "secret", token: "" }),
        ).resolves.toMatchObject({ success: false });
    });

    it("allows Cloudflare test secrets in local development", async () => {
        await expect(
            verifyTurnstileToken({
                secret: "1x0000000000000000000000000000000AA",
                token: "dev",
            }),
        ).resolves.toMatchObject({ success: true });
    });

    it("maps siteverify success payloads", async () => {
        const fetcher = async () =>
            Response.json({ success: true, "error-codes": [] });

        await expect(
            verifyTurnstileToken({
                secret: "real-secret",
                token: "token",
                fetcher: fetcher as typeof fetch,
            }),
        ).resolves.toEqual({ success: true, errorCodes: [] });
    });
});
