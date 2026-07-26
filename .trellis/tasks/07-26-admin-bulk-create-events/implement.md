# 实施计划

## 有序清单

- [x] 添加成熟的 `csv-parse` 运行时依赖和轻量 TypeScript 测试命令；在单一管理员导入模块中定义固定 CSV 表头和模板合同。
- [x] 将管理员活动校验重构到共享原始记录读取器后方，同时保持单条创建和编辑的 `parseEventForm()` 行为；为 CSV 记录增加结构化字段错误以及类型/规模标签与代码的规范化。
- [x] 实现严格 UTF-8 CSV 解析、1 MiB 文件限制、1 至 20 条记录限制、完整记录错误收集、纯表头模板处理和逻辑记录编号。
- [x] 新增重复键规范化和一次查询的 D1 候选匹配；返回带稳定确认键的 CSV/数据库警告。
- [x] 新增批量 D1 持久化函数，保持最坏 44 条查询预算，分配连续候选 ID，解析规范/别名标签，写入逐活动审计元数据，并只调用一次原子 `db.batch()`。
- [x] 新增需要认证的模板、预览和提交 API。提交时重新解析和校验；对新增的未确认警告返回 409；未认证和意外错误沿用现有 JSON 封装。
- [x] 构建 `/admin/events/bulk` 和 `BulkEventImport.svelte`，覆盖文件选择、模板下载、稳定的预览/错误/警告/提交/成功状态、重复警告确认、重置和已创建活动编辑链接。
- [x] 为桌面和移动导航新增“批量导入”项目与图标，并保持路由专属激活状态。
- [x] 添加聚焦的解析器/校验测试与 D1 路由验证，覆盖成功创建、整批回滚、标签复用/别名解析、审计记录、重复警告确认、鉴权和并发冲突。
- [x] 运行格式化、测试、TypeScript、生产构建、本地 D1/API 检查，并回归检查单条创建和公开投稿界面。
- [ ] 完成移动/平板/桌面三种视口的交互式浏览器验证；当前会话未暴露应用内浏览器运行时，NixOS Firefox 无头模式对公开页面也退出 139。不引入 Playwright。

## 验证记录

- `corepack pnpm test`、`corepack pnpm exec tsc --noEmit`、Prettier、`corepack pnpm build` 和 `git diff --check` 通过。
- `corepack pnpm lint` 在 Prettier 通过后，因项目已记录的 TypeScript 7 / `typescript-eslint` 上游兼容问题在加载配置时退出；ESLint 未读取项目文件。
- 真实本地 D1 验证了发布状态、标签别名解析、逐活动审计、失败整批回滚和候选 ID 冲突 409。
- HTTP 验证了未认证 401、模板 BOM/纯表头、预览、新警告 409、确认后 201，以及 `/admin/events/new`、`/admin/events/bulk`、`/submit` 返回 200。

## 验证命令

```bash
corepack pnpm test
corepack pnpm lint
corepack pnpm exec tsc --noEmit
corepack pnpm build

tmp_dir=$(mktemp -d)
corepack pnpm exec wrangler d1 migrations apply eventlist-db --local --persist-to "$tmp_dir"
corepack pnpm exec astro dev --background
corepack pnpm exec astro dev status
corepack pnpm exec astro dev logs
corepack pnpm exec astro dev stop
```

路由验证必须覆盖：

- 未认证模板、预览和提交请求返回 401 JSON；
- 模板包含 UTF-8 BOM 和精确表头，不包含示例活动；
- 无效 UTF-8、错误引用、缺失/多余/乱序表头、空文件和 21 条记录均被拒绝且不产生写入；
- 带引号逗号、转义引号、多行描述、可选空单元格、类型/规模中文标签和 `、` 分隔标签能够正确往返；
- 记录校验返回所有适用的记录/字段错误；
- CSV/数据库重复警告在确认前阻止提交，新出现的警告返回 409；
- 20 条有效记录准确生成 20 条已发布活动、对应标签关系和 20 条 `admin-bulk-create` 审计记录；
- 故意失败的语句和候选 ID 冲突不会留下部分数据；
- 单条管理员创建/编辑和公开 `pending` 投稿合同保持不变。

浏览器检查使用约 390x844、768x1024 和 1440x1000 三种视口，验证页面无横向溢出、预览表格可滚动、焦点可见、错误/警告状态清楚、无效数据时确认按钮禁用，以及成功链接稳定。不要添加 Playwright。

## 风险文件与回滚点

- `src/lib/admin/form.ts`：由单条创建和编辑共享。完成校验重构后立即运行回归测试，再添加 CSV 行为。
- `src/lib/db/queries.ts`：共享 D1 层。新批量函数与现有公开/单条管理员操作保持分离，并验证 20 条记录时的 44 条查询预算。
- `src/lib/admin/bulk-events.ts`（新增）：唯一拥有表头、字段映射、模板生成、解码、记录映射和警告键；Svelte 组件或路由不得重复这些合同。
- `src/pages/api/admin/events/bulk/**`（新增）：预览和提交必须调用同一解析器与重复检测器；提交不得信任浏览器提供的规范化记录。
- `src/components/admin/BulkEventImport.svelte`（新增）：状态转换必须显式；选中文件变化时清除过期预览和警告确认。
- `src/components/admin/navigation.ts` 及桌面/移动图标映射：验证 `/admin/events/new`、`/admin/events/bulk` 和 `/admin/published` 的激活状态。

若验证门失败，只在检查当前差异后回滚对应清单组。保留其他活跃 Trellis 任务和用户改动。

## 启动前审查门

- [x] PRD 不包含未解决的产品决策。
- [x] PRD 与技术设计中的 CSV 表头、错误、警告、API 和成功结果合同一致。
- [x] 20 条记录时，D1 确认请求最坏不超过 44 条查询。
- [x] `implement.jsonl` 和 `check.jsonl` 包含真实项目规范/研究条目。
- [x] 用户批准最终规划摘要后再运行 `task.py start`。
