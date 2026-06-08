import { describe, expect, it } from "vitest";
import { createTestRepository } from "../../../src/server/db/test-utils";
import { observedDay } from "../../../src/server/events/utils";
import { fixtureNow } from "../../fixtures/events";

describe("event hotness", () => {
    it("deduplicates the same visitor for an event on the same day", async () => {
        const repository = createTestRepository();
        const day = observedDay(fixtureNow);

        await repository.recordEventView(
            "event-shanghai-comic",
            "visitor-a",
            day,
        );
        await repository.recordEventView(
            "event-shanghai-comic",
            "visitor-a",
            day,
        );
        await repository.recordEventView(
            "event-shanghai-comic",
            "visitor-b",
            day,
        );

        const hot = await repository.listHotEvents(3, fixtureNow);

        expect(hot[0]?.id).toBe("event-shanghai-comic");
        expect(hot[0]?.hotness).toBe(2);
    });

    it("does not record pending or ended event visits into public hot lists", async () => {
        const repository = createTestRepository();
        const day = observedDay(fixtureNow);

        expect(
            await repository.recordEventView("event-pending", "visitor-a", day),
        ).toBe(false);
        expect(
            await repository.recordEventView("event-ended", "visitor-b", day),
        ).toBe(false);
        expect(await repository.listHotEvents(30, fixtureNow)).toEqual([]);
    });
});
