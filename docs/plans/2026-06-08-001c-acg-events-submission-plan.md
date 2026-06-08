---
title: "feat: ACG events anonymous submission"
type: feat
status: active
date: 2026-06-08
origin: docs/brainstorms/2026-06-08-acg-events-directory-requirements.md
parent: docs/plans/2026-06-08-001-feat-acg-events-directory-plan.md
---

# feat: ACG events anonymous submission

## Summary

建立免注册活动提交流程：提交者填写必填活动事实信息，可选填写官方 QQ 群、购票地址、联系方式和一张封面图；服务端用 Turnstile、IP 哈希限频和字段校验保护入口；提交成功后写入待审核记录，批准前不进入公开发现路径。

---

## Scope

**In scope**

- `/submit` 提交页面和表单。
- `/api/submissions` 创建接口。
- Turnstile 服务端校验。
- IP 哈希限频。
- 可选单张封面图上传到 R2。
- pending 活动、提交元数据和封面元数据写入。

**Out of scope**

- 维护者审核 UI。
- 提交者状态页、查询码和自助修改。
- 批准后封面替换和公开管理。

---

## Requirements

- R6. 提交者能免注册提交活动，必填活动名称、地点、开始时间、结束时间、活动类型文本和活动 IP 文本。
- R7. 官方 QQ 群、购票地址、提交者联系方式和一张封面图可选，提交成功后只提示等待审核。
- R8. 未批准提交、封面图、联系方式和内部审核信息不得进入公开发现路径。
- R15. 提交入口具备基础反滥用保护，热度计数不存储明文访客 IP。

---

## Dependencies

- `docs/plans/2026-06-08-001a-acg-events-foundation-plan.md`

---

## Files

- `src/pages/submit.astro`
- `src/pages/api/submissions/index.ts`
- `src/server/submissions/create.ts`
- `src/server/submissions/cover-upload.ts`
- `src/server/security/turnstile.ts`
- `src/server/security/rate-limit.ts`
- `src/components/events/EventSubmissionForm.tsx`
- `.dev.vars.example`
- `tests/server/submissions/*.test.ts`
- `tests/server/security/turnstile.test.ts`
- `tests/server/security/rate-limit.test.ts`
- `tests/e2e/submit-event.spec.ts`

---

## Approach

客户端表单提交 Turnstile token、活动字段和可选封面到 Worker API。服务端先调用 Turnstile siteverify，再用 IP 哈希检查提交冷却和每日上限，随后复用基础计划中的提交校验服务创建 pending 活动和提交元数据。封面图经 Worker 验证大小和类型后写入 R2，D1 只保存待审核封面元数据。

Turnstile token 具有短有效期且单次使用；验证失败时前端提示重新验证，不复用旧 token。所有限频和审计字段只保存 IP 哈希，不写入明文 IP。

---

## Test Scenarios

- Covers AE5. 只提交必填字段且省略联系方式和封面时提交成功，并进入待审核状态。
- 验证缺失必填字段、结束时间早于开始时间、无效购票 URL、无效 QQ 群号返回字段级错误。
- 验证 Turnstile token 缺失、失败、超时和成功路径。
- 验证同一 IP 哈希触发冷却或每日上限后提交被拒绝，且响应和日志不泄露明文 IP。
- 验证封面图可选；提供封面时对象写入 R2，活动批准前公开页不可见。
- 验证联系方式只进入提交或内部字段，不进入公开查询结果。
- 验证提交成功页面只提示等待审核，不承诺自动发布或提供状态页。

---

## Verification

- 匿名提交页面可完成待审核提交。
- 待审核活动不会出现在公开列表、详情或热门榜。
- `pnpm test` 覆盖提交、Turnstile、限频和封面服务。
- 浏览器冒烟覆盖成功提交、字段级错误和 Turnstile 失败提示。

---

## Handoff Notes

- 本计划只创建 pending 数据；批准、拒绝、映射词表和公开展示由 `001d` 负责。
- R2 对象公开 URL 或展示策略应通过 D1 封面元数据控制，不能直接以对象存在作为公开依据。
