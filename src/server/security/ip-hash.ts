export async function hashVisitorIp(
    ip: string,
    secret: string,
): Promise<string> {
    if (!secret || secret.length < 12) {
        throw new Error(
            "IP hash secret must be configured and at least 12 characters long.",
        );
    }

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
    );
    const signature = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(ip.trim()),
    );
    return [...new Uint8Array(signature)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}
