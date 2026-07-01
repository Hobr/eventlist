# Implement — 前端 UI 重写为 bits-ui 官方推荐风格

> Task: `07-01-bits-ui-redesign` · Phase: planning → execute
> Pairs with: `prd.md`（契约/验收）+ `design.md`（栈/结构/边界）

## 0. 前置研究（在 step 1.4 之前做，结论回填本节）

- [ ] R1 Lucide：确认 Svelte 5 正确包名 (`@lucide/svelte` vs `lucide-svelte`)、按需引入写法、是否需 `unplugin-icons`。写一个最小 `pnpm build` 冒烟验证。
- [ ] R2 bits-ui v2.18 Select：跑 `codegraph explore "Select Root Trigger Value Content Viewport Item ScrollUpButton items onValueChange"` 核对签名；确认 `name` prop 仍输出 hidden input（契约 §4.2）。
- [ ] R3 Tailwind v4 + Astro + Cloudflare adapter：最小 `astro.config.mjs` 接入 `@tailwindcss/vite` + `app.css` 仅 `@import "tailwindcss"` 跑通 build。
- [ ] R4 暗色：确认 Tailwind v4 `@custom-variant dark (&:is(@media (prefers-color-scheme: dark)))` 或等价写法可用。

> 研究若与 design.md 前设冲突（如 Lucide 包名差异），就地更新 design.md。

## 1. 验证命令（每批末跑）

```bash
corepack pnpm build        # Astro + Cloudflare adapter
corepack pnpm lint          # prettier --check . && eslint .
corepack pnpm format        # 仅在确认要落盘时
```

视觉冒烟（人工）：

```bash
corepack pnpm preview       # 或 astro dev --background
# 抽查：/ | /events | /events/[id] | /submit | /admin | /admin/login
```

## 2. 执行批次

### 批次 A — 依赖接入与全局样式基座 [闸门 G0]

- [ ] A1 依赖：`pnpm add -D tailwindcss @tailwindcss/vite`；按 R1 加
      Lucide（`pnpm add @lucide/svelte` 或确认包名）。
- [ ] A2 `astro.config.mjs`：`vite.plugins` 注入 `tailwindcss()`（保持
      `cloudflare()` / `svelte()` 不动）。
- [ ] A3 `src/styles/app.css`：`@import "tailwindcss";` + `@custom-variant dark` + `@theme` 桥接既有 `--color-*` / `--radius-*` / `--font-*`（复用
      tokens.css，必要时把 tokens 合并进 app.css）。
- [ ] A4 删除 `public.css`、`admin.css`、`base.css` 中已被 Tailwind 覆盖的
      规则；保留必要的全局重置（box-sizing / body 字体 / focus reset）。
- [ ] A5 临时让两个布局 import `app.css`，跑 build/lint。
- [ ] **闸门 G0**：build + lint 绿；preview 起来页面虽丑但不报500

### 批次 B — `ui/*` 原语层 [闸门 G1]

按 shadcn-svelte 习惯建以下原语（每个含 `.svelte` + 同名 `.tsx`? 不,纯
svelte）：脚本 `<script lang="ts">` 用 Svelte 5 runes + `cn-division` 的
`cn()` + Tailwind class + 必要 `data-*`：

- [ ] B1 `ui/button.svelte`（variant×size，含 `asChild`/`as` 用 Svelte 5
      snippet 或留 `<a>` 分支）。
- [ ] B2 `ui/badge.svelte`（替换 `.chip`）。
- [ ] B3 `ui/card.svelte`（Card + Header/Title/Description/Content/Footer）。
- [ ] B4 `ui/input.svelte`、`ui/label.svelte`、`ui/textarea.svelte`。
- [ ] B5 `ui/separator.svelte`、`ui/kbd.svelte`。
- [ ] B6 `ui/select.svelte`：基于 bits-ui v2 Select 的 shadcn 风格封装
      （Trigger/Content/Viewport/Item/ScrollUp/DownButton）；沿用既有
      `.bits-select-*` 类名作为 data 钩子的语义保留（删除其 CSS 规则）。
- [ ] B7 `ui/table.svelte`（Table/Header/Body/Row/Cell/Head）。
- [ ] B8（可选 R 决策）`ui/dialog.svelte`：bits-ui Dialog 封装，用于
      替换 `window.confirm`。不强制。
- [ ] **闸门 G1**：build + lint 绿；ui 原语可被业务组件引用

### 批次 C — 布局 + 公开页 [闸门 G2]

- [ ] C1 `layouts/Layout.astro`：nav/品牌/容器用 Tailwind + ui；删除
      `home-console`/`route-section` 等旧类语义；保留 `currentPath` /
      `isCurrent` 逻辑。
- [ ] C2 `layouts/AdminLayout.astro`：左侧 nav + topbar + admin email
      chip；保留 `Astro.locals.admin` 契约。
- [ ] C3 `SelectField.svelte`：内部改用 `ui/select`，**Props 契约不变**
      （name/label/value/options/placeholder/required/disabled/wide/
      onchange）。
- [ ] C4 `DivisionPicker.svelte`：改用 `SelectField`（行为/hidden input
      `name` 不变）。
- [ ] C5 `CitySelector.svelte`：行为不变，外层 Tailwind。
- [ ] C6 `FilterBar.svelte`：滤器外壳 Tailwind + ui，URL query 名与提交
      不变。
- [ ] C7 `TagInput.svelte`：chip→ui/badge，hidden `name="tags"` 与
      `"、" ` join 不变。
- [ ] C8 `EventCard.astro`(card & row)：ui/badge + ui/card。
- [ ] C9 `admin/Pagination.astro`：ui/button；`hrefFor` 逻辑不变。
- [ ] C10 `/` 首页：重做布局，文案去叙事化（"情报表/雷达/COMMAND"→工具型）。
- [ ] C11 `/events`：FilterBar + 行列表 + 分页；文案去 "活动雷达" → "活动列表"。
- [ ] C12 `/events/[id]`：dossier → 卡片网格；保留 JSON-LD；"EVENT DOSSIER"
      → 中性标题。
- [ ] C13 `/submit`：分节表单；逐字段核对 §4.2；内联 `<script>` 行为不变。
- [ ] C14 `Turnstile.svelte`：仅样式壳，行为不变。
- [ ] **闸门 G2**：build + lint 绿；公开 4 页人工抽查：路由/query 参数/投稿
      跳转/城市记忆/JSON-LD 不退化。

### 批次 D — 管理页 [闸门 G3]

- [ ] D1 `admin/EventTable.astro`：ui/table 重写，内联 fetch 提交保留；
      若启用 Dialog，`data-confirm` → Dialog。
- [ ] D2 `/admin`、`/admin/published`、`/admin/offline`：套新布局 +
      EventTable + Pagination（三页数据源逻辑保留）。
- [ ] D3 `/admin/tags`：归并表单 + 表格 → ui；内联 `<script>` 保留。
- [ ] D4 `/admin/events/[id]/edit`：编辑表单 → ui 原语；字段名逐项核对；
      内联 `<script>` 保留。
- [ ] D5 `/admin/login`：居中卡片登录；保留 POST/token/next/authMode 流。
- [ ] **闸门 G3**：build + lint 绿；管理 6 页人工抽查：审核动作/归并/编辑
      保存/登录跳转/authMode 提示不退化。

### 批次 E — 收尾 [闸门 G4]

- [ ] E1 全量 `rg "material-symbols-rounded"`、`rg "src/styles/(public|admin|base)\.css"`
      必须零命中（除注释/删除清单）。
- [ ] E2 全量 `rg "class=\"(button|chip|panel|surface|notice|event-row|dossier)"` 旧全局类
      零命中（替换为 ui 原语 + Tailwind）。
- [ ] E3 契约逐项核对清单（见 §3 回填）全部勾选。
- [ ] E4 `pnpm format` 落盘后再次 `pnpm lint`。
- [ ] E5 跑 `pnpm preview` 走一遍亮/暗模式抽检。
- [ ] **闸门 G4**：build + lint 绿 + 契约核对无残留 + 亮暗模式可用。

## 3. 契约逐项核对清单（E3 用,不勾不算完成）

路由 200：`/` `/events` `/events?city=11&type=con` `/events/<已有id>` `/submit`
`/submit?sent=1` `/admin` `/admin/login` `/admin/published` `/admin/offline`
`/admin/tags` `/admin/events/<id>/edit`

查询参数（保留名）：city / type / scale / tag / from / to / page / sort

表单字段名核对：

- 投稿：title,type,scale,tags,division_code,venue,address,start_date,
  end_date,cover_url,description,qq_group,ticket_url,source_url,
  submitter_contact,cf-turnstile-response
- 编辑：同上除 turnstile
- 标签归并：from,to

API 路径不变：`POST /api/submit`、`GET /api/tags?q=`、
`POST /api/admin/events/[id]/{approve,reject,offline,republish}`、
`PATCH /api/admin/events/[id]`、`POST /api/admin/tags/merge`

行为不退化：投稿成功→`/submit?sent=1`；登录→`next`→`/admin`；
EventTable 内联提交→reload；标签归并前 confirm；城市记忆
localStorage key=`eventlist.divisionCode`；暗色下可读。

## 4. 回退点

- 单批闸门红灯：停在当前批不前进,就地修；若发现 PRD 契约冲突,回 Phase 1
  修 PRD/design。
- 整体回退：因为后端/migrations/API 文件未动,`git revert` 即可恢复。

## 5. 范围红线（避免扩面）

- 不加 Playwright / 不加 Toast 系统 / 不加分步向导 / 不加 ThemeToggle。
- 不改 db migrations / API 路由层返回结构（除非前端真有缺口且记入 PRD）。
- 不引入除 `tailwindcss` / `@tailwindcss/vite` / Lucide 之外的运行时依赖。
