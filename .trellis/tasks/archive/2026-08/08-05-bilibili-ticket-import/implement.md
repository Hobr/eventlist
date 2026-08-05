# 实施计划

## 有序清单

- [x] 从 `sample.har` 手工提取只包含已使用业务字段的最小脱敏 JSON fixture；确认仓库不包含 Cookie、请求头、商家证照 token、完整 HAR 或完整响应。
- [x] 添加会员购导入纯模块和聚焦测试：ID/规范 URL、512 KiB 响应限制、未知 JSON 解码、错误分类、上海时区、价格、HTTPS 图片、场次警告、类型建议和可选字段。
- [x] 在现有 `cn-division` 数据上实现省/市/区县上下文匹配，并测试上海市宝山区 `310113`、直辖市、名称后缀、缺失和歧义情况。
- [x] 把 CSV 批量导入的重复键规范化和 D1 候选查询提取到共享管理员重复检测模块；保持现有 CSV 警告键、API 和测试行为不变。
- [x] 新增会员购精确来源查询和专用原子创建函数：来源存在时不写标签、活动、关系或审计；候选 ID 冲突仍按现有策略重试；成功写入 `admin-bilibili-import` 审计元数据。
- [x] 扩展 `AdminEventForm.astro` 支持 `AdminEventRawInput` 创建态初始值和只读来源字段，保持编辑态、字段名、必填标识、DivisionPicker、SelectField 和 TagInput 合同不变。
- [x] 在 `/admin/events/new` 增加会员购 ID GET 导入区、服务端预填、缺失字段/多场次/类型建议/重复警告和已有活动入口；无 ID 或导入失败时保留完整手动录入路径。
- [x] 扩展管理员创建 API 的可选导入元数据分支：重新校验项目 ID和规范来源、重新计算疑似重复、验证警告确认键、调用会员购专用创建函数，并继续执行现有公开缓存失效和成功跳转。
- [x] 添加解析器、页面、路由和 D1 测试，覆盖样例 `1004224`、无效 ID、无 Cookie 请求合同、超时、过大/非 JSON/业务失败、字段漂移、精确重复、疑似重复确认、原子回滚和审计内容。
- [x] 回归手动管理员创建/编辑、CSV 批量导入、公开投稿和公开活动读取；确认缺少导入元数据时 SQL、响应和审计来源保持原样。
- [x] 按项目规范新增会员购导入跨层可执行合同，并更新 `.trellis/spec/backend/index.md`。
- [ ] 运行格式化、完整测试、TypeScript、生产构建、本地 D1/API 检查和三种视口的应用内浏览器验证；不引入 Playwright。

## 验证记录

- 2026-08-05：`corepack pnpm test` 通过，155/155；`corepack pnpm lint`、`corepack pnpm exec tsc --noEmit`、`corepack pnpm build` 和 `git diff --check` 通过。
- 2026-08-05：全新本地 D1 迁移通过；实时会员购 `1004224` 返回预期标题、宝山区 `310113`、时间、价格、开售时间及规范来源 URL。
- 2026-08-05：应用内浏览器两次在控制桥初始化阶段失败，错误为缺少 `BROWSER_USE_SECURITY_MODE` 运行时配置；本地 Astro 服务可在 `http://localhost:4322` 启动。按项目约束未使用 Playwright 替代，因此三视口交互验证保持未完成。

## 验证命令

```bash
corepack pnpm test
corepack pnpm lint
corepack pnpm exec tsc --noEmit
corepack pnpm build
git diff --check

tmp_dir=$(mktemp -d)
corepack pnpm exec wrangler d1 migrations apply eventlist-db --local --persist-to "$tmp_dir"
corepack pnpm exec astro dev --background
corepack pnpm exec astro dev status
corepack pnpm exec astro dev logs
corepack pnpm exec astro dev stop
```

聚焦测试至少覆盖：

- 样例 ID `1004224` 映射到上海市宝山区 `310113`、2026-08-16 12:00 至 21:00、78-138 元和 2026-07-23 00:00；
- 上游请求目标固定且不包含 Cookie、Authorization、Access JWT、Referer 或 HAR 头；
- `//` 与 `http:` 图片规范化为 HTTPS，无效协议被丢弃；
- 多场次产生警告，单场次不产生该警告；
- `ONLY展` 只产生需要确认的类型建议，未知分类不自动猜测；
- 免费、同价、价格区间、缺失价格、缺失地点和歧义行政区；
- 精确来源重复始终 409，疑似重复在确认前 409、确认后 201；
- 精确重复和故意失败的 D1 批次不留下新标签、活动、关系或审计；
- 普通手动创建仍产生 `source = admin-create`，CSV 仍产生 `source = admin-bulk-create`；
- 创建成功继续触发与普通创建相同的公开缓存失效影响。

浏览器检查使用约 390x844、768x1024 和 1440x1000 三种视口，验证：

- ID 输入、错误、缺失字段和警告文本不会横向溢出；
- 导入成功后焦点和状态提示可被键盘/读屏理解；
- 精确重复时发布按钮禁用且已有活动链接可用；
- 疑似重复确认控件可键盘操作；
- 手动录入、导入预填、修改字段、发布和成功跳转完整可用；
- 页面控制台无错误，网络中没有浏览器直连会员购 API 的请求。

## 风险文件与回滚点

- `src/lib/admin/form.ts`：管理员单条、编辑和 CSV 共享验证器。导入模块只能生成 `AdminEventRawInput`，不得复制字段规则；每次相关修改后先运行 `test/admin-event-form.test.ts` 和 `test/admin-bulk-events.test.ts`。
- `src/lib/admin/bulk-events.ts` 与新共享重复模块：提取重复逻辑时先锁定现有警告键快照，避免让已确认警告失效。
- `src/lib/db/admin-events.ts`：普通创建和会员购创建必须保持分支清晰；专用写入失败或重复时检查标签、关系和审计均无残留。
- `src/components/admin/AdminEventForm.astro`：编辑记录优先级高于导入初始值；不要让创建态 props 改变编辑页面。
- `src/pages/admin/events/new.astro`：继续只有一个活动表单；导入区域不能复制业务字段或创建第二套提交状态机。
- `src/pages/api/admin/events/index.ts`：无导入元数据时必须维持现有 400/500/201 合同和 `admin-create` 审计。

任何阶段出现回归时，只回滚对应清单组并保留用户已有的 `.trellis/tasks/08-05-homepage-dual-intent-feed/` 及其他工作区改动。该任务没有数据库迁移，完整回滚不需要远程数据操作。

## 启动前审查门

- [x] PRD 已移除全部未解决产品问题，并记录“管理员确认后立即发布”。
- [x] PRD、技术设计和实施计划对字段映射、只读来源、多场次、重复检查、错误和发布语义一致。
- [x] 技术设计不依赖数据库迁移、原始 HAR、完整上游响应或浏览器直连会员购接口。
- [x] `implement.jsonl` 和 `check.jsonl` 包含真实项目规范与当前任务设计条目。
- [ ] 用户明确批准本次最终规划摘要后再运行 `task.py start`。
