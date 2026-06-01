import type { APIRoute } from "astro";
import { hashIp } from "../../../../lib/rate-limit";
import { env } from "cloudflare:workers";

export const POST: APIRoute = async ({ params, request }) => {
    const { id } = params;
    if (!id) return new Response("Missing id", { status: 400 });

    const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
    const ipHash = await hashIp(ip);
    const key = `event:${id}:ip:${ipHash}`;

    const existing = await env.RATE_LIMIT.get(key);
    if (existing) {
        return new Response(JSON.stringify({ counted: false }), {
            headers: { "Content-Type": "application/json" },
        });
    }

    await env.RATE_LIMIT.put(key, "1", { expirationTtl: 86400 });
    await env.DB.prepare(
        "UPDATE events SET view_count = view_count + 1 WHERE id = ?",
    )
        .bind(id)
        .run();

    return new Response(JSON.stringify({ counted: true }), {
        headers: { "Content-Type": "application/json" },
    });
};
