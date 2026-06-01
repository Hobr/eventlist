import type { EventFilters } from "../types/event";

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
