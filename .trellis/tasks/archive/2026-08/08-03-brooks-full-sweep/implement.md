# Brooks Full Sweep 执行计划

## Phase 0: 激活与基线

- [ ] 激活 Trellis 任务并加载 Phase 2.1 / `trellis-before-dev` 上下文。
- [ ] 记录 Git 状态、最终 scope 文件清单、`.brooks-lint.yaml` 状态和既有 Brooks 历史。
- [ ] 运行修复前基线：测试、类型、构建、lint、Wrangler 类型同步检查与 `git diff --check`。
- [ ] 初始化 `unresolvable`、`non_critical_rounds`、`fix_log` 和维度统计。

## Phase 1: Review (R1-R6)

- [ ] 扫描认知负担、变更传播、知识重复、偶然复杂度、依赖失序和领域模型扭曲。
- [ ] 对每个候选完成 Iron Law 诊断并对照项目规范排除误报。
- [ ] 应用 Safe / Extended-Safe 修复，运行针对性测试与全局验证，失败则仅回滚本批修复。

## Phase 2: Test (T1-T6)

- [ ] 扫描测试晦涩、脆弱、重复、mock 滥用、覆盖错觉和测试架构失配。
- [ ] 将无现成测试基础设施、需外部服务或需新 E2E 工具的补测标为 residual。
- [ ] 应用安全的测试命名、局部去重、边界覆盖和纯函数测试修复并验证。

## Phase 3: Debt

- [ ] 扫描跨文件重复、分层 workaround、TODO/FIXME 聚集、死分支和配置漂移。
- [ ] 计算 Pain x Spread，识别模式级严重度提升。
- [ ] 仅修复边界明确且兼容的债务项，其余进入 residual。

## Phase 4: Audit

- [ ] 使用 CodeGraph 与静态导入检查依赖方向、循环、高扇出、基础设施泄漏、god module 和 seam 违规。
- [ ] 不自动移动目录、重命名 package 或更改公共导出；仅应用满足 Extended-Safe 条件的局部架构修复。

## Phase 5: 迭代复扫

- [ ] 复扫所有修改文件、同模块文件与静态消费者。
- [ ] Critical 持续迭代到修复或三次失败退休；Warning/Suggestion 最多三轮。
- [ ] 记录 clean、critical-only、mixed 或 iteration-cap 的每轮状态。

## Phase 6: 最终验证与报告

- [ ] 运行 `corepack pnpm test`。
- [ ] 运行 `corepack pnpm exec tsc --noEmit`。
- [ ] 运行 `corepack pnpm build`。
- [ ] 运行 `corepack pnpm lint`，将其作为正常硬门禁处理。
- [ ] 运行 `corepack pnpm exec wrangler types --check`。
- [ ] 运行 `corepack pnpm exec prettier --check .` 与 `git diff --check`。
- [ ] 更新 Brooks 历史，输出维度汇总、Fix Log、迭代历史、健康分数变化和 residual。

## Rollback Rules

- 不使用 `git reset --hard`、`git checkout --` 或覆盖整个文件的恢复方式。
- 只通过逆向 `apply_patch` 撤回本轮清扫产生的具体改动。
- 不触碰远程 D1、部署环境、秘密、提交历史或用户任务前的工作树内容。
