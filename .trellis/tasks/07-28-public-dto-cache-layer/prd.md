# Public DTO cache layer on Cache API

## Goal

在公开读取路径上引入基于 Cloudflare Cache API 的公开 DTO 读穿缓存与热度当日成功标记，在保持 D1 为唯一事实来源、正常服务陈旧不超过 60 秒的前提下，进一步降低 D1 `rows_read` 与重复统计请求。

## Parent

父任务：`.trellis/tasks/07-28-d1-cache-strategy/`

需求以父任务 `prd.md` 的 R1-R28 为准；技术设计见父任务 `design.md` §0-§9、§12-§15；执行清单见父任务 `implement.md` §0.1、§3（当日成功标记部分）、§4-§8、§10、§11。本文件只界定本子任务的范围、前置条件与验收边界。

## Blocking Preconditions

本子任务在以下两项全部满足前不得进入实现（父设计 §0.1）：

1. Worker 已绑定自定义域名 `acg.hobr.site`（Workers 路由或 Custom Domain）。官方文档只保证自定义域与 Pages 域具备可用的 Cache API 操作，`*.workers.dev` 不在该列表内。
2. 在 `https://acg.hobr.site` 上的探针证明 `cache.put()` 后 `cache.match()` 可以命中。本地 `astro dev` 的 Miniflare 结果不作为依据。

此外，子任务 `07-28-d1-query-write-optimization` 应已上线并观察一个正常流量周期，其 `rows_read` 与 CPU 实测数据用于确认本子任务的必要性与启用范围。

## Scope

- `src/lib/cache/public-data.ts`：命名 namespace、版本化规范键、`CachedEnvelope<T>` 状态机、稳定抖动、`waitUntil()` 后台刷新、isolate 内 Promise 合并、异常安全降级。
- `src/lib/cache/view-dedupe.ts`：中国本地日期 TTL、二次 SHA-256 标记摘要、独立 namespace、D1 确认后才写标记。
- 路由接入：首页、`/api/homepage`、`/api/popularity`、`/events`、详情、`/api/tags`、`/sitemap.xml`；详情 SSR 命中标记时省略统计 POST。
- 写后失效：`MutationImpact` 驱动，地区键按省/市/县祖先前缀展开（父设计 §9.1）。
- 分阶段开关 `PUBLIC_DATA_CACHE_SCOPES` 与 `VIEW_DEDUPE_CACHE_ENABLED`，以及对应回滚路径。

## Out of Scope

- 索引改写、Cron 清理、`getDB()` 收口、DTO 投影、管理写入收口——属于子任务 `07-28-d1-query-write-optimization`。
- KV、Durable Objects、Queues、整页 HTML 缓存、全局 Workers Cache（父设计 §15 已论证否决理由）。

## Acceptance Criteria

- [ ] A1. 生产 hostname 探针证据已记录，且在启用任何 scope 之前完成。
- [ ] A2. 缓存键测试证明地区、窗口、活动 ID、筛选、分页、排序、标签不串用，参数顺序不产生重复键。
- [ ] A3. 状态机测试覆盖 fresh hit、miss、后台刷新、60 秒阻塞边界、stale-if-error、硬期限、损坏条目与 Cache API 故障；缓存写失败不改变原成功响应。
- [ ] A4. 隐私测试证明所有缓存值不含投稿联系、建议标签、驳回原因、审计或访客键；标记键与日志不含原始 IP 或 `visitorKey`。
- [ ] A5. 失效测试证明修改 `110101` 的活动会失效 `11`、`1101`、`110101` 三级的发现键与 3/7/30 三个热门窗口键，旧/新地区双侧覆盖。
- [ ] A6. 调用预算测试证明单次公开读取的 Cache API + D1 调用合计 ≤ 10，单次写后失效的 `delete()` ≤ 24。
- [ ] A7. 热度测试证明首次与跨日写入 D1、同日重复为 no-op、无效或已结束活动与 D1 失败不建立标记、标记命中时 SSR 省略统计 POST 且 IP/日期变化后恢复输出。
- [ ] A8. 启用前后按路由的 CPU time p50/p99 对比表明公开读取仍在 10 ms 预算内，`exceededCpu` 未上升。
- [ ] A9. 清空 `PUBLIC_DATA_CACHE_SCOPES` 后所有路由直接回源 D1 且响应合同不变；`VIEW_DEDUPE_CACHE_ENABLED` 关闭后统计恢复原有 POST 路径。
- [ ] A10. `pnpm test`、`pnpm lint`、`tsc --noEmit`、`pnpm build` 全部通过。
