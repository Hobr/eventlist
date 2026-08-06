# Bits UI interface redesign

## Goal

在不改变现有业务能力的前提下, 将 Eventlist 的公共端和管理端从 Flowbite Svelte + Tailwind CSS v4 全面迁移到 Bits UI 驱动的 Svelte 组件系统. 新界面应具有清晰的 ACG 活动浏览层级, 高端但克制的视觉表达, 完整的键盘和屏幕阅读器可用性, 以及公共端与管理端一致的交互语言.

## User value

- 浏览者能更快发现本地活动, 理解时间, 地点, 类型, 热度和购票信息.
- 投稿者能在长表单中明确看到必填项, 错误, 上传和提交状态.
- 管理员能高效完成创建, 批量导入, 编辑, 审核, 下线, 重新发布和标签归并.
- 后续前端开发优先复用 Bits UI primitives 和项目级 UI wrappers, 避免再次绑定大型样式框架或散落的一次性 CSS.

## Confirmed facts

- 当前技术栈为 Astro 7 + Svelte 5 islands, `bits-ui@2.18.1` 已安装.
- 当前视觉层依赖 Tailwind CSS v4, Flowbite, Flowbite Svelte 和 Flowbite Svelte Icons. `astro.config.mjs`, `src/styles/app.css` 和 30 多个前端文件直接依赖这套栈.
- Bits UI 官方 `https://bits-ui.com/docs/llms.txt` 明确说明 Bits UI 是 headless component library. 大多数组件完全无样式, 只提供行为, 可访问性, 状态和组合 API.
- 用户已确认使用薄层集中式 vanilla CSS 作为 Bits UI 的视觉皮肤. 该决定允许保留 tokens, base styles 和 reusable component styles, 但禁止恢复 utility-first CSS 或散落的页面级样式系统.
- 当前共有 62 个 Astro 或 Svelte 文件包含 class-based presentation. 因此移除 Tailwind 不是依赖替换, 而是全站视觉系统迁移.
- 公共端范围包括 `/`, `/events`, `/events/[id]`, `/categories`, `/submit` 和 `/404`.
- 管理端范围包括 `/admin`, `/admin/published`, `/admin/offline`, `/admin/tags`, `/admin/events/new`, `/admin/events/bulk`, `/admin/events/[id]/edit` 和 `/admin/login`.
- 现有公共端和管理端共享布局, 表单控件, 表格, 对话框, side panel, badge, card, alert 和 button wrappers. 这些 wrappers 当前多数代理 Flowbite 组件或依赖 Tailwind utilities.
- `@fontsource-variable/geist` 已安装, 可继续作为自托管主字体. 不需要运行时拉取 webfont.
- 当前工作树中的 `.mcp.json` 和 `.vscode/*` 修改不属于本任务, 必须保留且不得覆盖.

## Requirements

### R1. Full UI stack migration

- 删除 Flowbite, Flowbite Svelte, Flowbite Svelte Icons, Tailwind CSS 和对应的 Astro/Vite, PostCSS, Prettier 配置及 source/plugin declarations.
- 删除产品代码中的 Flowbite imports 和 Tailwind utility-class dependency.
- 不引入另一个依赖 Tailwind 的组件套件作为替代层.
- 保留 Astro + Svelte 架构, Cloudflare adapter 和现有服务端数据加载方式.

### R2. Bits UI-first primitive layer

- 交互原语优先使用 Bits UI 官方 `llms.txt` 中记录的 API, 包括适用的 Dialog, AlertDialog, Select, Combobox, Popover, Tooltip, Tabs, Accordion, Checkbox, Radio Group, Switch, Slider, Progress, Pagination, Calendar, Date Field 和 Navigation Menu primitives.
- 项目级 `src/components/ui/` wrappers 负责统一语义, props, tokens, focus, portal, motion 和错误状态. 业务页面不得重复实现同类交互.
- 对 Bits UI 不覆盖的纯结构元素使用语义 HTML, 例如 `nav`, `main`, `section`, `article`, `form`, `table` 和真实链接.
- 原生控件仅在能提供更强的无 JavaScript 回退或浏览器验证时保留, 并在设计文档中列出边界.

### R3. Minimal reusable styling layer

- Bits UI 不提供视觉皮肤, 因此项目仍需要一层视觉实现. 该层必须集中, tokenized, 可复用, 且不恢复 utility-first CSS.
- 颜色, 字体, 间距, radius, shadow, focus 和 motion 由少量全局 custom properties 统一定义.
- UI wrappers 复用稳定的 semantic classes 或 scoped styles. 页面文件不得堆叠长串一次性 class names.
- 避免组件内联 style, 大量局部 CSS, 任意 z-index, 布局属性动画和滚动容器 blur.
- 所有 motion 只动画 `transform` 和 `opacity`, 使用项目级 cubic-bezier, 并尊重 `prefers-reduced-motion`.

### R4. Visual direction

- 公共端采用 editorial luxury + asymmetric layout 方向: 温暖中性色, 单一低饱和品牌强调色, 强标题层级, 大留白, 不对称事件编排和真实活动媒体.
- 避免常见 AI 模板特征: 对称三列卡片, 紫蓝渐变, 通用灰边框卡片, 顶部贴边导航, 过度 pill 化和无差别阴影.
- 主要公共内容容器可使用克制的 nested bezel 层级, 但不得让高密度列表和管理表格变成嵌套卡片.
- 管理端采用同一 token system 的 operational variant: 更紧凑的 spacing, 清晰表格, 可预测 actions, 明确 pending/error/disabled states.
- 使用 Geist Variable 和兼容中文的系统 fallback. 不使用 Inter, Roboto, Arial, Open Sans 或 Helvetica 作为首选字体.
- 图标使用轻量一致的线性图标集. 不保留 Flowbite icons, 不使用粗线 Lucide 或 Material Icons.

### R5. Preserve public behavior

- 保留首页地区切换, featured event, local/nationwide ranking, `3 / 7 / 30` 时间窗, 缓存和 loading/error/empty states.
- 保留 `/events` 的 `city`, `type`, `scale`, `tag`, `from`, `to`, `starts`, `active`, `sort` 和 `page` URL query contract.
- 保留活动详情数据, JSON-LD, 外部链接, 报名/购票/来源信息和返回浏览路径.
- 保留投稿表单的字段名, 必填标识, 原生验证, Turnstile, POST `/api/submit` 和成功跳转 `/submit?sent=1`.
- 保留 `eventlist.divisionCode` 地区偏好写入时机和现有 client island data flow.

### R6. Preserve admin behavior

- 保留管理员认证, `next` redirect 和 Access/token mode 提示.
- 保留新建, 批量 CSV preview/import, 编辑, 审核通过, 驳回理由, 下线, 重新发布和标签归并的 API contracts.
- 保留 destructive confirmation, loading, disabled, inline error, focus restoration 和 screen-reader status behavior.
- 保留没有规范标签时禁止通过或重新发布的限制.

### R7. Accessibility and responsive behavior

- 所有 interactive controls 必须有可见 focus state, 键盘操作, accessible name 和正确的 title/description relationships.
- Portal content 必须正确管理 focus, escape close, outside interaction 和 scroll locking.
- 移动端低于 768px 时取消不安全的 overlap/rotation, 使用单列或可操作的 horizontal overflow, touch targets 不得重叠.
- 不使用 `100vh`; 需要全高时使用 `100dvh` compatible min-height.
- 内容默认可见. Scroll reveal 仅做 progressive enhancement, 动态插入内容不得永久保持 hidden.

### R8. Documentation source and maintenance

- Bits UI API 和 data attributes 以开发时获取的官方 `https://bits-ui.com/docs/llms.txt` 为准.
- 更新 `.trellis/spec/frontend/design-system.md`, 移除 Flowbite + Tailwind contract, 写入 Bits UI-first 组件边界和最小 styling contract.
- 新增或重写 UI wrapper 前先检查 Bits UI 是否已有对应 primitive.

## Acceptance criteria

- [ ] AC1. `package.json`, lockfile, Astro config, style entry 和 product source 中不再包含 Flowbite 或 Tailwind runtime/build dependency.
- [ ] AC2. 全部公共端和管理端路由可构建和渲染, 不出现旧 Flowbite/Tailwind shell 或未样式化的 Bits UI content.
- [ ] AC3. 公共端所有现有 URL query, localStorage, form field, API, JSON-LD 和 navigation contracts 保持不变.
- [ ] AC4. 管理端所有 auth, create, import, edit, moderation, confirmation 和 tag merge contracts 保持不变.
- [ ] AC5. 重复交互由 Bits UI primitives + shared wrappers 实现. 页面中不存在第二套 dialog, select, popover, tooltip 或 checkbox behavior.
- [ ] AC6. 全站有一致的 light/dark system-preference presentation, visible focus, reduced-motion fallback, loading, empty, error 和 disabled states.
- [ ] AC7. 320px mobile, tablet 和 desktop 布局均无横向页面溢出, 控件重叠或不可达操作.
- [ ] AC8. `corepack pnpm build`, `corepack pnpm lint` 和现有 `corepack pnpm test` 通过.
- [ ] AC9. 使用 `astro dev --background` 启动后, 对关键公共和管理路由完成 HTTP 和浏览器视觉抽查. 不新增 Playwright.
- [ ] AC10. `.trellis/spec/frontend/design-system.md` 与最终实现一致, 不再描述 Flowbite/Tailwind 为项目 contract.

## Out of scope

- 数据库 schema, migrations, ranking algorithm, cache policy 或 API response shape 改造.
- 新增活动字段, moderation states, auth mode 或产品流程.
- 引入新前端框架, utility-first CSS framework, page builder 或 animation framework.
- 在本任务中重做内容文案策略或品牌名称.
- 修改 `.mcp.json` 或 `.vscode/*` 的现有用户改动.
