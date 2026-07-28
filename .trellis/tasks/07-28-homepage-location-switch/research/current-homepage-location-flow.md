# 当前首页地区切换与数据流

## 已确认现状

- `src/components/NavLocationPicker.svelte` 在导航栏 `SidePanel` 中复用 `CitySelector.svelte`。
- `CitySelector.svelte:23-25` 在 `DivisionPicker` 的每次层级变化后调用 `navigateToDivision()`。
- `src/lib/division-preference.ts:19-34` 会先写入 `eventlist.divisionCode`，再调用 `window.location.assign()`；恢复已保存地区时使用 `window.location.replace()`。
- `DivisionPicker.svelte` 的 `mode="region"` 允许省、市、区县任一级作为有效地区，因此无需等待用户选到区县。
- `SidePanel.svelte` 当前自行持有 `open` 状态，没有向调用方暴露关闭控制；若应用成功后需要主动关闭，应增加可选的 bindable `open` prop，并保持现有调用方默认行为不变。
- 地区侧栏依赖 Svelte/Flowbite 才能打开和完成三级联动；当前不存在可用的无 JavaScript 地区选择器。

## 首页服务端数据流

`src/pages/index.astro`：

1. 通过 `resolveSelectedDivision()` 从 `city`、Cloudflare 地理信息或默认值解析 `RegionOption`。
2. 并行执行 `listHomepageDiscovery()` 与 `listHomepagePopularity()`。
3. 将完整 D1 记录投影为 `PublicFeaturedEvent[]` 与 `PublicHomepagePopularity`。
4. 分别渲染 `FeaturedEventCarousel.svelte`、`HomepagePopularity.svelte` 和 Astro `EventCard variant="row"` 今日列表。

初始页面允许发现数据与热门数据独立失败；异步地区切换若要保持所有区块使用同一地区，应采用全有或全无的快照提交，失败时保留旧快照。

## 现有客户端岛

- `FeaturedEventCarousel.svelte` 接收公开主推荐数组，但需要在地区数据变化时重置轮播索引和播放状态。
- `HomepagePopularity.svelte` 当前缓存键只有 `3 | 7 | 30`，并把初始 props 捕获为一次性状态；地区切换后必须支持响应新 props，并将缓存键扩展为 `divisionCode + window`。
- 今日活动仍是 Astro 标记。Astro 组件不能作为可动态更新的 hydrated Svelte 子组件使用，因此需要一个客户端可渲染的今日列表边界。
- `EventCard.astro` 的 `row` 分支是首页和活动目录共同使用的视觉合同。为避免复制整套行卡片，适合把该分支抽为可 SSR、也可在 Svelte 岛中更新的 `EventRow.svelte`，其余 EventCard 变体保留在 Astro。

## 公开数据边界

现有 `src/lib/public/homepage.ts` 已逐字段投影主推荐与热门榜。地区快照还需要：

- 地区：`code`、`name`、`label`；
- 今日活动：行卡片所需的 `id`、`title`、`type`、`scale`、`division_code`、`venue`、日期/时间、`cover_url`、`tags`；
- 现有 `featuredEvents`；
- 现有 `popularity`。

不得返回 `submitter_contact`、`source_url`、`reject_reason`、`tag_suggestions`、状态或完整 `EventRecord`。

## 推荐状态边界

- 新建 `GET /api/homepage?city=<region>&trend=<3|7|30>`，验证参数并并行复用现有两个查询。
- 新建一个首页内容 Svelte 岛，作为主推荐、热门榜与今日列表的单一已生效快照所有者。
- 导航地区岛负责选择、请求、加载/错误和浏览器历史；成功后通过一个带类型的 `window` 自定义事件把完整公开快照提交给首页内容岛。
- 不使用模块级 Svelte store 共享 SSR 状态，避免 Cloudflare SSR 请求间的全局状态泄漏。
- 用户应用地区使用 `history.pushState`；初始化已保存地区使用 `replaceState`；热门窗口继续使用 `replaceState`。
- 每个 history entry 保存有效地区/窗口元数据，`popstate` 据此无刷新请求并恢复；恢复请求失败时退回普通页面导航，避免 URL 与内容长期不一致。

## 测试与环境约束

- 项目没有 Playwright，浏览器交互继续使用本地 Astro 后台服务器和应用内浏览器验证。
- 现有 Node 测试可以覆盖公开投影、响应解析、URL/history 元数据、缓存键和 API 源码合同。
- 完整质量门为 `corepack pnpm test`、`corepack pnpm lint`、`corepack pnpm exec tsc --noEmit`、`corepack pnpm build` 和 `git diff --check`。
