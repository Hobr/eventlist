# 首页活动推荐技术设计

## 概述

本功能扩展现有公开活动发现链路，不创建并行的推荐应用。D1 继续作为活动与热度数据的唯一事实来源；Astro 在服务端渲染首页；一个很小的客户端信标负责记录符合条件的详情页打开行为。

```text
浏览器执行活动详情页
  -> POST /api/events/:id/view
  -> 校验活动 ID 与同源请求
  -> HMAC(活动 ID + CF IP)
  -> D1 event_visitors 更新或插入

首页请求 (?city=...&trend=7)
  -> 解析当前地区
  -> 查询主推荐 + 正在进行 + 日期分组
  -> 批量查询本地/全国热度榜
  -> 服务端渲染数量受控的区域
  -> 使用精确日期条件链接到 /events
```

## 边界与所有权

- 在数据库仍是未部署基线期间，`migrations/0001_init.sql` 负责 `event_visitors` 表、约束和索引。
- `src/lib/events/popularity.ts` 负责解析热度窗口并生成活动级 HMAC；路由和页面不得重复定义这些合同。
- `src/lib/db/queries.ts` 负责访问持久化和有类型的首页查询结果，因为它已经是公开活动 SQL 与结果校验的所有者。
- `POST /api/events/[id]/view` 负责请求校验和原始 IP 信任边界。原始 IP 不能越过从路由到哈希的边界。
- `src/pages/index.astro` 负责 URL 解析、地区解析、服务端查询编排、区域组合和活动目录链接。
- `src/pages/events/index.astro` 与 `FilterBar.svelte` 负责新的精确日期目录筛选。
- `EventCard.astro` 继续作为共享活动展示组件。首页专用包装可以添加日期标题、排名、数量和推荐理由，但不能让通用 `ui/` 组件理解活动业务。

## 数据模型

在基线中新增 `event_visitors`：

```sql
event_id        INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE
visitor_key     TEXT NOT NULL, 64 个小写十六进制字符
last_seen_date  TEXT NOT NULL, 中国本地时间下的规范 YYYY-MM-DD
PRIMARY KEY (event_id, visitor_key)
INDEX (last_seen_date, event_id)
```

该表不存储原始 IP、User-Agent、来源页、账号标识或跨活动访客标识。HMAC 输入包含活动 ID，因此相同 IP 在不同活动中会生成无法从数据库记录相互关联的键。

`VIEW_HASH_SECRET` 是 Worker 密钥，只加入运行时类型和部署文档，绝不写入 `wrangler.jsonc` 的 `vars`。更换密钥会有意重置去重连续性：更换时应清除保留期内的 `event_visitors` 数据，不能混用不同代密钥。

## 访问记录流程

1. 公开详情页正常渲染，服务端渲染链路不执行 D1 写入。
2. 对有效公开活动，页面中的非可视脚本在浏览器执行后发送同源 POST。统计失败不影响页面。
3. 路由拒绝无效 ID 和跨源请求。缺少 `CF-Connecting-IP` 或 `VIEW_HASH_SECRET` 时返回运行错误，但不暴露具体值。
4. `hashEventVisitor(eventId, ip, secret)` 使用 Web Crypto HMAC-SHA-256，并返回小写十六进制字符串。
5. `recordEventView` 使用预处理语句组成 D1 批处理：
   - 删除超出 30 个自然日保留边界的数据；
   - 仅当活动已发布且尚未结束时，插入 `(event_id, visitor_key, today)`；
   - 主键冲突时，仅在存储日期不同的情况下更新 `last_seen_date`。
6. 请求被接受时返回 `204`，有效但无需更新的重复访问同样不返回可视内容。

该路由是低风险统计，不是权限控制。通过同源检查和单活动 IP 去重限制普通刷量；多地址协同作弊不在本次范围内。

## 查询合同

### 共享日期和排序

所有日期分类都使用与现有 `EVENT_ENDED_CLAUSE` 一致的 SQLite 中国本地时间表达式。可选时间只在已存在时参与现有结束状态判断，绝不参与首页排序。

规模排序集中定义在一段 SQL 中：`mega > large > mid > small`。页面不得重复定义另一份规模顺序。

### 附近活动结果

定义以下有类型结果：

```ts
interface HomepageDateCluster {
    date: string;
    total: number;
    events: EventRecord[];
}

interface HomepageNearby {
    featured: EventRecord | null;
    ongoing: EventRecord[];
    clusters: HomepageDateCluster[];
}
```

主推荐条件为当前地区、尚未结束、开始日期位于今天到未来第 14 天。依次按规模、开始日期、是否有封面和 ID 排序。页面根据相同字段生成中性理由，例如 `本周内 · 大型活动`。

“正在进行”定义为 `start_date < today` 且活动尚未结束。最多 4 场，依次按最近结束日期、规模和 ID 排序。

未来日期分组包含 `start_date >= today` 的活动。窗口查询为最近 3 个不同日期分别返回最多 5 行和完整分组数量。页面移除主推荐 ID 后取前 4 场，无需额外 D1 往返即可避免附近区域重复。

### 热度结果

```ts
type PopularityWindow = 3 | 7 | 30;

interface PopularEvent extends EventRecord {
    unique_visitors: number;
}

interface HomepagePopularity {
    window: PopularityWindow;
    local: PopularEvent[];
    nationwide: PopularEvent[];
}
```

`trend` 只接受 `3`、`7` 或 `30`，其他值都回退为 `7`。近期计数 CTE 从今天向前 `window - 1` 天筛选 `last_seen_date`，并按活动 ID 分组。本地和全国查询通过一次 `db.batch()` 执行，各返回 5 场已发布且尚未结束的活动。

排行同分依次使用独立访客数降序、规模降序、开始日期升序和 ID。没有符合条件访问数据时显示冷启动提示，绝不替换成定义不同的榜单。

## 活动目录日期合同

新增两个彼此独立的可选公开筛选：

- `starts=YYYY-MM-DD`：`date(events.start_date) = date(?)`
- `active=YYYY-MM-DD`：`date(events.start_date) <= date(?) AND date(events.end_date) >= date(?)`

使用现有日期解析模式忽略无效值。`FilterBar` 将两个条件加入活动条件标签，应用表单时保留，并在移除时只删除所选键。现有 `from`/`to` 语义保持不变。

日期分组链接使用 `starts`；正在进行链接使用 `active=today`。两者都携带 `city` 和默认的未结束状态。

## 首页信息架构

```text
页面标题 + 当前地区 + 紧凑地区控制
页内跳转：附近活动 | 热门活动

附近活动
  紧凑主推荐（最多一场、受控媒体尺寸、推荐理由）
  正在进行的紧凑行（0 至 4 场）
  最近活动日期 #1（总数 + 最多 4 行 + 精确日期链接）
  最近活动日期 #2
  最近活动日期 #3
  当前地区完整活动目录入口

热门活动
  共用的 3日 | 7日 | 30日链接控制（默认 7 日）
  本地前 5 | 全国前 5
  各自独立的冷启动/错误状态
```

即使完整热门区域位于多个日期分组之后，页内跳转仍让两个发现区域在首屏可见。它们是导航，不是内容模式切换。

紧凑主推荐在宽屏使用横向媒体和内容组合，在移动端使用高度受控的上下结构，不能重新产生当前 23-28rem 高的大图。日期分组和榜单使用边框分隔的无框列表，不在区域卡片中嵌套卡片。

热门行显示名次、标题、日期/地区和独立访客数。桌面使用等宽双列，移动端先本地后全国上下排列。同一活动可以出现在两个榜单中，但两个标题必须持续可见。

## 网址与交互状态

- 首页状态由服务端管理：`city` 选择地区，`trend` 选择热度窗口。
- 热度控制使用带 `aria-current` 的普通链接，因此结果保持服务端渲染、可分享且支持键盘操作。
- 每个热度链接都保留 `city`。
- 首页向 `CitySelector` 传入包含当前 `trend` 的 `action`，使切换城市时保留热度窗口，同时不扩展该组件的公开合同。
- 不为热度窗口新增 localStorage 偏好；现有城市持久化保持不变。

## 失败和稀疏状态

- 首页 D1 失败：保留现有页面级警告和导航，不渲染误导性的替代榜单。
- 附近无活动：保留地区控制，并提供全部地区和投稿入口。
- 附近只有少量活动：不渲染空分组标题。
- 没有正在进行活动：省略该分组。
- 没有热度数据：本地榜和全国榜分别显示 `暂无足够浏览数据`。
- 统计失败：活动详情保持完全可用；非可视请求独立失败，并可通过直接路由检查诊断。

## 兼容、上线和回滚

实现前确认远程数据库尚未应用 `0001_init.sql`。如果此前提已经变化，停止实现并改为规划追加迁移，不能改写历史。

上线顺序为数据库结构、路由/查询代码、首页 UI。首次请求时 `event_visitors` 为空，页面也必须正常工作。

回滚时可以移除统计脚本、接口和热度展示，同时保留未使用的新表。如果基线尚未部署，也可以从基线删除该表。绝不能在没有单独审批迁移的情况下删除远程已部署表。

## 验证策略

- 在全新临时 D1 中应用基线和种子数据。
- 使用 SQL 断言数据库结构、约束、主键去重、保留期限、窗口边界、活动状态、本地/全国筛选和确定性同分排序。
- 直接检查有效重复访问、不同访客键、无效 ID、跨源请求、缺少配置和详情页独立性。
- 运行 `corepack pnpm lint`、`corepack pnpm exec tsc --noEmit` 和 `corepack pnpm build`。
- 后台启动 Astro 开发服务器，并在约 390x844、768x1024、1440x1000 下使用应用内浏览器检查溢出、明暗配色、键盘焦点、稀疏数据和同日高密度数据。
