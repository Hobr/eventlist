# Cloudflare Turnstile 实施计划

## 实施前检查

- [x] 记录 `git status --short` 与 `README.md` 既有 diff，确认只在任务相关行上叠加修改。
- [x] 读取 `trellis-before-dev`、backend error-handling、frontend design-system、Cloudflare Workers/Turnstile 规范。
- [x] 确认不调用 Cloudflare管理 API，不创建 widget，不读取或打印真实 secret。

## 1. 统一后端验证合同

- [x] 在 `src/types/cloudflare.ts` 将 `TURNSTILE_SECRET_KEY` 改为 `TURNSTILE_SECRET`。
- [x] 在 `src/pages/api/submit.ts` 从 `runtimeEnv.TURNSTILE_SECRET` 读取 secret，继续在 `insertSubmission` 之前调用验证器。
- [x] 在 `src/lib/turnstile.ts` 显式设置 `application/x-www-form-urlencoded`，保持 canonical URL、字段和 `success === true` 判断。
- [x] 保持缺 token/验证失败为 400、配置缺失为 500、上游失败为 502，避免泄漏 token、secret、IP 或内部错误引用。

## 2. 补全前端 widget 与 token 生命周期

- [x] 在 `src/components/Turnstile.svelte` 的真实容器增加 `cf-turnstile`、给定 site key 和 `data-action="turnstile-spin-v2"`。
- [x] 显式 render options 同步传入 `action: "turnstile-spin-v2"`。
- [x] 保存 `widgetId`，实现局部 reset：清空隐藏 token 并调用 `turnstile.reset(widgetId)`；卸载时清理事件和 widget。
- [x] 在 `src/pages/submit.astro` 保持现有 FormData/错误/跳转逻辑，只在非成功导航路径触发 reset。

## 3. 同步配置、生成类型与当前文档

- [x] 在 `wrangler.jsonc` 把 `TURNSTILE_SITE_KEY` 更新为 `0x4AAAAAAECBuh-0cHETrayP`。
- [x] 在 `.dev.vars.example` 只声明 `TURNSTILE_SECRET=`，不保存真实 secret。
- [x] 更新 `README.md` 当前环境变量表、Wrangler secret 命令和检查说明中的旧变量名，同时保留既有 Access 相关行。
- [x] 运行 `corepack pnpm generate-types`，核对 `worker-configuration.d.ts` 只包含新 secret 名称和正式 site key。
- [x] 搜索活动代码、当前配置、README 与 spec，确认无残留 `TURNSTILE_SECRET_KEY`；归档任务文档不做历史改写。

## 4. 添加聚焦测试

- [x] 新增 Turnstile 后端测试，覆盖 canonical 请求、严格成功判断、error codes、缺 token、缺 secret、网络异常、非 2xx 与非 JSON。
- [x] 增加轻量前端合同断言，覆盖 `cf-turnstile`、`data-action`、render action 和失败 reset；不引入新的浏览器测试依赖。
- [x] 验证测试不会输出或快照任何 secret/token/IP。

## 5. 静态质量门

- [x] `corepack pnpm test`
- [x] `corepack pnpm exec tsc --noEmit`
- [x] `corepack pnpm lint`
- [x] `corepack pnpm exec astro build --outDir .tmp-build-turnstile`
- [x] 检查构建后 `git status`，只移除本任务生成且未跟踪的临时产物，保留用户改动。

## 6. Spin 与浏览器验证

- [x] 按附件原文把 Spin `validate.sh` 写入 `/tmp/turnstile-spin-scripts/`，不写入仓库。
- [x] 只检查 `TURNSTILE_SECRET` 是否存在，不打印值。
- [x] 运行 `validate.sh --sitekey 0x4AAAAAAECBuh-0cHETrayP`；不传 API token/account/domain 参数，hostname 管理 API 检查必须为 skipped。
- [x] 若 secret 未设置或校验失败，原样报告失败检查并停止，等待用户修复环境后重跑。
- [x] 使用 `astro dev --background`，在应用内浏览器验证 `/submit` 的 widget DOM、脚本/iframe、桌面与移动布局、失败后新 token 重试路径；完成后运行 `astro dev stop`。
- [x] 在本地 D1 可用时比较失败提交前后记录数，确认验证失败不会写入投稿。

## 7. 复核、spec 与提交

- [x] 运行 `trellis-check` 覆盖 spec 一致性、类型、lint、测试、构建与跨层数据流。
- [x] 更新 `.trellis/spec/backend/error-handling.md`，把公开投稿环境变量合同统一为 `TURNSTILE_SECRET`，记录 canonical 编码与 reset 要求。
- [x] 审查最终 diff，确认没有 Cloudflare API 调用、widget 创建、真实 secret、无关重构或用户改动回滚。
- [ ] 仅暂存本任务拥有的改动；`README.md` 若仍混有用户既有行，使用精确暂存补丁避免误提交。
- [ ] 创建任务提交，记录验证结果；外部 secret 验证未通过时不得把任务标记完成或归档。
