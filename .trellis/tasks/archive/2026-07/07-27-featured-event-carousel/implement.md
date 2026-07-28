# Implementation Plan

## Ordered Checklist

### Main Recommendation

- [ ] 将 `HomepageDiscovery` 的主推荐契约改为 `featuredEvents: EventRecord[]`，更新首页空值和所有消费者。
- [ ] 修改 `listHomepageDiscovery()` 主推荐 SQL：保留未结束与地区过滤，仅限制开始日期上界为未来 14 天，增加“已经开始优先”的中国本地时间排序，并将上限改为 5。
- [ ] 扩展 `test/homepage-discovery.test.ts`，断言无开始日期下界、未来 14 天上界、未结束条件、进行中优先排序、稳定次级排序、`LIMIT 5` 和候选数组返回值；同时保证今日列表仍为 `LIMIT 10`。
- [ ] 在 `src/lib/public/homepage.ts` 定义主推荐最小公开 DTO/投影，并新增 `FeaturedEventCarousel.svelte`，只接收公开字段并实现零/单/多候选分支、完整 Hero 卡片切换、图片回退、详情链接和稳定响应式布局。
- [ ] 使用 Flowbite Svelte Carousel/Controls/Indicators 和 Flowbite Svelte Icons 实现触摸、方向键、上一张/下一张、分页与播放/暂停控制。
- [ ] 实现 6 秒自动播放及悬停、焦点、主动暂停、`prefers-reduced-motion` 四类暂停条件；确保单候选没有计时器和轮播控件。
- [ ] 将首页原有 Hero 标记替换为新组件：多候选 `client:load`，零/单候选仅服务端渲染；保持今日数据查询、错误提示、列表/空状态结构和目录链接行为不变，只收紧标题与 CTA 文案。

### Popularity Switching

- [ ] 在 `src/lib/events/popularity.ts` 增加严格的窗口类型守卫，并在共享 `src/lib/public/homepage.ts` 定义最小公开热门 DTO 与逐字段投影函数。
- [ ] 新增 `GET /api/popularity`：验证 `city`/`trend`，调用现有排名查询，返回投影后的 JSON；无效参数为 400，内部失败为稳定 500 且不泄漏错误细节。
- [ ] 新增 `HomepagePopularity.svelte`，服务端渲染初始公开快照，并将现有本地/全国热门列表标记移入可复用 snippet。
- [ ] 将 `3 / 7 / 30` 链接渐进增强为按需请求：按窗口缓存、保留旧榜、Flowbite Spinner、失败提示、AbortController 和请求编号防竞态。
- [ ] 在成功切换时用 `history.replaceState` 同步 `city`、`trend`、`#popular`，实现 tab/方向键语义，并保留无 JavaScript 链接降级。
- [ ] 首页只把投影后的主推荐/初始榜单传给 hydrated 组件；删除无其他消费者的 `PopularEventList.astro`，不得序列化完整 `EventRecord`/`PopularEvent`。
- [ ] 添加首页公开 DTO/窗口守卫聚焦测试，断言两个投影和 JSON 均不含 `submitter_contact`、`source_url`、审核状态等非展示字段；补充 API 参数和响应路由检查。

### Specs And Verification

- [ ] 更新 `.trellis/spec/backend/database-guidelines.md` 的首页发现返回类型、候选窗口、排序和测试合同。
- [ ] 更新 `.trellis/spec/backend/error-handling.md` 的公开热门 API envelope、参数验证、字段最小化和失败合同。
- [ ] 更新 `.trellis/spec/frontend/design-system.md` 的首页首屏、Flowbite Carousel、自动播放暂停和无嵌套卡片合同。
- [ ] 在前端规范中补充热门榜按需缓存、渐进增强链接、URL 同步、加载/错误/竞态状态合同。
- [ ] 执行聚焦测试、完整质量门和本地浏览器响应式/交互检查。

## Validation Commands

```bash
corepack pnpm test test/homepage-discovery.test.ts
corepack pnpm test test/public-homepage.test.ts
corepack pnpm test
corepack pnpm lint
corepack pnpm exec tsc --noEmit
corepack pnpm build
git diff --check
```

按项目约定启动和管理开发服务器：

```bash
corepack pnpm exec astro dev --background
corepack pnpm exec astro dev status
corepack pnpm exec astro dev logs
```

在本地浏览器验证 `390x844`、`768x1024` 和 `1440x900`：

- 首屏无横向滚动、文字遮挡或切换导致的尺寸跳动；
- 一个候选不显示轮播控制，多个候选可通过按钮、方向键、分页点和触摸切换；
- 自动播放约每 6 秒推进，悬停、焦点、主动暂停时停止；
- 封面失败时显示 `/images/event-fallback.webp`；
- 每张详情 CTA 指向当前活动 ID；
- 热门和今日模块的位置、内容及继续浏览链接未回归；
- `3 / 7 / 30` 首次切换只更新热门区域和 URL，不重载文档或改变滚动位置；再次选择已缓存窗口不重复请求；
- 快速连续选择最终显示最后一次选择，失败时保留原榜单并可再次操作；
- 禁用 JavaScript 或直接访问 `/?city=<code>&trend=<window>#popular` 仍显示正确服务端榜单。

使用 `curl` 或浏览器网络面板验证：

- `/api/popularity` 的无效 `city`/`trend` 返回 400 JSON；
- 有效请求只包含 `id`、`title`、`division_code`、`start_date`、`unique_visitors`；
- 响应正文不含 `submitter_contact`、`source_url`、`tag_suggestions`、`reject_reason`。

## Risky Files And Rollback Points

- `src/lib/db/queries.ts`：共享首页发现 batch；必须确认第二条今日查询和热门查询未被改动。
- `src/pages/index.astro`：首页三模块的数据流和错误隔离；替换两个区块时保留导航位置选择器和今日模块。
- `src/components/FeaturedEventCarousel.svelte`：客户端定时器与媒体查询监听必须在卸载或状态变化时清理。
- `src/lib/public/homepage.ts`、两个 hydrated props 与 `/api/popularity`：这是新的公开序列化边界，禁止对象展开完整数据库记录。
- `src/components/HomepagePopularity.svelte`：缓存、AbortController、请求编号、选中窗口和 URL 必须作为一条原子成功路径更新。
- `src/components/PopularEventList.astro`：只有新 Svelte 组件完整承接服务端标记和空状态后才能删除。
- `test/homepage-discovery.test.ts`：测试应验证 SQL 合同而不是重复实现整个查询。
- 三份相关 Trellis 规范：代码和规范必须在同一提交中保持一致。

如果质量门失败，先按上述边界定位并回退最后一个检查项对应的改动；不得重置或覆盖任务之外的用户修改。

## Review Gates Before Activation

- PRD 不再包含未决产品问题，并记录 5 条上限、进行中优先、整块 Hero 轮播、6 秒自动播放和热门榜按需缓存。
- 设计与执行计划对候选类型、SQL 时间语义、Flowbite 边界、暂停状态、公开 DTO、API 和客户端竞态描述一致。
- `implement.jsonl` 与 `check.jsonl` 均包含真实规范/思考指南条目。
- 用户明确批准本次最终规划摘要后，才运行 `task.py start`。
