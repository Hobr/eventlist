import type { APIRoute } from "astro";
import { getDB } from "../../../../lib/db";
import { recordEventView } from "../../../../lib/db/views";
import { hashEventVisitor } from "../../../../lib/events/popularity";
import { jsonError } from "../../../../lib/http/json";
import { getRuntimeEnv } from "../../../../lib/runtime/env";

export const prerender = false;

export const POST: APIRoute = async ({ params, request }) => {
    const rawId = params.id ?? "";
    if (!/^[1-9]\d*$/.test(rawId)) {
        return jsonError("活动编号无效", 400);
    }

    const eventId = Number(rawId);
    if (!Number.isSafeInteger(eventId)) {
        return jsonError("活动编号无效", 400);
    }

    const requestOrigin = request.headers.get("Origin");
    if (!requestOrigin || requestOrigin !== new URL(request.url).origin) {
        return jsonError("请求来源无效", 403);
    }

    const runtimeEnv = getRuntimeEnv();
    const ip = request.headers.get("CF-Connecting-IP")?.trim();
    if (!ip) {
        return jsonError("无法识别访问来源", 503);
    }
    if (!runtimeEnv.VIEW_HASH_SECRET) {
        return jsonError("访问统计未配置", 503);
    }

    try {
        const visitorKey = await hashEventVisitor(eventId, ip, runtimeEnv.VIEW_HASH_SECRET);
        const db = await getDB(runtimeEnv);
        await recordEventView(db, eventId, visitorKey);
        return new Response(null, { status: 204 });
    } catch {
        return jsonError("访问统计暂时不可用", 500);
    }
};
