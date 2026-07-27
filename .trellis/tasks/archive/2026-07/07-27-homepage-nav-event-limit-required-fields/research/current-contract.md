# 当前实现证据

## 首页与导航

- `src/layouts/Layout.astro:66-124`：公共导航目前是两端 flex；`nav-control` 与主导航同处右侧 wrapper，且地区入口先于主导航。
- `src/pages/index.astro:208-223`：Hero 后存在“热门活动 / 今日活动”页内锚点。
- `src/pages/index.astro:332-359`：今日列表或空状态已经提供底边，CTA wrapper 又使用 `border-t`，形成两条分割线。
- `src/lib/db/queries.ts:439-498`：today 查询使用 China-local 日期覆盖、稳定排序且当前无 `LIMIT`。
- `test/homepage-discovery.test.ts:69-93`：现有测试明确断言 today SQL 不含 `LIMIT`，本任务需要反转该合同。

## 公开投稿必填合同

- `src/lib/public/form.ts:82-123` 的服务端解析要求：`title`、`type`、`scale`、`division_code`、`venue`、`start_date`、`end_date`、`source_url`、`submitter_contact`。
- `src/pages/submit.astro:78-266` 中相同控件已经带原生 `required`，但可见标签没有“必填”文字。
- `tag_suggestions`、`address`、`cover_url`、`description`、`qq_group`、`ticket_url` 仍是选填。

## 管理员新建必填合同

- `src/lib/admin/form.ts:177-246` 要求：`title`、`type`、`scale`、`division_code`、`venue`、`start_date`、`end_date`、`source_url`、`submitter_contact`。
- `src/pages/api/admin/events/index.ts:13-18` 额外要求管理员新建时至少一个规范标签。
- `src/components/admin/AdminEventForm.astro:45-292` 是新建和编辑共享字段组件；直接硬编码标注会改变编辑页。
- `src/pages/admin/events/new.astro:44-53` 是新建页配置入口，适合显式启用页面级必填标注。

## 共享组件影响面

- `SelectField.svelte` 同时被投稿、管理员、筛选器和标签管理使用；必填标注必须 opt-in，不能自动扩散到所有 required 调用。
- `DivisionPicker.svelte` 内含省/市/区县三个 `SelectField`；地区只应在组合控件顶层标注一次。
- `TagInput.svelte` 使用 hidden `tags` 值和可见搜索输入；管理员新建的标签必填由 API 最终校验，不应伪造无效的 hidden-input 原生 required 行为。

## 规范漂移

- `.trellis/spec/frontend/design-system.md:167-177` 当前要求 Hero 后保留直接锚点且 today 不设上限，与本任务目标冲突。
- `.trellis/spec/backend/database-guidelines.md:306-323` 当前把 today 定义为完整无上限列表；实施时必须同步为最多 10 条。
