import type { APIRoute } from "astro";
import { getDB } from "../../../server/db";
import { events } from "../../../server/db/schema";
import { eq, desc } from "drizzle-orm";
import { env } from "cloudflare:workers";

export const GET: APIRoute = async ({ request }) => {
    const db = getDB(env);
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? "pending";

    const rows = await db
        .select()
        .from(events)
        .where(eq(events.status, status as "pending" | "approved" | "rejected"))
        .orderBy(desc(events.createdAt));

    return new Response(JSON.stringify(rows), {
        headers: { "Content-Type": "application/json" },
    });
};
