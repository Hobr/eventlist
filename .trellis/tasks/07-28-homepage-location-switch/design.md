# Technical Design

## 1. Boundaries

本任务跨越八个边界：

1. `src/pages/api/homepage.ts` 提供一次地区切换所需的完整公开首页快照。
2. `src/lib/public/homepage.ts` 扩展地区、今日活动和完整首页快照 DTO/逐字段投影。
3. `src/lib/public/homepage-client.ts` 定义浏览器响应校验、缓存键、URL/history 元数据和跨岛事件合同。
4. `NavLocationPicker.svelte` 与 `CitySelector.svelte` 将逐级立即导航改为“本地选择 + 应用地区”，并负责请求、错误、历史与偏好提交。
5. `HomepageContent.svelte` 成为三个首页数据区块的单一客户端快照所有者。
6. `FeaturedEventCarousel.svelte` 和 `HomepagePopularity.svelte` 支持父级地区快照变化，且清理旧地区定时器/请求状态。
7. 新增 `EventRow.svelte` 与 `HomepageToday.svelte`，让今日列表在客户端更新，同时让活动目录继续复用同一行卡片视觉。
8. `index.astro` 继续负责首屏 SSR、地区解析和初始错误隔离，只把公开首页快照传给 hydrated 首页内容岛。

不引入 Astro `ClientRouter`、全站 SPA、模块级全局 Svelte store、新依赖或持久化缓存。

## 2. Public Snapshot Contract

`src/lib/public/homepage.ts` 增加：

```ts
interface PublicHomepageDivision {
    code: string;
    name: string;
    label: string;
}

interface PublicEventRow {
    id: number;
    title: string;
    type: EventType;
    scale: EventScale;
    division_code: string;
    venue: string;
    start_date: string;
    end_date: string;
    start_time: string | null;
    end_time: string | null;
    cover_url: string | null;
    tags: string | null;
}

interface PublicHomepageData {
    division: PublicHomepageDivision;
    featuredEvents: PublicFeaturedEvent[];
    today: PublicEventRow[];
    popularity: PublicHomepagePopularity;
}
```

`toPublicHomepageData(division, discovery, popularity)` 只调用逐字段投影函数，不使用对象展开。`index.astro` 初始 props 与 `/api/homepage` 响应必须共用这一投影，确保 SSR 和异步结果字段完全一致。

`GET /api/homepage?city=<region>&trend=<3|7|30>`：

- 使用 `getRegionOptionByCode()` / `isRegionCode()` 验证并取得地区标签；
- 使用 `isPopularityWindow()` 验证窗口；
- 并行调用 `listHomepageDiscovery()` 与 `listHomepagePopularity()`；
- 任一查询失败时返回稳定 500，不提交部分新地区数据；
- 成功返回 `{ ok: true, data: { homepage } }`；
- 无效参数返回 400，错误正文不包含 D1、绑定或异常细节。

原 `/api/popularity` 保留，继续用于已生效地区内的热度窗口切换。

## 3. Client Validation And Cross-Island Event

`src/lib/public/homepage-client.ts` 包含纯函数和类型：

- `readHomepageResponse(body, expectedCity, expectedWindow)`：运行时验证 envelope、地区、窗口、数组及每个公开字段；
- `homepagePopularityCacheKey(city, window)`：唯一生成热门缓存键；
- `buildHomepageUrl(current, city, window)`：保留无关查询参数与 hash，写入 `city` / `trend`；
- `readHomepageHistoryState()` / `mergeHomepageHistoryState()`：在保留其他 `history.state` 字段时管理 `{ city, trend, sourceLabel }`；
- `HOMEPAGE_DATA_EVENT` 与 `HomepageDataEventDetail`：跨 Svelte 岛只提交一个完整、已验证的 `PublicHomepageData`。

不创建 SSR 可见的模块级 writable store。导航岛通过 `window.dispatchEvent(new CustomEvent(...))` 提交成功快照；首页内容岛只监听成功事件，因此不会出现半更新状态。

## 4. Location Picker State Flow

`CitySelector.svelte` 增加向后兼容的受控模式：

- 默认行为仍可调用 `navigateToDivision()`；
- `navigateOnChange={false}` 时只通过 `onchange(value)` 报告待应用值；
- 不再由首页实例在每一级选择时写 localStorage 或导航。

`NavLocationPicker.svelte` 持有：

- `currentDivision`：已生效地区；
- `draftDivisionCode`：侧栏内待应用值；
- `pendingDivisionCode`、`errorMessage`、`AbortController` 和请求序号；
- `panelOpen`：通过为 `SidePanel.svelte` 增加可选 `$bindable` `open` prop 控制。

流程：

1. 打开侧栏时，待应用值从当前已生效地区开始。
2. 省、市、区县变化只更新待应用值。
3. 点击“应用地区”且值未变化时直接关闭；无效或请求中时按钮禁用。
4. 新请求开始时保留当前导航标签和页面内容，显示 Spinner 与 `aria-live` 状态。
5. 请求成功且仍是最新请求时：先得到完整已验证快照，再同步派发事件、更新导航标签、写入历史/URL、保存 `eventlist.divisionCode`、清除错误并关闭侧栏。
6. 请求失败时不改变已生效状态；显示行内错误和目标 `/?city=...&trend=...` 普通导航链接。
7. 新应用会中止旧请求并递增请求序号；卸载时中止请求。

导航触发器在加载时保持可见，侧栏的应用按钮显示加载状态。错误使用 `role="alert"`；按钮、选择器和关闭后的焦点恢复沿用 Flowbite/SidePanel 合同。

## 5. Initial Preference And Browser History

当前 `restoreStoredDivision()` 会整页 `replace()`。首页改为：

- URL 已包含有效 `city` 时，以 URL 为准，不自动应用本地偏好；
- URL 无 `city` 且保存地区与 SSR 地区不同时，复用同一异步加载流程，并在成功后使用 `history.replaceState`；
- 初始 history entry 使用 `replaceState` 写入有效的 `{ city, trend, sourceLabel }` 元数据，但不必改写原始无 `city` URL；
- 用户主动应用地区使用 `pushState`，不会滚动页面；
- `HomepagePopularity` 的窗口切换继续 `replaceState`，同时更新 history 元数据中的窗口；
- `popstate` 优先读取 entry 元数据，其次读取 URL；加载成功后只提交内容，不再 push/replace；
- `popstate` 恢复失败时执行当前 URL 的普通页面导航，以服务端结果重新建立 URL/内容一致性。

这样从 `A/7日 -> B/7日 -> B/30日 -> C/30日` 返回时得到 `B/30日 -> A/7日`，热度窗口切换不会制造多余历史项，地区切换仍可返回。

## 6. Homepage Content Ownership

新增 `HomepageContent.svelte`，接收：

- `initialHomepage: PublicHomepageData`；
- 初始 `regionError`、`discoveryError`、`popularityError`。

它在服务端渲染现有首页顺序，并在 hydration 后监听 `HOMEPAGE_DATA_EVENT`。收到成功快照时只执行一次 `homepage = detail.homepage`，同时清除旧的发现/热门错误。所有子区块在同一 Svelte 更新周期中读取同一地区。

`index.astro` 不再分别创建两个孤立客户端岛和一个 Astro 今日区块，而是渲染一个 `HomepageContent client:load`。为支持后续地区切换，零/单候选 Hero 也会随父岛 hydration；首屏 HTML 仍由 SSR 输出，不出现客户端加载空白。

`FeaturedEventCarousel` 在地区代码变化时重新挂载或显式重置 `index`、暂停状态与计时器，防止旧候选索引越界或自动播放状态泄漏。

## 7. Popularity State And Cache

`HomepagePopularity.svelte` 改为响应父级的 `initialPopularity`、`divisionCode` 和 `divisionLabel`：

- 地区快照变化时中止旧热门请求、递增请求序号、提交新初始榜单并清除旧错误；
- 缓存从 `Map<window, snapshot>` 改为 `Map<"city:window", snapshot>`；
- 地区 API 返回的当前窗口榜单写入对应组合缓存；
- 选择窗口时只查找当前地区的组合键；
- 成功后继续更新 URL hash 为 `#popular`，并同步 history 元数据；
- 旧地区请求即使无法被真正取消，也无法通过请求序号提交。

## 8. Today Event Row Reuse

Astro `EventCard.astro` 不能直接放入 hydrated Svelte 父组件。为保持首页和目录一致：

- 将现有 `variant="row"` 标记提取为 `EventRow.svelte`；
- `EventCard.astro` 的 row 分支通过共享 `toPublicEventRow()` 逐字段投影后传给 `EventRow`，其他 `card / featured / compact` 分支保持 Astro 和 `EventArtwork.astro` 不变；
- `HomepageToday.svelte` 直接使用同一 `EventRow.svelte` 与 `PublicEventRow[]`；
- `EventRow` 使用固定尺寸位图回退、真实封面失败移除、现有 Badge/图标/格式化 helper 和原 Tailwind 类；
- 今日标题、空状态、10 条顺序、唯一分割线及目录 CTA 保持现有结构。

这是行变体的单一实现，不新增第二套全站卡片系统。

## 9. Compatibility And Failure Handling

- 初次 SSR 仍使用 `resolveSelectedDivision()`，Cloudflare IP/default/query 逻辑不变。
- 直接访问、刷新和分享 `/?city=<code>&trend=<window>` 仍由 Astro 服务端恢复同一地区和窗口。
- 首页异步切换全有或全无；初次 SSR 仍可分别显示发现/热门错误。
- 活动目录、投稿页、管理页的地区控件行为不在本任务内；共享 prop 默认值保持现有行为。
- 地区侧栏现有无 JavaScript 能力不扩张；错误回退链接和直接 URL 继续可进行普通服务端导航。
- 不改变 D1 schema、查询排序、主推荐候选、热门统计或今日 10 条上限。

## 10. Rollback

- API/快照异常：删除 `/api/homepage` 和新增 DTO，恢复 index 的三个独立区块。
- 跨岛状态异常：恢复 `NavLocationPicker` 的 `navigateToDivision()` 即时导航；服务端 URL 合同未改变。
- 行卡片回归：恢复 `EventCard.astro` 的 row 分支，删除 `EventRow.svelte` / `HomepageToday.svelte`。
- 热门缓存异常：恢复仅按窗口缓存；只会失去跨地区局部切换能力，不涉及持久数据。

没有迁移或不可逆数据变更。
