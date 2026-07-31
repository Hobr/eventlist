# 实施计划

## 0. 开始前

- [ ] 重新读取 `git status` 及本任务涉及文件，保留缓存任务和测试中的并发未提交改动。
- [ ] 确认远程迁移记录仍是旧版 `0001_init.sql`；只读核对，不在实现阶段删除、重建或迁移远程 D1。
- [ ] 运行相关现有测试，记录 URL 二选一行为作为预期的 Fail-to-Pass 基线。

## 1. Schema 与共享合同

- [ ] 直接更新 `migrations/0001_init.sql`，加入六个 nullable 列及 SQL `CHECK`；不创建 `0002`。
- [ ] 在 `src/lib/events/options.ts` 增加入场方式与异常状态的稳定代码、中文标签、类型守卫和显示 helper。
- [ ] 更新 `EventBaseInput`、`EventRecord`、`PublicEventDetail`、数据库 row 类型及显式公共列投影。
- [ ] 更新正在开发的公共 DTO 缓存 schema/namespace 和 validator，使旧 envelope 失效；不把热度放进缓存 payload。

## 2. 写入入口

- [ ] 扩展公开投稿表单、解析器与 `insertSubmission()`。
- [ ] 扩展管理员共享表单、字段目录、字段标签、验证、创建和编辑 SQL。
- [ ] 扩展 CSV 新模板、预览/解析和批量写入；删除旧 17 列模板兼容分支并断言旧表头失败。
- [ ] 覆盖超长主办方、非法异常状态、非法入场方式、超长票价、无日期但有时间及空值规范化。

## 3. 详情读取与展示 helper

- [ ] 更新静态活动详情查询和映射，保持列表 DTO 不膨胀。
- [ ] 新增近 30 日公开活动匿名访客计数查询，返回 0 而不是 `null`。
- [ ] 修改可选详情 helper：URL 相同去重，不同时保留购票和来源。
- [ ] 新增可注入时钟的用户状态、SQLite 更新时间和入场开始时间格式化 helper；下线、取消、延期依序覆盖日期推导。
- [ ] 为 URL、状态边界、时间格式及空字段先补单元测试。

## 4. 页面

- [ ] 详情页读取静态活动和动态热度，不向公开 DTO 泄漏访客键。
- [ ] 渲染状态、最后更新时间和近 30 日热度（含 0）。
- [ ] 独立渲染购票入口和不同的活动来源链接。
- [ ] 条件渲染主办方、入场方式、票价区间、开始购票/预约/申请日期与可选时间，并将主办方写入 JSON-LD。
- [ ] 异常状态复用主状态位置，公告内容继续来自活动描述，不创建独立公告 UI。
- [ ] 检查无可选值、仅一个值、全部值以及超长中文票价在移动/桌面布局下不产生空容器或溢出。

## 5. 测试与规范

- [ ] 更新 `test/event-detail.test.ts` 的旧 ticket-precedence 断言并覆盖相同/不同 URL。
- [ ] 更新公开 DTO/query、公开投稿、管理员表单、管理员 DB mutation、批量 CSV/DB fixture 测试。
- [ ] 更新真实 SQLite 测试，在全新数据库只应用新版 `0001`，验证 nullable 默认值、约束和热度窗口。
- [ ] 更新 `.trellis/spec/backend/database-guidelines.md` 的字段合同和开发库重建门禁，同时保留单基线规范。
- [ ] 更新 `.trellis/spec/backend/admin-bulk-event-import.md` 的新版唯一 CSV 表头合同。
- [ ] 更新 `.trellis/spec/frontend/design-system.md` 的详情页来源、状态、热度和可选信息规则。

## 6. 验证门禁

- [ ] `corepack pnpm test`
- [ ] `corepack pnpm exec tsc --noEmit`
- [ ] `corepack pnpm lint`
- [ ] `corepack pnpm build`
- [ ] 在全新 `mktemp -d` 持久化目录执行 `corepack pnpm exec wrangler d1 migrations apply eventlist-db --local --persist-to <dir>`，确认只记录新版 `0001` 且 seed 可用。
- [ ] 使用 `EXPLAIN QUERY PLAN` 确认近 30 日热度查询可使用 `idx_event_visitors_recent`。
- [ ] 按项目约定用 `corepack pnpm exec astro dev --background` 启动开发服务器，执行详情页 HTTP 和浏览器桌面/移动检查；不得引入 Playwright。

## 7. 发布与回滚检查

- [ ] 实现完成时不自动操作远程 D1；交付说明明确远程开发库需在另行授权下直接重建、应用新版 `0001`、重新生成开发样例后再部署代码，不迁移旧数据。
- [ ] 确认仓库中没有 `0002`，并提供重建后的表结构与迁移记录核验查询。
- [ ] 确认没有读取、记录或展示 `submitter_contact`、原始 `visitor_key`、审核原因或审计元数据。
