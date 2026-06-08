---
title: "feat: ACG events maintainer admin"
type: feat
status: completed
date: 2026-06-08
origin: docs/brainstorms/2026-06-08-acg-events-directory-requirements.md
parent: docs/plans/2026-06-08-001-feat-acg-events-directory-plan.md
---

# feat: ACG events maintainer admin

## Summary

建立由 Cloudflare Access 保护的维护后台，让维护者审核提交、编辑活动事实信息、映射正式词表、管理规模标签和封面，并保留审核历史。这个子计划把匿名提交转成公开目录记录，是产品信任边界的核心。

---

## Scope

**In scope**

- `/admin` 维护后台入口和权限边界。
- Access JWT 校验和本地 mock 管理员身份。
- 待审核队列、活动编辑、批准、拒绝、归档、恢复。
- 活动类型词表、活动 IP 词表、规模标签管理。
- 封面审核、替换、移除。
- 审核和管理审计记录。

**Out of scope**

- 第三方抓取和自动审核。
- 提交者状态页。
- 高级运营报表。

---

## Requirements

- R8. 未批准提交、封面图、联系方式和内部审核信息不得进入公开发现路径。
- R9. 维护者能审核、编辑、批准、拒绝、归档活动，并管理全部活动记录和历史记录。
- R10. 维护者能管理活动规模标签、活动类型词表、活动 IP 词表，并在审核时把提交字符串映射到正式词条。
- R11. 维护者能审核、替换或移除活动封面图。
- R14. 系统不得向公开访客暴露未批准提交、拒绝记录、内部审核备注、提交者联系方式或明文访客 IP。

---

## Dependencies

- `docs/plans/2026-06-08-001a-acg-events-foundation-plan.md`
- `docs/plans/2026-06-08-001c-acg-events-submission-plan.md`

---

## Files

- `src/middleware.ts`
- `src/server/admin/auth.ts`
- `src/server/admin/events.ts`
- `src/server/admin/vocabularies.ts`
- `src/server/admin/covers.ts`
- `src/pages/admin/index.astro`
- `src/pages/admin/events/[id].astro`
- `src/pages/admin/vocabularies.astro`
- `src/pages/admin/scales.astro`
- `src/pages/api/admin/events/[id].ts`
- `src/pages/api/admin/vocabularies.ts`
- `src/components/admin/AdminShell.astro`
- `src/components/admin/EventReviewEditor.tsx`
- `src/components/admin/VocabularyManager.tsx`
- `tests/server/admin/*.test.ts`
- `tests/e2e/admin-review.spec.ts`

---

## Approach

`middleware.ts` 和 API handlers 共享管理员身份解析。生产环境校验 Cloudflare Access JWT 的 issuer、audience、签名和邮箱身份；本地开发只在明确的 dev/test 环境允许 mock 维护者邮箱。后台提供待审核队列、活动详情编辑、批准/拒绝/归档、规模标签排序、类型/IP 词表增改停用和封面替换/移除。

审核页需要把提交字符串、现有词条搜索、新建词条、规模选择和封面审核放在同一工作流中，减少维护者在多个页面之间来回跳转。所有状态变更都写入审核或管理审计记录。

---

## Test Scenarios

- Covers AE6. 待审核提交包含新活动 IP 字符串时，维护者能创建或选择正式 IP 词条后批准。
- Covers AE8. 含联系方式的 pending 提交不会被公开查询看到。
- 验证匿名请求无法访问 `/admin` 和 `/api/admin/*`。
- 验证无效 Access JWT、错误 audience、缺失 issuer 被拒绝。
- 验证本地 mock 管理员身份只在开发/测试模式生效，生产模式不可用。
- 验证批准、拒绝、归档、恢复、封面替换和词表停用都会写入审核或管理审计记录。
- 验证停用的词表不再作为新审核默认选项，但历史活动仍可显示已有词条。
- 验证封面替换或移除后，公开详情页只展示当前批准的封面状态。

---

## Verification

- 维护者能完成“待审核提交 -> 映射词表和规模 -> 批准 -> 公开出现”的闭环。
- 匿名用户无法进入后台或调用后台 API。
- `pnpm test` 覆盖管理员权限、审核流、词表管理和审计记录。
- 浏览器冒烟覆盖待审核详情、批准、拒绝和公开列表变化。

---

## Handoff Notes

- Cloudflare Access policy 的生产控制台配置由部署者在 Zero Trust 中完成；本计划只实现 Worker 侧校验和本地文档要求。
- 后台 UI 先满足可靠审核和管理，再由 `001f` 做可扫描性与移动端 polish。
