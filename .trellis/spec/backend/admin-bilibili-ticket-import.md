# 会员购活动导入

> 管理员通过 bilibili 会员购活动 ID 预填、复核并立即发布活动的跨层合同。

## 1. 范围与触发条件

- 适用于 `GET /admin/events/new?bilibili_id=<id>` 的服务端预填和 `POST /api/admin/events` 的可选会员购导入分支。
- 第一版只支持单个正整数 ID，不建立通用第三方导入器，不保存上游快照，也不改变手动创建、编辑或 CSV 批量导入合同。
- 活动字段仍由共享 `validateAdminEventInput()` 校验；导入器只生成 `AdminEventRawInput` 初始值。
- 这是跨上游请求、管理员页面、创建 API 和 D1 写入的合同；修改任一层时必须回查本规范。

## 2. 签名

```ts
parseBilibiliProjectId(value: string | null | undefined): number;
canonicalBilibiliSourceUrl(projectId: number): string;
fetchBilibiliTicketPreview(
    projectId: number,
    options?: { fetchImpl?: typeof fetch; timeoutMs?: number; submitterContact?: string }
): Promise<Omit<BilibiliEventImportPreview, "exactDuplicate" | "duplicateCandidates">>;
buildBilibiliEventImportPreview(
    db: D1Database,
    projectId: number,
    options?: { submitterContact?: string; fetchImpl?: typeof fetch; timeoutMs?: number }
): Promise<BilibiliEventImportPreview>;
parseBilibiliImportSubmission(formData: FormData): BilibiliImportSubmission | null;
createBilibiliImportedPublishedEvent(
    db: D1Database,
    input: AdminEventInput,
    auditMeta: AdminCreateAuditMeta & {
        projectId: number;
        confirmedWarningKeys: string[];
    }
): Promise<number>;
```

- 预览入口：`GET /admin/events/new?bilibili_id=<positive-safe-integer>`。
- 创建入口：`POST /api/admin/events`，成功保持 `201 { ok: true, data: { id } }`。
- 导入提交额外字段：`import_provider=bilibili-ticket`、`bilibili_project_id` 和零个或多个 `confirmed_warning_keys`。

## 3. 合同

### 上游请求与解析

- 上游目标固定为 `https://show.bilibili.com/api/ticket/project/getV2`；scheme、host、path 和参数名都不能来自用户输入。
- 请求只发送 `Accept: application/json`，使用 8 秒默认超时、`redirect: "error"` 和 512 KiB 正文上限；不得转发 Cookie、Authorization、Cloudflare Access 头或 HAR 请求头。
- 解析从 `unknown` 开始。Unix 秒显式按 `Asia/Shanghai` 转换；多场次使用有效场次的最早开始和最晚结束，某一侧没有有效场次边界时才回退顶层时间。
- 价格从分转换为人民币文本；`//` 和 `http:` 图片地址规范化为 HTTPS。活动说明、图片集合和其他不可信富文本不进入预填结果。

### 表单与重复确认

- 浏览器只接收规范化表单值、缺失字段、警告和重复候选，不接收完整会员购响应。
- 除系统生成的 `source_url` 外，业务字段都可编辑。`source_url` 只读但随表单提交；API 必须根据项目 ID 重新生成并比较该 URL。
- 精确重复按规范 `source_url` 检查，预览和提交边界都阻止创建并提供已有活动入口。
- 疑似重复使用共享的“名称 + 开始日期 + 场馆”规范键。提交边界重新查询候选，返回完整当前警告集；客户端重绘时保留仍存在的已确认键。
- 并发精确重复 `409` 后发布按钮保持禁用，不能把该结果当作可重试的普通错误。

### D1 与审计

- 普通创建继续调用 `createPublishedEvent()`；会员购导入使用专用创建函数。
- 标签、活动、关系和 `create` 审计在单个 `db.batch()` 中有条件写入。规范来源已存在或批次失败时，不得留下新标签、关系或审计。
- 候选活动 ID 冲突最多重试三次。成功活动立即写入 `published` 和 `published_at`。
- 审计只记录 `source = admin-bilibili-import`、项目 ID、服务端实际匹配的确认键、规范标签、认证模式和可用管理员邮箱，不保存上游响应。

## 4. 校验与错误矩阵

| 条件 | 页面/API 结果 | D1 写入 |
| --- | --- | --- |
| ID 不是安全正整数 | 页面显示稳定中文错误；提交返回 `400` | 无 |
| 上游超时、非 2xx、非 JSON、过大或结构漂移 | 页面保留手动录入表单 | 无 |
| `source_url` 与项目 ID 的规范 URL 不一致 | `400` | 无 |
| 出现未确认的疑似重复 | `409`，`details.warnings` 返回完整当前集合 | 无 |
| 规范来源已存在 | `409`，`details.existingEvent` 提供已有活动 | 无 |
| 共享活动字段或标签校验失败 | 沿用现有 `400` 错误 | 无 |
| 会员购专用批次失败 | 稳定 `500` | 整批回滚 |
| 创建成功 | `201 { ok: true, data: { id } }` 并触发公开缓存失效 | 活动立即公开 |

## 5. Good / Base / Bad 案例

- Good：`1004224` 映射到宝山区 `310113`、2026-08-16 12:00 至 21:00、78-138 元、2026-07-23 00:00；管理员补齐规模、标签和联系方式后立即公开。
- Base：没有 `import_provider` 和 `bilibili_project_id` 时完整走原有管理员手动创建分支，审计来源仍为 `admin-create`。
- Bad：客户端伪造来源 URL、确认过期警告键或重复提交同一项目 ID 时，服务端重新生成来源和候选，不信任客户端结论。
- Bad：上游返回 HTML、超大正文或 ID 不一致时，不把正文放入错误、日志、浏览器或审计。

## 6. 必需测试

- 解析器：固定 URL/请求头、超时、流式正文上限、非 JSON、业务/结构错误、上海时区、HTTPS 图片、价格、行政区、保守类型建议和多场次边界。
- API/UI：来源重新生成、完整疑似重复警告集、确认键保留、精确重复链接和按钮禁用、无导入元数据时的手动创建回归。
- D1：成功审计、精确重复无残留、任一批次失败回滚和候选 ID 冲突重试。
- 全量门禁：`corepack pnpm test`、`corepack pnpm lint`、`corepack pnpm exec tsc --noEmit`、`corepack pnpm build` 和 `git diff --check`。

## 7. Wrong vs Correct

### Wrong

```ts
// 用户可控 URL 会形成 SSRF，并且转发请求头会泄露后台凭据。
await fetch(formData.get("source_url") as string, {
    headers: request.headers
});
```

```ts
// 只相信预览时的重复结果，会漏掉预览后并发创建的活动。
await createPublishedEvent(db, input, authMeta);
```

### Correct

```ts
const projectId = parseBilibiliProjectId(projectValue);
const sourceUrl = canonicalBilibiliSourceUrl(projectId);
if (input.source_url !== sourceUrl) throw new BilibiliImportError("会员购来源链接无效");

const candidates = await findEventDuplicateCandidates(db, [input.start_date]);
const warnings = findBilibiliDuplicateWarnings(input, candidates);
await createBilibiliImportedPublishedEvent(db, input, {
    ...authMeta,
    projectId,
    confirmedWarningKeys: warnings.map(({ key }) => key)
});
```

固定端点、提交边界复查和专用条件批次必须同时存在；不能只依赖只读输入框或预览结果。
