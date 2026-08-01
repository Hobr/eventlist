import type { APIRoute } from "astro";
import { waitUntil } from "cloudflare:workers";
import { parseEventForm } from "../../../../lib/admin/form";
import { schedulePublicDataInvalidation } from "../../../../lib/cache/invalidation";
import { getDB, STATUS } from "../../../../lib/db";
import { createPublishedEvent } from "../../../../lib/db/admin-events";
import { jsonError, jsonOk } from "../../../../lib/http/json";
import { getRuntimeEnv } from "../../../../lib/runtime/env";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, url }) => {
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
        const runtimeEnv = getRuntimeEnv();
        const db = await getDB(runtimeEnv);
        const id = await createPublishedEvent(db, input, {
            authMode: locals.admin.mode,
            ...(locals.admin.email ? { email: locals.admin.email } : {})
        });
        schedulePublicDataInvalidation({
            origin: url,
            configuredScopes: runtimeEnv.PUBLIC_DATA_CACHE_SCOPES,
            kind: "create",
            impact: {
                eventIds: [id],
                oldDivisionCodes: [],
                newDivisionCodes: [input.division_code],
                newStatus: STATUS.PUBLISHED,
                tagsChanged: true
            },
            zoneId: runtimeEnv.CLOUDFLARE_ZONE_ID,
            purgeToken: runtimeEnv.CLOUDFLARE_CACHE_PURGE_TOKEN,
            waitUntil
        });
        return jsonOk({ id }, { status: 201 });
    } catch (error) {
        return jsonError(error instanceof Error ? error.message : "创建活动失败", 500);
    }
};
