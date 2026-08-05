# 设计: 前端 Flowbite 组件覆盖改造

## 1. 架构

```text
Astro pages / Svelte business components
                  |
                  v
shared project adapters in src/components/ui
                  |
                  v
flowbite-svelte + flowbite-svelte-icons
                  |
                  v
Tailwind v4 semantic tokens
```

- 稳定且重复的 UI 合同进入 `src/components/ui/`.
- 业务状态继续由当前 Astro 页面或 Svelte island 持有. 适配器不接管 fetch, navigation, validation 或 domain state.
- 只出现一次且没有共享业务合同的结构型组件可以直接导入 Flowbite. 本任务中的例子是 ButtonGroup, Listgroup, PaginationItem, SidebarGroup 和 SidebarItem.
- 页面布局和信息架构继续由 Astro/HTML + Tailwind utilities 负责.

## 2. 适配器合同

### 2.1 原生属性透传

Button, Input, Textarea, Label, Card, Checkbox 和 Fileupload 不再维护不完整的手工属性白名单. 每个适配器基于对应 Flowbite prop type, 分离项目自有 variant/tone props 后将其余属性作为 `...restProps` 传入 Flowbite.

这允许页面保留:

- `id`, `name`, `type`, `value`, `href`, `target`, `title`.
- `required`, `readonly`, `disabled`, `autofocus`, `autocomplete`.
- `min`, `max`, `maxlength`, `pattern`, `accept`.
- `aria-*`, `data-*`, `role`, `tabindex`.
- `onclick`, `oninput`, `onchange`, `onkeydown`, `onblur`.

### 2.2 可绑定状态

- Input/Textarea 暴露 bindable `value`.
- Checkbox 暴露 bindable `checked`, 并允许 group/value 原生合同.
- Fileupload 暴露 bindable `files` 和 `elementRef`.
- Button 保持 href 分支和 disabled anchor 防护, 同时把 anchor/button 事件的 `currentTarget` 保持为实际 DOM 元素.

### 2.3 Token 所有权

Flowbite 提供 DOM 结构, focus, disabled 和 component state. 项目语义 token 继续覆盖颜色, radius, density 和 motion. 适配器通过 `cn()` 合并默认 token class 与 caller class, 不增加 component CSS.

## 3. 新增和更新的组件

| 组件 | Flowbite 基础 | 项目责任 |
| --- | --- | --- |
| `ui/button.svelte` | Button | variant/size 映射, href 语义, disabled anchor, rest props |
| `ui/input.svelte` | Input | token 样式, 可绑定 value, rest props |
| `ui/textarea.svelte` | Textarea | token 样式, 可绑定 value, rest props |
| `ui/label.svelte` | Label | token 排版, children, rest props |
| `ui/card.svelte` | Card | 项目 surface 样式, div/anchor 属性 |
| `ui/separator.svelte` | Hr | 语义 separator 和 token border |
| `ui/alert.svelte` | Alert | neutral/warning/danger/success tone 映射, role 覆盖 |
| `ui/checkbox.svelte` | Checkbox | token 颜色, checked 绑定, rest props |
| `ui/file-upload.svelte` | Fileupload | token 样式, files/elementRef 绑定, rest props |
| `admin/AdminNavList.svelte` | SidebarGroup/SidebarItem | 统一渲染 ADMIN_NAV_ITEMS, icon 映射和 active route |

Card header/content/footer 文件继续作为纯布局组合 helper. 它们不重复 Flowbite 交互合同, 只有生产调用方需要时才增加状态或 Flowbite 导入.

## 4. 页面迁移

### 4.1 表单

`submit.astro`, `AdminEventForm.astro`, `admin/login.astro`, `FilterBar.svelte`, `TagInput.svelte`, `EventActions.svelte` 和 `admin/events/new.astro` 将可见字段和操作迁移到适配器.

`admin/events/new.astro` 在 `82ab586` 新增 `importErrorDetails`. Alert 迁移必须保留主错误, 详情, cause 信息和手动录入提示的层级.

- Label 继续通过 `for` + `id` 明确关联.
- 现有必填标记继续可见, 并与原生 required 校验分离.
- Textarea 初始值按 Flowbite Textarea 合同改为 `value` props.
- Hidden input 和 datalist 保留原生实现.
- Astro SSR 后, 普通 DOM 脚本依赖的 id 和 data 属性保持不变.

### 4.2 批量导入

`BulkEventImport.svelte` 使用 Fileupload 选择 CSV, 使用 Checkbox 确认 warning, 使用 Button 承载命令, 使用 Alert 展示校验摘要, 并使用现有 Table 适配器渲染预览行.

当前状态机和文件重新上传合同保持不变. Table 在当前 overflow 容器中继续保持单个语义 table.

### 4.3 公开浏览和首页

- 分类页面使用 Flowbite Listgroup/ListgroupItem 输出分类链接.
- 公开活动分页使用 Flowbite PaginationItem, 直接输出上一页和下一页的真实 href, 不引入总页数或客户端分页状态.
- 重置操作, 详情 CTA, 404 操作和投稿成功操作使用 Button 适配器并保留真实 href.
- `PublicMobileNav.svelte` 在现有 Flowbite Drawer 中使用 Listgroup/ListgroupItem 渲染导航链接. 公开桌面三列导航保持现有结构.
- EventCard 的 card/featured 变体使用 Flowbite Card, 保留根链接, article 内容结构, 图片比例, badge 和事件元数据. row/compact 变体保持现有专用布局.
- 有视觉容器的 warning/error 消息使用 Alert 适配器.
- 首页 trend 和移动场景控件使用 ButtonGroup + Button. Trend 控件继续输出带 role=tab 的 anchor, 并保留当前键盘行为.
- 轮播继续使用 Flowbite Controls/Indicators, 只替换其中的自制按钮.

### 4.4 管理导航

`AdminNavList.svelte` 在桌面 AdminLayout 中无 client directive 服务端渲染, 在移动端作为现有 hydrated Drawer 的一部分渲染. 它接收 `currentPath` 和 density/context variant, 复用 `isAdminNavItemActive()` 并只映射一次 icon.

桌面外层 aside 保留原生实现, 因为它负责 sticky 布局和 identity/footer 区域, 不负责导航项行为. 移动 overlay 继续使用现有 Flowbite Drawer 适配器.

管理端分页使用 Flowbite PaginationItem 输出上一页和下一页链接. 该原语接受真实 href, 不要求总页数, 因此兼容当前 page/hasNext 合同和 Astro SSR.

## 5. 保留的原生边界

- 不替换公开桌面 Navbar. Flowbite Navbar 拥有自己的响应式容器和菜单状态, 会破坏当前平衡三列 capsule. 移动端继续保留 Drawer, 但 Drawer 内的导航列表改用 Listgroup/ListgroupItem.
- 投稿 `<details>` 不改为 Accordion, 因为必须保留无 JS 展开能力和原生表单校验.
- EventCard 的 row/compact 变体, EventRow 和 media stage 不改为 Card, 因为它们的横向/紧凑 article/link/media 结构属于专用业务信息架构.
- 管理端和公开端分页不使用 PaginationNav 容器, 因为后端只返回 `hasNext` 而不是总页数. 两端改用独立 PaginationItem, 以保留 SSR 真实链接和无 hydration 导航.
- 行内 status 文本和帮助文案保留原生实现, 除非它们属于有视觉容器的 Alert.

## 6. 兼容性和测试

- 适配器更新后立即运行 TypeScript 和 build, 捕获 Flowbite 泛型 props 和 Astro SSR 问题.
- 增加聚焦的源文件回归测试, 断言核心适配器导入对应 Flowbite 组件, 高价值页面使用适配器而不是旧的长控件 class. 测试允许已记录的原生例外.
- 保留现有首页源文件合同测试. 标记变化时, 只允许在继续断言真实链接, tab, cache 和无 JS 合同的前提下更新表达.
- 保留管理导航 active 测试, 并按需要覆盖共享渲染来源.

## 7. 浏览器验证

使用 `astro dev --background` 启动, 然后通过 in-app Browser 检查约 390x844, 768x1024 和 1440x1000.

必测流程:

- 首页 trend tab, 移动场景按钮和轮播控件.
- 活动筛选, 分页和 empty/error 状态.
- 投稿原生校验, optional details, pending 按钮和 Turnstile 失败状态.
- 管理登录表单.
- 可访问管理页面中的导航, 创建/编辑字段, 批量文件选择, warning checkbox, 预览表格和命令状态.
- Drawer 和 Modal 的 Escape, 外部关闭和焦点恢复.

不新增 Playwright. 如果 admin access 阻止路由, 验证公开端/登录页面, 并且只使用项目已有且已批准的本地 preview 机制检查受保护标记.

## 8. 风险和回滚

| 风险 | 缓解 |
| --- | --- |
| Flowbite 默认 class 覆盖语义 token | 适配器默认 class 通过项目 `cn()` 合并, 并在 light/dark 浏览器状态验证 |
| Rest prop 类型改变 Astro/Svelte 编译 | 先迁移适配器, 在修改调用方之前运行 `tsc` 和 build |
| Flowbite bindable value 改变表单序列化 | 在 DOM 中断言字段名/值, 并运行现有 form/API 测试 |
| Button anchor wrapper 改变 event currentTarget | 保持 Flowbite Button anchor tag, 验证 HomepageIntentFeed click guard |
| Fileupload wrapper 改变布局或文件 reset | 暴露 elementRef, 实测 reset/preview 流程 |
| 共享管理导航改变 active route | 复用 `isAdminNavItemActive()` 并运行管理导航测试 |
| PaginationItem 或 Card 改变根元素/链接语义 | 检查 SSR DOM, href, article 层级和无 JS 导航 |
| 大范围视觉漂移 | 保留现有 utility override, 比较 3 个视口, 按迁移批次回滚 |

回滚顺序为 adapters -> forms -> bulk/admin navigation/pagination -> public navigation/cards/pagination -> homepage. 每个批次必须编译通过后才能进入下一个批次.
