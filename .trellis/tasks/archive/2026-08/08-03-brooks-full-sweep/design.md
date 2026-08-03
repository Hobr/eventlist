# Brooks Full Sweep 技术设计

## 1. 扫描边界

扫描以当前仓库为根，语义分析重点覆盖 `src/`、`test/`、`migrations/` 和运行时配置。`.trellis/`、文档与生成/锁定资产参与合同和一致性检查，但不把模板性或机器生成代码误判为应用异味。

依赖判断遵循现有层次：

```text
Astro pages / Svelte business components
        -> public/admin/cache/auth services
        -> D1 query and mutation adapters
        -> Cloudflare bindings

UI primitives -> Flowbite Svelte adapters + semantic Tailwind tokens
```

页面可以编排具体基础设施，但业务/公开 DTO 合同不得反向依赖页面或组件。D1、Cache API、Turnstile 和 Access 都是边界适配器，不是领域事实的第二来源。

## 2. 诊断模型

每个候选发现先对照 Brooks 风险清单，再检查项目规范、实际调用方和测试覆盖。阈值只用于定位，不单独构成发现。最终条目固定记录：风险代码、位置、严重度、Symptom、Source、Consequence、Remedy 与 Fix-Class。

技术债维度在 R 系列基础上计算 `Pain (1-3) x Spread (1-3)`；架构维度额外检查依赖方向、循环、god module、基础设施泄漏和 seam 边界。

## 3. 修复与回滚

- 首先记录工作树和基线验证，之后每个维度形成独立修复批次。
- Safe 修复可直接应用；Extended-Safe 还要求基线通过、测试保护、无公共签名变化并且批次最多 5 个文件。
- 每批后执行针对性测试和项目门禁。失败时按修复逆序只撤销清扫新增的 patch，绝不回滚用户原有变更。
- 公共导出、数据库合同、路由/表单合同、跨模块结构变化、无测试区域和含糊设计均标为 Residual。
- 修改文件、同模块邻居和静态消费者进入复扫；同一发现三次失败后退休。

## 4. 关键合同

- D1 写入继续通过现有批处理和验证边界，缓存仍是可丢失的公开 DTO 层。
- 公开和管理 API 保持 `jsonOk/jsonError` envelope 与现有状态码。
- Svelte/Astro 前端保持 Flowbite Svelte 适配器、语义 token、系统暗色模式与可访问性合同。
- 不引入 Playwright；前端相关修复使用现有 Node 测试、构建、静态检查和必要的轻量路由检查。
- TypeScript 7 的 ESLint 兼容问题已解决；lint 失败视为真实验证失败，不再降级为已知工具链限制。

## 5. 可观测性与输出

执行期间维护 `fix_log`、`unresolvable`、`non_critical_rounds` 和每维度计数。最终输出 Brooks Full Sweep 报告并追加 `.brooks-lint-history.json`，但不创建 Git 提交。

## 6. 风险与回滚点

- D1/缓存/认证修改风险最高：只有局部兼容且有现有回归测试的改动可自动应用。
- 跨 Astro/Svelte 边界的 props 或序列化变化视为公共合同，默认 residual。
- 格式化命令可能扩大 diff，因此只对明确修改文件执行定点格式化；最终全仓使用 check 模式。
- 任一维度验证失败是回滚点；最终全套门禁失败时不得宣称 clean。
