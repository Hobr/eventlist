# Flowbite 覆盖审计

## 证据

- 当前依赖为 `flowbite@4.0.2`, `flowbite-svelte@1.33.1` 和 `flowbite-svelte-icons@3.1.0`.
- 本地 `node_modules/flowbite-svelte/dist` 已确认可用组件包括 Input, Textarea, Label, Card, Alert, Checkbox, Fileupload, Hr, ButtonGroup, Listgroup, SidebarItem 和 PaginationItem.
- PaginationItem 支持直接传入 href 并输出真实 anchor, 不要求 totalPages. Card 支持 href 根链接, 可承载当前 EventCard card/featured 变体.
- Flowbite Accordion 在 SSR 的 closed 状态不会输出内容, 因此不能替代投稿表单中必须无 JS 可达的 `<details>`.
- 现有 Flowbite 适配器包括 Button, Badge, Table, Drawer 和 Modal. `SelectField.svelte` 已使用 Flowbite Select. Hero 已使用 Flowbite Carousel/Controls/Indicators.
- 2026-07-27 的迁移设计明确表示未使用的 card/input/label/textarea/separator 不属于当时范围. 本次改造是增量扩展, 不是重做依赖和图标迁移.
- 当前测试包含源文件合同断言, 因此迁移必须保留关键组件名, 字段名和 homepage 行为标记.

## 共享层决策

| Current surface | Evidence | Decision |
| --- | --- | --- |
| `ui/button.svelte` | 已包装 Flowbite Button, 但 props 白名单缺少 `id`, `title`, `aria-*`, `data-*` | 保留公开 variant/size API, 改为基于 Flowbite/Button 原生属性的 rest props 透传 |
| `ui/input.svelte` | 自制 `<input>`, 无生产消费者 | 包装 Flowbite Input, 支持 bindable value 和完整原生属性 |
| `ui/textarea.svelte` | 自制 `<textarea>`, 无生产消费者 | 包装 Flowbite Textarea, 支持 bindable value 和完整原生属性 |
| `ui/label.svelte` | 自制 `<label>`, 无生产消费者 | 包装 Flowbite Label, 保留 token class |
| `ui/card.svelte` | 自制 `<div>`, 无生产消费者 | 包装 Flowbite Card, 支持 `href` 和原生 div/anchor 属性 |
| `ui/separator.svelte` | 自制 `role=separator`, 无生产消费者 | 包装 Flowbite Hr, 保留 class 合并 |
| Visual alerts | 多个页面复制 danger/warning surface | 新增 Alert 适配器, 统一 tone, role 和 token class |
| Checkboxes | 管理导入和重复确认直接写 `<input type="checkbox">` | 新增 Checkbox 适配器, 支持 checked 绑定和原生属性 |
| File input | 批量导入直接写 `<input type="file">` | 新增 Fileupload 适配器, 支持 files/elementRef 绑定 |

## 公开端决策

| Surface | Current state | Target |
| --- | --- | --- |
| `src/pages/submit.astro` | 约 18 个可见原生 Input/Textarea, 原生提交按钮和 CTA | 使用 Label/Input/Textarea/Button/Alert 适配器. 保留单 native form, optional details 和 Turnstile |
| `src/components/FilterBar.svelte` | 可见日期和标签字段复制输入样式 | 使用 Label/Input. hidden query fields 保留 native |
| `src/pages/events/index.astro` | warning/error surface 和重置 CTA 自制 | 使用 Alert/Button, 保留重置链接的真实 href |
| `src/pages/categories.astro` | 3 组重复 facet link surface | 使用 Flowbite Listgroup/ListgroupItem 和 Alert |
| `src/pages/events/[id].astro` / `404.astro` | 操作型链接复制按钮样式 | 使用 Button adapter. 正文和普通链接保持 native |
| `src/components/EventCard.astro` | card/featured/row/compact 共用业务组件, 但根布局不同 | card/featured 使用支持 href 的 Flowbite Card. row/compact 保留现有专用布局 |
| `HomepageIntentFeed.svelte` | 自制 tab anchors 和 mobile scene buttons | 使用 Flowbite ButtonGroup + Button adapter, 仍输出真实 trend href, role=tab, aria-selected 和键盘处理 |
| `FeaturedEventCarousel.svelte` | Flowbite Controls 内有 3 个自制按钮 | 使用 Button adapter, 保留 aria-label, aria-pressed, title 和 changeSlide 回调 |
| `Layout.astro` | 三列几何桌面导航 | 桌面 nav/link 保留 native, 因 Flowbite Navbar 的内部容器和 mobile state 会破坏现有几何 |
| `PublicMobileNav.svelte` | Flowbite Drawer 内仍使用自制导航链接列表 | 保留 Drawer, 将内部链接迁移到 Flowbite Listgroup/ListgroupItem, 保留 active/close/href 合同 |
| `src/pages/events/index.astro` | 上一页/下一页为自制链接, API 只有 page/hasNext | 使用带真实 href 的 Flowbite PaginationItem, 不引入总页数或客户端 handler |

## 管理端决策

| Surface | Current state | Target |
| --- | --- | --- |
| `src/pages/admin/login.astro` | 自制 card, label, input, alert 和 button | 使用 Card/Label/Input/Alert/Button 适配器 |
| `AdminEventForm.astro` | 约 17 个可见原生字段, 自制 action buttons | 使用 Label/Input/Textarea/Button. 保留 ids, data attrs, field names 和 sticky action bar |
| `src/pages/admin/events/new.astro` | 导入 Input/Button, duplicate Checkbox 和 Alert 自制; `82ab586` 增加 `importErrorDetails` | 使用对应适配器. metadata hidden inputs 保留原生实现, 保留异常详情/cause 和手动录入提示 |
| `BulkEventImport.svelte` | File input, 4 个 Button, Checkbox, Alert 和 preview Table 自制 | 使用 Fileupload/Button/Checkbox/Alert 及现有 Table 适配器 |
| `TagInput.svelte` | composite 内部 Input 和 removable tag Button 自制 | 使用 Label/Input/Button, 保留 hidden serialization 和 datalist |
| `EventActions.svelte` / `TagMergeForm.svelte` | reject Textarea 和多个 inline error/status | Textarea 和视觉化 Alert 使用适配器. 紧凑 live status 保留 native |
| `AdminLayout.astro` / `AdminMobileNav.svelte` | ADMIN_NAV_ITEMS 被渲染为两份重复 anchor markup | 新增 `AdminNavList.svelte`, 通过 Flowbite SidebarGroup/SidebarItem 共享 active 和 icon 输出. 外层 desktop aside 与 mobile Drawer 保留 |
| `admin/Pagination.astro` | 已使用 Flowbite Button adapter, API 只有 page/hasNext | 将两向链接迁移到带真实 href 的 Flowbite PaginationItem. 不使用需要 totalPages 或 client handler 的 PaginationNav |

## 保留的原生语义

- `<form>`, `<nav>`, `<section>`, `<article>` 和页面布局容器继续由 Astro/HTML 负责.
- `<details>` 保证投稿可选字段在无 JS 时可达, 不改为需要 hydration 的 Accordion.
- hidden input, datalist 和 Turnstile response field 保留原生实现.
- 管理创建页的重复警告确认 checkbox 由非 hydration DOM 脚本按 API 响应动态生成, 并依赖原生 `required` 校验. 它保留原生实现, 避免增加第二个客户端状态所有者.
- Homepage trend 选择必须保留真实 href 和无 JS 完整导航. Flowbite Button 适配器必须输出 anchor, 不能改成纯客户端 button.
- EventCard 的 row/compact 变体和 EventRow 使用横向/紧凑 article/link/media 信息架构, 不改为通用 Flowbite Card. card/featured 变体使用支持 href 的 Flowbite Card.
- 公开桌面三列导航保留现有布局. 移动 Drawer 中的链接列表改用 Flowbite Listgroup/ListgroupItem.
- 两端分页保留上一页/下一页和 SSR 真实链接合同, 但链接外观与状态由 Flowbite PaginationItem 承载.
- 纯文本返回链接, 行内帮助和未视觉化 live status 不为了形式覆盖而改成 Button/Alert.
- `TagMergeForm.svelte` 和 `EventActions.svelte` 的紧凑行内错误继续使用原生 `role="alert"` 文本, 不升级为视觉 Alert 容器.

## 验证要求

- 编译验证必须覆盖 Astro SSR + Svelte 5 bindable props, 特别是 Input, Textarea, Fileupload 和 Checkbox.
- DOM 脚本依赖的 `submit-button`, save button ids, `data-save-label`, status ids 和 field ids 必须保持.
- HomepageContent, HomepageIntentFeed, FeaturedEventCarousel, 投稿 Turnstile 和管理导航的源文件合同测试必须继续有效. 只有在保持相同行为断言时才允许更新测试表达.
- 增加 PublicMobileNav, 两端 PaginationItem 和 EventCard card/featured 根元素/href 的聚焦合同检查.
- 浏览器验证必须覆盖原生表单校验, 首页 tab, 轮播控制, 批量文件选择, 重复确认, Drawer/Modal 焦点和移动端溢出.
