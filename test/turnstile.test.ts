import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { handleSubmissionRequest } from "../src/lib/public/submission-handler";
import { verifyTurnstile } from "../src/lib/turnstile";
import type { RuntimeEnv } from "../src/types/cloudflare";

const originalFetch = globalThis.fetch;

test.afterEach(() => {
    globalThis.fetch = originalFetch;
});

test("Turnstile 使用 canonical 表单请求并严格接受 success true", async () => {
    const secret = `test-${crypto.randomUUID()}`;
    let capturedInput: string | URL | Request | undefined;
    let capturedInit: RequestInit | undefined;

    globalThis.fetch = async (input, init) => {
        capturedInput = input;
        capturedInit = init;
        return Response.json({ success: true });
    };

    const verification = await verifyTurnstile("response-token", secret, "203.0.113.8");

    assert.deepEqual(verification, { success: true, errors: [] });
    assert.equal(
        String(capturedInput),
        "https://challenges.cloudflare.com/turnstile/v0/siteverify"
    );
    assert.equal(capturedInit?.method, "POST");
    assert.equal(
        new Headers(capturedInit?.headers).get("content-type"),
        "application/x-www-form-urlencoded"
    );
    assert.ok(capturedInit?.body instanceof URLSearchParams);
    assert.equal(capturedInit.body.get("secret"), secret);
    assert.equal(capturedInit.body.get("response"), "response-token");
    assert.equal(capturedInit.body.get("remoteip"), "203.0.113.8");
});

test("Turnstile 保留失败码且不接受 truthy success", async () => {
    globalThis.fetch = async () =>
        Response.json({
            success: "true",
            "error-codes": ["invalid-input-response", 42]
        });

    const verification = await verifyTurnstile("response-token", "test-secret");

    assert.deepEqual(verification, {
        success: false,
        errors: ["invalid-input-response"]
    });
});

test("Turnstile 缺少 token 时不调用上游", async () => {
    let called = false;
    globalThis.fetch = async () => {
        called = true;
        return Response.json({ success: true });
    };

    assert.deepEqual(await verifyTurnstile(null, "test-secret"), {
        success: false,
        errors: ["missing-input-response"]
    });
    assert.equal(called, false);
});

test("Turnstile 缺少 secret 时失败关闭", async () => {
    await assert.rejects(() => verifyTurnstile("response-token", null), /not configured/);
});

test("Turnstile 网络和响应协议异常时失败关闭", async (t) => {
    await t.test("网络异常", async () => {
        globalThis.fetch = async () => {
            throw new Error("network unavailable");
        };
        await assert.rejects(
            () => verifyTurnstile("response-token", "test-secret"),
            /verification request failed/
        );
    });

    await t.test("非 2xx", async () => {
        globalThis.fetch = async () => new Response(null, { status: 503 });
        await assert.rejects(
            () => verifyTurnstile("response-token", "test-secret"),
            /verification request failed/
        );
    });

    await t.test("非 JSON", async () => {
        globalThis.fetch = async () => new Response("not-json");
        await assert.rejects(
            () => verifyTurnstile("response-token", "test-secret"),
            /verification request failed/
        );
    });
});

test("公开投稿仅在 Turnstile 成功后访问 D1", async () => {
    const formData = new FormData();
    formData.set("title", "Turnstile 门禁测试");
    formData.set("type", "comic");
    formData.set("scale", "small");
    formData.set("division_code", "310101");
    formData.set("venue", "测试场地");
    formData.set("start_date", "2026-08-01");
    formData.set("end_date", "2026-08-01");
    formData.set("source_url", "https://example.com/event");
    formData.set("submitter_contact", "test@example.com");
    formData.set("cf-turnstile-response", "rejected-token");

    globalThis.fetch = async () =>
        Response.json({ success: false, "error-codes": ["invalid-input-response"] });

    let databaseAccessed = false;
    const runtimeEnv: RuntimeEnv = { TURNSTILE_SECRET: "test-secret" };
    Object.defineProperty(runtimeEnv, "DB", {
        get() {
            databaseAccessed = true;
            throw new Error("D1 must not be accessed before Turnstile succeeds");
        }
    });

    const response = await handleSubmissionRequest(
        new Request("https://example.com/api/submit", {
            method: "POST",
            headers: { "CF-Connecting-IP": "203.0.113.8" },
            body: formData
        }),
        runtimeEnv
    );

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
        ok: false,
        error: "人机校验失败, 请刷新后重试"
    });
    assert.equal(databaseAccessed, false);
});

test("公开投稿前端带有 Spin 标记和失败 reset 合同", async () => {
    const [component, page, route] = await Promise.all([
        readFile(new URL("../src/components/Turnstile.svelte", import.meta.url), "utf8"),
        readFile(new URL("../src/pages/submit.astro", import.meta.url), "utf8"),
        readFile(new URL("../src/pages/api/submit.ts", import.meta.url), "utf8")
    ]);

    assert.match(component, /class="cf-turnstile"/);
    assert.match(component, /data-action="turnstile-spin-v2"/);
    assert.match(component, /action: TURNSTILE_ACTION/);
    assert.match(component, /"response-field": false/);
    assert.match(component, /window\.turnstile\.reset\(widgetId\)/);
    assert.match(page, /form\.dispatchEvent\(new Event\(TURNSTILE_RESET_EVENT\)\)/);
    assert.match(route, /handleSubmissionRequest\(request, getRuntimeEnv\(\)\)/);
});
