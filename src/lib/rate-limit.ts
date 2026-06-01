interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    cooldown?: boolean;
}

export async function checkRateLimit(
    kv: KVNamespace,
    ipHash: string,
    dailyLimit: number,
    cooldownSeconds: number,
): Promise<RateLimitResult> {
    const today = new Date().toISOString().slice(0, 10);
    const dayKey = `rl:${ipHash}:${today}`;
    const cooldownKey = `rl:cd:${ipHash}`;

    const [dayData, cooldownData] = await Promise.all([
        kv.get(dayKey, "json") as Promise<{ count: number } | null>,
        kv.get(cooldownKey),
    ]);

    if (cooldownData) {
        return { allowed: false, remaining: 0, cooldown: true };
    }

    const count = dayData?.count ?? 0;
    if (count >= dailyLimit) {
        return { allowed: false, remaining: 0 };
    }

    await Promise.all([
        kv.put(dayKey, JSON.stringify({ count: count + 1 }), {
            expirationTtl: 86400,
        }),
        kv.put(cooldownKey, "1", { expirationTtl: cooldownSeconds }),
    ]);

    return { allowed: true, remaining: dailyLimit - count - 1 };
}

export async function hashIp(ip: string): Promise<string> {
    const data = new TextEncoder().encode(ip);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}
