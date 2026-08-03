# 全仓库 Brooks 质量清扫

## Goal

对当前 `eventlist` 仓库执行一次可验证的 Brooks Full Sweep：依次检查生产代码衰减、测试质量、技术债和架构完整性，直接修复低风险问题，并把需要产品或架构判断的高风险问题留在最终 residual 报告中。

## Background

- 用户已批准 `/brooks-sweep` 的全仓自治清扫，预估 Git 跟踪文件约 409 个。
- 应用代码主要位于 `src/`，测试与夹具位于 `test/`；技术栈是 Astro 7、Svelte 5、TypeScript 7、Tailwind CSS v4、Flowbite Svelte 与 Cloudflare Workers/D1。
- 仓库没有 `.brooks-lint.yaml`，因此使用 balanced 默认严格度，并启用 R1-R6 与 T1-T6 全部风险。
- 当前工作树中的 `.trellis/tasks/08-03-brooks-full-sweep/` 是本任务规划资产，必须保留；清扫不得覆盖或回滚任务开始前的用户修改。

## Requirements

### R1. 扫描范围与诊断纪律

- 枚举并记录最终扫描文件列表。
- 对 Git 跟踪的应用源代码、测试、配置、迁移与相关文档执行全仓检查；生成声明、锁文件和非源码资产只做一致性/依赖检查，不把机器生成细节当作手写代码异味。
- 四个维度固定按 `review -> test -> debt -> audit` 顺序运行。
- 每个发现必须包含 `Symptom -> Source -> Consequence -> Remedy`，并给出文件与近似行号、风险代码、严重度和 Fix-Class。

### R2. 自动修复边界

- Safe：仅限单文件、局部、非导出符号、不改变外部合同的机械或防御性修复。
- Extended-Safe：仅在修复前基线验证通过、无公共接口变化、单次不超过 5 个文件且有测试保护时执行。
- Residual：公共 API 变化、模块边界重构、远程/持久数据操作、缺少测试保护、意图不明确或需要产品判断的修复不得自动执行。
- 每个维度后运行相应验证；若回归，只回滚本轮由清扫产生的修改，并记录 `reverted`，不得使用破坏性 Git 命令或覆盖任务前工作树。
- 同一发现验证失败 3 次后移入 `unresolvable`；非 Critical 复扫最多 3 轮。

### R3. 项目合同保护

- 保持 D1 为活动、标签、热度的唯一事实来源；不自动重建或删除远程 D1，不新增第二迁移基线。
- 保持 API JSON envelope、公开 DTO、缓存 fail-closed、管理员原子写入与隐私边界。
- 保持 Flowbite Svelte + Tailwind v4 设计合同，不重新引入 Material 3、Bits UI、Playwright、第二套运行时 UI/CSS 框架或 Flowbite DOM runtime。
- 不改变表单字段名、路由、查询参数、公共导出签名或数据库行为，除非属于有测试保护且完全兼容的 Extended-Safe 修复。
- TypeScript 7 的既有 ESLint 兼容问题已由用户确认解决；`corepack pnpm lint` 作为正常硬门禁，任何失败都必须诊断和处理。

### R4. 验证与报告

- 建立修复前基线，并在每个维度与最终状态运行适当的测试、格式、类型和构建检查。
- 最终报告包含维度汇总、迭代历史、Fix Log、Health Score Delta、Residual Items 与 Summary。
- 更新 `.brooks-lint-history.json` 的 Full Sweep 历史记录。
- 不提交、不推送、不 amend；Git 操作只用于只读检查和识别本次修改。

## Acceptance Criteria

- [ ] R1-R6、T1-T6、技术债和架构四个维度均完成首轮扫描，并有可核查的维度统计。
- [ ] 所有已报告发现满足 Iron Law，且误报已经对照代码、测试和 `.trellis/spec/` 合同复核。
- [ ] 所有 Safe 与 Extended-Safe 修复均记录在 Fix Log；高风险或含糊项只进入 residual。
- [ ] 修改后至少执行 `corepack pnpm test`、`corepack pnpm exec tsc --noEmit`、`corepack pnpm build`、`corepack pnpm lint`、`corepack pnpm exec wrangler types --check` 与 `git diff --check`；所有失败均需正常诊断。
- [ ] 复扫达到 clean round、迭代上限或无未解决 Critical 的明确停止条件；失败 3 次的发现不再重试。
- [ ] 最终报告说明总发现数、已修复数、residual 数、unresolvable 数、修复前后健康分数及验证结果。
- [ ] 未执行远程 D1 重建、部署、依赖降级、Playwright 引入、提交或推送。

## Out of Scope

- 公共 API 破坏性变化、跨服务或大规模目录重构。
- 远程 D1 删除、重建、迁移应用、生产数据回填或部署。
- 新产品功能、视觉重设计或业务合同变更。
- 为非清扫目标进行依赖升级、工具链降级或锁文件全面刷新。
- Git commit、push、amend 或 PR 创建。
