# 接入 Cloudflare Turnstile

## 目标

使用用户已在 Cloudflare 控制台创建的 Turnstile widget，保护公开活动投稿链路，确保只有服务端 `siteverify` 明确返回 `success === true` 后才写入投稿，同时保留现有投稿字段、审核队列和错误反馈行为。

## 背景与已确认事实

- 项目是部署到 Cloudflare Workers 的 Astro SSR 应用，公开投稿页面为 `src/pages/submit.astro`，提交接口为 `POST /api/submit`。
- 前端已有 `src/components/Turnstile.svelte`，后端已有 `src/lib/turnstile.ts`，因此本任务是修正并补全现有集成，不是新建另一套服务。
- 当前 widget 容器缺少 `data-action="turnstile-spin-v2"`，AJAX 投稿失败后也没有重置单次使用的 token。
- 当前运行时使用 `TURNSTILE_SECRET_KEY`，与用户指定的 `TURNSTILE_SECRET` 契约不一致；`wrangler.jsonc` 中仍是 Cloudflare 测试 site key。
- 现有服务端已经使用 `URLSearchParams` 向官方 `siteverify` 地址发起 `POST`，携带 `CF-Connecting-IP`，并以 `result.success === true` 作为成功条件；网络、非 2xx 和非 JSON 响应均会失败关闭。
- 代码库没有 reCAPTCHA 或 hCaptcha，也没有 Turnstile 专项自动化测试。
- 用户已确认 Spin 第 7 步只保护公开投稿表单及其现有 `POST /api/submit` 处理器，不扩展到其他候选入口。

## 需求

- **R1**：复用现有 widget，不创建新 widget，不调用任何 Cloudflare 管理 API。
- **R2**：公开投稿页使用 site key `0x4AAAAAAECBuh-0cHETrayP`，所有 `cf-turnstile` 容器包含 `data-action="turnstile-spin-v2"`。
- **R3**：后端只从运行时环境变量 `TURNSTILE_SECRET` 读取 secret；源码、文档、测试输出和回复中均不得硬编码真实 secret。
- **R4**：`POST /api/submit` 在任何数据库写入前读取 `cf-turnstile-response`，并调用 `POST https://challenges.cloudflare.com/turnstile/v0/siteverify`。
- **R5**：`siteverify` 使用 `application/x-www-form-urlencoded` 请求体，字段为 `secret`、`response`，并在可用时携带 `remoteip`（来自 `CF-Connecting-IP`）。
- **R6**：只有解析后的响应满足 `success === true` 才继续原有投稿逻辑；缺 token、缺 secret、网络失败、非 2xx、非 JSON 或 `success !== true` 均不得写入数据库。
- **R7**：AJAX 投稿未导航离开页面时重置 Turnstile widget 和本地 token，允许用户使用新 token 重试，避免 `timeout-or-duplicate`。
- **R8**：保持现有投稿字段校验、D1 写入、成功跳转和面向用户的错误反馈不变；不重构无关前端或后台逻辑。
- **R9**：同步更新运行时类型、Wrangler 配置、示例环境变量和相关运维文档中的变量名，保留用户已存在的无关改动。
- **R10**：新增聚焦测试，覆盖 canonical 请求字段、严格成功判断以及主要失败关闭路径，并完成静态检查、构建与可执行的运行时验证。

## 验收标准

- [ ] **AC1（R1-R3）**：仓库中仅引用给定 site key 和 `TURNSTILE_SECRET` 环境变量；没有 widget 创建/API 管理调用，也没有真实 secret 字面量。
- [ ] **AC2（R2）**：公开投稿页实际渲染的 Turnstile 容器具有 `cf-turnstile` 类、给定 site key 和 `data-action="turnstile-spin-v2"`。
- [ ] **AC3（R4-R6）**：服务端请求官方 `siteverify`，表单编码包含 `secret`、`response`、可用时的 `remoteip`，且只有 `success === true` 才执行 `insertSubmission`。
- [ ] **AC4（R6）**：缺 token、缺环境变量、网络异常、非 2xx、非 JSON 与 `success: false` 均返回失败响应，自动化测试证明数据库写入门禁不可绕过。
- [ ] **AC5（R7）**：前端失败或其他未跳转结果后会清空旧 token 并重置 widget，下一次提交不会复用已兑换 token。
- [ ] **AC6（R8-R9）**：投稿成功仍进入原审核队列并跳转成功页；运行时类型、配置、示例和文档统一使用 `TURNSTILE_SECRET`，无关 `README.md` 改动得到保留。
- [ ] **AC7（R10）**：测试、类型检查、lint 和 Astro/Workers 构建通过；若当前进程已设置 `TURNSTILE_SECRET`，Spin 的 dummy-token `siteverify` 校验返回预期的 `invalid-input-response`，否则明确报告该外部验证前置条件未满足。

## 范围外

- 创建、查询、更新或删除 Cloudflare Turnstile widget。
- 调用 Cloudflare 管理 API、改动 widget 域名或 clearance 配置、部署额外 Worker/代理。
- 将 Turnstile 加到已由 Cloudflare Access/管理员 token 保护的后台审核、编辑、批量导入或登录操作。
- 将 Turnstile 加到活动筛选 GET 表单或被动的浏览量统计请求。
- 改动邮件、短信、OAuth、数据库结构、投稿持久化语义或无关视觉设计。
