# Implementation Plan - 首页双场景信息流设计

> Task: `08-05-homepage-dual-intent-feed` · Phase: planning
> Required order: data contract -> cache/API -> UI -> verification

## 1. 数据查询与领域类型

- [ ] 在 `src/lib/db/homepage.ts` 中定义双场景热门类型与受控 statement builder。
- [ ] 将访客聚合改为合格活动 `LEFT JOIN recent_visitors`，投影 `COALESCE(..., 0)`，实现零热度兜底。
- [ ] 用一次 `db.batch()` 查询本地/全国的未开票与未结束四个榜单，每榜稳定 `LIMIT 5`。
- [ ] 实现中国本地 14 日开票边界、当日已知时间边界、当日空时间语义和既有 ended clause。
- [ ] 将 `HomepageDiscovery` 收敛为仅查询 Hero candidates，移除无消费者的 today statement。

## 2. 公开 DTO、缓存与 API

- [ ] 更新 `src/lib/public/homepage.ts` 的显式双场景投影，限制公开字段。
- [ ] 更新 `src/lib/cache/public-routes.ts` 的 exact-shape guard：discovery 仅含 Hero，popularity 含两个场景及四榜。
- [ ] 保持 Cache API namespace、key、TTL、stale 与 purge tag 不变，验证旧 payload 被 guard 拒绝后回源。
- [ ] 更新 `/api/popularity` 与 `/api/homepage` 的类型和响应，继续保持参数校验、稳定错误和 all-or-nothing 快照。
- [ ] 更新 `src/pages/index.astro` 的 SSR 初始空值、load 和组合投影。

## 3. 客户端合同与状态

- [ ] 更新 `src/lib/public/homepage-client.ts` 的共享 decoder、缓存键和 history snapshot 读取；禁止组件内局部 cast。
- [ ] 保留普通 `3 / 7 / 30` href、AbortController、request sequence、按 `city:window` 缓存及成功后 replaceState。
- [ ] 确认导航地区切换仍通过一次 `/api/homepage` 成功响应提交 Hero 与四榜，不拆分请求。

## 4. 双场景界面

- [ ] 新建 `HomepageIntentFeed.svelte`，实现共享热度控件、桌面双栏、移动 `未结束 / 未开票` 控件和区段级状态。
- [ ] 新建或提取紧凑 `HomepageRankedList.svelte`，复用本地/全国标题、稳定行网格、排名、日期/状态、地区、热度与空状态。
- [ ] `HomepageContent.svelte` 保留 Hero，把旧 `HomepagePopularity + HomepageToday` 替换为新组件。
- [ ] 删除无消费者的旧首页组件，保留活动目录仍使用的 `EventRow.svelte`。
- [ ] 使用现有 Flowbite/Tailwind/token/icon 合同；不新增依赖、外层卡片、嵌套卡片或页面级横向滚动。
- [ ] no-JS/未 hydration 时移动端显示两个场景，hydration 后才启用单场景切换。

## 5. 自动化验证

- [ ] 扩展 `test/homepage-discovery.test.ts`：Hero 查询不再读取 today，精选排序和 14 日合同不退化。
- [ ] 扩展热门查询测试：四条 batch、published/ended 边界、地区前缀、14 日开票、今日已知/未知时间、正/零热度、稳定排序和每榜 5 条。
- [ ] 扩展 `test/public-homepage.test.ts`：新投影、decoder、非法/额外字段拒绝、完整快照、请求竞态与 history 行为。
- [ ] 扩展 `test/public-data-cache.test.ts`：新 discovery/popularity exact shape、旧 payload miss、日期/时间字段格式。
- [ ] 更新 D1 query/runtime contract tests 中依赖旧 statement 数量或旧 DTO 的断言。
- [ ] 添加组件源合同测试：Hero 保留、旧区块移除、桌面两栏、移动控件、no-JS 双内容和共享热度控件。

## 6. 质量与视觉检查

- [ ] `corepack pnpm test`
- [ ] `corepack pnpm lint`
- [ ] `corepack pnpm exec tsc --noEmit`
- [ ] `corepack pnpm build`
- [ ] `git diff --check`
- [ ] 使用 `astro dev --background` 启动本地服务，检查桌面和移动视口的 Hero、双栏/切换、长标题、空榜、加载与错误状态；完成后 `astro dev stop`。
- [ ] 使用本地 D1 或受控 fixture 验证 `/`、`/api/homepage`、`/api/popularity` 的字段、状态码及本地/全国结果。

## 7. 规范、风险与回滚

- [ ] 将最终首页双场景、DTO 和查询合同同步到 frontend design system、backend database 与 public data cache specs。
- [ ] 确认 diff 不包含 migration、依赖锁文件、热度写入语义或管理员 mutation 改动。
- [ ] 回滚点是同一实现提交；若新查询或 DTO 出现回归，整体恢复旧首页查询/投影/guard/组件，避免混合合同。
