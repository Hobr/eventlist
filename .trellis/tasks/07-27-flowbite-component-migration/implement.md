# Implement：组件库迁移至 Flowbite

## 0. 前置确认

- [x] 确认当前任务仍为 `.trellis/tasks/07-27-flowbite-component-migration`，状态在批准前保持 `planning`。
- [x] 保留用户已暂存的 Flowbite 依赖修改，不覆盖 `package.json` 与 `pnpm-lock.yaml` 的既有变更。
- [x] 阅读 `.trellis/spec/frontend/design-system.md` 与 `research/flowbite-technical-migration.md`。
- [x] 记录基线：测试、构建、TypeScript、Prettier 通过；ESLint 仅存在已知 TypeScript 7 加载阻断。

## 1. Flowbite 样式与构建接入

- [x] 在 `src/styles/app.css` 添加 `flowbite/plugin`、Flowbite Svelte/Icons `@source` 和系统暗色 `dark` variant，保留现有 token 与 base reset。
- [x] 从 `astro.config.mjs` 移除 Lucide 专用 `optimizeDeps.exclude`。
- [x] 用一个最小的 Flowbite Svelte 组件和图标迁移验证 Astro SSR、Svelte 编译、Tailwind 扫描和 Cloudflare 构建。
- [x] 运行 `corepack pnpm exec tsc --noEmit` 与 `corepack pnpm build`；失败时停在本批，不进入组件批量迁移。

## 2. 共享交互组件

- [x] 将 `src/components/SelectField.svelte` 迁移到 Flowbite `Select`，映射 option `label -> name`，保留所有 props 和变更回调。
- [x] 将 `src/components/ui/side-panel.svelte` 迁移到 Flowbite `Button`、`Drawer`、`Drawerhead`，保留 snippets 与关闭行为。
- [x] 将 `src/components/ui/confirm-dialog.svelte` 迁移到 Flowbite `Button`、`Modal`、`Spinner`，保留异步成功关闭语义。
- [x] 逐项核对 `DivisionPicker`、`FilterBar`、`AdminMobileNav`、`TagMergeForm`、`EventActions` 消费合同。
- [x] 运行 TypeScript、测试与生产构建。

## 3. 通用 UI 适配器

- [x] 将 `ui/button.svelte` 的 variant/size/href/form props 映射到 Flowbite `Button`。
- [x] 将 `ui/badge.svelte` 的 tone/href/class 映射到 Flowbite `Badge`。
- [x] 将六个已使用的 table 原语映射到 Flowbite Table 组件；防止额外 `<tr>`，保留 `data-label` 和移动单表格合同。
- [x] 检查 `FilterBar`、`Pagination`、`EventActions`、`EventCard`、活动详情、管理事件表格的渲染与状态。
- [x] 运行 TypeScript、测试与生产构建。

## 4. 图标迁移

- [x] 按 `design.md` 映射表迁移 Astro 页面、布局和 Astro 业务组件中的 Lucide 导入。
- [x] 按映射表迁移 Svelte 业务组件中的 Lucide 导入；加载指示器改用 Flowbite `Spinner`。
- [x] 保留现有尺寸类、颜色继承和按钮可访问名称；不添加手写 SVG。
- [x] 执行旧导入硬闸门：`rg -n 'bits-ui|@lucide/(astro|svelte)' src` 必须无结果。
- [x] 运行 TypeScript、测试与生产构建。

## 5. 依赖与配置清理

- [x] 使用 pnpm 移除 `bits-ui`、`@lucide/astro`、`@lucide/svelte`，保留用户新增的三个 Flowbite 包并同步锁文件。
- [x] 检查 `package.json`、`pnpm-lock.yaml` 与 `astro.config.mjs` 不再含旧库配置。
- [x] 确认源码没有 `initFlowbite()`、Flowbite data-attribute DOM runtime 或第二套主题状态。

## 6. 全量质量检查

- [x] `corepack pnpm test`
- [x] `corepack pnpm exec tsc --noEmit`
- [x] `corepack pnpm exec prettier --check .`
- [x] `corepack pnpm build`
- [x] `corepack pnpm lint`，记录并隔离已知 TypeScript 7 / typescript-eslint 加载失败。
- [x] `rg -n 'bits-ui|@lucide/(astro|svelte)' src package.json astro.config.mjs` 无结果。
- [x] 检查 git diff，确认没有后端、API、数据库或无关元数据改动。

## 7. 浏览器验证

- [x] 以 `astro dev --background` 启动开发服务器，记录 URL，完成后使用 `astro dev stop`。
- [x] 在约 390x844、768x1024、1440x1000 检查 `/`、`/events`、一个 `/events/:id`、`/submit`、`/admin/login`。
- [x] 检查 `scrollWidth <= clientWidth`、图标非空、Flowbite 样式生效、亮暗主题、中文标签和操作按钮不重叠。
- [x] 操作 Select、筛选 Drawer、移动管理 Drawer 和确认 Modal，验证焦点、Escape、外部关闭、禁用和 pending 状态。
- [x] 若 Cloudflare Access 阻止管理页面，不弱化鉴权；仅使用规范允许的本地临时预览方式，并在验证后删除。

## 8. 规范与收尾

- [x] 更新 `.trellis/spec/frontend/design-system.md`：组件方向、图标、原语层、业务组件、禁用模式和验证命令改为 Flowbite 合同。
- [x] 对照 PRD AC1-AC8 逐项验收并执行 Trellis check。
- [x] 提交前确认用户预先暂存的 Flowbite 依赖修改已被保留且纳入同一迁移变更。

## 回滚点

- 样式接入失败：只回退 `app.css` 与 `astro.config.mjs` 当前批。
- 共享交互失败：保留适配器公开 props，单独回退对应 Select/Drawer/Modal 适配器。
- 图标构建失败：先回退单个 Astro 图标验证点并修正导入方式，不恢复整个 Lucide 依赖。
- 完整迁移验收失败：在不改后端和数据的前提下回退本任务单一提交。
