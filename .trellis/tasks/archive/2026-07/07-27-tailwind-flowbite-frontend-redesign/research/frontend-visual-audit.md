# 前端视觉审计

## 审计范围

- 配置与依赖：`package.json`、`astro.config.mjs`、`src/styles/app.css`、`src/styles/tokens.css`。
- 共享外壳：`src/layouts/Layout.astro`、`src/layouts/AdminLayout.astro`。
- 公开页面：`src/pages/index.astro`、`src/pages/events/**`、`src/pages/submit.astro`。
- 管理页面：`src/pages/admin/**`、`src/components/admin/**`。
- 组件边界：`src/components/ui/**`、筛选、地区选择、活动卡片和媒体组件。

## 当前基础

- Flowbite 迁移已完成，Button、Badge、Table、Drawer、Modal 和 Select 通过本地适配层或共享业务组件使用。
- `app.css` 已加载 Tailwind v4、`flowbite/plugin`、Flowbite Svelte/Icons 源码路径和系统媒体暗色 variant。
- `EventArtwork.astro` 已有稳定 16:9 本地 WebP fallback，并能在远程封面失败时保留可见媒体。
- 表单、查询参数、后台动作、焦点恢复和移动单表格结构已经在前端规范中形成明确契约。

## 主要视觉问题

1. `src/styles/tokens.css:4` 仍以 `Inter` 为第一字体，且公开与后台没有更具识别度的数字/标题层级。
2. `src/layouts/Layout.astro:52` 使用贴顶、通栏、通用边框导航；品牌仅表现为小号文字，首屏识别度不足。
3. 当前主要靠 `border-border`、白色 surface 和 `rounded-md` 分隔层级，页面视觉节奏平，缺少克制的内高光、色面与媒体层次。
4. 多数交互只使用默认 `transition-colors`；只有少量卡片图片具有 `duration-300`，不存在统一自定义缓动或滚动进入策略。
5. `src/pages/index.astro:289` 的日期组在宽屏使用三等分网格，首页首屏与后续内容之间缺少明确的视觉主次。
6. 公开页面已有真实活动媒体能力，但现有首屏并未把媒体作为第一视口的主要品牌信号。
7. 管理后台的信息架构合理，但导航、表格、错误和空状态仍使用相似的边框卡片表达，状态辨识可进一步强化。

## 保留项

- 公开站点的“附近 + 热门”单页结构、最多显示数量和精确目录链接。
- 活动目录的常用筛选 + 高级侧栏、活动详情的信息顺序、投稿单原生表单。
- 后台桌面固定侧栏、移动抽屉、单语义表格任务卡、共享创建/编辑表单和动作状态流。
- 系统偏好亮暗模式、语义 token、Flowbite Svelte Icons 和本地 `ui/` 适配层。

## 质量基线

- `corepack pnpm test`：14/14 通过。
- `corepack pnpm build`：通过。
- `corepack pnpm exec tsc --noEmit`：通过。
- 本地预览：`astro dev --background` 在此次环境中启动后立即退出，`astro dev status` 未发现运行实例；实施阶段需重新诊断并记录日志。

## 设计结论

- 公开站点采用 Soft Structuralism 与非对称内容构图，以冷中性基底、石墨文字、单一信号色和活动封面色彩建立品牌感。
- 管理后台采用同令牌、低装饰、高密度模式；不复制公开站点的大留白、英雄区或叠层卡片。
- 本次保留一个集成任务而不拆父子任务：共享 token、布局外壳、响应式和状态验收跨越公开与后台，分离实施会造成临时双设计系统与重复回归验证。实施清单仍按“基础 -> 公开 -> 后台 -> 集成验收”设置独立回滚点。

