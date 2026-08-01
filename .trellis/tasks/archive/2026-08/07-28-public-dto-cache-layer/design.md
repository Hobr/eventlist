# Technical Design

## 1. Architecture

保留现有 `eventlist-public-data-v2` Cache API 读穿层，不迁移整页缓存或 Workers Caching。变更分为四部分：

1. 为 Cache API response 附加固定 `Cache-Tag`。
2. 管理员 D1 mutation 成功后，在现有本地 `cache.delete()` 之外调度一次 Cloudflare Cache Purge API 请求。
3. 调整热门与非热门 DTO 的 TTL。
4. 为首页发现和活动列表缓存键加入中国本地日期。

D1 仍是唯一事实来源。缓存和 purge 都是可失败的优化层。

## 2. Cache Tags

缓存条目使用低基数、固定 ASCII tag：

| Scope | Required tag |
| --- | --- |
| `homepage` | `eventlist-homepage` |
| `popularity` | `eventlist-popularity` |
| `tags` | `eventlist-tags` |
| `detail` | `eventlist-detail` |
| `sitemap` | `eventlist-sitemap` |
| `list` | `eventlist-list` |

详情可附加 `eventlist-detail-{id}` 供未来精确 purge，但本次全局正确性使用低基数 scope tag。管理员写入频率低，CRUD 后 broad scope purge 比维护不可枚举的列表/标签键索引更简单可靠。

`writePublicDataCache()` 接收由受测 adapter 提供的 tag 列表，把去重后的值写入 `Cache-Tag` response header。helper 只接受代码生成的 tag，不接收请求头、原始查询字符串或任意用户文本。

## 3. Global Purge Client

新增可注入测试的 Cloudflare purge client：

```text
POST https://api.cloudflare.com/client/v4/zones/{CLOUDFLARE_ZONE_ID}/purge_cache
Authorization: Bearer {CLOUDFLARE_CACHE_PURGE_TOKEN}
Content-Type: application/json

{"tags":[...]}
```

Runtime 配置：

- `CLOUDFLARE_ZONE_ID`：普通 Wrangler var。
- `CLOUDFLARE_CACHE_PURGE_TOKEN`：Worker secret，只授予目标 zone 的 `Cache Purge: Edit`。

每个 changed 管理 mutation 将本地 delete work 与一个全局 purge work 合并进同一个 `waitUntil()`。purge tag 先去重并保持固定顺序；单次 mutation 最多一个 HTTP 请求，避免撞击免费方案 5 次/分钟限制。

默认采用安全的 broad 映射：

- 创建、批量创建、编辑或公开状态变化：purge 全部六个公开 DTO scope tag。
- 标签归并：按批准的保守映射 purge `homepage,popularity,tags,detail,list`，不让正确性依赖当前热门榜公开投影是否展示标签。`src/lib/db/admin-events.ts` 的归并 SQL 只修改 `event_tags.tag_id` 与 `tags.alias_of_id`，不更新 `events.updated_at` 或活动 URL，因此不 purge sitemap。
- 成功驳回 pending、冲突、already-target、校验失败、404 和公共 pending 投稿：不 purge。

全局 tag 映射不按当前 `PUBLIC_DATA_CACHE_SCOPES` 裁剪。scope 关闭只禁止读取和本地 Cache API 操作；mutation 仍 purge 完整受影响 tag 集合，防止长 TTL 旧条目在后续重新启用 scope 时恢复可见。

全局 purge 失败时：

- 不抛回管理路由，不更改其 HTTP 状态或 JSON envelope。
- 保留当前数据中心的本地 delete 尝试。
- 输出结构化日志 `{ event: "public_cache_global_purge", status, kind, tags, code? }`，不得输出 token、Authorization header 或完整 Cloudflare response body。
- 依赖正常 TTL 最终收敛。

## 4. TTL Policy

| Data | Fresh | Normal limit | D1 fault limit |
| --- | --- | --- | --- |
| Popularity | stable jitter 45-55 seconds | 60 seconds | 5 minutes |
| Homepage discovery | 30 minutes | 30 minutes | 48 hours |
| Event list | 30 minutes | 30 minutes | 48 hours |
| Event detail | 6 hours | 6 hours | 48 hours |
| Tags/search | 30 minutes | 30 minutes | 48 hours |
| Sitemap | 6 hours | 6 hours | 48 hours |

非热门 DTO 的 fresh 与 normal 边界相同，因此正常期间不会进入 `STALE-REFRESH`。首页、列表和标签在 30 分钟到期后同步回源，详情和 sitemap 在 6 小时到期后同步回源。只有 D1 故障时才能在 48 小时内返回 `STALE-IF-ERROR`。

热门榜保留当前状态机：45-55 秒后先返回旧值并后台刷新，60 秒后同步回源。`/api/popularity` 私有浏览器缓存不超过 5 秒。访问统计写入不 purge 热门榜，避免每个访客制造刷新风暴。

## 5. Date-Sensitive Keys

首页 `today` 与活动列表 `timing` 依赖中国本地日期。将 `asOfDate` 加入以下规范键：

```text
home-discovery?division=31&date=2026-08-01
event-list?...&date=2026-08-01
```

日期来自共享 `getChinaLocalDate()`，不是浏览器时区或请求字符串。adapter 在生成键和执行 D1 loader 前读取一次日期，保证同一次 load 不跨日期。DTO guard 继续验证地区和分页身份。

热门榜会在 60 秒内回源，允许沿用现有地区+窗口键；详情和 sitemap 不依赖自然日期。首页、活动列表和标签查询仍受当前时间影响，因此分别使用 30 分钟正常 TTL；首页和活动列表另外将中国本地日期加入规范键。

## 6. Route Integration

现有所有公开路由继续复用 `loadCached*` adapter。仅改变 adapter 传入的 TTL、tag 和日期参数；不复制缓存逻辑到页面。

现有八个管理 mutation 路由继续调用 `schedulePublicDataInvalidation()`。该 helper 扩展为同时调度：

- 当前数据中心的 bounded `cache.delete()`；
- 全局 Cache-Tag purge。

路由只需传入已取得的 `runtimeEnv` 配置，不自行构造 Authorization header 或 purge body。

## 7. Compatibility And Security

- 不改变 namespace/schema；TTL 和 tag 不改变 payload 解析合同，部署前已有条目按旧 TTL 自然失效或被新版本冷启动隔离。
- token 只存 Worker secret；`.dev.vars.example` 只声明空键名。
- zone ID 可以进入 `wrangler.jsonc`，但必须由实时 Cloudflare 账户查询确认。
- purge client 只访问固定 Cloudflare API origin，zone ID 必须匹配 Cloudflare ID 格式，禁止接受任意 URL。
- Cache-Tag 只使用代码常量；Cloudflare 会在对客户端响应前移除该 header。
- 不授予生产 Worker Workers Scripts、D1 管理或其他账户写权限。

## 8. Verification

自动测试覆盖 TTL 边界、跨日期键、tag 写入、purge 请求合同、tag 去重、零/单请求预算和全部失败降级。

生产验证顺序：

1. 确认工作树、当前版本、zone ID、最小权限 token 和上一稳定版本。
2. 部署前运行全量质量命令和 dry-run。
3. 将 scope 一次设置为六项并部署 100%。
4. 对首页、热门 API、标签、列表、详情和 sitemap 验证 `MISS -> HIT` 与正文哈希一致。
5. 使用可恢复的受控管理员编辑触发 purge，确认 Cloudflare API 成功、相关公开 route 重新 `MISS` 且 D1 投影一致；恢复测试数据后再次 purge。
6. 确认旧自动晋级控制器仍为暂停状态。

## 9. Rollback

- 逻辑回滚：恢复上一 Worker Version 100%。
- 缓存回滚：将 `PUBLIC_DATA_CACHE_SCOPES` 恢复为 `tags,sitemap` 或清空；旧条目不会在关闭 scope 后被读取。
- purge 配置回滚：移除 `CLOUDFLARE_CACHE_PURGE_TOKEN` 和 zone var；本地 delete 与 TTL 仍保证最终收敛。
- D1 无迁移、无缓存事实写入，不需要数据库恢复。
