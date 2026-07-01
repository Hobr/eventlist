# PRD — 前端 UI 重写为 bits-ui 官方推荐风格

> Task: `07-01-bits-ui-redesign` · Status: planning
> Owner: hobr · Created: 2026-07-01

## 1. 背景与动机

现有前端由"bits-inspired 手写 CSS + Material Symbols 图标"渐进迭代而来
（见已归档的 `06-30-bits-ui-frontend-redesign` 与
`06-30-structural-frontend-redesign`）。界面可工作但风格不统一：手写 CSS
在 `tokens.css` / `base.css` / `public.css` / `admin.css` 四处分散，组件
样式靠 `.button`、`.chip`、`.panel`、`.surface` 等全局类拼装，缺乏一个
稳定的、可被 AI 助手复用的组件原语层。

用户希望**彻底推翻当前前端 UI**，按 bits-ui 官方推荐栈（Tailwind CSS v4

- `cn` 工具 + headless 原语组合出的 shadcn-svelte 风格）重新设计，使页
  面呈现整洁、克制、可扫读的视觉语言。

> 说明：此决策*显式推翻* `.trellis/spec/frontend/design-system.md` 中
> "Adding Tailwind or another CSS framework without an explicit
> product/tooling decision" 的禁令——本 PRD 即为该产品/工具决策。Phase
> 3.3 会同步更新该 spec。

## 2. 目标

1. 引入 Tailwind CSS v4 作为统一样式层，移除 `src/styles/*.css` 手写
   分散样式（保留必要的全局重置 / 字体 / token 桥接）。
2. 按 bits-ui 官方推荐风格，在 `src/components/ui/` 建立 headless 原语
   组件集（Button、Card、Badge、Input、Label、Textarea、Select、
   Dialog、Table、Separator、Kbd…），样式走 shadcn-svelte 习惯的
   `data-*` / `cn()` 模式。
3. 迁移图标体系：Material Symbols Rounded → Lucide（按需 tree-shake 的
   SVG 图标）。
4. 重写文案为简洁、中性、可扫读的"工具型"语言，去除"情报表 / 雷达 /
   COMMAND / DOSSIER / LIVE PREVIEW"等叙事化包装。
5. 重做全部 10 个页面 + 2 个布局。
6. 保持所有路由路径、查询参数、表单字段名、API 端点、鉴权与 Turnstile
   流不变（API _返回结构_ 允许小幅调整，但仅在前端确实需要时）。

## 3. 范围

### 3.1 重写的页面（全部）

公开站点（`Layout.astro`）：

- `/` 首页
- `/events` 活动列表
- `/events/[id]` 活动详情
- `/submit` 投稿

管理后台（`AdminLayout.astro`）：

- `/admin` 待审核
- `/admin/published` 已发布
- `/admin/offline` 已下线
- `/admin/tags` 标签归并
- `/admin/events/[id]` 编辑
- `/admin/login` 登录（独立页面，不经 AdminLayout）

### 3.2 重写的组件

- 布局：`Layout.astro`、`AdminLayout.astro`
- 原语：新建 `src/components/ui/*`（headless 组件 snippets，bits-ui +
  Tailwind，**不引第三方 UI 库**）
- 业务组件：
    - `EventCard.astro`
    - `admin/EventTable.astro` + `admin/Pagination.astro`
    - `CitySelector.svelte` / `DivisionPicker.svelte` /
      `FilterBar.svelte` / `SelectField.svelte` / `TagInput.svelte` /
      `Turnstile.svelte`
- 页面级内联 `<script>`（submit/tags/edit/EventTable 的 fetch
  提交逻辑）保留行为，只改 DOM 选择与样式钩子。

### 3.3 不在本次范围

- 不改后端业务逻辑（`src/lib/db/*`、`src/lib/auth/*`、
  `src/lib/turnstile.ts`、`src/middleware.ts` 的算法语义）。
- 不改数据库 schema / migrations。
- 不新增测试框架（项目当前无 e2e；spec 明确禁止擅自加 Playwright）。
- 不做 SEO 文案之外的 JSON-LD 结构变更。

## 4. 关键约束（不可破坏的契约）

### 4.1 路由与查询参数

- 公开路由：`/`、`/events`、`/events/[id]`、`/submit`
- 管理路由：`/admin`、`/admin/published`、`/admin/offline`、
  `/admin/tags`、`/admin/events/[id]/edit`、`/admin/login`
- 列表查询参数：`city`、`type`、`scale`、`tag`、`from`、`to`、`page`、
  `sort`（语义与取值集合不变）
- 投稿成功跳转：`/submit?sent=1`
- 登录跳转：`?next=...` → `/admin`

### 4.2 表单字段名（服务端读取，禁止改名）

投稿 `/api/submit`：`title`、`type`、`scale`、`tags`、`division_code`、
`venue`、`address`、`start_date`、`end_date`、`cover_url`、`description`、
`qq_group`、`ticket_url`、`source_url`、`submitter_contact`、
`cf-turnstile-response`。

编辑 `PATCH /api/admin/events/[id]`：同上（除 turnstile）。

标签归并 `POST /api/admin/tags/merge`：`from`、`to`。

> bits-ui `Select.Root` 的 `name` prop 仍须输出同名 hidden input，保留
> `DivisionPicker` 的 hidden `<input name=...>` 行为。

### 4.3 API 端点

- `POST /api/submit`
- `GET /api/tags?q=`
- `POST /api/admin/events/[id]/approve`
- `POST /api/admin/events/[id]/reject`（带 `reject_reason`）
- `POST /api/admin/events/[id]/offline`
- `POST /api/admin/events/[id]/republish`
- `PATCH /api/admin/events/[id]`
- `POST /api/admin/tags/merge`

> API _返回结构_ 允许小幅调整（用户已批准），但若前端能不改就改前端。

### 4.4 鉴权与安全

- Admin cookie 流（token / Cloudflare Access 两种 authMode）不变。
- `Astro.locals.admin` 在 AdminLayout 的展示契约不变。
- Turnstile 站点 key 来自 `getRuntimeEnv().TURNSTILE_SITE_KEY`。
- 不引入硬编码密钥、不在前端日志暴露 secret。

### 4.5 SEO

- `events/[id]` 的 JSON-LD（`buildEventJsonLd`）继续输出。
- 各页 `<title>` / meta description 不弱化。
- `sitemap.xml.ts` 不动。

## 5. 验收标准

1. **构建**：`corepack pnpm build` 成功（Astro + Cloudflare 适配器）。
2. **Lint**：`corepack pnpm lint` 通过（prettier + eslint，含 svelte /
   astro 插件）。
3. **依赖卫生**：新增依赖仅限 `tailwindcss`、`@tailwindcss/vite`、Lucide
   的 svelte 包；`bits-ui`、`cn-division` 已存在；不引入 shadcn-svelte
   CLI 生成的非 headless 第三方包之外的运行时 UI 库。
4. **契约不破**：
    - 全部路由可 200（含带查询参数的 `/events`、`/submit?sent=1`）。
    - 投稿 / 编辑 / 归并 / 审核动作的表单字段名与 API 路径不变（人工对照
      §4.2 / §4.3 逐项核对）。
    - 投稿成功仍重定向到 `/submit?sent=1`。
    - 列表分页 / 筛选 / 城市记忆（localStorage `eventlist.divisionCode`）
      行为不退化。
5. **视觉**：
    - 全站统一 Tailwind token 与一套语义 class 原语，无残留
      `src/styles/*.css` 全局业务样式（全局只剩 `app.css` 形态的 reset +
      字体 + token 桥接）。
    - 全站无 `material-symbols-rounded` 类引用。
    - 公开页与后台在亮/暗 `prefers-color-scheme` 下都可用。
6. **整洁度**：
    - 文案去除"情报表/雷达/COMMAND/DOSSIER/LIVE PREVIEW"叙事化包装，
      改为中性可扫读描述；保留信息量，不改信息架构。
    - 不用纯渐变 / 抽象 SVG 当首页 hero 视觉（spec 既有约束延续：有真实
      封面时优先封面图）。
7. **可访问性**：保留语义化 nav/form/table/detail 结构，保留可见 focus
   态，尊重 `prefers-reduced-motion`，中文标签移动端不截断。

## 6. 风险与缓解

| 风险                                                                        | 缓解                                                                            |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Tailwind v4 与 Astro + Svelte + Cloudflare 适配器集成需要 Vite 插件顺序正确 | 在 `implement.md` 设独立验证闸门：构建 + 预览冒烟                               |
| bits-ui v2 API 与当前 v1 风格 snippet 有差异                                | 实现前先核对已装 `bits-ui@2.18` 的 Select API；保留 `SelectField` prop 契约不变 |
| Lucide 在 Svelte 5 下包名/用法（`lucide-svelte` vs `@lucide/svelte`）需确认 | 实现前研究步骤确定确切包与用法                                                  |
| 移除手写 CSS 后暗色模式链路变化                                             | 用 Tailwind v4 `@custom-variant dark` + token 映射，保留亮/暗双值               |
| 彻底重写易引入隐性回归                                                      | 按"先底层后页面"分批，每批配构建闸门；契约字段逐页核对清单                      |
