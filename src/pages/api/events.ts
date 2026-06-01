import type { APIRoute } from "astro";
import type { EventFilters, EventWithWorks } from "../../types/event";

interface QueryResult {
    where: string;
    join: string;
    params: unknown[];
    limit: number;
    offset: number;
}

export function buildEventsQuery(filters: EventFilters): QueryResult {
    const conditions: string[] = ["status = 'approved'", "deleted_at IS NULL"];
    const params: unknown[] = [];
    let join = "";

    conditions.push("start_date >= ?");
    params.push(new Date().toISOString().slice(0, 10));

    if (filters.province) {
        conditions.push("province = ?");
        params.push(filters.province);
    }
    if (filters.city) {
        conditions.push("city = ?");
        params.push(filters.city);
    }
    if (filters.eventType) {
        conditions.push("event_type = ?");
        params.push(filters.eventType);
    }
    if (filters.scale) {
        conditions.push("scale = ?");
        params.push(filters.scale);
    }
    if (filters.month) {
        conditions.push("start_date LIKE ?");
        params.push(`${filters.month}%`);
    }
    if (filters.work) {
        join = `INNER JOIN event_works ON events.id = event_works.event_id`;
        conditions.push("work_name = ?");
        params.push(filters.work);
    }

    const page = filters.page ?? 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    return { where: conditions.join(" AND "), join, params, limit, offset };
}

export const GET: APIRoute = async ({ request, locals }) => {
    const url = new URL(request.url);

    const typeParam = url.searchParams.get("type");
    const filters: EventFilters = {
        province: url.searchParams.get("province") ?? undefined,
        city: url.searchParams.get("city") ?? undefined,
        eventType:
            typeParam === "doujin" || typeParam === "concert"
                ? typeParam
                : undefined,
        work: url.searchParams.get("work") ?? undefined,
        scale: url.searchParams.get("scale") ?? undefined,
        month: url.searchParams.get("month") ?? undefined,
        page: url.searchParams.get("page")
            ? Number(url.searchParams.get("page"))
            : 1,
    };

    const q = buildEventsQuery(filters);

    const countSql = `SELECT COUNT(*) as total FROM events ${q.join} WHERE ${q.where}`;
    const countResult = await locals.runtime.env.DB.prepare(countSql)
        .bind(...q.params)
        .first<{ total: number }>();
    const total = countResult?.total ?? 0;

    const dataSql = `SELECT events.* FROM events ${q.join} WHERE ${q.where} ORDER BY start_date ASC LIMIT ? OFFSET ?`;
    const rows = await locals.runtime.env.DB.prepare(dataSql)
        .bind(...q.params, q.limit, q.offset)
        .all();

    const eventIds = (rows.results as Record<string, unknown>[]).map(
        (r) => r.id as string,
    );
    let worksMap: Record<string, string[]> = {};

    if (eventIds.length > 0) {
        const placeholders = eventIds.map(() => "?").join(",");
        const worksRows = await locals.runtime.env.DB.prepare(
            `SELECT event_id, work_name FROM event_works WHERE event_id IN (${placeholders})`,
        )
            .bind(...eventIds)
            .all();

        for (const w of worksRows.results as Record<string, unknown>[]) {
            const eid = w.event_id as string;
            if (!worksMap[eid]) worksMap[eid] = [];
            worksMap[eid].push(w.work_name as string);
        }
    }

    const items: EventWithWorks[] = (
        rows.results as Record<string, unknown>[]
    ).map((r) => ({
        id: r.id as string,
        title: r.title as string,
        province: r.province as string,
        city: r.city as string,
        venue: r.venue as string,
        address: r.address as string | null,
        startDate: r.start_date as string,
        endDate: r.end_date as string | null,
        eventType: r.event_type as "doujin" | "concert",
        scale: r.scale as string | null,
        qqGroup: r.qq_group as string | null,
        ticketUrl: r.ticket_url as string | null,
        posterKey: r.poster_key as string | null,
        priceInfo: r.price_info as string | null,
        description: r.description as string | null,
        viewCount: r.view_count as number,
        status: r.status as "pending" | "approved" | "rejected",
        deletedAt: r.deleted_at as string | null,
        createdAt: r.created_at as string,
        updatedAt: r.updated_at as string,
        works: worksMap[r.id as string] ?? [],
    }));

    return new Response(
        JSON.stringify({ items, total, page: filters.page ?? 1 }),
        {
            headers: { "Content-Type": "application/json" },
        },
    );
};
