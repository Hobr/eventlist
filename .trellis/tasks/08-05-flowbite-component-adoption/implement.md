# 实施: 前端 Flowbite 组件覆盖改造

## 0. 基线

- [x] 用户批准后, 确认当前任务为 `.trellis/tasks/08-05-flowbite-component-adoption`, 状态为 `in_progress`.
- [x] 阅读 `.trellis/spec/frontend/index.md`, `.trellis/spec/frontend/design-system.md`, `.trellis/spec/guides/code-reuse-thinking-guide.md` 和 `research/flowbite-coverage-audit.md`.
- [x] 记录 `git status`, 保留无关的用户修改.
- [x] 运行基线 `corepack pnpm exec tsc --noEmit`, `corepack pnpm test` 和 `corepack pnpm build`.

## 1. 共享适配器

- [x] 更新 `ui/button.svelte`, 保留当前 variant, 同时透传有类型的 Flowbite Button 原生属性.
- [x] 将 `ui/input.svelte`, `ui/textarea.svelte`, `ui/label.svelte`, `ui/card.svelte` 和 `ui/separator.svelte` 迁移到 Flowbite 基础组件, 并覆盖项目 token.
- [x] 新增 `ui/alert.svelte`, `ui/checkbox.svelte` 和 `ui/file-upload.svelte`, 提供有类型的 props 和所需可绑定状态.
- [x] 在迁移调用方之前运行 formatter, TypeScript 和生产 build.

## 2. 表单页面

- [x] 将 `src/pages/submit.astro` 的可见控件迁移到 Label/Input/Textarea/Button/Alert, 保留 form, details, 字段名, id 和 Turnstile 脚本选择器.
- [x] 迁移 `src/components/admin/AdminEventForm.astro`, 保留 form id, data attrs, `data-save-label`, 初始值, 必填标记和 sticky action bar.
- [x] 将 `src/pages/admin/login.astro` 迁移到 Card/Label/Input/Alert/Button.
- [x] 迁移 FilterBar 可见 input, TagInput 组合控件和 EventActions 拒绝 textarea. Hidden query/tag input 保留原生实现.
- [x] 迁移 `src/pages/admin/events/new.astro` 中的 Bilibili 导入控件和重复确认.
- [x] 运行相关测试, TypeScript 和 build.

## 3. 批量导入和管理导航

- [x] 将 BulkEventImport 文件选择, 命令, warning 和 checkbox 迁移到 Flowbite 适配器.
- [x] 使用现有 Flowbite Table 适配器替换原生预览表格, 保留单个 table 和 overflow 行为.
- [x] 新增使用 SidebarGroup/SidebarItem 的 `AdminNavList.svelte`, 在桌面 AdminLayout 和移动 AdminMobileNav 中复用.
- [x] 将 `admin/Pagination.astro` 的上一页/下一页链接迁移到 Flowbite PaginationItem, 保留真实 href 和 page/hasNext 合同.
- [x] 运行 bulk/admin 测试, TypeScript 和 build.

## 4. 公开端操作, 列表和状态

- [x] 将分类, 活动, 详情, 首页和管理队列中有视觉容器的 warning/error 状态迁移到 Alert 适配器.
- [x] 将公开分页迁移到 Flowbite PaginationItem, 保留上一页/下一页的真实 href, 查询参数和无 JS 导航.
- [x] 将重置, 投稿成功, 详情和 404 操作链接迁移到带真实 href 的 Button 适配器.
- [x] 将分类 facet group 迁移到 Flowbite Listgroup/ListgroupItem.
- [x] 将 `PublicMobileNav.svelte` 的 Drawer 内导航链接迁移到 Flowbite Listgroup/ListgroupItem, 保留关闭行为, active 状态和真实 href.
- [x] 将 EventCard 的 card/featured 变体迁移到 Flowbite Card, 保留根链接, article 内容, 图片比例, badge 和元数据.
- [x] 普通文本链接, EventCard 的 row/compact 变体, EventRow, 公开桌面三列 Navbar 和原生 details 保持不变.
- [x] 运行公开路由测试, TypeScript 和 build.

## 5. 首页控件

- [x] 使用 Flowbite ButtonGroup + Button 适配器替换 HomepageIntentFeed trend 和移动场景控件.
- [x] 保留真实 trend href, role=tab, aria-selected, aria-busy, roving tabindex 和键盘导航.
- [x] 使用 Button 适配器替换 3 个自制轮播按钮, 保留 title, aria-label, aria-pressed 和回调.
- [x] 运行首页源文件合同测试, TypeScript 和 build.

## 6. 覆盖闸门

- [x] 增加聚焦的前端 Flowbite 覆盖测试, 检查适配器导入和高价值迁移页面, 同时记录允许的原生例外.
- [x] 搜索生产源码中剩余的原生可见 button/input/textarea/table/alert 模式, 将每个结果分类为已迁移或已批准的原生实现.
- [x] 确认未新增 `initFlowbite()`, DOM data runtime, 第二套 UI 库, 手写 SVG 或旧组件库导入.
- [x] 确认字段名, 查询参数, endpoint, redirect 和 route active 规则没有变化.
- [x] 确认两端 PaginationItem 和 EventCard card/featured 在 SSR DOM 中保留真实 href, 且公开移动导航仍在 Drawer 关闭时正确恢复焦点.

## 7. 质量检查

- [x] `corepack pnpm format`
- [x] `corepack pnpm lint`
- [x] `corepack pnpm exec tsc --noEmit`
- [x] `corepack pnpm test`
- [x] `corepack pnpm build`
- [x] `git diff --check`
- [x] 检查 diff 中是否存在 backend, API, database, dependency 或无关 metadata 变化.

## 8. 浏览器验证

- [x] 使用 `astro dev --background` 启动并记录本地 URL.
- [ ] 使用 in-app Browser 检查约 390x844, 768x1024 和 1440x1000. 当前 browser runtime 缺少初始化所需的 `env` 能力.
- [ ] 验证首页控件, 活动筛选/分页, 投稿 form/details/status, 404 和管理登录. 已完成 HTTP/SSR 合同验证, 未完成视口交互验证.
- [ ] 环境允许时, 验证可访问管理路由中的导航, 创建/编辑表单, 批量 file/reset/checkbox/table 和 action 状态. 当前没有可用的 in-app Browser 会话.
- [ ] 断言不存在水平溢出, 文本裁切, 控件重叠, 焦点丢失或控制台错误. 当前无法生成浏览器截图或读取客户端控制台.
- [x] 验证完成后使用 `astro dev stop` 停止后台服务.

## 9. 规范和收尾

- [x] 更新 `.trellis/spec/frontend/design-system.md`, 记录扩展后的适配器清单, 原生属性透传规则, 直接结构组件边界和批准的原生例外.
- [x] 运行 Trellis check 并解决已验证的问题.
- [x] 提交实现, 并通过 Trellis finish workflow 归档任务.

## 回滚点

- 适配器编译失败: 只回滚共享适配器批次.
- 表单回归: 保留适配器, 回滚受影响的表单页面.
- 批量导入/管理导航回归: 回滚对应调用方, 不修改 API 或 database 代码.
- 分页/公开导航/EventCard 回归: 分别回滚 PaginationItem, Listgroup 或 Card 调用方, 保留已验证的共享适配器.
- 首页行为回归: 回滚 ButtonGroup/Button 调用方迁移, 保留共享适配器.

## 验证记录

- `corepack pnpm format`, `corepack pnpm lint`, `corepack pnpm exec tsc --noEmit`, `corepack pnpm test`, `corepack pnpm build` 和 `git diff --check` 通过.
- 完整测试为 168/168 通过, 其中 Flowbite 覆盖合同为 6/6 通过.
- Astro dev 验证 `/`, `/submit`, `/events`, `/categories` 和 `/admin/login` 返回 200, `/404` 返回预期 404.
- SSR 保留真实分页/分类/CTA href, 投稿 form/details/字段名和按钮 id. 生产 CSS 已确认语义 dark token 生成 `!important` 声明.
- Vite 首次依赖优化期间出现 4 次 `lifecycle_outside_component`, 优化完成后两轮顺序路由验证前后计数均为 4, 未继续新增. 生产构建不受影响.
- in-app Browser 初始化失败, 错误为 `Cannot read properties of undefined (reading 'BROWSER_USE_SECURITY_MODE')`. 按项目约束未改用独立 Playwright.
