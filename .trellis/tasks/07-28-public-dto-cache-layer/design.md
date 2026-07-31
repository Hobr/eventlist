# Technical Design

## 0. 本文件的定位

本子任务的完整技术设计**不在此处复制**，以父任务为准：

`.trellis/tasks/07-28-d1-cache-strategy/design.md`

| 主题 | 父设计章节 |
| --- | --- |
| 免费方案额度排序、Cache API 部署前提、CPU 与 subrequest 预算 | §0 - §0.3 |
| 缓存边界、命名空间、公开 DTO 与键规范化 | §2 - §4 |
| 新鲜/正常陈旧/故障陈旧状态机与并发回源控制 | §5 - §6 |
| 热度当日成功标记与请求流程 | §7.1 - §7.4、§7.6 |
| 失败降级与用户可见行为 | §8 |
| 写后失效与地区祖先前缀展开 | §9、§9.1 |
| 路由集成、可观测性、分阶段发布与回滚 | §12 - §14 |
| 未采用方案及其现行依据 | §15 |

本文件只记录属于子任务 B 的增量决策。父设计中任何决策变更都改父文件，不在此处重述。

## 1. 前置条件（阻断）

1. Worker 绑定自定义域名 `acg.hobr.site`。
2. 在 `https://acg.hobr.site` 上的探针证明 `cache.put()` 后 `cache.match()` 命中（父实施 §0.1）。
3. 子任务 `07-28-d1-query-write-optimization` 已上线并取得连续 3 个完整 24 小时指标窗口，其 `rows_read`、Worker 请求与 CPU 实测数据可用。

这些条件阻断的是**路由接入和生产激活**，不阻断默认关闭、无全局 Cache API 副作用的纯基础代码。公开 DTO 缓存层保留为 feature-flagged 能力；当容量收益不足或 CPU 不满足门禁时延后激活，不取消。

## 2. 继承自子任务 A 的接缝

A 已经交付以下接口，本子任务直接消费，不得重构：

- 管理写入操作函数返回的 `MutationImpact`（活动 ID、旧/新地区、旧/新状态、`tagsChanged`）——失效 helper 的唯一输入，不得提交后回读 D1。
- 纯可序列化的公开 DTO（`PublicEventPage`、`PublicEventDetail` 等）——envelope 的缓存值。
- `recordEventView()` 的三态返回 `changed | already-current | ignored`——`ignored` 时禁止写标记。
- 各自独立、签名为 `(db, 规范化参数) => Promise<DTO>` 的 loader——读穿缓存原样包一层。

## 3. 执行清单

本子任务继续使用父任务 `implement.md` 作为执行清单。首个 preflight slice 只实现规范键、envelope 解析、TTL 状态边界、严格默认关闭的 scope 解析和注入式最小存储接口；后续 Phase 2 已完成稳定抖动、读穿 loader、`waitUntil()`、并发合并、`homepage,popularity,detail,list` 路由接入和写后失效，但四个新增 scope 仍保持生产关闭。热度标记和外部自动控制器尚未实现。

## 4. 2026-07-31 前置条件审计（历史快照）

本节保留首次审计时的阻断状态。此后真实 hostname 探针已通过并删除，`tags,sitemap` 获得一次性提前 pilot；最新生产证据和回滚版本以父任务 `implement.md` 的“`tags,sitemap` 提前 pilot”记录为准。该例外没有扩展到四个新增 scope。

- **自定义 hostname：功能上已满足，配置记录未满足。** `https://acg.hobr.site` 返回 200，定向 Workers tail 证明请求由 `eventlist` 当前版本处理；但 `wrangler.jsonc` 没有 `routes` / Custom Domain 记录，绑定仍只存在于 Cloudflare 侧配置。
- **真实 Cache API 探针：未满足。** 当前产品源码没有任何 `caches.open()` / `cache.put()`，生产 hostname 也没有可用探针证据。不得用本地 Miniflare 结果替代。
- **子任务 A 的正常流量观察：未满足。** 已取得一次 D1 24 小时滚动快照和短时 CPU tail，但没有上线前同口径基线，也尚未观察完一个正常流量周期。
- **启动结论：只进入默认关闭的 preflight 实现，生产激活继续延后。** 当前 D1 `rows_read=2569/24h`，约为 5,000,000 日额度的 0.05%；与此同时活动列表 CPU p50/p99 为 126/193 ms，首页为 15/63 ms，已越过父设计的 10 ms 门禁。现有证据不支持任何公开 DTO scope 生产 pilot。
- 先累计连续 3 个完整 24 小时窗口并重取 D1、Worker 请求和路由 CPU 指标。真实 hostname 探针在 `acg.hobr.site` 证明 `put` 后 `match` 命中之前，`PUBLIC_DATA_CACHE_SCOPES` 必须缺失或为空，任何路由不得调用 Cache API。

## 5. 激活阈值

- 公开 DTO pilot：连续 3 个完整 24 小时窗口的 D1 `rows_read` 均不低于 500,000（免费日额度的 10%），或已观察到可归因于 D1 公开读取的持续延迟/错误压力。
- 热度标记评审：连续 3 个完整 24 小时窗口的 Worker 请求均不低于 25,000（免费日额度的 25%），且详情统计 POST 占比足以形成可测收益。该阈值不用于证明公开 DTO 缓存收益。
- CPU 门禁：候选 scope 的路由级正常流量 CPU p99 必须低于 10 ms，且 `exceededCpu` 为 0；否则继续延后。提前 pilot 必须记录具体路由的延迟或错误证据及预期缓解机制。
- 通用门禁：`wrangler.jsonc` 记录真实 hostname 路由，自定义 hostname `put` / `match` 探针通过，开关关闭时路由合同与 D1 直读保持一致。

## 6. 发布顺序和回滚

1. 部署 preflight 基础，保持 `PUBLIC_DATA_CACHE_SCOPES` 缺失或为空；这一步不打开 Cache API。
2. 门禁通过后先 pilot `tags,sitemap`，观察一个完整正常流量周期的命中率、D1、CPU 和错误。
3. 外部控制面严格按 `popularity -> homepage -> detail -> list` 每次只增加一个 scope。
4. `list` 仅在第 1-3 页具有可测重复命中、CPU 有余量且前序 scope 稳定时启用。
5. 热度标记按独立阈值、开关和验收单独发布。

单 scope 回滚是从 `PUBLIC_DATA_CACHE_SCOPES` 删除对应值；全量回滚是清空变量。解析器对缺失、空值或任一未知 token 严格 fail closed 为全关闭，避免拼写错误造成部分激活。回滚后所有路由直接读取 D1，不删除或恢复 D1 数据。
