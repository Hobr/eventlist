---
title: "feat: ACG events foundation and domain services"
type: feat
status: active
date: 2026-06-08
origin: docs/brainstorms/2026-06-08-acg-events-directory-requirements.md
parent: docs/plans/2026-06-08-001-feat-acg-events-directory-plan.md
---

# feat: ACG events foundation and domain services

## Summary

建立 ACG 活动目录首版的 Cloudflare 数据基础、测试基础和服务端领域层。这个子计划不做正式公开页面或后台界面，目标是先把状态、可见性、词表、筛选、校验和 IP 哈希规则变成可复用、可测试的底座。

---

## Scope

**In scope**

- D1/KV/R2/Turnstile/Access bindings 和类型生成基础。
- D1 schema、migrations、fixture 和测试替身。
- 活动、提交、词表、规模标签、审核记录、封面元数据和访问观察表。
- 公开查询、后台查询、提交校验、词表映射和 IP 哈希服务。

**Out of scope**

- 首页、详情页、提交页和后台 UI。
- Turnstile siteverify 调用和 R2 封面上传细节。
- 首页热门榜展示。

---

## Requirements

- R1. 公开浏览支持按地点、时间、活动类型、活动 IP 和活动规模筛选。
- R2. 普通列表按维护者管理的规模优先排序，并保留筛选状态。
- R6. 提交者能免注册提交活动，必填活动名称、地点、开始时间、结束时间、活动类型文本和活动 IP 文本。
- R8. 未批准提交、封面图、联系方式和内部审核信息不得进入公开发现路径。
- R9. 维护者能审核、编辑、批准、拒绝、归档活动，并管理全部活动记录和历史记录。
- R10. 维护者能管理活动规模标签、活动类型词表、活动 IP 词表，并在审核时把提交字符串映射到正式词条。
- R11. 维护者能审核、替换或移除活动封面图。
- R12. 详情页访问产生热度值，同一访客 IP 在同一活动的同一统计窗口内只计一次。
- R14. 系统不得向公开访客暴露未批准提交、拒绝记录、内部审核备注、提交者联系方式或明文访客 IP。
- R15. 提交入口具备基础反滥用保护，热度计数不存储明文访客 IP。
- R16. 本地开发、测试、部署文档覆盖 D1、KV、R2、Turnstile、Access 和类型生成。

---

## Key Decisions

- D1 是活动状态、词表、审核轨迹、封面元数据和热度观察的事实来源。
- KV 只作为提交限频、冷却和可选重复写入抑制，不作为权威状态存储。
- 提交和公开记录共享活动实体；待审核状态转为批准状态，而不是复制出另一张公开表。
- 提交阶段保留用户输入的活动类型和活动 IP 字符串；公开查询只使用维护者映射后的正式词条。
- 访客 IP 只以带密钥盐的哈希参与限频和热度，不存储明文。
- 测试先覆盖服务端规则，再让后续页面和 API 调用这些规则。

---

## Files

- `package.json`
- `pnpm-lock.yaml`
- `wrangler.jsonc`
- `worker-configuration.d.ts`
- `src/env.d.ts`
- `drizzle.config.ts`
- `migrations/*`
- `src/server/db/schema.ts`
- `src/server/db/client.ts`
- `src/server/db/test-utils.ts`
- `src/server/events/queries.ts`
- `src/server/events/validation.ts`
- `src/server/events/visibility.ts`
- `src/server/events/vocabularies.ts`
- `src/server/security/ip-hash.ts`
- `src/lib/event-filters.ts`
- `tests/setup/*`
- `tests/fixtures/events.ts`
- `tests/server/events/*.test.ts`
- `tests/server/security/ip-hash.test.ts`

---

## Approach

添加 Vitest 和必要的测试环境，建立 Cloudflare binding 替身，确保服务端代码能在本地测试中显式接收 DB、KV、R2 和 vars。用 Drizzle 定义活动、提交、词表、规模标签、审核记录、封面元数据和访问观察表；migrations 使用 `migrations/` 默认目录。

领域层按职责拆分：`queries.ts` 负责公开和后台查询入口，`validation.ts` 负责提交字段校验，`visibility.ts` 负责公开边界，`vocabularies.ts` 负责正式词条和映射规则，`ip-hash.ts` 负责隐私安全的访客标识。客户端只允许导入无 binding 依赖的 `src/lib/event-filters.ts`。

---

## Test Scenarios

- 验证活动状态包含 pending、approved、rejected、archived，公开查询相关字段有索引支持。
- 验证规模标签、活动类型、活动 IP 是运行时数据，且支持停用和排序字段。
- 验证热度观察对活动、IP 哈希和日期的唯一性约束能阻止同日重复贡献。
- 验证测试环境缺少 DB/KV/R2 binding 时返回明确错误，而不是静默使用 undefined。
- 验证 fixture 覆盖已批准、待审核、已拒绝、已归档、已结束、有封面和无封面的活动。
- Covers AE1. 给定上海和广州活动，按上海筛选只返回已批准且未结束的上海活动。
- Covers AE2. 给定不同规模排序权重，普通列表先按规模优先级排序。
- 验证待审核、已拒绝、已归档活动不会进入公开列表。
- 验证已结束活动不会进入默认列表，但详情可见性允许直达。
- 验证无效日期范围、缺少必填字段、无效 QQ 群号和不支持 URL 会被提交校验拒绝。
- 验证 IP 哈希在相同密钥下稳定，在不同密钥下不同，且不会返回明文 IP。

---

## Verification

- `pnpm test` 能运行新增服务端测试。
- `pnpm cf-typegen` 后绑定类型包含 DB、RATE_LIMIT、BUCKET 和配置 vars。
- `pnpm lint` 仍通过。
- 后续子计划可以复用领域服务构建页面、API 和后台，而不重复 SQL 条件或可见性判断。

---

## Handoff Notes

- 这个子计划完成后，公开页面、提交接口、后台和热门榜都应依赖同一套领域层。
- 不要在后续子计划中重新定义公开可见性规则；如果发现规则缺口，应回补到本计划创建的服务端模块和测试中。
