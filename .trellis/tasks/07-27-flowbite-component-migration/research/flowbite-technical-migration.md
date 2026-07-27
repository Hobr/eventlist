# Flowbite 技术迁移研究

## 结论

- 当前版本组合满足 peer 约束：项目的 Svelte `5.56.8` 高于 `flowbite-svelte@1.33.1` 要求的 `^5.40.0`，Tailwind `4.3.3` 高于其要求的 `^4.1.4`。证据见 `node_modules/flowbite-svelte/package.json`。
- Flowbite Svelte 官方 quickstart 要求顶层安装 `flowbite-svelte` 与 `flowbite`，图标包可选；项目已暂存的三项依赖与官方方式一致。顶层 `flowbite@4.0.2` 供 Tailwind 插件解析，`flowbite-svelte` 内部的 `flowbite@3.1.2` 由 pnpm 隔离，不代表需要初始化两套客户端运行时。
- Flowbite Svelte 的交互由 Svelte 管理。项目不应导入 `flowbite` JavaScript、调用 `initFlowbite()` 或添加 data-attribute DOM runtime。
- Flowbite Svelte Icons 仅包含 Svelte 5 组件，但 Astro 已配置 `@astrojs/svelte`，可在 `.astro` frontmatter 中导入并服务端渲染；实施时用首个 Astro 图标替换后的生产构建作为兼容性闸门。

## Tailwind CSS 4 接入

官方 quickstart：<https://raw.githubusercontent.com/themesberg/flowbite-svelte/main/src/routes/docs/pages/quickstart.md>。

`src/styles/app.css` 位于 `src/styles/`，因此相对扫描路径应为：

```css
@import "tailwindcss";
@import "./tokens.css";
@plugin "flowbite/plugin";
@custom-variant dark (@media (prefers-color-scheme: dark));
@source "../../node_modules/flowbite-svelte/dist";
@source "../../node_modules/flowbite-svelte-icons/dist";
```

官方示例默认使用 `.dark` selector；本项目规范要求 `prefers-color-scheme` 自动暗色，因此把同一个 `dark` variant 绑定到媒体查询，并通过 Tailwind 编译、亮暗页面渲染验证语法和效果。

## 组件 API 核验

证据来自 `node_modules/flowbite-svelte/dist/types.d.ts` 与对应 `*.svelte` 源码。

- `Select` 渲染原生 `<select>`，支持 `items`、`bind:value` 和所有原生 select attributes。`items` 文本键为 `name`，因此 `SelectField` 需把 `{ value, label, disabled }` 映射成 `{ value, name: label, disabled }`。
- `Drawer` 基于 Flowbite `Dialog`，支持 `bind:open`、`placement="right"`、`modal`、`dismissable`、`outsideclose`。`Drawerhead` 是关闭头控件，不包含业务标题与说明，适配器仍需渲染自己的标题区。
- `Modal` 支持 `bind:open`、title/header/footer snippets、dismissable 和原生 dialog attributes。确认适配器可传 `role="alertdialog"`，并继续由业务回调决定何时关闭。
- `Button` 支持 anchor/button 两种输出、href、disabled、loading、color、outline、size 和原生 attributes；本地 wrapper 可保持现有 variant/size 合同。
- `Badge` 原生支持 href、color、border、rounded 与 class，本地 tone 可直接映射。
- `Table` 会额外输出一个 div wrapper；`TableHead` 默认把 children 包在一个 `<tr>`。本地适配器应为 wrapper 使用不改变布局的 class，并设置 `defaultRow={false}`，否则当前显式 `TableRow` 会产生嵌套 row。

## 图标与无障碍

精确导出以 `node_modules/flowbite-svelte-icons/dist/index.d.ts` 为准。40 种 Lucide 用途的完整映射记录在任务 `design.md`。主要非一一对应项：

- `calendar-clock` / `calendar-days` -> `CalendarMonthOutline`
- `compass` -> `GlobeOutline`
- `file-spreadsheet` -> `FileCsvOutline`
- `loader-circle` -> Flowbite Svelte `Spinner`
- `triangle-alert` -> `ExclamationCircleOutline`
- `save` -> `FloppyDiskOutline`

图标组件默认继承 `currentColor`，无 `ariaLabel` 时自动使用 `aria-hidden`。仅图标按钮的可访问名称继续由外层按钮提供，装饰图标不重复朗读。

## 风险与验证

- Astro 对包的 `svelte` condition 解析若有差异，会在首个 `.astro` 图标替换后的 `astro build` 暴露；不得等到 24 个文件全部替换后才验证。
- Flowbite 原生 Select 与 Bits UI popover 外观和 DOM 不同，但原生 name/required/disabled/keyboard 合同更直接；必须验证行政区联动与 GET 表单参数。
- Drawer/Modal 必须验证 Escape、外部关闭、关闭后焦点返回、滚动锁和窄屏尺寸。
- Table 必须验证桌面列、移动任务卡、`data-label` 与单一语义 `<table>`。
- 硬闸门：`rg -n 'bits-ui|@lucide/(astro|svelte)' src package.json astro.config.mjs` 无结果。
- 可执行质量闸门：测试、TypeScript、Prettier、生产构建；完整 lint 仍执行，但当前存在已记录的 TypeScript 7 / typescript-eslint 配置加载阻断。
