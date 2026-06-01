import { describe, it, expect } from "vitest";
import { buildEventsQuery } from "../../src/pages/api/events";

describe("buildEventsQuery", () => {
    it("returns base query with no filters", () => {
        const result = buildEventsQuery({});
        expect(result.where).toContain("status = 'approved'");
        expect(result.where).toContain("deleted_at IS NULL");
        expect(result.where).toContain("start_date >= ?");
    });

    it("adds province filter", () => {
        const result = buildEventsQuery({ province: "上海" });
        expect(result.where).toContain("province = ?");
        expect(result.params).toContain("上海");
    });

    it("adds event_type filter", () => {
        const result = buildEventsQuery({ eventType: "doujin" });
        expect(result.where).toContain("event_type = ?");
        expect(result.params).toContain("doujin");
    });

    it("adds work join filter", () => {
        const result = buildEventsQuery({ work: "原神" });
        expect(result.join).toContain("event_works");
        expect(result.where).toContain("work_name = ?");
    });

    it("sets offset for pagination", () => {
        const result = buildEventsQuery({ page: 3 });
        expect(result.limit).toBe(20);
        expect(result.offset).toBe(40);
    });
});
