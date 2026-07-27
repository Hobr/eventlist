# Implement：基于 Tailwind 与 Flowbite 重构前端

## 0. 前置与基线

- [x] 确认当前任务仍为 `.trellis/tasks/07-27-tailwind-flowbite-frontend-redesign` 且在批准前保持 `planning`。
- [x] 阅读 `.trellis/spec/frontend/index.md`、`design-system.md` 与 `research/frontend-visual-audit.md`。
- [x] 检查 `git status`，保留用户修改；重新运行测试、TypeScript 和构建基线。
- [x] 诊断 `astro dev --background` 启动即退出，记录 URL 或可复现环境阻断，不改鉴权或业务逻辑绕过问题。

## 1. 共享视觉基础

- [x] 安装并接入自托管 Geist variable font，更新 `tokens.css` 的字体、冷中性色、单一品牌色、功能色、阴影和 motion tokens。
- [x] 更新 `app.css` 的 Tailwind token 桥接、focus、selection、数字、减少动效和 reveal 基础状态；保留 Flowbite plugin/source 与系统暗色 variant。
- [x] 审查 Button、Badge、Card、Input、Textarea、Table、SidePanel、ConfirmDialog 和 SelectField 的 token 覆盖，统一 cubic-bezier、active、disabled、pending 与 focus，不改变公开 props。
- [x] 运行 `corepack pnpm exec tsc --noEmit`、`corepack pnpm test` 和 `corepack pnpm build`。

## 2. 公开外壳与首页

- [x] 重构 `Layout.astro` 为品牌化 floating island 导航，增加 skip link、主内容 id、移动菜单和简洁页脚；当前路由及三个入口不变。
- [x] 实现渐进增强 IntersectionObserver reveal，确保无 JS 和减少动效时内容默认可见。
- [x] 重构首页首屏为真实主推荐媒体驱动的非对称布局，保留地区来源、CitySelector、附近/热门锚点和完整目录入口。
- [x] 重构附近日期组与热门两列，移除宽屏等分三卡模板，同时保持查询、数量上限和精确链接。
- [x] 更新 EventArtwork、EventCard 和 PopularEventList 的稳定尺寸、媒体层次、hover/active/focus 与空状态。
- [x] 在可用本地预览中检查首页亮暗、390/768/1440 视口、封面失败和无活动状态。

## 3. 公开目录、详情、投稿与 404

- [x] 重构 `/events` 顶部信息层级、FilterBar、active filters、目录行、分页、错误和空状态；查询参数合同不变。
- [x] 重构 `/events/[id]` 媒体 stage、facts、说明和 action rail；保留离线/不存在、外链、view 记录和 JSON-LD。
- [x] 重构 `/submit` 与 SubmissionSection，保持单原生表单、必填常显、可选 details、Turnstile、错误聚焦和 `/submit?sent=1`。
- [x] 新增 `src/pages/404.astro`，使用真实站内路径和本地位图，不增加虚构法律或营销内容。
- [x] 检查所有公开页面长标题、空封面、日期仅有部分时间、网络错误与 loading/disabled 状态。
- [x] 运行 TypeScript、测试、构建和公开页面浏览器检查。

## 4. 管理外壳与工作流

- [x] 重构 `AdminLayout.astro`、AdminMobileNav 和 navigation active 状态的视觉，不改变现有路由匹配。
- [x] 重构登录、待审核、已发布、已下线队列的标题、统计、表格、分页、空状态和错误状态。
- [x] 重构 EventTable 的桌面列和移动任务卡视觉，继续只输出一个语义 `<table>` 并只挂载一份 EventActions。
- [x] 重构创建/编辑共享表单、批量导入和标签管理，保持字段合同、CSV 状态机、确认规则与成功跳转。
- [x] 验证 Drawer/Modal Escape、外部关闭、pending/disabled、防重复提交和关闭后焦点恢复。
- [x] 若 Access 阻止本地后台渲染，只采用规范允许的临时 localhost preview route，并在截图后删除。

## 5. 跨页面状态与元数据

- [x] 确认每页 title、description、favicon、color-scheme 和现有 JSON-LD；仅在已有真实资产可用时补充社交图片，不生成失效 URL。
- [x] 搜索并清理死链接、可见占位文案、无目标 `#`、通用 spinner、重复错误样式和不可见 focus。
- [x] 确认 icon-only 控件有 accessible name，装饰图标 `aria-hidden`，中文文本不会挤压固定尺寸控件。

## 6. 质量与视觉验收

- [x] `corepack pnpm test`
- [x] `corepack pnpm exec tsc --noEmit`
- [x] `corepack pnpm exec prettier --check .`
- [x] `corepack pnpm build`
- [x] `corepack pnpm lint`，只允许记录设计系统已注明的 TypeScript 7 / typescript-eslint 上游加载阻断。
- [x] `git diff --check`
- [x] `rg -n 'bits-ui|@lucide/(astro|svelte)|initFlowbite|material-symbols-rounded|--md-sys-' src package.json astro.config.mjs` 无结果。
- [x] 搜索 `Inter`、`ease-in-out`、`h-screen`、紫蓝渐变、装饰性 blur/blob 和新增任意 z-index；逐项确认无禁止模式或有明确工具层理由。
- [x] 使用 in-app Browser 在约 390x844、768x1024、1440x1000 检查 `/`、`/events`、可用详情页、`/submit`、`/404`、`/admin/login` 和可访问的管理流程。
- [x] 对每个视口断言 `scrollWidth <= clientWidth`，检查固定导航、媒体尺寸、文字换行、focus、Drawer/Modal、亮暗模式、减少动效和 console errors。
- [x] 对照两个用户指定设计技能和 PRD AC1-AC9 做最终视觉审计；后台按工具密度例外处理，不强行套用公开站点构图。

## 7. 规范与收尾

- [x] 将最终可复用的字体、颜色、公开/后台双模式、motion 和组件约束同步到 `.trellis/spec/frontend/design-system.md`。
- [x] 执行 Trellis check，修复所有经源码确认的 critical/warning 问题。
- [x] 确认 diff 不包含后端、API、数据库、Cloudflare 绑定或无关依赖变化。
- [x] 提交一个可整体回滚的前端重构提交并按 Trellis 流程归档任务。

## 回滚点

- 基础层失败：回退字体与 token/app.css 批次，保留现有 Flowbite 迁移。
- 公开页面失败：保留新 token，单独回退 Layout 与公开页面批次。
- 后台效率或行为回归：保留公开重构，回退 AdminLayout 与 admin 组件批次。
- 集成验收失败：在不改后端与数据的前提下回退本任务单一提交。
