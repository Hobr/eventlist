import type { RuntimeEnv } from "../../types/cloudflare";

const encoder = new TextEncoder();

function readCookie(cookieHeader: string | null, name: string) {
    if (!cookieHeader) return null;

    for (const part of cookieHeader.split(";")) {
        const [rawKey, ...rawValue] = part.trim().split("=");
        if (rawKey === name) {
            return decodeURIComponent(rawValue.join("="));
        }
    }

    return null;
}

async function constantTimeEqual(left: string, right: string) {
    const leftBytes = encoder.encode(left);
    const rightBytes = encoder.encode(right);
    const length = Math.max(leftBytes.length, rightBytes.length);
    const paddedLeft = new Uint8Array(length);
    const paddedRight = new Uint8Array(length);

    paddedLeft.set(leftBytes);
    paddedRight.set(rightBytes);

    const leftHash = await crypto.subtle.digest("SHA-256", paddedLeft);
    const rightHash = await crypto.subtle.digest("SHA-256", paddedRight);
    const leftDigest = new Uint8Array(leftHash);
    const rightDigest = new Uint8Array(rightHash);

    let difference = leftBytes.length ^ rightBytes.length;
    for (let index = 0; index < leftDigest.length; index += 1) {
        difference |= leftDigest[index] ^ rightDigest[index];
    }

    return difference === 0;
}

export async function verifyTokenValue(token: string | null, runtimeEnv: RuntimeEnv) {
    if (!runtimeEnv.ADMIN_TOKEN || !token) return false;
    return constantTimeEqual(token, runtimeEnv.ADMIN_TOKEN);
}

export async function verifyTokenCookie(cookieHeader: string | null, runtimeEnv: RuntimeEnv) {
    return verifyTokenValue(readCookie(cookieHeader, "admin_token"), runtimeEnv);
}
