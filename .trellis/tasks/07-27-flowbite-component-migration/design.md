# Design：组件库迁移至 Flowbite

## 1. 技术决策

| 关注点 | 当前 | 目标 | 决策 |
| --- | --- | --- | --- |
| 框架 | Astro 7 + Svelte 5 | 不变 | 保留 Astro 页面与现有 Svelte islands 边界 |
| 交互原语 | Bits UI Select/Dialog/AlertDialog | Flowbite Svelte Select/Drawer/Modal | 通过本地薄适配器保持业务层 API 稳定 |
| 图标 | Lucide Astro + Svelte | Flowbite Svelte Icons | Astro 与 Svelte 文件统一使用同一导出包 |
| 样式 | Tailwind 4 +语义 token | Tailwind 4 + Flowbite 插件 +语义 token | 组件采用 Flowbite 默认视觉，页面布局继续使用现有 token |
| 暗色模式 | `prefers-color-scheme` | 不变 | 把 Tailwind `dark` variant 绑定到系统媒体查询，不增加 `.dark` 状态 |
| Flowbite JS | 无 | 无 | 交互由 Flowbite Svelte 管理，不调用 `initFlowbite()` 或数据属性运行时 |

官方快速入门要求同时安装顶层 `flowbite` 和 `flowbite-svelte`。顶层 `flowbite@4.0.2` 供 Tailwind 插件在构建期解析；`flowbite-svelte@1.33.1` 自身锁定的 `flowbite@3.1.2` 由 pnpm 隔离为包内部依赖。源码不导入 Flowbite DOM 运行时，因此不会在客户端初始化两套交互系统。

## 2. 分层与依赖方向

```text
Astro pages / business components
                  |
                  v
src/components/ui/* compatibility adapters
                  |
                  v
flowbite-svelte + flowbite-svelte-icons
                  |
                  v
Tailwind v4 + flowbite/plugin + existing semantic tokens
```

- 业务组件继续依赖本地 `ui/` 路径，避免 Flowbite 的 prop 细节散落到页面。
- 只有图标直接从 `flowbite-svelte-icons` 导入；图标无业务状态，不需要再包一层。
- `SelectField.svelte` 仍是行政区、筛选和标签归并的共享业务字段适配器。
- 不把 Astro 页面无条件改成客户端 island；Flowbite Svelte 组件可在 Astro 中服务端渲染，只有包含交互状态的现有 `.svelte` 组件沿用客户端指令。

## 3. Tailwind 与主题接入

`src/styles/app.css` 保留现有 token import 和 `@theme inline`，新增：

```css
@import "tailwindcss";
@import "./tokens.css";
@plugin "flowbite/plugin";
@custom-variant dark (@media (prefers-color-scheme: dark));
@source "../../node_modules/flowbite-svelte/dist";
@source "../../node_modules/flowbite-svelte-icons/dist";
```

实现时先以 Tailwind 编译和生产构建验证 `@custom-variant` 的媒体查询语法。若当前 Tailwind 版本拒绝该形式，回到规划调整为等价的系统偏好方案；不得静默改成手动主题状态。

`astro.config.mjs` 继续使用 `@tailwindcss/vite`，删除 `optimizeDeps.exclude: ["@lucide/astro"]`。Flowbite Svelte 处理自身交互，不在布局中加载 `flowbite` JavaScript。

## 4. 适配器设计

| 本地组件 | Flowbite 实现 | 保留合同与注意点 |
| --- | --- | --- |
| `SelectField.svelte` | `Select` | 把 `{ label }` option 映射成 Flowbite 的 `{ name }`；使用原生 `name`、`required`、`disabled`、`bind:value` 和 `onchange`，继续回调字符串值 |
| `ui/side-panel.svelte` | `Button` + `Drawer` + `Drawerhead` | 本地维护 `open`；右侧 placement；保留 trigger/body/footer snippets、标题说明、外部点击与 Escape 关闭 |
| `ui/confirm-dialog.svelte` | `Button` + `Modal` + `Spinner` | 设置 `role="alertdialog"`；pending 或 confirmDisabled 时禁止重复提交；`onconfirm()` 返回 true 才关闭 |
| `ui/button.svelte` | `Button` | 把 default/outline/ghost/destructive/tonal 映射到 Flowbite color/outline；保留 href、type、name、value、disabled、ariaLabel、onclick |
| `ui/badge.svelte` | `Badge` | tone 映射为 Flowbite color/border；保留 href 与 class，使用小尺寸非 pill 外观 |
| `ui/table*.svelte` | `Table`、`TableHead`、`TableBody`、`TableBodyRow`、`TableBodyCell`、`TableHeadCell` | `TableHead` 使用 `defaultRow={false}` 以避免嵌套 `<tr>`；`dataLabel` 映射到 `data-label`；保留移动端单表格任务卡 CSS 与语义 |

未被生产源码引用的 card/input/label/textarea/separator 原语不属于旧库依赖链，本次不迁移或删除。

## 5. 图标映射

同一语义在多个文件中复用同一 Flowbite 导出。没有一一对应图标时选最接近的 Flowbite 官方图标，不新增 SVG。

| Lucide 名称 | Flowbite 导出 |
| --- | --- |
| `arrow-left` | `ArrowLeftOutline` |
| `arrow-right` | `ArrowRightOutline` |
| `arrow-up-right`, `external-link` | `ArrowUpRightFromSquareOutline` |
| `calendar-clock`, `calendar-days` | `CalendarMonthOutline` |
| `check` | `CheckOutline` |
| `check-circle-2`, `circle-check` | `CheckCircleOutline` |
| `chevron-down/left/right/up` | `ChevronDown/Left/Right/UpOutline` |
| `circle-off` | `CloseCircleOutline` |
| `compass` | `GlobeOutline` |
| `download`, `upload` | `DownloadOutline`, `UploadOutline` |
| `file-spreadsheet` | `FileCsvOutline` |
| `filter` | `FilterOutline` |
| `flame` | `FireOutline` |
| `git-fork`, `git-merge` | `CodeForkOutline`, `CodeMergeOutline` |
| `inbox` | `InboxOutline` |
| `loader-circle` | `Spinner` from `flowbite-svelte` |
| `lock-keyhole` | `LockOutline` |
| `map-pin`, `map-pinned` | `MapPinOutline`, `MapPinAltOutline` |
| `menu` | `BarsOutline` |
| `pencil` | `EditOutline` |
| `plus` | `PlusOutline` |
| `rotate-ccw` | `RefreshOutline` |
| `save` | `FloppyDiskOutline` |
| `send` | `PaperPlaneOutline` |
| `shield-check` | `ShieldCheckOutline` |
| `sliders-horizontal` | `AdjustmentsHorizontalOutline` |
| `store` | `StoreOutline` |
| `tags` | `TagOutline` |
| `ticket` | `TicketOutline` |
| `triangle-alert` | `ExclamationCircleOutline` |
| `x` | `CloseOutline` |

图标默认继承 `currentColor`。现有 `class="size-*"` 可继续使用；装饰性图标不提供 `ariaLabel`，由组件自动输出 `aria-hidden`，仅图标按钮继续由外层按钮提供可访问名称。

## 6. 行为合同

- `SelectField` 输出真实 `<select name="...">`，因此筛选、行政区和标签归并不再依赖 Bits UI hidden input，但服务端收到的字段名和值不变。
- Drawer 和 Modal 的 `open` 仅存在于本地组件，不进入全局状态。
- 管理操作的 `fetch`、错误信息和 pending 状态继续由现有业务组件持有；适配器只负责显示与关闭条件。
- 表格仍只有一个语义 `<table>`，移动端通过现有 `data-label` 和 CSS 呈现任务卡，不复制 DOM。
- Astro 页面数据加载、API 请求、Cloudflare Access、Turnstile、JSON-LD 和数据库查询全部保持不变。

## 7. 可访问性与响应式

- Select 使用原生控件，label 文本继续可见，并补齐 `aria-label` 或 label 关联。
- Drawer 与 Modal 使用 Flowbite 基于 `<dialog>` 的 focus trap、Escape 和 dismiss 行为；实现后检查关闭时焦点返回触发器。
- 确认 Modal 使用 `role="alertdialog"`，危险操作按钮保留 disabled、`aria-busy` 和明确文案。
- 在 390x844、768x1024、1440x1000 下检查 Drawer 宽度、Modal 高度、表格横向滚动和中文标签换行。
- 自动暗色模式下检查 Flowbite 的 `dark:` 类是否由媒体查询 variant 生效，并检查文字/背景对比度。

## 8. 迁移与回滚

迁移按“样式接入 -> 适配器 -> 图标 -> 依赖清理 -> 全站验证”顺序进行。每批完成后执行类型检查和构建；适配器 API 不变使业务层可逐批迁移。发生问题时优先回退当前批次，不改后端或数据。最终提交保持为一个可整体 `git revert` 的前端迁移提交。

## 9. 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| Flowbite `Select` 是原生 select，外观和弹层行为与 Bits UI 不完全相同 | 用户已选择 Flowbite 视觉；保留字段、禁用、必填和值回调合同，按浏览器验证键盘行为 |
| Flowbite `Table` 自动增加 wrapper 或 `TableHead` 自动增加 row | 适配器显式设置 wrapper class 和 `defaultRow={false}`，通过 DOM 与移动端检查确认单表格合同 |
| `dark:` 默认使用 class 策略 | 自定义为系统媒体查询并在亮/暗截图中验证，不引入主题状态 |
| Astro 直接服务端渲染 Svelte 图标存在打包差异 | 第一批替换一个 Astro 图标后立即构建；失败则记录并评估仅图标的 Astro 兼容适配器，不回退到 Lucide |
| 40 种图标批量替换容易漏项 | 使用源码搜索作为硬闸门，并按映射表逐文件审查 |
| ESLint 当前无法加载 | 保留 lint 尝试，使用 Prettier、TypeScript、测试和生产构建执行可运行检查，不扩大到工具链升级 |
