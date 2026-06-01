import type { APIRoute } from "astro";
import { verifyTurnstile } from "../../../lib/turnstile";
import { checkRateLimit, hashIp } from "../../../lib/rate-limit";
import { signTicket } from "../../../lib/hmac";
import { env } from "cloudflare:workers";

const MAX_FIELD_LEN = 2000;

export const POST: APIRoute = async ({ request }) => {

    let body: Record<string, unknown>;
    try {
        body = await request.json();
    } catch {
        return new Response(JSON.stringify({ error: "无效的请求格式" }), {
            status: 400,
        });
    }

    const turnstileToken = body.turnstileToken as string | undefined;
    if (!turnstileToken) {
        return new Response(JSON.stringify({ error: "请完成验证码" }), {
            status: 400,
        });
    }

    const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
    const ipHash = await hashIp(ip);

    const turnstileOk = await verifyTurnstile(
        turnstileToken,
        env.TURNSTILE_SECRET_KEY,
        ip,
    );
    if (!turnstileOk) {
        return new Response(JSON.stringify({ error: "验证码验证失败" }), {
            status: 400,
        });
    }

    const rateLimit = await checkRateLimit(env.RATE_LIMIT, ipHash, 10, 30);
    if (!rateLimit.allowed) {
        return new Response(
            JSON.stringify({
                error: rateLimit.cooldown
                    ? "提交过于频繁，请30秒后重试"
                    : "今日提交次数已达上限",
            }),
            { status: 429 },
        );
    }

    const required = [
        "title",
        "province",
        "city",
        "venue",
        "startDate",
        "eventType",
    ];
    for (const field of required) {
        if (!body[field] || String(body[field]).trim() === "") {
            return new Response(
                JSON.stringify({ error: `缺少必填字段: ${field}` }),
                { status: 400 },
            );
        }
    }

    const eventType = String(body.eventType);
    if (eventType !== "doujin" && eventType !== "concert") {
        return new Response(JSON.stringify({ error: "无效的活动类型" }), {
            status: 400,
        });
    }

    for (const [key, val] of Object.entries(body)) {
        if (typeof val === "string" && val.length > MAX_FIELD_LEN) {
            return new Response(JSON.stringify({ error: `字段 ${key} 过长` }), {
                status: 400,
            });
        }
    }

    const works = Array.isArray(body.works)
        ? (body.works as string[])
              .filter((w) => typeof w === "string" && w.trim())
              .slice(0, 20)
        : [];

    const ticketPayload = {
        title: String(body.title).trim(),
        province: String(body.province).trim(),
        city: String(body.city).trim(),
        venue: String(body.venue).trim(),
        address: body.address ? String(body.address).trim() : null,
        startDate: String(body.startDate),
        endDate: body.endDate ? String(body.endDate) : null,
        eventType: String(body.eventType),
        scale: body.scale ? String(body.scale) : null,
        works,
        qqGroup: body.qqGroup ? String(body.qqGroup).trim() : null,
        ticketUrl: body.ticketUrl ? String(body.ticketUrl).trim() : null,
        priceInfo: body.priceInfo ? String(body.priceInfo).trim() : null,
        description: body.description ? String(body.description).trim() : null,
        ipHash,
    };

    const ticket = await signTicket(
        ticketPayload,
        env.TURNSTILE_SECRET_KEY,
        300,
    );

    return new Response(JSON.stringify({ ticket }), {
        headers: { "Content-Type": "application/json" },
    });
};
