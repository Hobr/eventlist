# Technical Design

## 0. 本文件的定位

本子任务的完整技术设计**不在此处复制**，以父任务为准：

`.trellis/tasks/07-28-d1-cache-strategy/design.md`

| 主题 | 父设计章节 |
| --- | --- |
| 免费方案额度排序、CPU 10 ms 预算、subrequest 50 上限 | §0、§0.2、§0.3 |
| 访客清理移出请求链路、Cron 与自定义入口 | §7.5 |
| 规范日期/时间列的无语义查询改写 | §10 |
| `getDB()` 收口、模块边界、公开投影、管理写入合同 | §11.1 - §11.7 |
| 热度语义为何保持 `last_seen_date` 单行模型 | §7.1 |

本文件只记录**属于子任务 A 的增量决策**，以及与子任务 B 的接口约定。父设计中任何决策变更都改父文件，不在此处重述。

## 1. 与子任务 B 的接口约定

子任务 A 不引入任何 Cache API 调用，但必须把 B 需要的接缝留出来，避免 B 再次重构 A 的产物：

- **`MutationImpact` 现在就落地。** 管理写入的业务操作函数按父设计 §11.3 返回 `eventIds` / `oldDivisionCodes` / `newDivisionCodes` / `oldStatus` / `newStatus` / `tagsChanged`。A 阶段没有消费者，路由只是拿到后忽略；B 阶段直接接失效 helper，不需要改动操作函数签名。
- **公开 DTO 就是缓存值的形状。** A 建立的 `PublicEventPage` / `PublicEventDetail` 等类型必须是可直接 JSON 序列化的纯数据，不含 `Date`、`Map`、类实例或方法，否则 B 的 envelope 无法无损往返。
- **`recordEventView()` 返回三态。** `changed | already-current | ignored`（父设计 §7.3 / implement §3）。A 阶段调用方只用它决定响应码；B 阶段用它决定是否写当日成功标记，`ignored` 必须能覆盖无效/已结束活动，防止假阳性标记。
- **loader 保持可独立调用。** 首页发现、热门、top tags、活动列表、详情、sitemap 各自是独立函数，签名为 `(db, 规范化参数) => Promise<DTO>`，B 才能原样包一层读穿缓存。不得为了减少调用把它们合并。

## 2. 自定义入口的边界

新增 `src/worker.ts` 是本子任务唯一的部署配置变更：

```ts
import { handle } from "@astrojs/cloudflare/handler";

export default {
    fetch: handle,
    async scheduled(event, env, ctx) { /* deleteExpiredEventVisitors */ }
};
```

已核实 `@astrojs/cloudflare@14.1.5` 导出 `./handler`（`handle(request, env, context)`）与现用的 `./entrypoints/server`，因此 `wrangler.jsonc` 的 `main` 可以安全从 `@astrojs/cloudflare/entrypoints/server` 切到 `./src/worker.ts`。

约束：

- `fetch` 必须原样委托，不得在其中插入任何逻辑；所有请求期行为仍留在 Astro 路由内。
- `scheduled()` 的 CPU 上限同样是 10 ms（父设计 §0.2）。清理是单条 DELETE，耗时属于 D1 等待而非 CPU，安全；但不得在 `scheduled()` 内做聚合统计或循环批删。
- Cron 表达式 `5 16 * * *`（UTC）对应中国时间每日 00:05。
- 构建后需确认生成的 wrangler 配置仍保留 D1 绑定、assets、vars 和 trigger。

## 3. 风险与回滚

| 风险 | 判据 | 回滚 |
| --- | --- | --- |
| 查询改写改变结果或排序 | 与改写前的完整结果集逐行对比不一致 | 恢复列外层转换函数；无迁移 |
| batch 内 `changes()` 门控审计不可靠 | 本地 D1 合同测试无法稳定复现 | 退回"确认 changed 后第二次调用写审计"，绝不写错误审计 |
| 自定义入口导致资源或绑定丢失 | 构建产物缺少 D1/assets/vars/trigger | `main` 恢复为 `@astrojs/cloudflare/entrypoints/server`，清理改人工命令 |
| 模块拆分引入行为漂移 | 现有测试失败或调用计数上升 | 保留兼容 re-export，逐路由回退 |

本子任务不修改 `0001_init.sql`，不新增索引，因此任何回滚都不涉及数据迁移。
