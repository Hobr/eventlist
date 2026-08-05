import type { APIRoute } from "astro";
import { waitUntil } from "cloudflare:workers";
import {
    BilibiliImportError,
    findBilibiliDuplicateWarnings,
    parseBilibiliImportSubmission
} from "../../../../lib/admin/bilibili-ticket";
import { findEventDuplicateCandidates } from "../../../../lib/admin/event-duplicates";
import { parseEventForm } from "../../../../lib/admin/form";
import { schedulePublicDataInvalidation } from "../../../../lib/cache/invalidation";
import { getDB, STATUS } from "../../../../lib/db";
import {
    BilibiliExactDuplicateError,
    createBilibiliImportedPublishedEvent,
    createPublishedEvent,
    findEventBySourceUrl
} from "../../../../lib/db/admin-events";
import { jsonError, jsonOk } from "../../../../lib/http/json";
import { getRuntimeEnv } from "../../../../lib/runtime/env";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, url }) => {
    if (!locals.admin) return jsonError("Unauthorized", 401);

    let input;
    let bilibiliImport;
    try {
        const formData = await request.formData();
        input = parseEventForm(formData);
        if (input.tags.length === 0) {
            return jsonError("请至少选择或新增一个规范标签", 400);
        }
        bilibiliImport = parseBilibiliImportSubmission(formData);
        if (bilibiliImport && input.source_url !== bilibiliImport.canonicalSourceUrl) {
            return jsonError("会员购来源链接与活动 ID 不一致，请重新导入", 400);
        }
    } catch (error) {
        return jsonError(
            error instanceof BilibiliImportError || error instanceof Error
                ? error.message
                : "活动信息无效",
            400
        );
    }

    try {
        const runtimeEnv = getRuntimeEnv();
        const db = await getDB(runtimeEnv);
        const authMeta = {
            authMode: locals.admin.mode,
            ...(locals.admin.email ? { email: locals.admin.email } : {})
        };
        let id: number;

        if (bilibiliImport) {
            const exactDuplicate = await findEventBySourceUrl(
                db,
                bilibiliImport.canonicalSourceUrl
            );
            if (exactDuplicate) {
                return jsonError("该会员购活动已经导入", 409, {
                    existingEvent: exactDuplicate
                });
            }

            const candidates = await findEventDuplicateCandidates(db, [input.start_date]);
            const warnings = findBilibiliDuplicateWarnings(input, candidates);
            const unconfirmedWarnings = warnings.filter(
                ({ key }) => !bilibiliImport.confirmedWarningKeys.has(key)
            );
            if (unconfirmedWarnings.length > 0) {
                return jsonError("发现新的疑似重复活动，请确认后重新提交", 409, {
                    warnings: warnings
                });
            }

            id = await createBilibiliImportedPublishedEvent(db, input, {
                ...authMeta,
                projectId: bilibiliImport.projectId,
                confirmedWarningKeys: warnings.map(({ key }) => key)
            });
        } else {
            id = await createPublishedEvent(db, input, authMeta);
        }
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
        if (error instanceof BilibiliExactDuplicateError) {
            return jsonError(error.message, 409, { existingEvent: error.existingEvent });
        }
        return jsonError(error instanceof Error ? error.message : "创建活动失败", 500);
    }
};
