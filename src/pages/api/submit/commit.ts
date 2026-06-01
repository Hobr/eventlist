import type { APIRoute } from "astro";
import { verifyTicket } from "../../../lib/hmac";
import { generateUlid } from "../../../lib/ulid";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const POST: APIRoute = async ({ request, locals }) => {
  const env = locals.runtime.env;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return new Response(JSON.stringify({ error: "无效的表单数据" }), { status: 400 });
  }

  const ticket = formData.get("ticket") as string | null;
  if (!ticket) {
    return new Response(JSON.stringify({ error: "缺少签名票据" }), { status: 400 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await verifyTicket(ticket, env.TURNSTILE_SECRET_KEY);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "验证失败";
    return new Response(JSON.stringify({ error: msg }), { status: 400 });
  }

  const posterFile = formData.get("poster") as File | null;
  let posterKey: string | null = null;

  if (posterFile && posterFile.size > 0) {
    if (posterFile.size > MAX_FILE_SIZE) {
      return new Response(JSON.stringify({ error: "图片文件不能超过5MB" }), { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(posterFile.type)) {
      return new Response(JSON.stringify({ error: "仅支持 JPG/PNG/WebP 格式" }), { status: 400 });
    }

    const ext = posterFile.type === "image/png" ? "png" : posterFile.type === "image/webp" ? "webp" : "jpg";
    posterKey = `posters/${generateUlid()}.${ext}`;
    await env.BUCKET.put(posterKey, posterFile.stream(), {
      httpMetadata: { contentType: posterFile.type },
    });
  }

  const eventId = generateUlid();
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO events (id, title, province, city, venue, address, start_date, end_date, event_type, scale, qq_group, ticket_url, poster_key, price_info, description, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
  )
    .bind(
      eventId,
      payload.title,
      payload.province,
      payload.city,
      payload.venue,
      payload.address,
      payload.startDate,
      payload.endDate,
      payload.eventType,
      payload.scale,
      payload.qqGroup,
      payload.ticketUrl,
      posterKey,
      payload.priceInfo,
      payload.description,
      now,
      now
    )
    .run();

  const works = payload.works as string[] | undefined;
  if (works && works.length > 0) {
    for (const work of works) {
      await env.DB.prepare(
        "INSERT INTO event_works (event_id, work_name) VALUES (?, ?)"
      )
        .bind(eventId, work)
        .run();
    }
  }

  return new Response(JSON.stringify({ id: eventId, status: "pending" }), {
    headers: { "Content-Type": "application/json" },
  });
};
