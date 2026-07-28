# Technical Design

## Boundaries

本任务跨越七个边界：

1. `src/lib/db/queries.ts` 将首页主推荐从单条结果改为最多五条候选，并在中国本地时间语义下扩大候选范围、调整稳定排序。
2. `src/pages/index.astro` 继续负责地区解析、D1 查询和错误隔离，把经过投影的主推荐候选及初始热门数据传给两个首页组件。
3. 新增 `src/components/FeaturedEventCarousel.svelte`，用 Flowbite Svelte `Carousel` 负责滑动与过渡，用本地状态补足自动播放暂停策略。
4. `src/lib/public/homepage.ts` 定义浏览器可见的主推荐/热门最小 DTO 和唯一投影函数，隔离完整数据库记录。
5. 新增 `GET /api/popularity`，验证地区/窗口并按现有 JSON envelope 返回一组公开本地/全国榜单。
6. 新增 `src/components/HomepagePopularity.svelte`，服务端渲染初始榜单，并在 hydration 后按需加载、缓存和切换窗口。
7. 聚焦测试、后端数据库/API 规范与前端设计规范共同锁定查询、公开字段和交互契约。

今日活动仍由现有查询与 Astro 标记渲染，不进入任一新组件；数据查询、列表/空状态结构和 10 场上限保持不变，只收紧地区化标题与目录 CTA 文案。主推荐轮播与热门榜切换是独立 Svelte 岛：一方失败或暂停不得改变另一方状态。

## Data Flow And Contracts

```text
selected division
  -> listHomepageDiscovery(D1, divisionCode)
  -> HomepageDiscovery { featuredEvents: EventRecord[0..5], today: EventRecord[0..10] }
  -> index.astro isolates discovery errors
  -> toPublicFeaturedEvents(full database rows)
  -> FeaturedEventCarousel(public events, divisionLabel)
  -> zero candidate fallback | one static hero | multi-candidate Flowbite carousel

selected division + URL trend
  -> listHomepagePopularity(D1, divisionCode, trend)
  -> toPublicHomepagePopularity(full database rows)
  -> HomepagePopularity.svelte(initial public snapshot)
  -> click uncached window
  -> GET /api/popularity?city=<code>&trend=<3|7|30>
  -> public snapshot cache[window]
  -> replaceState + local/nationwide list update
```

`HomepageDiscovery.featured` 改名为 `featuredEvents` 并改为数组，避免用单数属性承载复数。首页初始值同步改为 `{ featuredEvents: [], today: [] }`。该类型只在查询层、首页和聚焦测试中使用，不影响公共活动目录或 API 响应。

## Candidate Query

主推荐语句继续作为 `listHomepageDiscovery()` 的第一个 D1 batch 语句，并保留：

- `events.status = published`；
- 当前地区的精确或前缀匹配；
- `NOT EVENT_ENDED_CLAUSE`，包括“结束日期为今天且明确结束时间已到”的排除规则；
- 标签聚合和按活动 ID 分组。

开始日期条件改为仅限制上界：

```sql
date(events.start_date) <= date('now', '+8 hours', '+14 days')
```

不设置开始日期下界，因此更早开始但仍未结束的长周期活动可以进入候选。排序依次为：

1. 已经开始的活动优先。开始日期早于今天，或开始日期为今天且 `start_time` 为空/已经到达，均视为已经开始。
2. 规模按 `mega > large > mid > small`。
3. 开始日期升序，保持当前同规模稳定规则。
4. 有封面优先。
5. 活动 ID 升序。

查询使用 `LIMIT 5`，直接返回全部成功结果；今日列表的过滤、排序和 `LIMIT 10` 保持不变。

## Hero And Carousel Composition

`FeaturedEventCarousel.svelte` 接收 `PublicFeaturedEvent[]` 与地区标签，整个组件自身就是现有圆角 Hero 卡片，不再包一层内部卡片。公开候选仅包含 `id`、`title`、`scale`、`start_date`、`end_date`、`start_time`、`end_time`、`cover_url`，足以支持当前展示但不包含联系方式、来源或审核字段：

- `0` 个候选：使用现有 `/images/event-fallback.webp`、站名、简介和“浏览活动目录”入口。
- `1` 个候选：服务端渲染单张 Hero，不创建 Flowbite `Carousel`、定时器、控制按钮或分页指示。
- `2..5` 个候选：背景图片和底部活动信息随 Flowbite `Carousel` 的受控 `index` 一起切换；站名、简介和地区标签保持固定位置。

首页根据候选数量决定 hydration：多候选使用 `client:load` 以立即启动交互；零/单候选只进行 Svelte 服务端渲染，避免无意义的客户端运行时。每张封面使用活动 `cover_url`，空值或加载失败回退到现有位图占位图。首张图片 eager，其余图片按轮播当前项加载，不预加载全部远程封面。

组件复用 `formatEventSchedule()` 和 `getEventScaleLabel()`；推荐说明统一表达为“重要活动 · <规模>”，避免把数据库内部的“进行中优先”排序规则直接写进面向用户的文案，也不在客户端重新实现时间分类。

## Carousel Interaction And Accessibility

Flowbite Svelte `Carousel` 提供受控索引、触摸滑动、切换过渡和上下文控制。组件使用 Flowbite `Controls`/`CarouselIndicators`，并通过 `flowbite-svelte-icons` 提供上一张、下一张、播放和暂停图标，不手写 SVG。

自动播放由组件自己的 6 秒计时器控制，而不是把暂停策略委托给 Flowbite 的单一 `duration` 属性。以下任一条件成立时不创建或清除计时器：

- 鼠标位于 Hero 内；
- 键盘焦点位于 Hero 内；
- 用户点击了主动暂停；
- `matchMedia('(prefers-reduced-motion: reduce)')` 匹配；
- 候选少于两个。

主动暂停只能由播放按钮恢复；悬停/焦点离开不能覆盖它。轮播容器提供中文可访问名称、`aria-roledescription="carousel"` 和方向键处理。图标按钮有 `aria-label` 与 `title`，焦点样式使用现有语义 token。稳定的响应式最小高度、内容宽度和控制区位置避免图片或长标题切换时改变首屏尺寸。

## Public Popularity Projection And API

`src/lib/public/homepage.ts` 还定义：

```ts
interface PublicPopularEvent {
    id: number;
    title: string;
    division_code: string;
    start_date: string;
    unique_visitors: number;
}

interface PublicHomepagePopularity {
    window: 3 | 7 | 30;
    local: PublicPopularEvent[];
    nationwide: PublicPopularEvent[];
}
```

`toPublicFeaturedEvents()` 和 `toPublicHomepagePopularity()` 均逐字段构造对象；首页两个初始 props 和 API 响应必须调用这些共享投影。禁止对象展开或把 `EventRecord[]`/`PopularEvent[]` 直接传给 hydrated 组件，因为它们包含 `submitter_contact`、来源与审核字段。

`GET /api/popularity?city=<region>&trend=<window>` 使用 `isRegionCode()` 校验省/市/区县代码，并使用共享的 `isPopularityWindow()` 验证只允许 `3 | 7 | 30`。无效参数返回 400 JSON；D1/运行时失败返回不泄漏内部错误的 500 JSON。成功返回：

```json
{
    "ok": true,
    "data": {
        "popularity": {
            "window": 7,
            "local": [],
            "nationwide": []
        }
    }
}
```

接口复用 `listHomepagePopularity()` 的当前两语句 batch，不改变访问量统计或排序规则。客户端缓存已足够满足本任务，不增加 Cloudflare Cache API 或长期缓存头。

## Popularity Island State Flow

`HomepagePopularity.svelte` 接收经过投影的初始快照、地区代码和地区文案。现有 `PopularEventList.astro` 的两列展示合并到该业务组件的可复用 snippet，旧 Astro 组件在无其他消费者后删除。

控件保留真实 `href="/?city=...&trend=...#popular"`，因此服务端渲染和禁用 JavaScript 时仍可完整导航。hydration 后点击处理流程为：

1. 已缓存窗口：立即更新选中窗口和两组列表。
2. 未缓存窗口：阻止导航、保留当前列表、标记 `pendingWindow` 并显示 Flowbite `Spinner`。
3. 新请求开始前中止上一个 `AbortController`，并使用递增请求编号防止不可中止的迟到响应提交。
4. 成功：写入窗口缓存、切换当前快照、清除错误并更新 URL。
5. 失败：当前快照不变，清除 pending，并在控件附近显示 `role="alert"` 错误；被主动中止的请求不显示错误。

URL 更新通过当前 `window.location.href` 创建 `URL`，设置 `city`、`trend` 和 `#popular` 后调用 `history.replaceState`。不派发导航、不滚动页面、不为每次 tab 切换增加返回历史。刷新或分享仍由现有 Astro `parsePopularityWindow()` 和地区解析恢复状态。

三段控件使用 `role="tablist"`、`role="tab"`、`aria-selected`、`aria-controls` 和方向键焦点移动；当前面板使用 `aria-live="polite"`，加载链接使用 `aria-busy`。项目级 Tailwind token 继续控制 segmented 外观，Flowbite `Spinner` 提供加载反馈。

## Compatibility And Failure Handling

- 地区解析、发现/热门查询的 `Promise.allSettled()` 隔离逻辑保持不变。
- 发现查询失败继续展示现有错误提示；无候选是正常空状态，不当作错误。
- 热门查询和排名定义不变；仅把窗口切换从完整导航增强为按需数据请求。
- 无 JavaScript 时热门链接保持当前完整导航行为，服务端初始榜单仍可读。
- 今日模块、继续浏览链接和 `trend`/`city` URL 规则保持兼容。
- 不增加依赖、不调用 Flowbite DOM runtime、不引入手写组件 CSS。
- 回滚时可分别还原主推荐候选数组/Carousel，或热门 DTO/API/Svelte 岛并恢复 `PopularEventList.astro`；没有迁移或持久数据变化。

## Risks And Mitigations

- Flowbite Carousel 本身不提供产品要求的悬停、焦点和用户暂停组合状态；本地计时器只负责推进受控索引，滑动和过渡仍由 Flowbite 所有。
- 远程封面可能失败；所有图片都有本地位图回退，且固定尺寸避免布局偏移。
- 自动轮播可能干扰阅读；6 秒节奏、显式暂停按钮、悬停/焦点暂停和减少动态效果禁用共同限制该风险。
- 查询取消开始日期下界后可能纳入很早开始的长周期活动；`NOT EVENT_ENDED_CLAUSE`、进行中优先和五条上限仍保证结果有限且可解释。
- 将完整 `EventRecord`/`PopularEvent` 传给 hydrated Svelte 会泄漏内部字段；共享首页白名单投影、类型和序列化测试是硬性边界。
- 快速点击会产生请求竞态；`AbortController` 与请求编号共同保证只有最新请求可以提交。
- API 首次请求可能失败或较慢；现有榜单保持可见，错误可恢复，成功结果在页面会话内缓存。
