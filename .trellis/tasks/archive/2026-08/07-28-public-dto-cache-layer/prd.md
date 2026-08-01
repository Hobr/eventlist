# Public DTO cache production activation

## Goal

一次启用 `homepage,popularity,tags,detail,sitemap,list` 六个公开 DTO 缓存 scope。热门榜缩短定时刷新周期；其他公开 DTO 使用长 TTL，并在管理员 CRUD 成功后通过 Cache-Tag 全局失效，从而减少重复 D1 读取且不改变公开响应、地区、筛选、状态或隐私合同。

## Parent

父任务：`.trellis/tasks/07-28-d1-cache-strategy/`。

本文件记录 2026-08-01 起的现行激活合同；父任务中的早期门禁、短 TTL 和逐 scope 自动晋级记录保留为历史证据，但不再阻断本次实施。

## Background

- 激活实施前，Cache API 读穿层、DTO guard、规范键、状态机、路由接入、本地写后失效和测试已经实现，生产仅启用 `tags,sitemap`；本任务随后按部署记录一次启用全部六个 scope。
- 用户明确要求忽略此前的 D1 用量、CPU p99、`exceededCpu` 和逐 scope canary 门禁，一次启用首页发现、热门榜、活动详情和活动列表缓存。
- Cloudflare Cache API 条目不会复制到其他数据中心，`cache.delete()` 也只清理当前请求所在数据中心，因此仅延长 TTL 会导致其他地区长期陈旧。
- Cloudflare 免费方案支持按 Cache-Tag 全局 purge；当前限制为每账号 5 次 purge 请求/分钟，每次最多 100 个操作。管理员 mutation 需要将所有受影响 tag 合并为一次请求。
- 首页发现和活动列表结果依赖中国本地日期。长 TTL 下必须把日期纳入规范键，避免跨午夜复用前一天结果。

## Requirements

- R1. 生产 `PUBLIC_DATA_CACHE_SCOPES` 固定为 `homepage,popularity,tags,detail,sitemap,list`；缺失、空值或未知 token 时仍保持现有 fail-closed 行为。
- R2. `popularity` 使用缓存键稳定计算的 45-55 秒新鲜期、60 秒正常上限和 5 分钟 D1 故障上限；`/api/popularity` 私有浏览器缓存不超过 5 秒，访问写入不主动 purge 热门榜。
- R3. `homepage`、`tags`、`list` 使用 30 分钟新鲜期与正常上限、48 小时 D1 故障上限；`detail`、`sitemap` 使用 6 小时新鲜期与正常上限、48 小时 D1 故障上限。正常期间不做周期刷新，到达各自上限后同步回源。
- R4. 首页发现与活动列表规范键包含 `getChinaLocalDate()` 生成的中国本地日期。日期变化必须产生新键，即使旧条目仍在 48 小时存储期内也不得被读取。
- R5. 每个缓存响应写入固定、可测试、仅含 printable ASCII 的 `Cache-Tag`：`eventlist-homepage`、`eventlist-popularity`、`eventlist-tags`、`eventlist-detail`、`eventlist-sitemap`、`eventlist-list`；详情可以额外携带活动 ID tag，但全局正确性不得依赖枚举全部详情 ID。
- R6. 管理员创建、批量创建、编辑、审核通过、下线和重新发布在 D1 事实与审计成功后 purge 全部六个 scope tag；标签归并 purge `homepage,popularity,tags,detail,list`，不 purge sitemap。每次 mutation 最多调度一次 Cloudflare `POST /zones/{zone_id}/purge_cache`，请求体使用去重后的 tag 数组。
- R7. 全局 purge 使用 `CLOUDFLARE_CACHE_PURGE_TOKEN` secret 和 `CLOUDFLARE_ZONE_ID` 普通变量。token 只授予目标 zone 的 Cache Purge 权限，不得提交到仓库、日志或响应，也不得授予 Workers Scripts 写权限。
- R8. purge 缺少配置、网络失败、非 2xx、Cloudflare `success:false` 或限流时，记录不含 token 的结构化错误；不得回滚 D1、改变成功管理 API 响应或取消现有本地 best-effort `cache.delete()`。长 TTL 是 purge 失败的最终收敛边界。
- R9. 成功驳回 pending 活动、公共 pending 投稿、失败/冲突/already-target mutation 和访问统计 POST 不触发全局公开 DTO purge。访问去重缓存不在本次范围。
- R10. 缓存 payload 继续只保存受测公开 DTO；完整 `EventRecord`、投稿联系、建议标签、驳回原因、审计和访客信息不得进入缓存或 purge 日志。
- R11. 本次不迁移到 Workers Caching，不缓存整页 HTML，不修改 D1 schema，不改变热门统计口径、路由响应字段、状态码、SSR 错误隔离、列表准入或详情访问 POST。
- R12. 实施完成后执行一次人工审查的全量生产部署，不使用旧的自动逐 scope 控制器；控制器保持暂停。部署失败或线上响应不一致时，通过清空新增 scope 或恢复上一 Worker Version 回滚。

## Acceptance Criteria

- [ ] A1. 单元测试证明全部六个 scope 同时启用，未知配置仍全量关闭；`wrangler.jsonc` 和生成类型与生产目标一致。
- [ ] A2. TTL 测试证明热门榜在 45-55 秒后进入后台刷新、60 秒后阻塞回源、5 分钟后硬过期，且 `/api/popularity` 私有浏览器缓存不超过 5 秒；首页、列表和标签在 30 分钟内保持命中，详情和 sitemap 在 6 小时内保持命中，各自超过正常上限后阻塞回源，D1 故障最多使用 48 小时旧值。
- [ ] A3. 首页发现和列表键在地区、筛选等参数相同但中国本地日期不同时不相等；旧日期 envelope 不会被新日期请求读取。
- [ ] A4. 每类缓存写入正确 Cache-Tag；tag 不含 Unicode、空格、secret、用户输入或原始查询字符串。
- [ ] A5. 管理员成功 mutation 最多产生一次全局 purge HTTP 请求，使用 Bearer token、正确 zone endpoint 和去重 tag；标签归并精确使用五个非 sitemap scope tag，成功驳回 pending、公共投稿及非 changed 结果为零请求。
- [ ] A6. 缺少 secret/zone、网络异常、限流、非 2xx 和 `success:false` 测试均保留管理 API 成功与 D1 事实，并产生可诊断但不泄密的结构化日志。
- [ ] A7. 现有本地失效、24 次 delete 上限、DTO guard、负详情不缓存、并发合并、stale-if-error 和响应状态测试继续通过。
- [ ] A8. `corepack pnpm test`、`corepack pnpm lint`、`corepack pnpm exec tsc --noEmit`、`corepack pnpm build`、`corepack pnpm exec wrangler types --check` 和 `git diff --check` 全部通过。
- [ ] A9. 生产版本绑定包含完整 scope、zone ID 和 Cache Purge secret；真实 hostname 上六类路由均验证正文正确且可观察 `MISS -> HIT`。
- [ ] A10. 生产只使用可恢复管理员编辑验证六类 scope purge 成功及相关 route 重新 `MISS`。标签归并的五类 purge 映射与 sitemap 不 purge 只通过自动化测试或临时本地 D1 验证，不在生产执行不可逆归并；所有公开结果必须与 D1 投影一致。
- [ ] A11. 旧自动控制器保持暂停；上一稳定 Worker Version 与清空新增 scope 的回滚步骤均已记录。

## Out of Scope

- 启用或迁移到 Cloudflare Workers Caching、Cache Reserve、KV、Durable Objects 或第三方缓存。
- 整页 HTML、管理页面、鉴权响应、POST/PATCH 响应或访问统计 payload 缓存。
- 启用 `VIEW_DEDUPE_CACHE_ENABLED` 或修改热度访客写入语义。
- 修改 D1 schema、索引或管理员业务事务。

## Operational Prerequisites

- 部署前必须取得目标 zone 的 `CLOUDFLARE_ZONE_ID`。
- 部署前必须由用户提供或创建仅含目标 zone `Cache Purge: Edit` 权限的 API token，并通过 `wrangler secret put CLOUDFLARE_CACHE_PURGE_TOKEN` 写入；不得复用权限更宽的全局 API key。
- 若部署时无法取得最小权限 token，可以完成代码与测试，但不得声称全局 CRUD 失效已上线。
