import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
    BILIBILI_TICKET_API_URL,
    BILIBILI_TICKET_PROVIDER,
    BilibiliImportError,
    MAX_BILIBILI_RESPONSE_BYTES,
    canonicalBilibiliSourceUrl,
    createBilibiliTicketApiUrl,
    fetchBilibiliTicketPreview,
    findBilibiliDuplicateWarnings,
    formatBilibiliPrice,
    matchBilibiliDivisionCode,
    normalizeBilibiliImageUrl,
    normalizeBilibiliTicketResponse,
    parseBilibiliImportSubmission,
    parseBilibiliProjectId
} from "../src/lib/admin/bilibili-ticket";

async function samplePayload() {
    return JSON.parse(
        await readFile(new URL("./fixtures/bilibili-ticket-1004224.json", import.meta.url), "utf8")
    ) as unknown;
}

test("样例 1004224 映射为可编辑管理员字段", async () => {
    const preview = normalizeBilibiliTicketResponse(await samplePayload(), {
        projectId: 1004224,
        submitterContact: "admin@example.com"
    });

    assert.equal(preview.provider, BILIBILI_TICKET_PROVIDER);
    assert.equal(preview.values.title, "上海·芳文社同人ONLY展2.0~街角兔屋");
    assert.equal(preview.values.type, "only");
    assert.equal(preview.values.scale, "");
    assert.equal(preview.values.division_code, "310113");
    assert.equal(preview.values.venue, "交运智慧湾科创园25号楼");
    assert.equal(preview.values.address, "呼青路158号");
    assert.equal(preview.values.start_date, "2026-08-16");
    assert.equal(preview.values.start_time, "12:00");
    assert.equal(preview.values.end_date, "2026-08-16");
    assert.equal(preview.values.end_time, "21:00");
    assert.equal(preview.values.price_range, "78-138 元");
    assert.equal(preview.values.admission_start_date, "2026-07-23");
    assert.equal(preview.values.admission_start_time, "00:00");
    assert.equal(preview.values.admission_method, "ticket");
    assert.equal(preview.values.submitter_contact, "admin@example.com");
    assert.equal(
        preview.values.source_url,
        "https://show.bilibili.com/platform/detail.html?id=1004224"
    );
    assert.equal(preview.values.ticket_url, preview.values.source_url);
    assert.match(preview.values.cover_url ?? "", /^https:\/\/i0\.hdslb\.com\//);
    assert.deepEqual(new Set(preview.missingRequiredFields), new Set(["scale", "tags"]));
    assert.deepEqual(
        preview.warnings.map(({ code }) => code),
        ["type-suggestion", "multiple-sessions"]
    );
});

test("项目 ID 和固定请求 URL 不接受 URL、零或不安全整数", () => {
    assert.equal(parseBilibiliProjectId("1004224"), 1004224);
    for (const value of ["", "0", "-1", "1.5", "https://show.bilibili.com/1", "9007199254740992"]) {
        assert.throws(() => parseBilibiliProjectId(value), BilibiliImportError);
    }

    const url = createBilibiliTicketApiUrl(1004224);
    assert.equal(`${url.origin}${url.pathname}`, BILIBILI_TICKET_API_URL);
    assert.deepEqual(Object.fromEntries(url.searchParams), {
        version: "134",
        id: "1004224",
        project_id: "1004224",
        requestSource: "pc-new"
    });
    assert.equal(
        canonicalBilibiliSourceUrl(1004224),
        "https://show.bilibili.com/platform/detail.html?id=1004224"
    );
});

test("服务端请求只发送 Accept 且不转发管理员认证信息", async () => {
    const payload = await samplePayload();
    let receivedUrl = "";
    let receivedInit: RequestInit | undefined;
    const fetchImpl: typeof fetch = async (input, init) => {
        receivedUrl = String(input);
        receivedInit = init;
        return new Response(JSON.stringify(payload), {
            headers: { "content-type": "application/json; charset=utf-8" }
        });
    };

    await fetchBilibiliTicketPreview(1004224, { fetchImpl });

    assert.equal(new URL(receivedUrl).hostname, "show.bilibili.com");
    assert.equal(receivedInit?.method, "GET");
    assert.equal(receivedInit?.redirect, "manual");
    assert.deepEqual(receivedInit?.headers, { Accept: "application/json" });
    const serialized = JSON.stringify(receivedInit).toLocaleLowerCase();
    for (const header of ["cookie", "authorization", "cf-access-jwt-assertion", "referer"]) {
        assert.doesNotMatch(serialized, new RegExp(header));
    }
});

test("服务端不跟随会员购重定向响应", async () => {
    const redirectFetch: typeof fetch = async () =>
        new Response(null, {
            status: 302,
            headers: { location: "https://example.com/redirected" }
        });

    await assert.rejects(
        () => fetchBilibiliTicketPreview(1004224, { fetchImpl: redirectFetch }),
        /HTTP 302/
    );
});

test("图片、价格、类型和状态只做保守规范化", async () => {
    assert.equal(
        normalizeBilibiliImageUrl("//i0.hdslb.com/cover.png"),
        "https://i0.hdslb.com/cover.png"
    );
    assert.equal(
        normalizeBilibiliImageUrl("http://i0.hdslb.com/cover.png"),
        "https://i0.hdslb.com/cover.png"
    );
    assert.equal(normalizeBilibiliImageUrl("javascript:alert(1)"), "");
    assert.equal(formatBilibiliPrice({ is_free: true }), "免费");
    assert.equal(formatBilibiliPrice({ price_low: 8800, price_high: 8800 }), "88 元");
    assert.equal(formatBilibiliPrice({ price_low: 7850, price_high: 13800 }), "78.5-138 元");
    assert.equal(formatBilibiliPrice({}), "");

    const payload = (await samplePayload()) as { data: Record<string, unknown> };
    payload.data.name = "OnlyFans 主题活动";
    payload.data.status_text = "活动已明确取消";
    payload.data.screen_list = [{ start_time: 1786852800, ticket_list: [] }];
    const preview = normalizeBilibiliTicketResponse(payload, { projectId: 1004224 });
    assert.equal(preview.values.type, "");
    assert.equal(preview.values.schedule_status, "cancelled");
    assert.equal(preview.values.admission_method, "");
    assert.equal(
        preview.warnings.some(({ code }) => code === "multiple-sessions"),
        false
    );
});

test("多场次使用最早场次开始和最晚场次结束, 不信任较窄的顶层范围", async () => {
    const payload = (await samplePayload()) as { data: Record<string, unknown> };
    payload.data.start_time = 1786860000;
    payload.data.end_time = 1786870800;
    payload.data.screen_list = [
        { start_time: 1786852800, end_time: 1786856400, ticket_list: [{}] },
        { start_time: 1786874400, end_time: 1786885200, ticket_list: [{}] }
    ];

    const preview = normalizeBilibiliTicketResponse(payload, { projectId: 1004224 });

    assert.equal(preview.values.start_time, "12:00");
    assert.equal(preview.values.end_time, "21:00");
    assert.match(
        preview.warnings.find(({ code }) => code === "multiple-sessions")?.message ?? "",
        /2026-08-16 12:00 至 2026-08-16 21:00/
    );
});

test("行政区按省市区上下文唯一匹配, 缺失或歧义时不猜测", () => {
    assert.equal(
        matchBilibiliDivisionCode({
            provinceName: "上海市",
            cityName: "上海市",
            districtName: "宝山区"
        }),
        "310113"
    );
    assert.equal(matchBilibiliDivisionCode({ districtName: "城区" }), null);
    assert.equal(matchBilibiliDivisionCode({ provinceName: "上海", cityName: "上海" }), null);
    assert.equal(
        matchBilibiliDivisionCode({
            provinceName: "不存在省",
            cityName: "不存在市",
            districtName: "不存在区"
        }),
        null
    );
});

test("上游超时、过大、非 JSON、业务失败和结构漂移返回稳定错误", async () => {
    const timeoutFetch: typeof fetch = async (_input, init) =>
        new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
                reject(new DOMException("Aborted", "AbortError"))
            );
        });
    await assert.rejects(
        () => fetchBilibiliTicketPreview(1004224, { fetchImpl: timeoutFetch, timeoutMs: 1 }),
        /请求超时/
    );

    const oversizedFetch: typeof fetch = async () =>
        new Response("{}", {
            headers: {
                "content-type": "application/json",
                "content-length": String(MAX_BILIBILI_RESPONSE_BYTES + 1)
            }
        });
    await assert.rejects(
        () => fetchBilibiliTicketPreview(1004224, { fetchImpl: oversizedFetch }),
        /数据过大/
    );

    const oversizedStreamFetch: typeof fetch = async () =>
        new Response(" ".repeat(MAX_BILIBILI_RESPONSE_BYTES + 1), {
            headers: { "content-type": "application/json" }
        });
    await assert.rejects(
        () => fetchBilibiliTicketPreview(1004224, { fetchImpl: oversizedStreamFetch }),
        /数据过大/
    );

    const htmlFetch: typeof fetch = async () =>
        new Response("<html></html>", { headers: { "content-type": "text/html" } });
    await assert.rejects(
        () => fetchBilibiliTicketPreview(1004224, { fetchImpl: htmlFetch }),
        /无法识别/
    );

    assert.throws(
        () => normalizeBilibiliTicketResponse({ success: false, code: -1 }, { projectId: 1 }),
        /未返回可导入/
    );
    assert.throws(
        () =>
            normalizeBilibiliTicketResponse(
                { success: true, code: 0, data: { id: 1004224 } },
                { projectId: 1004224 }
            ),
        /缺少名称/
    );
    assert.throws(
        () =>
            normalizeBilibiliTicketResponse(
                { success: true, code: 0, data: { id: 9, name: "错误活动" } },
                { projectId: 1004224 }
            ),
        /ID 与响应不一致/
    );
});

test("上游连接异常保留异常类型, 消息和 cause 供管理员排查", async () => {
    const connectionError = new TypeError("fetch failed", {
        cause: new Error("TLS handshake failed")
    });
    const failedFetch: typeof fetch = async () => {
        throw connectionError;
    };

    await assert.rejects(
        () => fetchBilibiliTicketPreview(1004224, { fetchImpl: failedFetch }),
        (error: unknown) => {
            assert.ok(error instanceof BilibiliImportError);
            assert.equal(error.message, "暂时无法连接会员购, 请稍后重试或手动录入");
            assert.equal(
                error.details,
                "TypeError: fetch failed | cause: Error: TLS handshake failed"
            );
            assert.equal(error.cause, connectionError);
            return true;
        }
    );
});

test("提交元数据重新生成规范来源并使用稳定的疑似重复警告键", () => {
    const formData = new FormData();
    formData.set("import_provider", BILIBILI_TICKET_PROVIDER);
    formData.set("bilibili_project_id", "1004224");
    formData.append("confirmed_warning_keys", "confirmed-key");
    const submission = parseBilibiliImportSubmission(formData);
    assert.equal(submission?.projectId, 1004224);
    assert.equal(submission?.canonicalSourceUrl, canonicalBilibiliSourceUrl(1004224));
    assert.equal(submission?.confirmedWarningKeys.has("confirmed-key"), true);

    const input = { title: "测试 活动", start_date: "2026-08-16", venue: "测试场馆" };
    const warnings = findBilibiliDuplicateWarnings(input, [
        { id: 7, title: " 测试  活动 ", start_date: "2026-08-16", venue: "测试场馆" },
        { id: 8, title: "其他活动", start_date: "2026-08-16", venue: "测试场馆" }
    ]);
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0]?.event.id, 7);
    assert.equal(
        warnings[0]?.key,
        '["bilibili-ticket","[\\"测试 活动\\",\\"2026-08-16\\",\\"测试场馆\\"]",7]'
    );
});
