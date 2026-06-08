import { describe, expect, it } from "vitest";
import { assertRequiredBindings } from "../../../src/server/db/test-utils";

describe("Cloudflare binding checks", () => {
    it("returns a clear missing binding error", () => {
        expect(() => assertRequiredBindings({})).toThrow(
            "Missing required Cloudflare binding: DB",
        );
    });
});
