import type { APIRoute } from "astro";
import { parseEventForm } from "../../../../lib/admin/form";
import { getDB } from "../../../../lib/db";
import { createPublishedEvent } from "../../../../lib/db/queries";
import { jsonError, jsonOk } from "../../../../lib/http/json";
import { getRuntimeEnv } from "../../../../lib/runtime/env";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
    if (!locals.admin) return jsonError("Unauthorized", 401);

    let input;
    try {
        input = parseEventForm(await request.formData());
        if (input.tags.length === 0) {
            return jsonError("请至少选择或新增一个规范标签", 400);
        }
    } catch (error) {
        return jsonError(error instanceof Error ? error.message : "活动信息无效", 400);
    }

    try {
        const db = await getDB(getRuntimeEnv());
        const id = await createPublishedEvent(db, input, {
            authMode: locals.admin.mode,
            ...(locals.admin.email ? { email: locals.admin.email } : {})
        });
        return jsonOk({ id }, { status: 201 });
    } catch (error) {
        return jsonError(error instanceof Error ? error.message : "创建活动失败", 500);
    }
};
