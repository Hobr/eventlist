# Cloudflare Turnstile 集成设计

## 设计目标

在不改变投稿业务语义的前提下，补全现有 Turnstile 集成。浏览器只负责获取并提交一次性 token；Astro/Workers 服务端是唯一可信验证边界；D1 写入只能发生在 `siteverify` 明确成功之后。

## 范围与边界

- 唯一前端插入点：`src/pages/submit.astro` 内的公开投稿表单。
- 唯一服务端门禁：`src/pages/api/submit.ts` 的 `POST` 处理器。
- 复用 `src/components/Turnstile.svelte` 和 `src/lib/turnstile.ts`，不增加第三方 Turnstile 依赖。
- 不触碰 Cloudflare 管理 API，不创建或修改 widget，不部署额外基础设施。
- 后台管理入口继续依赖现有 Cloudflare Access/管理员 token 中间件。

## 数据流

```text
Turnstile widget
  -> cf-turnstile-response 隐藏字段
  -> /submit AJAX FormData
  -> POST /api/submit
  -> parseSubmissionForm
  -> verifyTurnstile(token, env.TURNSTILE_SECRET, CF-Connecting-IP)
  -> Cloudflare siteverify
  -> success === true
  -> getDB + insertSubmission
  -> 201 + /submit?sent=1
```

任何验证失败都在 `getDB`/`insertSubmission` 之前终止。表单字段本身无效时仍沿用现有解析错误路径，不为了 Turnstile 改变业务校验顺序。

## 前端设计

### Widget 渲染合同

`Turnstile.svelte` 继续通过 `api.js?render=explicit` 显式渲染，避免更换现有组件生命周期：

- 容器增加 `class="cf-turnstile"`。
- 容器增加公开的 `data-sitekey` 与固定 `data-action="turnstile-spin-v2"`。
- `turnstile.render()` 同时传入 `sitekey` 和 `action: "turnstile-spin-v2"`，确保显式渲染 token 的 action 与 DOM 标记一致。
- 保留 `cf-turnstile-response` 隐藏字段；成功 callback 写入 token，expired/error callback 清空 token。

### 单次 token 重置合同

组件保存 `turnstile.render()` 返回的 `widgetId`，并监听所属表单上的局部自定义 reset 事件。收到事件时：

1. 立即清空 Svelte token 状态和隐藏字段值。
2. widget 已渲染时调用 `window.turnstile.reset(widgetId)`。
3. 组件卸载时移除事件监听，并在 API 可用时移除 widget，避免残留生命周期状态。

`submit.astro` 的现有 AJAX 处理器只在请求失败、非 2xx 或其他未导航结果后触发该事件。成功 201 仍直接跳转 `/submit?sent=1`。因此失败重试获得新 token，而正常成功路径不增加可见延迟。

## 服务端设计

### 环境变量

- 公共 site key：`TURNSTILE_SITE_KEY`，在 `wrangler.jsonc` 的 `vars` 中使用用户给定值。
- 服务端 secret：`TURNSTILE_SECRET`，仅通过 Workers secret/本地环境提供。
- 删除活动代码、类型、示例和当前文档中的 `TURNSTILE_SECRET_KEY` 引用。
- `.dev.vars.example` 只声明变量名，不放置用户真实 secret 或与正式 site key 不匹配的测试 secret。

Astro on Cloudflare 的实际访问方式为 `getRuntimeEnv().TURNSTILE_SECRET`，等价于从后端运行时环境读取；不会把 secret 暴露给组件或响应。

### Canonical siteverify

`verifyTurnstile()` 保持独立边界，发起：

- URL：`https://challenges.cloudflare.com/turnstile/v0/siteverify`
- 方法：`POST`
- `Content-Type`：`application/x-www-form-urlencoded`
- 请求体：`URLSearchParams`，包含 `secret`、`response`，有 `CF-Connecting-IP` 时包含 `remoteip`

只有 JSON 对象中的 `success === true` 返回成功。以下情况全部失败关闭：

- `TURNSTILE_SECRET` 未配置：抛出配置错误，路由返回 500 JSON。
- token 缺失或 `success !== true`：路由返回 400 JSON。
- 网络/TLS、非 2xx 或非 JSON：抛出上游错误，路由返回稳定的 502 JSON。

不记录或返回 secret、token、原始 IP 或 Cloudflare 内部错误引用。

## 配置、类型与文档同步

- `wrangler.jsonc`：写入给定 site key。
- `src/types/cloudflare.ts`：运行时字段改为 `TURNSTILE_SECRET`。
- `worker-configuration.d.ts`：通过 `corepack pnpm generate-types` 重新生成并核对 site key/secret 字段。
- `.dev.vars.example`：改为 `TURNSTILE_SECRET=`。
- `README.md`：把当前环境变量表、secret 命令和检查说明统一为 `TURNSTILE_SECRET`；保留任务开始前已存在的 Access 相关改动。
- `.trellis/spec/backend/error-handling.md`：在完成阶段更新公开 API 的正式环境变量合同，并删除旧名称。

## 测试与验证设计

### 自动化测试

新增聚焦测试，替换 `globalThis.fetch` 并在每个测试后恢复：

- canonical URL、方法、表单编码头和 `secret`/`response`/`remoteip` 字段。
- `success: true` 严格成功。
- `success: false` 与 error codes。
- 缺 token 不调用上游。
- 缺 secret、网络异常、非 2xx、非 JSON 均失败关闭。

前端合同通过源文件断言与浏览器验证共同覆盖：widget DOM 标记、render action、失败 reset 路径均必须存在；不为单个组件引入新的 DOM 测试框架。

### 构建与运行时验证

- `corepack pnpm test`
- `corepack pnpm generate-types`
- `corepack pnpm exec tsc --noEmit`
- `corepack pnpm lint`
- `corepack pnpm exec astro build --outDir .tmp-build-turnstile`
- 使用 `astro dev --background` 启动本地服务，并通过应用内浏览器检查 `/submit` 的实际 widget DOM、脚本加载、响应式布局和无重叠。
- 使用 Spin 附带的 `validate.sh` 仅调用官方 `siteverify`，不传 Cloudflare API token/account/domain 参数，从而跳过管理 API 的 hostname 检查。

当前会话未设置 `TURNSTILE_SECRET`。实现完成后若仍缺失，`validate.sh` 必须按前置条件失败并停止，等待用户在后端环境设置后重跑；不得用硬编码 secret 或管理 API 绕过。

## 风险与缓解

- **真实 widget 未允许 localhost**：浏览器会显示域名错误；只报告控制台配置缺口，不调用 API 修改 widget。
- **本地 workerd TLS 信任链失败**：保持稳定 502 JSON，区分环境 TLS 问题与应用门禁逻辑。
- **token 被重复使用**：所有非成功导航路径触发 reset，清空本地 token。
- **README 有既有改动**：编辑和暂存时按行保留无关内容，不回滚、不误提交用户改动。
- **临时构建修改 Wrangler 状态**：使用独立 outDir，检查并清理仅由本任务生成的临时产物，不覆盖用户文件。

## 回滚

所有改动均为仓库内配置、组件、处理器、测试和文档；没有 Cloudflare 控制面状态变化。回滚只需反向应用本任务各文件的独立 diff，并把 secret 名称恢复到部署前版本；用户已有 `README.md` 改动不属于回滚目标。
