import { describe, it, expect } from "vitest";
import { getPosterUrl } from "../src/lib/poster-url";

describe("getPosterUrl", () => {
  it("returns R2 base URL when configured", () => {
    const url = getPosterUrl("posters/abc.webp", "https://cdn.example.com");
    expect(url).toBe("https://cdn.example.com/posters/abc.webp");
  });

  it("returns same-origin fallback when base is empty", () => {
    const url = getPosterUrl("posters/abc.webp", "");
    expect(url).toBe("/r2/posters/abc.webp");
  });

  it("returns placeholder when key is null", () => {
    const url = getPosterUrl(null, "https://cdn.example.com");
    expect(url).toBe("/placeholder-poster.svg");
  });
});
