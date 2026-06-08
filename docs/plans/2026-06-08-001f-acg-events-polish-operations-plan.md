---
title: "feat: ACG events polish and operations"
type: feat
status: completed
date: 2026-06-08
origin: docs/brainstorms/2026-06-08-acg-events-directory-requirements.md
parent: docs/plans/2026-06-08-001-feat-acg-events-directory-plan.md
---

# feat: ACG events polish and operations

## Summary

在核心发现、提交、后台和热度闭环完成后，做首版体验和运维收尾：视觉一致性、响应式布局、可访问性、seed 数据、README、本地开发、预览、部署和 Cloudflare 配置说明。

---

## Scope

**In scope**

- 公开目录和维护后台的视觉与响应式 polish。
- 表单、按钮、链接和后台工作流的键盘可达性。
- 长文本、无封面、有封面、空状态和错误状态处理。
- demo seed 数据。
- README 和 `.dev.vars.example`。
- D1 migrations、binding 类型生成、Turnstile、R2、Access 和部署说明。

**Out of scope**

- 新增产品功能。
- 高级 analytics。
- R2 自定义域名、图片变体和 CDN 缓存策略。

---

## Requirements

- R1. 公开浏览支持按地点、时间、活动类型、活动 IP 和活动规模筛选。
- R2. 普通列表按维护者管理的规模优先排序，并保留筛选状态。
- R3. 活动卡片和详情页展示发现所需字段。
- R4. 已结束活动详情页可直达，但不得出现在默认近期列表或首页热门榜。
- R5. 详情页在官方 QQ 群或购票地址存在时提供清晰官方渠道入口。
- R9. 维护者能审核、编辑、批准、拒绝、归档活动，并管理全部活动记录和历史记录。
- R16. 本地开发、测试、部署文档覆盖 D1、KV、R2、Turnstile、Access 和类型生成。

---

## Dependencies

- `docs/plans/2026-06-08-001b-acg-events-public-discovery-plan.md`
- `docs/plans/2026-06-08-001c-acg-events-submission-plan.md`
- `docs/plans/2026-06-08-001d-acg-events-admin-plan.md`
- `docs/plans/2026-06-08-001e-acg-events-hotness-plan.md`

---

## Files

- `src/styles/global.css`
- `src/layouts/Layout.astro`
- `src/components/events/*.astro`
- `src/components/events/*.tsx`
- `src/components/admin/*.astro`
- `src/components/admin/*.tsx`
- `README.md`
- `.dev.vars.example`
- `scripts/seed-events.ts`
- `tests/fixtures/events.ts`
- `tests/e2e/discover-events.spec.ts`
- `tests/e2e/submit-event.spec.ts`
- `tests/e2e/admin-review.spec.ts`
- `tests/e2e/home-hotlists.spec.ts`

---

## Approach

公开站点采用目录型首页，不做营销 hero。筛选、列表、热门榜和详情页优先扫描效率；后台采用工作台布局，支持待审核、已发布、词表和规模标签之间快速切换。所有按钮、表单和链接保留键盘可达性、可见焦点和明确状态。

README 保留现有跑活清单，并补充本地 D1 migrations、Cloudflare binding 类型生成、Turnstile 测试 key、R2 本地预览、Access 生产配置和 demo seed。种子数据覆盖多城市、多规模、多状态、多热度窗口。

---

## Test Scenarios

- 验证移动视口下筛选控件、活动卡片、热门榜和详情页官方渠道不重叠。
- 验证后台列表在长标题、长活动 IP、长地点下仍可扫描。
- 验证表单错误信息关联到对应字段，键盘可以完成提交与后台审核。
- 验证有封面和无封面活动的卡片尺寸稳定。
- 验证 seed 生成的数据能支持首页、筛选、详情、提交和后台冒烟。
- 验证 README 中提到的脚本名都存在于 `package.json`。
- 验证 `.dev.vars.example` 不包含真实 secret，并清楚区分公开变量和 Worker secrets。
- 验证桌面和移动端主要页面没有明显文本溢出或控件重叠。

---

## Verification

- 浏览器级截图检查桌面和移动端首页、详情页、提交页、后台审核页。
- 新开发者可以按 README 安装依赖、应用本地 migrations、灌入 demo 数据、运行测试并预览站点。
- `pnpm lint`、`pnpm test` 和关键 e2e 冒烟通过。

---

## Handoff Notes

- 这个子计划应该在功能闭环之后执行，避免在仍频繁变动的页面上反复 polish。
- R2 自定义域名、图片变体和 CDN 缓存策略可以在首版可用后单独开计划优化。
