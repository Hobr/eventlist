# Turnstile 代码扫描结论

## 用户硬约束

- 复用已存在的 widget，site key 为 `0x4AAAAAAECBuh-0cHETrayP`。
- 不创建 widget，不调用 Cloudflare 管理 API。
- secret 只从后端环境变量 `TURNSTILE_SECRET` 读取，不索取、不打印、不硬编码真实值。
- 服务端向 `https://challenges.cloudflare.com/turnstile/v0/siteverify` 发起 canonical POST，提交 `secret`、`response`、`remoteip`，并只接受 `success === true`。
- 每个 `cf-turnstile` 容器都必须有 `data-action="turnstile-spin-v2"`。
- 执行 Spin 步骤 6、7、9、10；跳过账户、域名、widget 创建和持久化技能步骤。

## 框架与现有数据流

- Astro SSR + `@astrojs/cloudflare`，交互组件使用 Svelte 5。
- 公开投稿表单：`src/pages/submit.astro:72`，AJAX `POST /api/submit` 位于 `src/pages/submit.astro:339`。
- Widget 组件：`src/components/Turnstile.svelte:1`，当前显式加载 `api.js?render=explicit`。
- Token 字段：`src/components/Turnstile.svelte:73` 的 `cf-turnstile-response`。
- 表单解析：`src/lib/public/form.ts:74`，在 `:114` 读取 token。
- 服务端路由：`src/pages/api/submit.ts:12`；验证在 `:17`，D1 获取/写入在 `:26-30`，门禁顺序正确。
- 验证器：`src/lib/turnstile.ts:13`；已经使用官方 URL、`URLSearchParams`、`CF-Connecting-IP` 和 `result.success === true`，网络/非 2xx/非 JSON 失败关闭。

## 已发现缺口

- `Turnstile.svelte` 容器没有 `cf-turnstile`、`data-sitekey`、`data-action`。
- 显式 render options 没有 `action: "turnstile-spin-v2"`。
- AJAX 投稿失败后没有 reset；已兑换 token 会在重试时得到 `timeout-or-duplicate`。
- 活动代码和 README 仍使用 `TURNSTILE_SECRET_KEY`，用户要求 `TURNSTILE_SECRET`。
- `.dev.vars.example` 仍含旧变量名和公开测试 secret，不适用于给定正式 site key。
- 当前没有 Turnstile 专项测试。
- 当前会话环境未设置 `TURNSTILE_SECRET`，Spin dummy-token 验证需要用户稍后提供后端环境绑定。

## 插入点决策

用户已确认只选择推荐项：

- **纳入**：公开 `/submit` 表单和现有 `POST /api/submit`。
- **跳过**：`POST /api/events/:id/view`，它是被动浏览量 beacon，没有可接受的 widget UX。
- **跳过**：活动筛选 GET 表单，不产生敏感写入。
- **跳过**：后台登录、审核、编辑、标签与批量导入，均由 Cloudflare Access 或管理员 token 中间件保护。

## 既有工作区状态

- 任务创建前后用户/其他流程已修改 `README.md`，新增 Access 相关 secret 命令；必须保留。
- `wrangler.jsonc` 已有用户暂存和未暂存改动，其中 site key 已改为给定值，同时还包含 observability、Access 与默认行政区改动；不得回滚或误提交这些既有改动。
- `worker-configuration.d.ts` 已出现 `TURNSTILE_SECRET`，但手写 `RuntimeEnv` 和活动代码仍是旧名称，存在类型/实现漂移。

## 验证边界

- 允许调用官方 `siteverify`，它是业务验证端点，不是 Cloudflare 管理 API。
- Spin `validate.sh` 不传 API token、account id 或 expected domains，hostname 管理 API 检查必须跳过。
- 项目要求开发服务器使用 `astro dev --background`；本仓库默认不使用 Playwright。
