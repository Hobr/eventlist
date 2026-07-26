import type { APIRoute } from "astro";
import {
    buildBulkEventPreview,
    BulkEventCsvError,
    createBulkEventErrorPreview
} from "../../../../../lib/admin/bulk-events";
import { getDB } from "../../../../../lib/db";
import { jsonError, jsonOk } from "../../../../../lib/http/json";
import { getRuntimeEnv } from "../../../../../lib/runtime/env";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
    if (!locals.admin) return jsonError("Unauthorized", 401);

    try {
        const file = (await request.formData()).get("file");
        if (!(file instanceof File)) {
            const preview = createBulkEventErrorPreview("请选择 CSV 文件");
            return jsonError("请选择 CSV 文件", 400, { preview });
        }

        const result = await buildBulkEventPreview(await getDB(getRuntimeEnv()), file);
        if (!result.preview.valid) {
            return jsonError("CSV 包含需要修正的记录", 400, { preview: result.preview });
        }

        return jsonOk({ preview: result.preview });
    } catch (error) {
        if (error instanceof BulkEventCsvError) {
            const preview = createBulkEventErrorPreview(error.message);
            return jsonError(error.message, 400, { preview });
        }
        return jsonError(error instanceof Error ? error.message : "无法预览 CSV", 500);
    }
};
