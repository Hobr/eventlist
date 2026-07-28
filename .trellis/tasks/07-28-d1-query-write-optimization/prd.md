# D1 query and write path optimization

## Goal

在不改变任何公开语义的前提下，消除 D1 免费额度上最先撞线的消耗：`event_visitors` 的全表扫描、每请求的无效往返，以及管理写入随标签数增长的调用放大。本子任务不依赖 Cache API，可独立上线与验证。

## Parent

父任务：`.trellis/tasks/07-28-d1-cache-strategy/`

需求以父任务 `prd.md` 的 R1-R28 为准；技术设计见父任务 `design.md` §0、§7.5、§10、§11；执行清单见父任务 `implement.md` §0（含 0.2 分工）、§1、§2、§3（当日成功标记除外）、§8、§9。本文件只界定本子任务的范围与验收边界。

## Scope

- 去掉规范日期/时间列外层的 `date()` / `time()` / `datetime()`，让热门窗口、访客清理、sitemap 命中现有索引（父设计 §10）。
- `recordEventView()` 移除每次访问的全局清理；新增 `deleteExpiredEventVisitors()`。
- 新增 `src/worker.ts` 自定义入口：`fetch` 委托 `@astrojs/cloudflare/handler`，`scheduled()` 执行每日访客清理；`wrangler.jsonc` 配置 `5 16 * * *`。
- `getDB()` 只校验并返回绑定，移除运行时 `ensureFK()`。
- 按职责拆分 `src/lib/db/queries.ts`，建立显式公开字段投影与公开 DTO。
- 管理写入收口：`transitionEventStatus()`、`json_each()` 集合式标签解析、`event_tags` 差异更新、`MutationImpact` 返回值、标签归并与创建路径的 statements 收口。

## Out of Scope

- 任何 Cache API 读写（公开 DTO 缓存、热度当日成功标记）——属于子任务 `07-28-public-dto-cache-layer`。
- 自定义域名绑定与生产探针——同上。
- 新增索引、修改 `0001_init.sql`、改变热度口径或审核状态机。

## Acceptance Criteria

- [ ] A1. `EXPLAIN QUERY PLAN` 证明热门窗口与访客清理使用 `idx_event_visitors_recent`、sitemap 使用 `idx_events_status_updated` 且不再额外排序、精确地区列表仍使用 `idx_events_public_division`。
- [ ] A2. 改写前后对同一份种子数据的完整结果、排序、分页和 3/7/30 日聚合逐项一致，中国本地时间口径不变。
- [ ] A3. 详情访问不再触发任何清理语句；过期访客由每日 Cron 删除，Cron 延迟或失败不影响热门查询正确性与页面请求。
- [ ] A4. `getDB()` 不执行任何 D1 statement，外键约束仍由 D1 默认行为与迁移声明生效（集成测试覆盖）。
- [ ] A5. 公开首页、热门、列表、详情 DTO 均来自显式公开投影，不含 `submitter_contact`、`tag_suggestions`、`reject_reason` 或审计字段。
- [ ] A6. 编辑活动的 D1 binding 调用固定为 2 次且不随标签数增长；未变化的 `event_tags` 关系不被删除重写；标签归并固定 2 次；状态变更 changed ≤ 2 次、冲突/幂等 ≤ 1 次。
- [ ] A7. 状态机回归测试证明 changed / already-target / wrong-status / missing-tag / not-found 的响应码、审计条数与当前行为一致。
- [ ] A8. 报告分别给出 binding 调用数、batch statements 数、D1 `meta.rows_read` / `rows_written` 的前后对比，不把"更少往返"记为"更少计费行"。
- [ ] A9. 记录部署前后按路由的 CPU time p50/p99 与 `exceededCpu` 计数，作为子任务 B 的判断基线。
- [ ] A10. `pnpm test`、`pnpm lint`、`tsc --noEmit`、`pnpm build` 全部通过。
