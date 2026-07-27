# 当前首页合同证据

## 地区

- `src/pages/index.astro` 通过 `resolveSelectedDivision()` 解析 `city`、Cloudflare 地理信息和默认地区。
- `src/components/CitySelector.svelte` 复用 `DivisionPicker`，把选择写入 `eventlist.divisionCode`，并导航到配置的 action 加 `city` 查询参数。
- 当前大型地区块只由首页渲染；公开 `Layout.astro` 尚无页面级导航 slot。

## 首页查询

- `listHomepageNearby()` 当前返回一个从今天起 14 天内、当前尚未结束的推荐，最多四个进行中活动，以及未来三个开始日期、每组最多五条的分组；它不提供今日全部结果。
- `listPublishedEvents()` 已证明地区前缀匹配以及 `active` 日期范围的 SQL 语义，但 `pageSize` 最大为 50，不满足首页“全部今日活动”的严格合同。
- `listHomepagePopularity()` 独立返回本地和全国热门，各限五条，时间窗口为 3、7、30 日；本任务无需修改。

## 活动目录

- `/events` 接受 `city` 并默认展示该地区未结束活动；底部 CTA 只带 `city` 即可让用户继续浏览接下来的活动并自行筛选。
- `active=<date>` 表示活动日期范围覆盖该自然日，`starts=<date>` 表示只在该日开始；本任务不把这些参数预填到底部 CTA。

## 实施影响

- `HomepageNearby` 与 `listHomepageNearby()` 只有首页一个调用者，可以安全替换为更聚焦的首页发现合同。
- 需要保持 `EVENT_SELECT`、`divisionFilter()`、状态过滤、标签聚合和稳定排序，避免另写不一致的活动映射。
- 当前没有覆盖首页 D1 查询或公共导航的自动化测试，必须用 TypeScript/build 和真实本地浏览器行为补足。
