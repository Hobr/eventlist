# 技术设计

## 边界

本功能在现有管理员“增加活动”流程中增加单个 bilibili 会员购活动的服务端预填，不改变公开投稿、编辑、审核或 CSV 批量导入合同：

1. `/admin/events/new` 增加会员购 ID 输入入口，并通过 `bilibili_id` 查询参数请求服务端预填。
2. 新增会员购导入模块，唯一负责固定上游请求、未知 JSON 解码、字段规范化、缺失字段和警告生成。
3. `AdminEventForm.astro` 增加创建态初始值能力；编辑态继续以 `EventRecord` 为权威。
4. `POST /api/admin/events` 在存在经过验证的会员购导入元数据时，重新执行重复检测并使用会员购专用创建路径；普通管理员创建保持现状。
5. D1 层复用活动、标签、审计和公开缓存失效合同，不新增表、列或迁移。

该功能是一个内聚交付：上游解析、表单预填、重复检查和创建写入必须一起可用，因此不拆分子任务。

## 数据流

```text
管理员输入会员购 ID
  -> /admin/events/new?bilibili_id=<id>
  -> 服务端校验正整数 ID
  -> 固定域名会员购 API 请求
  -> 有界响应读取 + unknown 解码
  -> 字段映射 + 行政区解析 + 北京时间转换
  -> 精确来源重复检查 + 疑似重复候选
  -> AdminEventRawInput 初始值 + 缺失字段 + 警告
  -> 现有 AdminEventForm 人工补齐/修改
  -> POST /api/admin/events + 导入元数据/警告确认键
  -> 共享活动校验 + 服务端重新计算重复项
  -> 会员购专用 D1 原子创建
  -> published 活动 + 标签关系 + create 审计
  -> 现有公开缓存失效 + 编辑页跳转
```

浏览器从不接收或回传完整会员购响应。最终活动字段仍由现有 `validateAdminEventInput()` 校验；导入模块只产生原始表单初始值，不建立第二套活动验证规则。

## 上游请求合同

会员购请求只由服务端构造：

```text
GET https://show.bilibili.com/api/ticket/project/getV2
    ?version=134
    &id=<projectId>
    &project_id=<projectId>
    &requestSource=pc-new
```

- `projectId` 必须是大于零的安全整数，页面和 API 都独立验证。
- 目标 scheme、host、path 和参数名是代码常量；用户不能提交任意 URL。
- 请求只发送必要的 `Accept: application/json`，不转发管理员 Cookie、Authorization、Access JWT、Referer 或 HAR 请求头。
- 使用显式超时，并在解析前把响应正文限制在 512 KiB；超时、非 2xx、非 JSON、`success !== true`、`code !== 0`、ID 不匹配或关键结构缺失均返回稳定中文错误。
- 完整正文不写日志，不放入错误详情。错误日志只允许记录 provider、project ID、阶段和不含响应正文的错误分类。
- 上游接口属于非公开合同。解析器从 `unknown` 开始，通过集中类型守卫读取使用到的字段，忽略未使用字段。

## 规范化预览合同

导入模块输出独立于上游结构的内部投影：

```ts
interface BilibiliEventImportPreview {
    provider: "bilibili-ticket";
    projectId: number;
    canonicalSourceUrl: string;
    values: AdminEventRawInput;
    missingRequiredFields: AdminEventField[];
    warnings: BilibiliImportWarning[];
    exactDuplicate: { id: number; title: string } | null;
    duplicateCandidates: Array<{
        id: number;
        title: string;
        start_date: string;
        venue: string;
        warningKey: string;
    }>;
}
```

`values` 只使用现有管理员字段名。页面不得读取会员购原始字段或自行解析价格、时间、行政区和图片地址。

## 字段映射

| 平台字段 | 会员购来源 | 规则 |
| --- | --- | --- |
| `title` | `data.name` | 去除首尾空白；空值为导入错误 |
| `type` | 活动名称 | 只对明确的 `ONLY/Only/only` 展名称建议 `only`，并生成“需要确认”警告；其他情况留空 |
| `scale` | 无可靠来源 | 留空并列为缺失必填字段 |
| `division_code` | `venue_info.province_name/city_name/district_name` | 在 `cn-division` 树内按省、市、区县上下文匹配；忽略“省/市/区/县”后缀，结果必须唯一，否则留空并警告 |
| `venue` | `venue_info.name`，回退 `place_info.name` | 去除首尾空白 |
| `address` | `venue_info.address_detail` | 仅存详细地址，不重复拼接已由行政区字段表达的省市区 |
| 日期时间 | 顶层 `start_time/end_time` | Unix 秒按 `Asia/Shanghai` 输出 `YYYY-MM-DD` 和 `HH:mm`；顶层缺失时才从有效场次边界回退 |
| `cover_url` | `cover`，回退 `performance_image.first.url`、`banner` | `//` 和 `http:` 统一为 HTTPS；无有效 URL 时留空 |
| `ticket_url` | 系统生成 | 使用规范详情链接 |
| `source_url` | 系统生成 | `https://show.bilibili.com/platform/detail.html?id=<projectId>`；导入流程只读 |
| `organizer` | `merchant.company` | 交给共享 200 字符校验 |
| `schedule_status` | 明确状态文案 | 仅当可靠文案明确包含延期/取消时映射；数值状态不猜测 |
| `admission_method` | 有效票种或电子/纸质票标记 | 映射为 `ticket`，否则留空 |
| `price_range` | `is_free`、`price_low/price_high` | 分转元；免费显示“免费”，同价显示单值，不同价显示区间 |
| 入场开始日期时间 | `sale_begin`，回退 `sale_start` | 按 `Asia/Shanghai` 转换 |
| `submitter_contact` | 已认证管理员邮箱 | Access 模式有邮箱时预填；Token 模式留空 |
| `tags` | 无可靠来源 | 留空，管理员至少选择一个规范标签 |
| `description` / `qq_group` | 无可靠纯文本来源 | 留空；不导入 HTML、图片集合或客服链接 |

当 `screen_list` 存在两个及以上场次时，预览增加多场次警告，并显示场次数量、最早开始和最晚结束。第一版不把票种或场次写入活动说明。

## 行政区匹配

新增纯函数在 `listDivisionTree()` 的现有 `cn-division` 数据中匹配位置，不创建城市表或第二份行政区常量：

1. 规范化全角/半角空白并移除常见行政区后缀。
2. 先匹配省级上下文，再匹配市级上下文，最后在限定候选中匹配区县。
3. 直辖市允许 `province_name` 和 `city_name` 同名；例如上海/上海/宝山唯一映射 `310113`。
4. 没有结果或存在歧义时不使用默认地区，保持字段为空并提示人工选择。

## 重复检测与确认

精确重复和疑似重复使用不同语义：

- 精确重复：规范 `source_url` 已存在。预览直接显示已有活动并禁用发布；提交边界再次检查，不能通过确认绕过。
- 疑似重复：共享规范化后的“名称 + 开始日期 + 场馆”匹配已有活动。页面显示已有活动链接和确认控件；管理员确认后允许继续。
- 稳定警告键由服务端根据规范化重复键和候选活动 ID 生成。最终提交重新计算；任何新出现且未确认的警告返回 HTTP 409 和最新 `details.warnings`。

把当前批量导入中的重复键规范化和候选查询提取到共享管理员模块，CSV 与会员购导入共同使用。CSV 的现有警告键和行为必须保持兼容。

## 创建与原子性

普通管理员创建继续调用 `createPublishedEvent()`。会员购导入使用专用创建函数，以规范来源链接作为不可编辑的外部身份：

1. 与现有创建路径相同，先读取候选活动 ID，并保留最多三次 ID 冲突重试。
2. 单个 `db.batch()` 中先有条件写入标签，再使用 `INSERT ... SELECT ... WHERE NOT EXISTS` 按规范来源链接有条件插入活动。
3. 活动插入后立即使用 `changes() > 0` 有条件写入 `create` 审计，再写标签关系并查询规范来源对应的活动。
4. 若活动插入语句没有产生变化，返回包含已有活动 ID 的精确重复冲突；不得新增标签、关系或审计。
5. 成功活动写入 `published` 和 `published_at`。审计元数据使用 `source = "admin-bilibili-import"`、`project_id`、确认的警告键、标签、认证模式和可用管理员邮箱，不保存原始响应。

该方案不要求对所有活动的 `source_url` 建立全局唯一约束，避免破坏可能共享同一来源页的非会员购活动，也不需要重建现有 D1。

## 页面与交互

- `/admin/events/new` 顶部增加紧凑的会员购导入区，包含数字输入和带下载/导入含义图标的明确命令按钮；不新增营销式说明区域。
- 无 ID 时页面保持当前手动新增状态。输入 ID 后进行普通 GET 导航，因此禁用 JavaScript时仍可工作。
- 导入成功后显示来源活动名称、规范链接、已导入字段摘要、缺失必填项和警告，然后渲染同一个 `AdminEventForm`。
- `AdminEventForm` 新增 `initialValues`，值优先级为编辑记录 > 导入初始值 > 默认值。只读来源字段仍随表单提交。
- 精确重复显示已有活动编辑链接，并禁用当前发布按钮。疑似重复必须以非颜色方式显示并要求明确确认。
- 上游失败时保留 ID 输入和完整手动新增表单，不清空管理员已经在当前请求中可恢复的输入。
- 错误与警告使用 `role="alert"` 或 `aria-live`，焦点在导入完成后移动到结果标题；控件在移动端不得造成横向滚动。

## API 与错误合同

`POST /api/admin/events` 保持现有成功响应 `201 { ok: true, data: { id } }`。导入元数据存在时增加以下错误：

| 条件 | 状态码 | 结果 |
| --- | ---: | --- |
| 无效/不一致的会员购项目 ID | 400 | 中文 JSON 错误，不写 D1 |
| 新出现或未确认的疑似重复 | 409 | `details.warnings`，不写 D1 |
| 规范来源已经存在 | 409 | `details.existingEvent`，不写 D1 |
| 其他共享字段校验失败 | 400 | 沿用现有活动错误 |
| D1/绑定意外失败 | 500 | 沿用稳定 JSON 封装，原子回滚 |

页面导入阶段的上游错误不经过创建 API，不产生任何 D1 写入或审计。

## 兼容性与回滚

- 不修改 `migrations/0001_init.sql`，不要求远程 D1 重建。
- 不改变手动管理员创建、编辑、公开投稿、CSV 批量导入、活动详情 DTO 或缓存键。
- 新字段只存在于管理员创建表单请求中；缺少会员购元数据时走现有分支。
- 公开缓存失效继续调用现有 `schedulePublicDataInvalidation()`，影响与普通创建一致。
- 远程封面继续使用现有 HTTPS URL 与 `referrerpolicy="no-referrer"` 行为，不在第一版复制到 R2。
- 回滚可移除会员购导入模块、创建页入口、表单初始值扩展、专用 D1/API 分支和相关测试；无数据库回滚步骤。

## 风险与延后事项

- 会员购接口是未公开合同，可能改字段或限制服务端访问；错误必须可降级到手动录入。
- 样例只覆盖单日、收费、线下、多场次活动。免费、多日、线上、无场馆、取消/延期等变体通过合成脱敏 fixture 测试，不宣称已由真实样例验证。
- 第一版不自动同步已导入活动，不保存原始快照，也不导入票种、嘉宾、退款规则或详情图片。
- 第一版不复制封面到 R2；若外链稳定性以后成为问题，再独立规划资源托管。
