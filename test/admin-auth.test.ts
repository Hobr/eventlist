import assert from "node:assert/strict";
import test from "node:test";
import { verifyAccessJWT, type AccessJwtPayload } from "../src/lib/auth/access";
import { verifyTokenCookie, verifyTokenValue } from "../src/lib/auth/token";
import type { RuntimeEnv } from "../src/types/cloudflare";

const originalFetch = globalThis.fetch;
const encoder = new TextEncoder();

test.afterEach(() => {
    globalThis.fetch = originalFetch;
});

function encodeBase64Url(value: string | ArrayBuffer) {
    return Buffer.from(value instanceof ArrayBuffer ? new Uint8Array(value) : value).toString(
        "base64url"
    );
}

async function createAccessFixture() {
    const team = `eventlist-${crypto.randomUUID()}`;
    const audience = `aud-${crypto.randomUUID()}`;
    const issuer = `https://${team}.cloudflareaccess.com`;
    const kid = `kid-${crypto.randomUUID()}`;
    const { privateKey, publicKey } = (await crypto.subtle.generateKey(
        {
            name: "RSASSA-PKCS1-v1_5",
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256"
        },
        true,
        ["sign", "verify"]
    )) as CryptoKeyPair;
    const publicJwk = { ...(await crypto.subtle.exportKey("jwk", publicKey)), kid };

    async function sign(overrides: Partial<AccessJwtPayload> = {}) {
        const header = encodeBase64Url(JSON.stringify({ alg: "RS256", kid, typ: "JWT" }));
        const payload = encodeBase64Url(
            JSON.stringify({
                iss: issuer,
                aud: audience,
                exp: Math.floor(Date.now() / 1000) + 300,
                email: "admin@example.com",
                ...overrides
            })
        );
        const data = `${header}.${payload}`;
        const signature = await crypto.subtle.sign(
            "RSASSA-PKCS1-v1_5",
            privateKey,
            encoder.encode(data)
        );
        return `${data}.${encodeBase64Url(signature)}`;
    }

    return {
        audience,
        publicJwk,
        runtimeEnv: { ACCESS_TEAM: team, ACCESS_AUD: audience } satisfies RuntimeEnv,
        sign
    };
}

function tamperSignature(jwt: string) {
    const parts = jwt.split(".");
    const signature = Buffer.from(parts[2] ?? "", "base64url");
    signature[0] ^= 1;
    return `${parts[0]}.${parts[1]}.${signature.toString("base64url")}`;
}

test("Token 管理认证要求精确值并安全解析 cookie", async () => {
    const runtimeEnv = { ADMIN_TOKEN: "admin=token" } satisfies RuntimeEnv;

    assert.equal(await verifyTokenValue("admin=token", runtimeEnv), true);
    assert.equal(await verifyTokenValue("admin=tokem", runtimeEnv), false);
    assert.equal(await verifyTokenValue(null, runtimeEnv), false);
    assert.equal(await verifyTokenCookie("other=x; admin_token=admin%3Dtoken", runtimeEnv), true);
    assert.equal(await verifyTokenCookie("admin_token=%E0%A4%A", runtimeEnv), false);
});

test("Access JWT 验证签名和声明并默认失败关闭", async () => {
    const fixture = await createAccessFixture();
    let jwksRequests = 0;
    globalThis.fetch = async (input) => {
        jwksRequests += 1;
        assert.equal(
            String(input),
            `${fixture.runtimeEnv.ACCESS_TEAM?.startsWith("https://") ? fixture.runtimeEnv.ACCESS_TEAM : `https://${fixture.runtimeEnv.ACCESS_TEAM}.cloudflareaccess.com`}/cdn-cgi/access/certs`
        );
        return Response.json({ keys: [fixture.publicJwk] });
    };

    const validJwt = await fixture.sign();
    assert.equal((await verifyAccessJWT(validJwt, fixture.runtimeEnv))?.email, "admin@example.com");
    assert.equal(await verifyAccessJWT(tamperSignature(validJwt), fixture.runtimeEnv), null);
    assert.equal(
        await verifyAccessJWT(await fixture.sign({ aud: "wrong-audience" }), fixture.runtimeEnv),
        null
    );
    assert.equal(await verifyAccessJWT(await fixture.sign({ exp: 1 }), fixture.runtimeEnv), null);
    assert.equal(await verifyAccessJWT("not-a-jwt", fixture.runtimeEnv), null);
    assert.equal(jwksRequests, 1);
});
