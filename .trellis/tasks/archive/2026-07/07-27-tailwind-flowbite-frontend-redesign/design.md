# Design：基于 Tailwind 与 Flowbite 重构前端

## 1. 设计目标与边界

本任务在现有 Astro 页面、Svelte islands、Flowbite 适配层和服务端数据合同之上重构表现层。数据查询、API、表单字段、路由和管理状态机不进入重构边界。

```text
Astro pages / Svelte business islands
                  |
                  v
Shared layouts + business components
                  |
                  v
src/components/ui/* Flowbite adapters
                  |
                  v
Tailwind v4 semantic tokens + Flowbite plugin
```

- 页面负责信息架构与响应式构图。
- 业务组件负责现有数据和交互状态。
- `ui/` 适配层负责 Flowbite 的变体、焦点、覆盖层和项目令牌映射。
- `tokens.css` 与 `app.css` 是视觉令牌、基础状态和减少动效的唯一全局入口。

## 2. 双模式视觉方向

### 2.1 公开站点：Soft Structuralism + Editorial Split

- 冷白/银灰背景、石墨前景和单一 raspberry signal 色组成基础；活动封面提供内容色彩，避免一色到底。
- 首页使用左侧品牌/地区/行动信息与右侧真实主推荐媒体的非对称首屏；在窄屏改为媒体优先的单列叠放。
- 重要媒体与主推荐使用克制的双层边缘结构：外层色面/内高光 + 内层媒体，不超过项目 8px 卡片圆角上限。
- 公开导航改为脱离页面边缘的固定/粘性 island。桌面显示主要入口，移动端使用 Flowbite Drawer 或等价本地适配器呈现菜单；模糊仅用于该固定层。
- 主要 CTA 使用文本 + 圆形内嵌尾部图标；普通行操作保持紧凑文字链接，避免所有控件都变成胶囊按钮。
- 首页各内容段在大屏使用 `py-20`/`py-24` 级节奏，目录、详情和投稿页根据扫描需求采用更紧凑间距。

### 2.2 管理后台：Operational Workbench

- 保留桌面侧栏与移动顶部栏，使用更紧凑的 spacing、tabular figures、稳定列宽和高对比状态语义。
- 导航激活态、队列状态、危险动作和错误信息通过色面、左侧信号线或图标区分，减少重复外框。
- 表格、表单、抽屉和模态继续使用 Flowbite 适配器；不使用英雄区、装饰性图片、叠层卡片或大面积滚动动画。
- 桌面与移动继续共享单个 `<table>` 和同一组 `EventActions`，只改变响应式样式。

## 3. 字体、颜色与令牌

### 3.1 字体

- 添加自托管 `@fontsource-variable/geist`，拉丁、数字和可覆盖字符使用 Geist Variable；中文回退为 `Noto Sans SC`、`PingFang SC`、`Microsoft YaHei` 和系统无衬线。
- 移除 `Inter`。数据列使用现有 mono stack 或 `tabular-nums`。
- 不按 viewport 连续缩放字号；使用 Tailwind 固定字号和断点切换，letter-spacing 保持 `0`。

### 3.2 色彩

- 亮色：cool-white background、white surface、graphite foreground、neutral grey muted、raspberry primary。
- 暗色：near-black charcoal background、raised graphite surface、soft-white foreground、lighter raspberry primary。
- `accent`/`link` 归一到同一品牌色族；warning、danger、success 仅作为功能语义色，不作为装饰色。
- 阴影带背景冷灰色调，避免纯黑硬阴影；重复列表优先使用色面和间距而不是每项阴影。

### 3.3 形状与动效

- 重复卡片最大 `rounded-md`；内层元素使用更小半径，CTA 可使用 `rounded-full`。
- 统一 motion token：fast 160ms、standard 360ms、reveal 760ms，全部使用 `cubic-bezier(0.32,0.72,0,1)` 或更短的同族缓动。
- 全局 focus ring 保持 3px 可见外圈，并在亮暗模式达到清晰对比。

## 4. 公共外壳与动效

### 4.1 导航

- `Layout.astro` 增加跳至主内容链接，并为 `<main>` 提供稳定 id。
- 桌面 island 包含品牌、首页/活动/投稿和当前路由状态；移动端由图标按钮打开 Flowbite Drawer，关闭后按现有适配器合同恢复焦点。
- 固定导航使用稳定宽度约束，不因当前页标签或图标变化改变尺寸。
- 页脚保持简洁，只保留产品身份、GitHub 和已有真实链接；不生成无目标 `#` 或虚构法律链接。

### 4.2 Reveal

- `Layout.astro` 中加入一个小型渐进增强脚本。脚本先给文档标记 reveal-ready，再通过 `IntersectionObserver` 观察 `[data-reveal]`。
- 未执行脚本、Observer 不可用或减少动效时，元素默认可见。
- 动画只变更 `opacity` 与 `transform`；观察到后立即 unobserve，避免持续成本。

## 5. 页面结构

### 5.1 首页

- 首屏由地区/标题/主 CTA 与主推荐媒体组成；主推荐存在时直接链接详情，无活动时使用本地 fallback 位图和明确空状态。
- 首屏高度使用内容驱动的 `min-height`/`max-height` 约束，不使用 `100vh`，并确保后续“附近活动”标题在常见视口可见。
- 附近活动保留一项主推荐、正在进行和最近日期组，但日期组改为非等分的连续栏目或两列错位布局。
- 热门活动保留 `3 / 7 / 30` segmented control 与本地/全国两列；窄屏转为垂直流。

### 5.2 活动目录与详情

- 目录顶部强调当前筛选与结果，不设置营销英雄区；常用筛选常显，高级条件留在 side-panel。
- 活动行保持稳定媒体轨道、日期/地区列和标题层级；hover 只做轻微内移/色彩/图标运动，不改变行高。
- 详情页使用宽幅稳定比例媒体作为第一信号，下方为日期/地区/场地 facts、说明与操作 rail；外链 CTA 使用嵌套图标结构。

### 5.3 投稿与 404

- 投稿表单按必填信息组分段，可选字段留在原生 `<details>`；错误结果在表单内聚焦显示，pending 不改变按钮尺寸。
- 404 页面复用公开外壳和本地活动 fallback 位图，提供回首页与活动目录的真实路径。

## 6. 管理页面结构

- `AdminLayout.astro` 统一侧栏、移动导航、页面标题和管理员身份样式；active route 逻辑不变。
- 队列表格强化 sticky header（仅在不会遮挡移动布局时）、数字对齐、状态色面、空状态和错误状态。
- 创建/编辑/批量导入/标签管理复用现有字段和 Flowbite 控件；分组标题、帮助文字和 action bar 对齐。
- Modal/Drawer blur 限定在覆盖层；表格和滚动容器不得使用 backdrop blur。

## 7. 兼容合同

- 不修改公开筛选字段、投稿字段、管理员字段、API 地址、请求 method 或成功 redirect。
- `SelectField.svelte` 保持真实 `<select>` 语义和现有 props。
- `side-panel.svelte`、`confirm-dialog.svelte` 继续遵循前端规范中的 Flowbite `<dialog>` 延迟焦点恢复合同。
- 活动封面继续经 `EventArtwork.astro` 输出稳定尺寸、本地 fallback 与远程失败回退。
- JSON-LD 中已知日期/时间和页面 meta 行为不因视觉重构改变。

## 8. 响应式与可访问性

- 目标视口为约 390x844、768x1024、1440x1000；所有固定格式控件使用 grid tracks、aspect-ratio、min/max 或稳定高度。
- 768px 以下取消公开页面的负 margin、叠层和多列跨度，转为 `w-full` 单列；触控按钮最小高度约 40px。
- 所有 dialog、drawer、details、select、form 与 table 保留语义和键盘行为。
- 自动亮暗模式各自检查正文 4.5:1、焦点可见、媒体替代文本和中文长文本换行。

## 9. 验证与回滚

- 每个阶段执行 TypeScript 和生产构建；共享令牌、公开页面和后台页面分别形成回滚点。
- 使用项目规定的 `astro dev --background` 启动本地预览。先诊断当前启动即退出问题；不得通过弱化 Access 或读取真实凭据绕过管理页面。
- 通过 in-app Browser 在三类视口检查 DOM、截图、overflow、固定层、交互状态和 console error；不新增 Playwright 依赖。
- 完成测试、构建、Prettier、lint 尝试、`git diff --check` 和禁止模式搜索后，再进行最终视觉审计。

## 10. 关键权衡

- 高端设计技能建议所有大卡片采用夸张圆角和大留白；项目的活动浏览与后台工具规范要求卡片不超过 8px 且保持信息密度。本设计保留双层边缘、媒体层次、自定义动效和非对称构图，但把夸张圆角与大留白限定为不损害扫描效率的公开区段。
- 不拆成父子任务。共享 token、外壳和跨页面验收高度耦合，拆分会让仓库暂时同时存在两套视觉规则。实施计划用阶段与回滚点控制风险。

