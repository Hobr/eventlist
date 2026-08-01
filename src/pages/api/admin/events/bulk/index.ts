import type { APIRoute } from "astro";
import { waitUntil } from "cloudflare:workers";
import {
    buildBulkEventPreview,
    BulkEventCsvError,
    createBulkEventErrorPreview
} from "../../../../../lib/admin/bulk-events";
import { schedulePublicDataInvalidation } from "../../../../../lib/cache/invalidation";
import { getDB, STATUS } from "../../../../../lib/db";
import {
    BulkEventIdConflictError,
    createBulkPublishedEvents
} from "../../../../../lib/db/admin-events";
import { jsonError, jsonOk } from "../../../../../lib/http/json";
import { getRuntimeEnv } from "../../../../../lib/runtime/env";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, url }) => {
    if (!locals.admin) return jsonError("Unauthorized", 401);

    try {
        const formData = await request.formData();
        const file = formData.get("file");
        if (!(file instanceof File)) {
            const preview = createBulkEventErrorPreview("请选择 CSV 文件");
            return jsonError("请选择 CSV 文件", 400, { preview });
        }

        const runtimeEnv = getRuntimeEnv();
        const db = await getDB(runtimeEnv);
        const result = await buildBulkEventPreview(db, file);
        if (!result.preview.valid) {
            return jsonError("CSV 包含需要修正的记录", 400, { preview: result.preview });
        }

        const confirmedKeys = new Set(
            formData
                .getAll("confirmed_warning_keys")
                .filter((value): value is string => typeof value === "string")
        );
        const unconfirmedWarnings = result.preview.warnings.filter(
            ({ key }) => !confirmedKeys.has(key)
        );
        if (unconfirmedWarnings.length > 0) {
            return jsonError("发现新的疑似重复活动, 请确认后重新提交", 409, {
                preview: result.preview
            });
        }

        const items = result.events.map(({ row, event }) => ({ row, event }));
        const events = await createBulkPublishedEvents(db, items, {
            authMode: locals.admin.mode,
            ...(locals.admin.email ? { email: locals.admin.email } : {})
        });
        schedulePublicDataInvalidation({
            origin: url,
            configuredScopes: runtimeEnv.PUBLIC_DATA_CACHE_SCOPES,
            kind: "create",
            impact: {
                eventIds: events.map(({ id }) => id),
                oldDivisionCodes: [],
                newDivisionCodes: items.map(({ event }) => event.division_code),
                newStatus: STATUS.PUBLISHED,
                tagsChanged: true
            },
            zoneId: runtimeEnv.CLOUDFLARE_ZONE_ID,
            purgeToken: runtimeEnv.CLOUDFLARE_CACHE_PURGE_TOKEN,
            waitUntil
        });
        return jsonOk({ events }, { status: 201 });
    } catch (error) {
        if (error instanceof BulkEventCsvError) {
            const preview = createBulkEventErrorPreview(error.message);
            return jsonError(error.message, 400, { preview });
        }
        if (error instanceof BulkEventIdConflictError) {
            return jsonError(error.message, 409);
        }
        return jsonError(error instanceof Error ? error.message : "批量创建活动失败", 500);
    }
};
