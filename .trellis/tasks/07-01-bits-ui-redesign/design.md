# Design — 前端 UI 重写为 bits-ui 官方推荐风格

> Task: `07-01-bits-ui-redesign` · Phase: planning
> Pairs with: `prd.md` (requirements / contracts / acceptance)

## 1. 技术栈决策

| 关注点    | 当前                                                  | 目标                                                                                      | 说明                                                       |
| --------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 元框架    | Astro 7 + Svelte 5                                    | 不变                                                                                      | 保留 `@astrojs/svelte`、`@astrojs/cloudflare`              |
| 交互原语  | bits-ui 2.18（仅 SelectField 在用）                   | bits-ui 全家族（Select / Dialog / Button 等 headless）                                    | 已装，不改版本                                             |
| 样式层    | 手写 `tokens.css`/`base.css`/`public.css`/`admin.css` | Tailwind CSS v4 + `cn-division`                                                           | 新增 `tailwindcss@4` + `@tailwindcss/vite`                 |
| `cn` 工具 | `cn-division`（已装）                                 | 仍用，统一用 `cn()` 合并 class                                                            | 零额外依赖                                                 |
| 图标      | Material Symbols Rounded（字体图标）                  | Lucide（SVG，按需）                                                                       | 拟用 `@lucide/svelte`（Svelte 5 支持）；实现前研究确认包名 |
| UI 组件库 | 无                                                    | **不引第三方运行时 UI 库**；在 `src/components/ui/` 自建 shadcn-svelte 风格 headless 原语 | 复用 bits-ui + Tailwind + `cn()`                           |
| 主题令牌  | CSS 变量 `--color-*` / `--radius-*`                   | 仍以 CSS 变量为底（Tailwind v4 `@theme` 映射），保留亮/暗双值                             | 详见 §3                                                    |

### 1.1 不引入

- 不用 shadcn-svelte CLI 生成的非 headless 依赖。
- 不加 Tailwind 之外的第二套 CSS 框架。
- 不加 Playwright。
- 不加动画库（除非确实需要 drawer/sheet，且届时单独评估）。

## 2. 目录与边界

```
src/
  styles/
    app.css            # Tailwind v4 入口：@import "tailwindcss"; @theme + @custom-variant dark + 少量 base 重置
    tokens.css         # 仅保留语义 CSS 变量（被 @theme 引用）—— 或合并进 app.css，二选一，实现时定
  components/
    ui/                # headless 原语（新建，目前空目录）
      button.svelte            # Button（variant: default/outline/ghost/destructive/tonal; size: sm/md/lg/icon）
      badge.svelte             # Badge（配 EventCard 的 type/scale chip）
      card.svelte              # Card.Header/Title/Description/Content/Footer
      input.svelte
      label.svelte
      textarea.svelte
      separator.svelte
      kbd.svelte
      select.svelte            # 基于 bits-ui Select 的 shadcn 风格封装（替换 SelectField 的样式层）
      dialog.svelte            # 用于确认对话框（替换 window.confirm）—— 可选,见 §6
      table.svelte             # shadcn 风格 Table/Header/Body/Row/Cell
      ...
    EventCard.astro            # 用 ui/badge + ui/card 重写
    CitySelector.svelte        # 行为不变,包 DivisionPicker + 提交跳转
    DivisionPicker.svelte      # 行为不变,内部 SelectField→ui/select
    FilterBar.svelte           # 行为不变,用 ui 原语重做滤器外壳
    SelectField.svelte         # 保留 Props 契约（name/label/value/options/placeholder/required/disabled/wide/onchange）,内部指向 ui/select
    TagInput.svelte            # 行为不变,chip→ui/badge,input→ui/input
    Turnstile.svelte           # 行为不变,仅样式壳
    admin/
      EventTable.astro         # 用 ui/table 重写,内联 fetch 逻辑保留
      Pagination.astro         # 用 ui/button 重写
  layouts/
    Layout.astro               # 公开布局：site-shell → Tailwind,顶部 nav 用 ui 原语
    AdminLayout.astro          # 管理布局：左侧 nav + topbar,保留 Astro.locals.admin 契约
  pages/                       # 全部 10 页重写,frontmatter 数据加载逻辑保留
```

**边界原则**：

- `src/components/ui/*` 只做"原语 + 样式"，不吃业务字段语义。
- 业务组件吃原语，不直接写裸 Tailwind 长 class 串；复杂样式抽到组件内部
  仍用 `cn()`。
- 页面只组装布局 + 业务组件 + frontmatter 数据；不写裸 `<style>`。
- `src/styles/*.css` 除 `app.css` 外全部删除；`public.css`、`admin.css`、
  `base.css` 的样式职责迁移到 Tailwind 工具类 + `ui/` 原语。

## 3. 主题与令牌桥接

### 3.1 Tailwind v4 接入

- `astro.config.mjs`：通过 `vite: { plugins: [tailwindcss()] }` 接入
  `@tailwindcss/vite`（Tailwind v4 不再需要 PostCSS / config 文件）。
- `src/styles/app.css`：
    ```css
    @import "tailwindcss";
    @custom-variant dark (&:where(.dark, .dark *));   /* 或保留 prefers-color-scheme：见 §3.3 */
    @theme {
      --color-background: var(--color-background);    /* 复用 tokens.css 既有语义名 */
      ...
      --radius-md: 8px;
      --font-sans: "Inter", ...;
    }
    ```
- 在两个布局根 `<html>` 处 `import "../styles/app.css"`，删除旧 `public.css`
  / `admin.css` import。

### 3.2 颜色语义映射（保留既有命名，避免大改 PRD 心智）

Tailwind v4 `@theme` 把既有 `--color-*` 暴露为 `bg-background` / `text-foreground`
/ `border-border` / `bg-primary` / `text-muted-foreground` 等，与 shadcn-svelte
习惯一致。既有 zinc/teal 调色板可整体沿用。

### 3.3 暗色模式

当前用 `@media (prefers-color-scheme: dark)` 自动切换。两选一：

- **A（推荐，最小改动）**：保留 `prefers-color-scheme` 自动切换，
  `@custom-variant dark` 用 `@media (prefers-color-scheme: dark)`。零新增
  状态、零 toggle 维护成本，与既有过渡一致。
- B：改成 `.dark` class + 根元素切换，需加一个 ThemeToggle 组件与
  localStorage。本任务**不选 B**（不在 PRD 目标内，避免扩面）。

实现时采用 A，除非研究步骤发现 Tailwind v4 `@custom-variant` 对 media
查询的写法有坑，再回 Plan 评估。

## 4. 数据流（与后端边界）

每页 frontmatter 的数据获取调用**保持不变**（函数名 / 入参 / 出参），仅
把渲染层换成新组件。逐页清单：

| 页面                           | 数据获取（保留）                                                            | 渲染层改动                                               |
| ------------------------------ | --------------------------------------------------------------------------- | -------------------------------------------------------- |
| `/`                            | `listPublishedEvents` / `topTags` / `listTypes` / `resolveSelectedDivision` | 重做首页布局：去 hero 叙事，留城市选择 + 紧凑预览        |
| `/events`                      | `listPublishedEvents` / `listTypes` / `listScales` / `topTags`              | `FilterBar` + `EventCard` row 列表 + 分页，全部 Tailwind |
| `/events/[id]`                 | `getPublicEvent` / `buildEventJsonLd` / `getDivisionLabel`                  | dossier → 用 ui 卡片网格重排，保留 JSON-LD               |
| `/submit`                      | `listScales` / `listTypes` / `gestRuntimeEnv.TURNSTILE_SITE_KEY`            | 表单分节保留,字段名不变                                  |
| `/admin`,`published`,`offline` | `listEventsByStatus`                                                        | EventTable → ui/table                                    |
| `/admin/tags`                  | `listTags`                                                                  | 归并表单 + 表格 → ui                                     |
| `/admin/events/[id]/edit`      | `getEvent` / `listTypes` / `listScales`                                     | 编辑表单 → ui 原语,内联 fetch 保留                       |
| `/admin/login`                 | `verifyTokenValue` / `createAdminCookie` / `getAuthMode`                    | 居中卡片登录                                             |

**API 返回结构**：原则上不动。`listTags` / `topTags` / `listPublishedEvents`
/ `getEvent` 等返回类型见 `src/lib/db/queries.ts`，前端照旧消费。只有当新
UI 确实需要某个 UI 上取不到的字段时，才评估在查询里补充（而非改 API 路由
层），并在 PRD §4.3 约束下记录。

## 5. 内联 `<script>` 行为保留

四处页面级 `<script>` 的行为契约保留，只改 DOM 钩子名：

1. `submit.astro`：拦截 `#submit-form` submit → `fetch /api/submit` → 成
   功跳 `/submit?sent=1`，失败写 `#submit-result`。
2. `admin/tags.astro`：`#merge-tags-form` → 校验 from≠to → confirm →
   `fetch /api/admin/tags/merge`。
3. `admin/events/[id]/edit.astro`：`#edit-event-form` → `PATCH
/api/admin/events/{id}`。
4. `admin/EventTable.astro`：对 `form[action^='/api/admin/']` 的统一提交
   处理 + `data-confirm` confirm。

> §6 决定是否把 `window.confirm` / `window.alert` 替换成 ui/dialog。即便替
> 换，**必**保留同等的"阻止误操作"语义。

## 6. 交互升级（可选、克制）

- 将 `window.confirm` 换成 bits-ui Dialog 确认框（统一外观）。**仅在构建
  闸门通过且时间允许时**进行；否则保留原生 confirm。回退成本几乎为零。
- 不引入 Toast 系统（避免扩面）。错误信息沿用 inline 文案。
- 大量长表单（submit / edit）保持单页多节，**不**引入分步向导（避免改
  表单字段名与提交语义）。

## 7. 兼容性 / 回退 / 灰度

- 全部改动集中在 `src/`，后端 / migrations / API 文件不动。
- 一次性替换：因为样式与组件强耦合，分页 shadcn 与残留手写 CSS 共存成本
  很高；采用"先底层（Tailwind 接入 + ui/* + 布局）→ 后页面逐页"的内部顺
  序，但最终上一次提交。
- 回退点：每完成一批（接入 / 布局 / 公开页 / 管理页）跑一次 `pnpm build &&
pnpm lint`；任何一批红灯未消，不进下一批。
- 整体回退：`git revert` 单次提交即可（因为后端未动）。

## 8. 需要实现前研究确认的两点

1. **Lucide 包**：Svelte 5 / Vite 下的正确包名与按需引入写法
   （`@lucide/svelte` vs `lucide-svelte`），以及是否需要
   `unplugin-icons` 风格的配套。
2. **bits-ui v2 Select API**：核对当前 `SelectField` 用到的
   `Select.Root`（type/name/items/value/onValueChange）、`Select.Trigger`、
   `Select.Value`、`Select.Content`/`Portal`/`Viewport`/`Item`/`ScrollUpButton`
   在 v2.18 下的稳定签名，避免重写时踩 API 漂移。

研究结论落到 `implement.md` 的开篇"前置研究"小节，并据此定稿 snippet
形态，再进入批量实现。
