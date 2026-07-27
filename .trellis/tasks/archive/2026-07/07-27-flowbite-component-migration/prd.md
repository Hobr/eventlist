# PRD：组件库迁移至 Flowbite

## Goal

将前端组件与图标体系从 `bits-ui`、`@lucide/astro` 和 `@lucide/svelte` 迁移到 Flowbite Svelte 与 Flowbite Svelte Icons，统一组件视觉语言并降低维护两套交互原语和图标 API 的成本，同时保持现有信息架构、路由和业务流程不变。

## Background

- 项目使用 Astro 7、Svelte 5、Tailwind CSS 4 和 Cloudflare 适配器。
- 用户已暂存 `package.json` 与 `pnpm-lock.yaml` 中新增 `flowbite@4.0.2`、`flowbite-svelte@1.33.1`、`flowbite-svelte-icons@3.1.0` 的修改，本任务保留并基于这些修改继续工作。
- 旧库引用分布于 24 个生产源码文件，覆盖公开页面、管理页面、两个布局和共享组件，共包含 40 种 Lucide 图标。
- `bits-ui` 的直接使用集中在 `SelectField.svelte` 的 `Select`、`ui/side-panel.svelte` 的 `Dialog` 和 `ui/confirm-dialog.svelte` 的 `AlertDialog`。
- 当前 `.trellis/spec/frontend/design-system.md` 明确以 Bits UI + Lucide 为组件与图标契约，任务完成时必须同步改为 Flowbite 契约。
- 迁移前基线为：14 项测试通过、生产构建通过、`tsc --noEmit` 通过、Prettier 检查通过；完整 lint 在 ESLint 加载配置前被仓库已记录的 TypeScript 7 / typescript-eslint 上游兼容问题阻断。

## Requirements

### R1：依赖与样式接入

- 使用 `flowbite-svelte` 提供交互与视觉组件，使用 `flowbite-svelte-icons` 提供图标。
- 按 Flowbite Svelte 的 Tailwind CSS 4 接入要求配置插件和源码扫描路径，同时保留现有 Tailwind Vite 集成。
- 保留系统偏好驱动的自动暗色模式，不增加主题开关或新的客户端主题状态。
- 迁移完成后移除 `bits-ui`、`@lucide/astro`、`@lucide/svelte` 直接依赖及生产源码引用，并移除仅为 Lucide 存在的构建配置。

### R2：组件迁移

- `SelectField.svelte` 改用 Flowbite `Select`，保留 `name`、`label`、`value`、`options`、`placeholder`、`required`、`disabled`、`wide`、`onchange` 合同。
- `ui/side-panel.svelte` 改用 Flowbite `Drawer` 与按钮组件，保留触发器、标题、说明、正文、页脚、右侧抽屉、遮罩、外部关闭和键盘关闭行为。
- `ui/confirm-dialog.svelte` 改用 Flowbite `Modal`、`Button` 与 `Spinner`，保留危险/主要语气、禁用、pending、自定义正文及“仅成功时关闭”的异步确认行为。
- 当前有生产消费者的 Button、Badge 与 Table 原语改为 Flowbite Svelte 适配器，业务组件继续使用稳定的本地接口。
- 没有生产消费者、且不依赖旧库的本地原语不为追求形式上的完全替换而删除或重写。
- 普通语义 HTML 在 Flowbite 不能增加交互或一致性价值时可保留，但视觉应与迁移后的 Flowbite 控件协调。

### R3：图标迁移

- 所有 Astro 与 Svelte 源码中的 Lucide 导入改为 `flowbite-svelte-icons` 中语义相同或最接近的图标；加载指示器使用 Flowbite `Spinner`。
- 保留当前图标的可见尺寸、颜色继承、装饰性 `aria-hidden` 语义及有文字按钮的图标+文字结构。
- 不引入新的图标库或手写 SVG 作为替代。

### R4：行为与可访问性

- 保持现有公开与管理路由、查询参数、表单字段名、API 端点、重定向、Cloudflare Access、Turnstile 和数据库行为不变。
- 保持目录筛选、行政区联动、移动管理导航、危险操作确认、批量导入和管理员操作的现有状态流。
- Select、Drawer 与 Modal 必须保留原生或等价的 label、focus、Escape、遮罩关闭、禁用和键盘操作语义。
- 迁移后的组件采用 Flowbite 视觉语言，但不改变页面信息架构、内容层级或工作流步骤。

### R5：文档与验证

- 更新 `.trellis/spec/frontend/design-system.md`，将 Bits UI / Lucide 合同改为 Flowbite Svelte / Flowbite Svelte Icons，并记录本地适配层边界。
- 对公开路由与 `/admin/login` 执行桌面、平板和移动视口检查，确认无横向溢出、组件可见且交互层不重叠。
- 完整 lint 仍需执行并记录结果；若仅命中已知 TypeScript 7 上游加载失败，则不得在本任务内降级 TypeScript 或修改无关 ESLint 配置。

## Acceptance Criteria

- [x] AC1：生产源码不再导入 `bits-ui`、`@lucide/astro` 或 `@lucide/svelte`，`package.json` 不再声明这三个依赖，锁文件同步更新。
- [x] AC2：`src/styles/app.css` 已配置 Flowbite 插件与 Svelte/Icons 扫描源；Flowbite 组件样式在生产构建中生成，自动暗色模式仍由系统偏好驱动。
- [x] AC3：Select、右侧 Drawer、确认 Modal、Button、Badge 与管理表格均由 Flowbite Svelte 或稳定的 Flowbite 适配器渲染，并呈现一致的 Flowbite 风格。
- [x] AC4：所有 40 种 Lucide 图标用途均已迁移；页面与组件中不存在缺失图标、错误语义映射或无障碍名称退化。
- [x] AC5：筛选参数、表单字段、API 路径、异步 pending/error 状态、成功跳转、行政区联动和危险操作确认行为与迁移前一致。
- [x] AC6：约 390x844、768x1024、1440x1000 视口下公开页面和 `/admin/login` 无非预期横向溢出、遮罩或控件重叠；Drawer 与 Modal 可用键盘关闭并正确管理焦点。
- [x] AC7：`corepack pnpm test`、`corepack pnpm build`、`corepack pnpm exec tsc --noEmit`、`corepack pnpm exec prettier --check .` 通过；`corepack pnpm lint` 已执行，除已知 TypeScript 7 / typescript-eslint 加载阻断外没有迁移引入的可执行失败。
- [x] AC8：前端设计系统规范已同步，源码搜索与构建配置中无旧库残留。

## Out of Scope

- 不重排页面布局、导航层级、内容优先级或业务工作流。
- 不修改后端业务逻辑、API 返回合同、数据库 schema、迁移或 Cloudflare 绑定。
- 不新增主题切换器、Toast 系统、前端状态框架或动画库。
- 不新增 Playwright 或其他端到端测试框架。
- 不处理 TypeScript 7 与 typescript-eslint 的上游兼容问题。
- 不删除与旧库无关且当前未使用的本地原语，除非它们阻断构建或造成明确重复导出冲突。
