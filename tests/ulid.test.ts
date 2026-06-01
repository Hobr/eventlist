import { describe, it, expect } from "vitest";
import { generateUlid, decodeUlidTimestamp } from "../src/lib/ulid";

describe("generateUlid", () => {
  it("returns a 26-character string", () => {
    const id = generateUlid();
    expect(id).toHaveLength(26);
  });

  it("starts with a valid Crockford base32 character", () => {
    const id = generateUlid();
    expect(id[0]).toMatch(/^[0-9A-HJKMNP-TV-Z]$/);
  });

  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => generateUlid()));
    expect(ids.size).toBe(1000);
  });

  it("encodes timestamp in first 10 characters (sortable)", () => {
    const before = Date.now();
    const id = generateUlid();
    const after = Date.now();

    const timestampChars = id.slice(0, 10);
    const decoded = decodeUlidTimestamp(timestampChars);
    expect(decoded).toBeGreaterThanOrEqual(before);
    expect(decoded).toBeLessThanOrEqual(after + 1);
  });
});
