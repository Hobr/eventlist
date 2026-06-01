import type { APIRoute } from "astro";
import { getDB } from "../../../../server/db";
import { events } from "../../../../server/db/schema";
import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";

export const POST: APIRoute = async ({ params, request }) => {
    const db = getDB(env);
    const { id } = params;
    if (!id) return new Response("Missing id", { status: 400 });

    const body = (await request.json()) as Record<string, unknown>;
    const action = body.action as string;

    if (action === "approve") {
        await db
            .update(events)
            .set({ status: "approved", updatedAt: new Date().toISOString() })
            .where(eq(events.id, id));
        return new Response(JSON.stringify({ status: "approved" }));
    }

    if (action === "reject") {
        await db
            .update(events)
            .set({ status: "rejected", updatedAt: new Date().toISOString() })
            .where(eq(events.id, id));
        return new Response(JSON.stringify({ status: "rejected" }));
    }

    return new Response("Invalid action", { status: 400 });
};

export const PUT: APIRoute = async ({ params, request }) => {
    const db = getDB(env);
    const { id } = params;
    if (!id) return new Response("Missing id", { status: 400 });

    const body = (await request.json()) as Record<string, unknown>;
    const updates: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
    };

    const allowedFields = [
        "title",
        "province",
        "city",
        "venue",
        "address",
        "startDate",
        "endDate",
        "eventType",
        "scale",
        "qqGroup",
        "ticketUrl",
        "priceInfo",
        "description",
    ];

    for (const field of allowedFields) {
        if (body[field] !== undefined) {
            updates[field] = body[field];
        }
    }

    await db.update(events).set(updates).where(eq(events.id, id));
    return new Response(JSON.stringify({ ok: true }));
};

export const DELETE: APIRoute = async ({ params }) => {
    const db = getDB(env);
    const { id } = params;
    if (!id) return new Response("Missing id", { status: 400 });

    await db
        .update(events)
        .set({
            deletedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        })
        .where(eq(events.id, id));

    return new Response(JSON.stringify({ ok: true }));
};
