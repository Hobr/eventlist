# Design - 首页双场景信息流设计

> Task: `08-05-homepage-dual-intent-feed` · Phase: planning
> Pairs with: `prd.md`

## 1. 设计摘要

保留当前大型精选 Hero，将 Hero 后的 `HomepagePopularity + HomepageToday` 替换为一个统一的双场景榜单组件。桌面端使用两列稳定网格，左侧 `未开票`、右侧 `未结束`；每列内部纵向展示 5 条本地热门和 5 条全国热门。移动端默认显示 `未结束`，使用 `未结束 / 未开票` 分段控件切换；hydration 前或 JavaScript 不可用时两个场景依次展示。

共享的 `3 / 7 / 30` 热度窗口位于双场景区标题栏，切换时一次请求并提交四个小榜。导航地区选择仍一次提交 Hero 与榜单完整快照。

## 2. 现有界面审计

- 当前 Hero 已承担强视觉推荐，继续在其后堆叠独立热门区和今日区会重复活动发现入口；本次用一个双场景区替换两者。
- 顶层再套四张卡片会形成通用仪表盘式卡片墙，并让移动端层级过深；新方案使用无外框区段、列间分隔线和行式榜单。
- 双场景列中再横排本地/全国会形成四个过窄轨道；本地与全国在各场景内纵向排列，以标题和留白分组。
- 桌面两列必须对齐场景标题、小榜标题和行网格；不强制左右内容等高，也不因空状态改变列宽。
- 当前 Geist、冷中性色、raspberry 品牌色、真实活动封面和 Flowbite 图标已经形成稳定视觉语言，本次不改配色、字体或 Hero 媒体策略。

## 3. 页面与组件边界

```text
src/pages/index.astro
  -> HomepageContent.svelte          # 完整首页快照唯一 owner
       -> FeaturedEventCarousel      # 保持现有 Hero
       -> HomepageIntentFeed         # 新双场景区
            -> HomepageRankedList    # 复用的本地/全国行式小榜
```

- `HomepageContent.svelte` 继续监听唯一 `HOMEPAGE_DATA_EVENT`，不新增全局 store 或分区独立请求。
- 新建 `HomepageIntentFeed.svelte`，接管热度窗口请求、页面生命周期缓存、移动端场景状态及四榜渲染。
- 新建 `HomepageRankedList.svelte` 或等价的小型业务组件，只负责一个有序小榜的标题、行、空状态和错误状态；不新增通用 UI 原语。
- 删除不再被首页使用的 `HomepageToday.svelte` 与旧 `HomepagePopularity.svelte`；`EventRow.svelte` 仍由活动目录行式卡片使用，不因本任务删除。

## 4. 数据合同

### 4.1 数据库层

将当前 `HomepagePopularity` 扩展为两个场景：

```ts
interface HomepageRankedScene {
    local: RankedHomepageEvent[];
    nationwide: RankedHomepageEvent[];
}

interface HomepagePopularity {
    window: PopularityWindow;
    unopened: HomepageRankedScene;
    unended: HomepageRankedScene;
}
```

`RankedHomepageEvent` 只在数据库/服务边界承载排序和展示需要的字段，包括活动标识、标题、规模、行政区、活动日期/时间、开票日期/时间和 `unique_visitors`。不得直接序列化完整 `PublicEventDatabaseRow`。

`HomepageDiscovery` 只保留 `featuredEvents`。旧 `today` 查询和投影随旧今日区一起移除，避免继续执行无消费者的 D1 查询。

### 4.2 公开 DTO

在 `src/lib/public/homepage.ts` 定义单一显式投影 `PublicHomepageRankedEvent`，包含：

- `id`, `title`, `division_code`
- `start_date`, `end_date`, `start_time`, `end_time`
- `admission_start_date`, `admission_start_time`
- `unique_visitors`

不公开 `ticket_url`、`source_url`、联系信息、标签建议、审核状态或完整数据库记录。客户端 `readHomepageResponse()` 与 `readPopularityResponse()` 只通过共享 decoder 接受该精确结构。

### 4.3 完整数据流

```text
events + event_visitors
  -> listHomepageDiscovery / listHomepagePopularity
  -> explicit public projections
  -> Cache API strict guards
  -> SSR index or /api/homepage + /api/popularity
  -> shared client decoders
  -> HomepageContent snapshot
  -> HomepageIntentFeed + ranked lists
```

每个边界只有一个合同 owner。组件不解析数据库行，Cache API 和浏览器不各自发明 DTO 变体。

## 5. 查询设计

### 5.1 四榜批处理

`listHomepagePopularity(db, divisionCode, window)` 继续使用一个 `db.batch()`，其中包含：

1. 本地未开票；
2. 全国未开票；
3. 本地未结束；
4. 全国未结束。

抽取一个受控的 statement builder 共享访客 CTE、公开准入、行政区过滤和稳定排序，场景只提供白名单 SQL 片段，禁止拼接用户输入。

### 5.2 热度与零热度

`recent_visitors` 仍按窗口内 `last_seen_date` 聚合，但改为从合格活动 `LEFT JOIN` 聚合结果，并以 `COALESCE(unique_visitors, 0)` 排序和投影。这样零热度活动只在正热度活动不足 5 条时自然补位。

共同排序前缀：

```text
unique_visitors DESC
```

场景兜底：

- `unopened`: `admission_start_date`, 当日已知开票时间, 活动规模, `events.id`；
- `unended`: 已开始未结束优先, `start_date`, 已知 `start_time`, 活动规模, `events.id`。

每条 statement 独立 `LIMIT 5`。全国榜不排除本地 ID。

### 5.3 中国本地时间

- 沿用 `date/time('now', '+8 hours')` 与现有 ended clause。
- 未开票下界：开票日在今天之后，或开票日为今天且时间为空/晚于当前时间。
- 未开票上界：`date('now', '+8 hours', '+14 days')`，含边界日。
- 当日空时间视为整日 `今日开票 · 时间待定`；当日已知且已到达的时间不再入榜。
- 未结束继续使用现有 date-only end-date 整日有效语义。

本次不修改 schema 或新增索引。候选规模与四条 `LIMIT 5` 查询在当前 D1 规模内可控；若生产观察证明开票字段扫描成为瓶颈，再以独立任务评估索引。

## 6. 缓存与路由

- `home-discovery` 缓存 payload 从 `{ featuredEvents, today }` 收敛为 `{ featuredEvents }`，缓存键仍含地区和中国本地日期。
- `popularity` payload 改为 `{ window, unopened, unended }`，键仍为地区 + 热度窗口，TTL 与 stale 策略不变。
- 严格 guard 会拒绝旧缓存 payload 并回源，因此不需要提升 `eventlist-public-data-v2` namespace；部署后的旧条目只造成一次 miss，不会被误读。
- `/api/popularity` 返回新的双场景热门 DTO；`/api/homepage` 仍以 `Promise.all` 获取 Hero discovery 与 popularity，并只在两者都成功时返回完整快照。
- 管理员写后的 `eventlist-homepage` 与 `eventlist-popularity` purge tag 映射保持不变。

## 7. 交互设计

### 7.1 桌面

- 双场景区标题行左侧为简洁区段标题，右侧为共享 `3 / 7 / 30` 分段控件。
- `lg` 起采用两列 CSS Grid；左 `未开票`、右 `未结束`，使用中线和列间距区分，不加外层卡片。
- 每列依次渲染场景标题、`本地热门` 小榜、`全国热门` 小榜。
- 行使用稳定网格：排名、标题/状态日期、地区、热度；长标题截断但保留可访问链接名和 title/tooltip。

### 7.2 移动端

- 控件顺序固定为 `未结束 / 未开票`，默认 `未结束`。
- hydration 前显示两个场景的顺序流；`onMount` 后启用单场景切换，避免 no-JS 丢失内容。
- 场景切换只改本地 UI 状态，不发请求、不改 URL；地区和 `3 / 7 / 30` 仍是数据请求边界。
- 固定行尺寸、排名列和热度列，避免切换或加载时横向位移。

### 7.3 加载、错误与空状态

- 热度窗口请求沿用真实 href、AbortController、序列号和成功后 `history.replaceState`。
- 加载期间保留旧四榜，在共享控件上显示 Flowbite Spinner，不以 skeleton 替换有效数据。
- 失败时保留旧快照并显示一条区段级 inline error；不为四榜复制四条相同错误。
- 单个小榜为空时在原列表高度约束内显示简洁空状态，其他小榜继续可用。

## 8. 兼容与回滚

- 路由、查询参数 `city` / `trend`、地区偏好键、history 合并逻辑和详情 URL 不变。
- DTO 变更是首页内部公开 API 合同更新；仓库内所有消费者与 strict guards 必须同批升级。
- 无数据库迁移、无新依赖、无管理员写路径变更。
- 回滚时恢复旧查询、DTO、guard 和组件作为一个提交；Cache API 旧/新 payload 都会由对应 strict guard 自动失效回源。
