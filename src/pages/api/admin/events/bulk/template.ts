import type { APIRoute } from "astro";
import { createBulkEventTemplate } from "../../../../../lib/admin/bulk-events";
import { jsonError } from "../../../../../lib/http/json";

export const prerender = false;

export const GET: APIRoute = ({ locals }) => {
    if (!locals.admin) return jsonError("Unauthorized", 401);

    return new Response(createBulkEventTemplate(), {
        headers: {
            "content-disposition": 'attachment; filename="event-import-template.csv"',
            "content-type": "text/csv; charset=utf-8",
            "x-content-type-options": "nosniff"
        }
    });
};
