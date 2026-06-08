---
title: "feat: ACG events public discovery"
type: feat
status: completed
date: 2026-06-08
origin: docs/brainstorms/2026-06-08-acg-events-directory-requirements.md
parent: docs/plans/2026-06-08-001-feat-acg-events-directory-plan.md
---

# feat: ACG events public discovery

## Summary

把 Astro 欢迎页替换为真实 ACG 活动目录体验：访客可以筛选近期活动、扫读活动卡片、进入详情页，并在有官方 QQ 群或购票地址时前往官方渠道。这个子计划聚焦公开发现闭环，不包含匿名提交、后台审核和热度统计实现。

---

## Scope

**In scope**

- 首页活动筛选和列表。
- 可分享或可恢复的筛选 URL。
- 活动卡片、详情页、官方渠道入口。
- 已结束活动默认隐藏但详情可直达。
- 公开页面的空状态和基础响应式布局。

**Out of scope**

- 匿名提交表单。
- 维护者后台。
- 详情页访问计数和热门榜真实数据。
- 完整视觉 polish；此处只做到发现闭环可用。

---

## Requirements

- R1. 公开浏览支持按地点、时间、活动类型、活动 IP 和活动规模筛选。
- R2. 普通列表按维护者管理的规模优先排序，并保留可分享或可恢复的筛选状态。
- R3. 活动卡片和详情页展示名称、地点、日期范围、类型、活动 IP、规模、封面图可用状态和详情入口。
- R4. 已结束活动详情页可直达，但不得出现在默认近期列表或首页热门榜。
- R5. 详情页在官方 QQ 群或购票地址存在时提供清晰官方渠道入口。

---

## Dependencies

- `docs/plans/2026-06-08-001a-acg-events-foundation-plan.md`

---

## Files

- `src/layouts/Layout.astro`
- `src/pages/index.astro`
- `src/pages/events/[slug].astro`
- `src/components/events/EventFilters.tsx`
- `src/components/events/EventCard.astro`
- `src/components/events/EventDetail.astro`
- `src/components/events/OfficialLinks.astro`
- `src/styles/global.css`
- `tests/server/events/public-query.test.ts`
- `tests/e2e/discover-events.spec.ts`

---

## Approach

首页直接呈现筛选控件、活动列表和热门榜占位接入点。筛选状态写入 URL 查询参数，页面服务端读取参数后调用基础计划中的公开查询服务。活动卡片保持紧凑、可扫描；详情页展示公开字段、封面图和官方渠道入口。没有封面时使用稳定占位视觉，不能阻塞活动展示。

Astro 页面负责服务端渲染和数据获取；筛选交互可使用 React island，但筛选序列化逻辑必须来自 `src/lib/event-filters.ts`，避免客户端和服务端各自理解筛选参数。

---

## Design Notes

- 网站首屏就是目录工具，不做营销 hero。
- 筛选、列表、热门榜占位和活动卡片需要适合快速扫读。
- 长活动名、长场馆名、长活动 IP 名称必须换行或截断得体，不能撑破布局。
- 空结果文案表达“没有匹配近期活动”，不能暗示全站没有数据。

---

## Test Scenarios

- Covers AE1. 浏览器按地点筛选后列表只显示匹配的已批准近期活动，URL 保留筛选状态。
- Covers AE3. 详情页展示官方 QQ 群和购票地址，并提供可点击或可复制入口。
- Covers AE4. 已结束活动不出现在首页列表，但直达详情页仍可访问。
- 验证默认首页只显示未结束、已批准活动。
- 验证活动列表按规模优先级排序。
- 验证筛选 URL 刷新后仍恢复同一结果。
- 验证空结果显示“没有匹配近期活动”语义。
- 验证移动端活动卡片中的长活动名、长场馆名和长 IP 名不会撑破布局。

---

## Verification

- 首页和详情页不再显示 Astro welcome。
- 访客可以从筛选列表进入详情，并看到官方渠道。
- `pnpm test` 覆盖公开查询和筛选参数。
- 浏览器冒烟覆盖桌面和移动端首页、筛选结果、详情页。

---

## Handoff Notes

- 首页热门榜区域在本计划可以保留占位或静态空状态，真实数据由 `001e` 接入。
- 提交入口链接可以预留，但提交表单由 `001c` 实现。
