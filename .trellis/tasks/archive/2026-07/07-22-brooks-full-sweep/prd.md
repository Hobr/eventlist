# Full Brooks quality sweep

## Goal

对当前 `eventlist` 仓库执行一次完整的 Brooks-Lint sweep：按 code decay、test quality、tech debt、architecture 四个维度诊断问题，在明确的安全边界内自动修复可验证的低风险问题，并留下可复核的残余报告。

## Background

- 工作区在任务创建时是干净的，分支为 `main`；仓库共有约 229 个 Git 跟踪文件。
- 应用是 Astro SSR + Cloudflare adapter + Svelte 5/Bits UI，数据边界是 D1；主要业务代码在 `src/`，数据库基线在 `migrations/0001_init.sql`。
- 当前 `package.json` 提供 `lint`、`build` 和类型检查所需的依赖，但没有 `test`/Vitest 脚本，也没有当前可发现的测试文件；测试维度必须如实记录覆盖缺口，不能假定不存在的测试通过。
- 项目没有 `.brooks-lint.yaml`，因此使用 Brooks 默认的全部风险、`balanced` 严格度和默认迭代上限。
- `.trellis/tasks/07-16-event-browse-metadata-theme` 是另一项已完成实现但尚未归档的任务；本 sweep 不修改其任务记录，也不回退其已经存在的代码。
- 项目规范要求使用 `corepack pnpm`，不引入 Playwright；前端/后端语义、D1 基线、错误响应和 Bits UI 约束分别以 `.trellis/spec/backend/*` 与 `.trellis/spec/frontend/*` 为准。

## Scope

- **分析范围：** 整个 Git 跟踪仓库；对 `src/`、`migrations/`、构建/部署配置、README/AGENTS 和可识别的测试面执行适用的四维扫描。
- **只读保护：** `.trellis/**` 任务、日志和规范文件仅用于上下文读取，不作为自动重构目标；`worker-configuration.d.ts` 等生成类型、二进制媒体和锁文件不做风格性改写，除非某个已验证的修复直接要求它们改变。
- **写入范围：** 仅在当前仓库内修改；不部署、不访问远端 D1、不改密钥、不推送；流水线本身不提交 Git。

## Requirements

### R1：先诊断再修复

严格按 `brooks-review → brooks-test → brooks-debt → brooks-audit` 执行。每个 finding 必须有 `Symptom / Source / Consequence / Remedy`，不能以格式偏好或阈值本身代替影响分析。

### R2：遵守自动修复边界

- `Safe`：单文件、局部、非导出 API 的低风险修复可以直接应用。
- `Extended-Safe`：最多五个文件、已有可运行的项目验证基线、且不改变公开导出签名的修复才可应用。
- `Residual`：公共 API 破坏、跨模块结构调整、没有测试保护的行为变更或补救方案不明确的 finding 只记录，不自动修改。

### R3：每阶段验证与回滚

每个维度的修复后运行可用的项目检查（`corepack pnpm exec tsc --noEmit`、`corepack pnpm lint`、`corepack pnpm build`，必要时 `git diff --check`）。若检查失败，按逆序逐项回退本阶段修复并把 finding 升级为 Residual。

### R4：有限迭代

只重新扫描本轮修改文件、同模块文件及其静态消费者；Critical finding 继续迭代，Warning/Suggestion 的非关键轮次最多三轮；同一 finding 三次验证失败后退休到 `unresolvable`。

### R5：保护现有契约

保持路由、表单字段、URL 查询参数、D1 约束、Astro/Svelte/Bits UI 技术栈和现有错误响应契约。不得为了让 lint 通过而降级 TypeScript、替换依赖、引入第二套 UI/测试工具或削弱认证/Turnstile 行为。

### R6：完整记录结果

最终报告必须包含扫描范围、四维汇总、迭代历史、逐项 fix log、残余/不可解析项、健康分数估计及验证结果，并明确没有自动处理的原因。

## Acceptance Criteria

- [ ] AC1：在任何仓库文件被修改前，向用户展示 `brooks-sweep` Step 0 的完整预检通知并取得明确同意。
- [ ] AC2：记录 229 个跟踪文件的实际范围、`.brooks-lint.yaml` 缺失状态、基线检查结果和受保护路径；不把不存在的测试命令当作通过。
- [ ] AC3：四个维度按规定顺序完成扫描；每个 finding 都符合 Iron Law，并按 Safe、Extended-Safe 或 Residual 分类。
- [ ] AC4：只应用符合边界且通过验证的安全修复；任何回归修复都被逆序回退并记录。
- [ ] AC5：完成重扫迭代，遵守三次失败退休和非关键轮次上限；没有未说明的自动修改。
- [ ] AC6：最终 Full Sweep 报告包含四维统计、fix log、残余项、unresolvable 项、健康分数前后估计和验证命令输出摘要。
- [ ] AC7：不引入 Playwright、不执行部署/远端数据库操作、不提交或推送 Git；现有 Trellis 任务记录保持不变。
- [ ] AC8：规划文档经过用户审阅后，才允许调用 `task.py start` 进入执行阶段；执行完成后再运行最终 lint、类型、构建和 diff 检查。

## Out of Scope

- 产品功能开发、视觉重设计、数据库 schema 演进或迁移历史重写。
- 为弥补测试缺失而新增完整测试框架、E2E 基础设施或 Playwright。
- 自动重排模块目录、重命名公开导出、改变 API/路由/表单契约。
- 修改 `.trellis` 历史、其他活动任务的 PRD/设计/实现记录，或生成类型/媒体文件的纯风格变更。

## Open Questions

无阻塞性产品问题。剩余的风险取舍由 Brooks 的 Safe/Extended-Safe/Residual 规则和用户已批准的全仓库范围决定。
