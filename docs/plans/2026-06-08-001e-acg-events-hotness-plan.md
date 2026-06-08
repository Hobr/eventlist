---
title: "feat: ACG events hotness and hot lists"
type: feat
status: completed
date: 2026-06-08
origin: docs/brainstorms/2026-06-08-acg-events-directory-requirements.md
parent: docs/plans/2026-06-08-001-feat-acg-events-directory-plan.md
---

# feat: ACG events hotness and hot lists

## Summary

实现活动详情页访问热度和首页 3/7/30 日热门榜。同一访客 IP 在同一活动的同一统计窗口内只贡献一次计数，热门榜只展示已批准且未结束的活动，不暴露明文 IP 或内部观察数据。

---

## Scope

**In scope**

- 详情页访问观察记录。
- IP 哈希去重。
- 可选 KV 冷却键减少重复写入。
- 3/7/30 日热门榜查询。
- 首页热门榜组件和切换。
- 热门榜空状态。

**Out of scope**

- 商业 analytics 仪表盘。
- 访客画像、来源追踪、用户会话分析。
- 历史活动专门榜单。

---

## Requirements

- R4. 已结束活动详情页可直达，但不得出现在默认近期列表或首页热门榜。
- R12. 详情页访问产生热度值，同一访客 IP 在同一活动的同一统计窗口内只计一次。
- R13. 首页展示未结束活动的近 3 日、7 日、30 日热门榜，并排除待审核、拒绝、归档和已结束活动。
- R14. 系统不得向公开访客暴露未批准提交、拒绝记录、内部审核备注、提交者联系方式或明文访客 IP。
- R15. 提交入口具备基础反滥用保护，热度计数不存储明文访客 IP。

---

## Dependencies

- `docs/plans/2026-06-08-001a-acg-events-foundation-plan.md`
- `docs/plans/2026-06-08-001b-acg-events-public-discovery-plan.md`

---

## Files

- `src/server/events/hotness.ts`
- `src/server/events/hotlists.ts`
- `src/pages/api/events/[id]/view.ts`
- `src/components/events/HotEventsTabs.tsx`
- `src/components/events/HotEventList.astro`
- `src/pages/events/[slug].astro`
- `src/pages/index.astro`
- `tests/server/events/hotness.test.ts`
- `tests/server/events/hotlists.test.ts`
- `tests/e2e/home-hotlists.spec.ts`

---

## Approach

详情页加载时记录 approved 活动的访问观察，使用 IP 哈希、活动 ID 和日期粒度唯一约束去重。D1 是事实来源；KV 可以写入短期冷却键，用于减少同一访客重复刷新造成的 D1 写入尝试，但不能替代 D1 约束。

热门榜只查询 approved 且未结束活动，按窗口内独立访问数排序，再用开始时间和活动 ID 做稳定平局排序。3/7/30 日窗口必须使用一致的边界定义，避免同一访问在临界日期表现不稳定。

---

## Test Scenarios

- Covers AE4. 已结束活动即使有访问也不会进入热门榜。
- Covers AE7. 同一 IP 在窗口内多次访问同一详情页只贡献一次计数。
- 验证不同 IP 哈希访问同一活动会分别计数。
- 验证 pending、rejected、archived 活动不会记录公开热度，也不会进入热门榜。
- 验证 3/7/30 日窗口边界和稳定平局排序。
- 验证没有访问数据时热门榜显示空状态或即将开始备用内容，且不误称为错误。
- 验证响应、日志和后台观察数据不包含明文访客 IP。
- 验证 KV 冷却键缺失或失效时，D1 唯一约束仍能保证去重正确。

---

## Verification

- 首页能切换近 3 日、7 日、30 日热门榜。
- 重复请求不会抬高同一 IP 的窗口计数。
- `pnpm test` 覆盖热度记录、热门榜查询和窗口边界。
- 浏览器冒烟覆盖详情页访问后首页榜单变化。

---

## Handoff Notes

- 热度是产品的轻量健康信号，不应扩展成复杂 analytics。
- 如果未来做缓存或边缘优化，必须保留 D1 观察记录的唯一约束作为最终正确性边界。
