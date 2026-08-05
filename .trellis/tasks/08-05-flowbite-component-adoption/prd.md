# 前端 Flowbite 组件覆盖改造

## 目标

审计公开端和管理端的现有 UI 实现, 将可由 Flowbite Svelte 稳定承载的自制控件替换为 Flowbite 组件或项目已有的类型化适配器, 提高交互一致性, 可访问性和维护性, 同时保持现有产品行为与视觉契约.

## 背景

- `flowbite@4.0.2`, `flowbite-svelte@1.33.1` 和 `flowbite-svelte-icons@3.1.0` 已安装.
- `.trellis/spec/frontend/design-system.md` 已将 Flowbite Svelte + Tailwind v4 定义为当前前端设计系统.
- 2026-07-27 的迁移只覆盖有生产消费者的 Button, Badge, Table, Drawer, Modal 和 Select. 当时明确排除了未被引用的 Input, Textarea, Label, Card 和 Separator.
- `src/components/ui/input.svelte:1`, `textarea.svelte:1`, `label.svelte:1`, `card.svelte:1` 和 `separator.svelte:1` 仍是自制原语, 且当前没有生产消费者.
- 页面仍直接实现大量可见控件. 主要集中在 `src/pages/submit.astro:98`, `src/components/admin/AdminEventForm.astro:97`, `src/pages/admin/login.astro:110`, `src/components/admin/BulkEventImport.svelte:188` 和 `src/components/FilterBar.svelte:187`.
- `src/components/admin/BulkEventImport.svelte:383` 仍有原生预览表格, 可直接复用项目已有 Flowbite Table 适配器.
- `src/components/HomepageIntentFeed.svelte:240` 和 `src/components/FeaturedEventCarousel.svelte:231` 包含业务状态控件. Flowbite ButtonGroup/Button 可以承载视觉与基础交互, 但必须保留真实链接, `aria-*`, 键盘和无 JS 行为.
- 最新提交 `82ab586` 在 `src/pages/admin/events/new.astro` 增加了 `importErrorDetails` 展示. 本任务必须保留连接异常详情, cause 展示和手动录入提示.

## 需求

- R1: 覆盖 `src/pages/`, `src/layouts/` 和 `src/components/` 中面向用户的公开端与管理端 UI.
- R2: 将 Input, Textarea, Label, Card 和 Separator 适配器改为对应 Flowbite 组件, 并补充重复使用所需的 Alert, Checkbox 和 Fileupload 适配器.
- R3: 扩展 Button 和表单适配器, 使用 Flowbite 类型并透传 `id`, `title`, `aria-*`, `data-*`, `maxlength`, `pattern`, `autofocus`, `readonly` 等原生属性. Svelte 调用方需要的 `value`, `checked`, `files` 和元素引用必须支持绑定.
- R4: 页面和业务组件优先复用 `src/components/ui/` 适配器. 只使用一次且不拥有共享业务合同的结构型组件, 如 ButtonGroup, Listgroup, PaginationItem, SidebarGroup 和 SidebarItem, 可以直接使用 `flowbite-svelte`.
- R5: 迁移投稿表单, 管理登录, 管理创建/编辑表单, 目录筛选, 标签输入, 批量导入, 页面 CTA, 公开端和管理端分页项, 移动公开导航列表, EventCard 的 card/featured 变体, 错误/警告块和首页控件.
- R6: 提取一个共享管理导航列表, 让桌面侧栏和移动 Drawer 共用 ADMIN_NAV_ITEMS, active 规则和 Flowbite SidebarItem 输出, 消除当前两份导航标记.
- R7: 保留现有路由, URL 查询参数, 表单字段名, 原生表单提交语义, API 请求, 重定向, 加载/错误/禁用状态和键盘交互.
- R7.1: 保留管理创建页在 `82ab586` 新增的会员购连接异常详情和 cause 展示.
- R8: 保留 Tailwind v4 语义 token 与当前密度, 布局和品牌视觉. 本任务不进行独立视觉重设计, 不使用 Flowbite 默认颜色覆盖项目 token.
- R9: 继续使用 `flowbite-svelte-icons`. 不新增手写 SVG, Flowbite DOM runtime, `initFlowbite()` 或第二套 UI runtime.
- R10: 没有合适 Flowbite 组件, 替换会削弱语义/渐进增强能力或会破坏稳定业务合同时, 保留原生实现并在覆盖审计中说明原因.

## 验收标准

- [ ] AC1: 覆盖审计包含公开端, 管理端和共享组件, 每个主要候选类别均有替换或保留结论.
- [ ] AC2: Input, Textarea, Label, Card, Separator, Alert, Checkbox 和 Fileupload 通过本地适配器使用 Flowbite, Button 支持通用原生属性透传.
- [ ] AC3: 投稿表单, 管理登录, 管理共享表单, 目录筛选, 标签输入和批量导入不再复制可由上述适配器承载的可见控件样式.
- [ ] AC4: 批量导入预览复用 Flowbite Table 适配器, 分类列表和移动公开导航使用 Flowbite Listgroup/ListgroupItem, 两端分页使用带真实 href 的 Flowbite PaginationItem, 首页分段控件使用 Flowbite ButtonGroup/Button, 管理导航项使用 Flowbite SidebarItem.
- [ ] AC5: 页面 CTA 和视觉化错误/警告块统一使用 Flowbite Button/Alert 适配器, 纯文本链接和非视觉化 live status 不强制组件化.
- [ ] AC6: EventCard 的 card/featured 变体使用 Flowbite Card, row/compact 变体保留现有业务布局和语义.
- [ ] AC7: 原生 `<details>`, hidden input, datalist, Turnstile 容器, 页面级 form/nav/section, 公开桌面三列导航和需要无 JS 可达的真实链接保持正确语义.
- [ ] AC8: 原有业务字段, 查询参数, 提交端点, 重定向, active 路由, pending 状态和首页缓存/history 行为保持不变.
- [ ] AC9: 所有交互控件具有可访问名称, 可见焦点, 键盘操作和正确的禁用/加载/错误状态.
- [ ] AC10: 增加聚焦的覆盖回归检查, 防止高价值页面重新引入已迁移的长控件类或绕过适配器.
- [ ] AC11: `corepack pnpm lint`, `corepack pnpm exec tsc --noEmit`, `corepack pnpm test`, `corepack pnpm build` 和 `git diff --check` 全部通过.
- [ ] AC12: 使用 `astro dev --background` 和 in-app Browser 验证约 390x844, 768x1024 和 1440x1000 视口, 无页面级水平溢出, 控件重叠, 丢失焦点或控制台错误.

## 范围外

- 后端 API, 数据库模式, 排名逻辑和内容模型变更.
- 与 Flowbite 采用无关的页面信息架构或品牌视觉重设计.
- 引入第二套 UI runtime, Flowbite DOM runtime, 新的客户端状态框架或 Playwright.
- 为追求组件数量而把语义更合适的原生结构改成需要额外 hydration 的 Flowbite 组件.
