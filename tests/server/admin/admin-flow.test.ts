import { describe, expect, it } from "vitest";
import { getAdminIdentity } from "../../../src/server/admin/auth";
import { createTestRepository } from "../../../src/server/db/test-utils";

describe("admin review flow", () => {
    it("approves a pending event after creating/selecting vocabulary and scale entries", async () => {
        const repository = createTestRepository();
        const actor = "maintainer@example.test";
        const type = await repository.createVocabularyTerm(
            { kind: "event_type", name: "茶会" },
            actor,
        );
        const ip = await repository.createVocabularyTerm(
            { kind: "event_ip", name: "新企划" },
            actor,
        );
        const scale = await repository.createScale(
            { name: "小型", priority: 20 },
            actor,
        );

        await repository.approveEvent(
            "event-pending",
            { typeId: type.id, eventIpId: ip.id, scaleId: scale.id },
            actor,
        );

        const publicEvent =
            await repository.getPublicEventBySlug("pending-new-ip");
        expect(publicEvent?.name).toBe("待审核新 IP 茶会");
        expect(publicEvent?.eventIp?.name).toBe("新企划");
        expect(JSON.stringify(publicEvent)).not.toContain(
            "submitter@example.test",
        );
    });
});

describe("admin identity", () => {
    it("does not allow mock admin identity in production", async () => {
        const request = new Request("https://example.test/admin", {
            headers: { "x-eventlist-admin-email": "maintainer@example.test" },
        });

        await expect(
            getAdminIdentity(request, { APP_ENV: "production" }),
        ).resolves.toBeNull();
    });
});
