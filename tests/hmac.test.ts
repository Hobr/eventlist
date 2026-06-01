import { describe, it, expect } from "vitest";
import { signTicket, verifyTicket } from "../src/lib/hmac";

const SECRET = "test-secret-key-at-least-32-chars!!";

describe("signTicket / verifyTicket", () => {
  it("signs and verifies a ticket", async () => {
    const payload = { title: "Test Event", city: "上海" };
    const ticket = await signTicket(payload, SECRET, 60);
    const result = await verifyTicket(ticket, SECRET);
    expect(result).toEqual(payload);
  });

  it("rejects expired ticket", async () => {
    const payload = { title: "Test" };
    const ticket = await signTicket(payload, SECRET, -1);
    await expect(verifyTicket(ticket, SECRET)).rejects.toThrow("expired");
  });

  it("rejects tampered ticket", async () => {
    const payload = { title: "Test" };
    const ticket = await signTicket(payload, SECRET, 60);
    const tampered = ticket.slice(0, -2) + "XX";
    await expect(verifyTicket(tampered, SECRET)).rejects.toThrow("invalid");
  });
});
