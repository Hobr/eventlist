import type { RuntimeEnv } from "../../types/cloudflare";

interface AccessJsonWebKey extends JsonWebKey {
    kid?: string;
}

interface JsonWebKeySet {
    keys: AccessJsonWebKey[];
}

interface JwtHeader {
    alg?: string;
    kid?: string;
    typ?: string;
}

export interface AccessJwtPayload {
    aud?: string | string[];
    email?: string;
    exp?: number;
    iat?: number;
    iss?: string;
    sub?: string;
}

const decoder = new TextDecoder();
const jwksCache = new Map<string, { expiresAt: number; keys: AccessJsonWebKey[] }>();
const JWKS_CACHE_MS = 5 * 60 * 1000;

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
}

function parseBase64UrlJson<T>(value: string) {
    return JSON.parse(decoder.decode(base64UrlToBytes(value))) as T;
}

function normalizeTeamDomain(team: string) {
    if (team.startsWith("https://")) return team.replace(/\/$/, "");
    return `https://${team.replace(/\/$/, "")}.cloudflareaccess.com`;
}

async function getJwks(teamDomain: string) {
    const cached = jwksCache.get(teamDomain);
    if (cached && cached.expiresAt > Date.now()) return cached.keys;

    const response = await fetch(`${teamDomain}/cdn-cgi/access/certs`);
    if (!response.ok) {
        throw new Error("Unable to fetch Cloudflare Access signing keys");
    }

    const jwks = (await response.json()) as JsonWebKeySet;
    jwksCache.set(teamDomain, {
        expiresAt: Date.now() + JWKS_CACHE_MS,
        keys: jwks.keys
    });

    return jwks.keys;
}

function audienceMatches(actual: string | string[] | undefined, expected: string) {
    if (Array.isArray(actual)) return actual.includes(expected);
    return actual === expected;
}

export async function verifyAccessJWT(jwt: string | null, runtimeEnv: RuntimeEnv) {
    if (!jwt || !runtimeEnv.ACCESS_TEAM || !runtimeEnv.ACCESS_AUD) {
        return null;
    }

    const parts = jwt.split(".");
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    if (!encodedHeader || !encodedPayload || !encodedSignature) return null;

    let header: JwtHeader;
    let payload: AccessJwtPayload;
    let signature: Uint8Array<ArrayBuffer>;
    try {
        header = parseBase64UrlJson<JwtHeader>(encodedHeader);
        payload = parseBase64UrlJson<AccessJwtPayload>(encodedPayload);
        signature = base64UrlToBytes(encodedSignature);
    } catch {
        return null;
    }

    if (header.alg !== "RS256" || !header.kid) return null;

    const teamDomain = normalizeTeamDomain(runtimeEnv.ACCESS_TEAM);
    const expectedIssuer = teamDomain;
    const now = Math.floor(Date.now() / 1000);

    if (payload.iss !== expectedIssuer) return null;
    if (!audienceMatches(payload.aud, runtimeEnv.ACCESS_AUD)) return null;
    if (!payload.exp || payload.exp <= now) return null;

    const keys = await getJwks(teamDomain);
    const jwk = keys.find((key) => key.kid === header.kid);
    if (!jwk) return null;

    const key = await crypto.subtle.importKey(
        "jwk",
        jwk,
        { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
        false,
        ["verify"]
    );
    const encodedData = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
    const signedData: Uint8Array<ArrayBuffer> = new Uint8Array(encodedData);
    const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, signedData);

    return valid ? payload : null;
}
