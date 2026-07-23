# 实施计划：品牌、地区、标签与自动夜间模式

## 1. 数据库基线与共享类型

- [ ] 重写 `migrations/0001_init.sql`，一次创建最终表、约束、索引和类型/规模种子。
- [ ] 删除 `0002_seed.sql`、`0003_audit.sql`、`0004_event_metadata.sql`，不保留未部署前的增量历史。
- [ ] 使用 STRICT 表、规范标签约束、日期/时间 CHECK、建议文本长度约束，并按真实查询优化索引。
- [ ] 在 `src/lib/db/queries.ts` 的 `EventRecord` / `EVENT_SELECT` 中加入建议与时间字段。
- [ ] 拆分 `SubmissionInput` 与 `AdminEventInput`；投稿类型只接受自由文本建议。
- [ ] 修改 `insertSubmission()`，写入建议文本和可选时间，但不创建或关联规范标签。
- [ ] 新增 canonical tag 存在性查询；让已发布/已下线活动编辑时禁止零规范标签。

## 2. 投稿与后台标签整理

- [ ] 将 `src/pages/submit.astro` 的 `TagInput` 替换为自由文本标签建议字段，并写清“由管理员统一整理”。
- [ ] 修改 `src/lib/public/form.ts`，限制建议长度并兼容旧 `tags` 字段回退。
- [ ] 在待审核后台表格展示标签建议，并提供编辑/整理入口。
- [ ] 扩展 `TagInput.svelte` 支持由后台传入完整 canonical tag 候选集合。
- [ ] 在管理员编辑页展示只读投稿建议，并使用 `TagInput` 编辑规范标签。
- [ ] 修改 approve / republish API 与 `EventActions.svelte`：零规范标签时阻止动作并提示先整理标签。
- [ ] 将公开活动标签筛选改成规范标签名精确匹配；保留标签搜索接口的模糊建议能力。

## 3. 地区交互与文案

- [ ] 使用 `MUNICIPALITY_CODES` 在 `listDivisionTree()` 中把四个直辖市归一化为单一市级节点，并合并重庆全部区/县。
- [ ] 修改 `DivisionPicker.svelte`，选择直辖市后自动选择市级节点，并正确清空切换前状态。
- [ ] 将三级控件标签和占位统一为“省”“市”“区/县”；保持外层分组和隐藏字段契约。
- [ ] 检查首页与活动列表筛选在省、市、区/县值下生成的 URL 参数仍正确。

## 4. 品牌与主题

- [ ] 删除公共 header 的字母 Logo `E`，将产品界面品牌统一为“野活网”。
- [ ] 更新公共布局、后台布局和登录页的 title / description / 可见品牌；不修改开发样例活动名称。
- [ ] 为公共、后台和登录 HTML head 增加 `color-scheme: light dark` 元信息。
- [ ] 审计所有改动文件仅使用语义颜色 token；保留活动封面媒体遮罩的固定高对比色。

## 5. 可选活动时间

- [ ] 新增 `src/lib/events/datetime.ts`，集中实现 `HH:MM` 解析、同日顺序校验、日期时间展示和 JSON-LD ISO 组合。
- [ ] 在公共投稿与后台编辑表单增加独立可选的开始时间、结束时间控件。
- [ ] 修改公共和后台 FormData 解析，允许单端时间，并拒绝非法格式或同日结束早于开始。
- [ ] 修改 `insertSubmission()` / `editEvent()` 持久化时间字段。
- [ ] 更新活动卡片、详情页和后台列表的日期时间展示，确保无时间历史数据保持原样。
- [ ] 更新 `buildEventJsonLd()`：有时间时输出带 `+08:00` 的 ISO 日期时间，无时间时保留日期。
- [ ] 保持筛选、过期判断、排序和 sitemap 行为仍基于日期。

## 6. 数据与静态验证

- [ ] 使用临时空 `--persist-to` 目录运行 `wrangler d1 migrations apply eventlist-db --local`，确认只应用 `0001_init.sql`。
- [ ] 查询 schema、外键、索引及种子数量，确认 `events` 初始包含三个新字段且不存在 `cities` 表。
- [ ] 验证非法状态、日期、时间、超长标签建议和重复大小写标签被数据库约束拒绝。
- [ ] 运行 `corepack pnpm exec tsc --noEmit`。
- [ ] 运行 `corepack pnpm lint`。
- [ ] 运行 `corepack pnpm build`。
- [ ] 搜索残留产品品牌 `Eventlist`，仅允许明确排除的开发样例数据。
- [ ] 搜索新增硬编码颜色和旧地区文案，确认没有非预期残留。

## 7. 运行时与视觉验证

- [ ] 使用 `astro dev --background` 启动后台开发服务器，并通过 `astro dev status/logs` 管理。
- [ ] 验证投稿请求不会增加 `tags` 表记录，而会保存 `tag_suggestions`。
- [ ] 验证待审核活动零规范标签时 approve 返回 409；整理至少一个标签后可发布并写 audit。
- [ ] 验证 offline 活动零标签时无法 republish，补齐标签后可以重新发布。
- [ ] 验证相似标签名（如“同人”和“同人展”）只通过精确标签筛选各自活动。
- [ ] 验证北京、天津、上海、重庆选择省后自动填充市；重庆全部区/县仍可选；切换普通省份后市和区/县清空。
- [ ] 验证无时间、仅开始、仅结束、同日双时间、跨日双时间五种活动保存和展示结果。
- [ ] 验证同日结束时间早于开始时间时，投稿和后台编辑均返回清晰错误。
- [ ] 检查 JSON-LD：无时间使用日期，有时间使用带 `+08:00` 的 ISO 日期时间。
- [ ] 在约 390x844、768x1024、1440x1000 下检查首页、活动列表、投稿页、活动详情、后台登录和后台审核/编辑页面。
- [ ] 分别模拟系统浅色与深色模式，检查背景、文字、边框、选择器、弹层、焦点态和原生表单控件。
- [ ] 完成后停止后台开发服务器。

## 8. 回滚点

- [ ] 若数据库基线异常，修正单一 `0001_init.sql` 并从空库重建，不维护未部署环境的 down migration。
- [ ] 若直辖市虚拟节点影响已有筛选，回退树形归一化和自动选择改动；末级行政代码无需迁移。
- [ ] 若发布门禁暴露历史零标签活动，保留门禁并通过后台补标签，不绕过正式活动规则。
- [ ] 若时间展示产生兼容问题，可暂时回退表单和展示代码并保留 nullable 时间列。

## 9. Verification Results

- Passed: `corepack pnpm lint`, `corepack pnpm exec tsc --noEmit`, `corepack pnpm build`, and `git diff --check HEAD`.
- Passed: a fresh temporary D1 persistence directory applied only `0001_init.sql`; schema, foreign keys, seven business indexes, eight types, four scales, and dev seed data were verified.
- Passed: D1 rejected invalid time, reversed same-day time, overlong tag suggestions, invalid status, and case-insensitive duplicate tags.
- Passed: municipality tree checks returned one city node for Beijing, Tianjin, Shanghai, and Chongqing; Chongqing retained all 37 lower-level options.
- Passed: exact-tag runtime fixtures proved that a base tag does not match an extended tag; event detail and JSON-LD rendered `HH:MM` and `+08:00` values correctly; fixtures were deleted afterward.
- Passed: browser checks confirmed the `野活网` brand, concise region labels, optional time inputs, removal of public canonical `tags`, and no horizontal overflow at the mobile viewport. Dark token foreground/background pairs measured at 6.13:1 or better.
- Environment limit: the real local submission reached Turnstile verification but workerd returned the documented TLS/network `502`; no bypass was added and all test rows were confirmed absent afterward.
