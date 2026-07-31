# 管理员批量导入活动规范

> 管理端 CSV 批量创建活动的跨层可执行合同。

## 场景：从 CSV 预览并原子发布多条活动

### 1. 范围与触发条件

- 触发条件：修改 `/admin/events/bulk`、`/api/admin/events/bulk/**`、管理员活动字段校验、CSV 解析、重复检测或 D1 批量写入。
- 本功能只接受已认证管理员提交的 UTF-8 CSV；不影响公开投稿的 `pending` 流程。
- 单批包含 1 至 20 条活动，文件不超过 1 MiB；不支持 XLSX、部分成功、异步任务或导入历史。

### 2. 签名

- `parseBulkEventCsv(file: File) -> Promise<ParsedBulkEventCsv>`：严格解码、解析并收集全部记录错误。
- `buildBulkEventPreview(db, file) -> Promise<ParsedBulkEventCsv>`：在有效解析结果上追加 CSV 内和数据库重复警告，不执行写入。
- `findBulkEventDuplicateCandidates(db, startDates) -> Promise<BulkEventDuplicateCandidate[]>`：通过一次 D1 查询读取匹配开始日期的候选活动。
- `createBulkPublishedEvents(db, items, auditMeta) -> Promise<Array<{ id; title }>>`：分配连续候选 ID，并只调用一次 `db.batch()`。
- `GET /api/admin/events/bulk/template`：下载只有 BOM 和固定表头的模板。
- `POST /api/admin/events/bulk/preview`：接收 `FormData.file` 并返回预览。
- `POST /api/admin/events/bulk`：接收原始 `FormData.file` 和可重复的 `confirmed_warning_keys`，重新解析后创建活动。

### 3. 合同

- CSV 表头顺序固定为：`活动名称,活动类型,活动规模,行政区代码,场馆,详细地址,开始日期,结束日期,开始时间,结束时间,封面URL,活动描述,QQ群,购票地址,来源链接,联系信息,标签,主办方,活动异常状态,入场方式,票价区间,开始购票/预约/申请日期,开始购票/预约/申请时间`。旧 17 列表头不兼容并返回表头错误。
- 模板前三字节为 UTF-8 BOM `EF BB BF`，表头后只有一个换行，不包含示例活动。
- 类型、规模、活动异常状态和入场方式接受共享选项目录中的代码或中文标签；标签只使用 `、` 分隔。
- CSV 适配器必须调用 `validateAdminEventInput()`；单条创建和编辑继续通过 `parseEventForm()` 使用同一字段规则。
- 重复键是去除首尾空白、折叠连续空白并统一大小写后的“活动名称 + 开始日期 + 场馆”。警告键必须由服务端稳定计算。
- 预览不写 D1。提交必须重新上传并解析原始文件，不接受浏览器传回的规范化活动对象。
- 当前警告中任一键未出现在 `confirmed_warning_keys` 时，提交返回 409 和最新 `details.preview`；确认警告后仍然创建，不跳过或合并活动。
- 20 条活动的提交固定使用 44 次 D1 查询：重复候选 1 次、候选 ID 1 次、一次包含 42 条语句的 `db.batch()`。42 条语句由标签插入 1 条、活动插入 20 条、标签关系 20 条、审计插入 1 条组成。
- 所有活动立即写入 `published` 和 `published_at`。每条活动写一条 `create` 审计，元数据至少包含 `source = admin-bulk-create`、`csv_row`、`batch_size`、`tags` 和 `auth_mode`。
- 标签关系把别名解析到 `alias_of_id` 指向的规范标签；同一活动不得因同时输入别名和规范名产生重复关系。
- 页面状态至少覆盖初始、预览中、无效、可提交、等待警告确认、提交中、成功和请求失败。选择新文件必须清除旧预览与警告确认。

成功响应：

```json
{
    "ok": true,
    "data": {
        "events": [{ "id": 123, "title": "活动名称" }]
    }
}
```

结构化失败响应：

```json
{
    "ok": false,
    "error": "CSV 包含需要修正的记录",
    "details": {
        "preview": {
            "valid": false,
            "rows": [],
            "errors": [{ "row": 2, "field": "开始日期", "message": "开始日期格式无效" }],
            "warnings": []
        }
    }
}
```

### 4. 校验与错误矩阵

| 条件 | 状态码 | 结果 |
| --- | ---: | --- |
| 未认证页面请求 | 302 | 重定向到 `/admin/login` |
| 带同源 Origin 的未认证 API 请求 | 401 | `{ ok: false, error: "Unauthorized" }` |
| 缺少文件、错误扩展名、超过 1 MiB、无效 UTF-8、坏 CSV 或错误表头 | 400 | 文件级 `details.preview.errors` |
| 任一记录字段无效或记录数不在 1 至 20 | 400 | 返回全部适用的记录号和中文字段错误，不写 D1 |
| 存在未确认或提交阶段新出现的重复警告 | 409 | 返回最新预览并要求重新确认 |
| 候选活动 ID 被并发请求占用 | 409 | 提示重新预览；不在同一请求内重试 |
| D1 任一其他语句失败 | 500 | 整个 `db.batch()` 回滚，不留下活动、标签或审计 |
| 成功创建 | 201 | 返回全部活动的名称与 ID |

### 5. 良好、基准与错误案例

- 良好：包含逗号、转义引号和多行描述的标准引用 CSV 能往返；类型/规模中文标签被规范化为代码。
- 良好：输入标签别名和新标签后，活动关系指向规范标签与新建规范标签。
- 良好：数据库中存在疑似重复时，管理员确认稳定警告键后仍可创建第二条活动。
- 基准：新增可选字段为空时写入 `null`；填写入场开始时间但不填写日期时按记录返回字段错误。
- 错误：兼容、推断或自动补齐旧 17 列模板；本开发阶段只接受当前固定表头。
- 错误：在预览 API 中写数据库，或提交时信任浏览器传回的活动对象。
- 错误：循环调用 `createPublishedEvent()`；20 条活动会超过 D1 免费计划的单请求查询预算。
- 错误：在 `db.batch()` 外先创建标签、活动或审计；后续失败会留下部分数据。

### 6. 必需测试

- 单元测试：BOM 模板、无效 UTF-8、坏引用、严格新版表头、旧 17 列失败、空模板、21 条记录、中文标签/代码、`、` 标签和全部字段错误。
- 单元测试：CSV 内重复、数据库重复和稳定警告键。
- 查询构造测试：20 条活动只调用一次含 42 条语句的 `db.batch()`；候选日期只查询一次。
- 本地 D1：成功活动为 `published`，标签关系解析别名，每条活动存在 `admin-bulk-create` 审计。
- 本地 D1：用失败触发器中断活动插入后，新增活动、标签和孤立审计计数均为 0。
- 本地 D1：制造 `events.id` 唯一冲突后返回 409，冲突活动和标签计数均为 0。
- HTTP：模板、预览和提交的未认证请求；400 结构化错误；409 新警告；确认后 201。
- 回归：`/admin/events/new`、`/submit`、测试、TypeScript 和生产构建。
- 页面：约 390x844、768x1024、1440x1000 检查无页面横向溢出，预览表格自身可滚动，焦点可见，错误/警告/成功状态清楚。不要引入 Playwright。

### 7. 错误与正确写法

#### 错误

```ts
const events = JSON.parse(String(formData.get("events")));
for (const event of events) {
    await createPublishedEvent(db, event, auditMeta);
}
```

#### 正确

```ts
const result = await buildBulkEventPreview(db, file);
const events = await createBulkPublishedEvents(
    db,
    result.events.map(({ row, event }) => ({ row, event })),
    auditMeta
);
```
