import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("管理员新增页保留单一活动表单并提供服务端会员购预填", async () => {
    const source = await readSource("src/pages/admin/events/new.astro");

    assert.match(source, /name="bilibili_id"/);
    assert.match(source, /method="get"/);
    assert.match(source, /buildBilibiliEventImportPreview/);
    assert.match(source, /initialValues=\{importPreview\?\.values\}/);
    assert.match(source, /sourceReadOnly=\{Boolean\(importPreview\)\}/);
    assert.match(source, /name="import_provider"/);
    assert.match(source, /name="bilibili_project_id"/);
    assert.match(source, /name="confirmed_warning_keys"/);
    assert.match(source, /id="bilibili-submit-warnings"[\s\S]*aria-live="polite"/);
    assert.match(source, /错误详情: \{importErrorDetails\}/);
    assert.match(source, /input\.checked = confirmedKeys\.has\(warning\.key\)/);
    assert.match(source, /if \(!exactDuplicateConflict\) saveButton\.disabled = false/);
    assert.equal(source.match(/<AdminEventForm/g)?.length, 1);
    assert.doesNotMatch(source, /fetch\([^)]*show\.bilibili\.com/);
});

test("管理员创建 API 重新校验导入来源、重复警告和原子创建结果", async () => {
    const source = await readSource("src/pages/api/admin/events/index.ts");

    assert.match(source, /parseBilibiliImportSubmission\(formData\)/);
    assert.match(source, /input\.source_url !== bilibiliImport\.canonicalSourceUrl/);
    assert.match(source, /findEventDuplicateCandidates\(db, \[input\.start_date\]\)/);
    assert.match(source, /bilibiliImport\.confirmedWarningKeys\.has\(key\)/);
    assert.match(source, /warnings: warnings/);
    assert.match(source, /createBilibiliImportedPublishedEvent/);
    assert.match(source, /BilibiliExactDuplicateError/);
    assert.match(source, /schedulePublicDataInvalidation/);
});
