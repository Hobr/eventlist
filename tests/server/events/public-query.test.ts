import { describe, expect, it } from "vitest";
import { createTestRepository } from "../../../src/server/db/test-utils";
import { fixtureNow } from "../../fixtures/events";

describe("public event queries", () => {
    it("filters approved upcoming events by city and hides pending/internal records", async () => {
        const repository = createTestRepository();
        const events = await repository.listPublicEvents(
            { city: "上海" },
            fixtureNow,
        );

        expect(events.map((event) => event.name)).toEqual(["上海术力口同人会"]);
        expect(JSON.stringify(events)).not.toContain("submitter@example.test");
        expect(JSON.stringify(events)).not.toContain("信息不足");
    });

    it("orders ordinary listings by maintainer scale priority", async () => {
        const repository = createTestRepository();
        const events = await repository.listPublicEvents({}, fixtureNow);

        expect(events.map((event) => event.name)).toEqual([
            "上海术力口同人会",
            "广州方舟音乐小聚",
        ]);
    });

    it("hides ended events from the default list while allowing direct detail access", async () => {
        const repository = createTestRepository();
        const list = await repository.listPublicEvents({}, fixtureNow);
        const ended = await repository.getPublicEventBySlug(
            "ended-hangzhou-comic",
            fixtureNow,
        );

        expect(
            list.some((event) => event.slug === "ended-hangzhou-comic"),
        ).toBe(false);
        expect(ended?.name).toBe("杭州已结束同人交流");
        expect(ended?.isEnded).toBe(true);
    });
});
