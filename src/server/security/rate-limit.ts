export interface RateLimitResult {
    allowed: boolean;
    reason?: "cooldown" | "daily-limit";
    remaining: number;
}

export async function checkSubmissionRateLimit(input: {
    kv: KVNamespace;
    ipHash: string;
    now?: Date;
    cooldownSeconds?: number;
    dailyLimit?: number;
}): Promise<RateLimitResult> {
    const now = input.now ?? new Date();
    const cooldownSeconds = input.cooldownSeconds ?? 60;
    const dailyLimit = input.dailyLimit ?? 5;
    const day = now.toISOString().slice(0, 10);
    const cooldownKey = `submission:cooldown:${input.ipHash}`;
    const dailyKey = `submission:daily:${day}:${input.ipHash}`;

    if (await input.kv.get(cooldownKey)) {
        return { allowed: false, reason: "cooldown", remaining: 0 };
    }

    const current = Number((await input.kv.get(dailyKey)) ?? "0");
    if (current >= dailyLimit) {
        return { allowed: false, reason: "daily-limit", remaining: 0 };
    }

    await input.kv.put(cooldownKey, "1", { expirationTtl: cooldownSeconds });
    await input.kv.put(String(dailyKey), String(current + 1), {
        expirationTtl: secondsUntilTomorrow(now),
    });

    return { allowed: true, remaining: dailyLimit - current - 1 };
}

function secondsUntilTomorrow(now: Date): number {
    const tomorrow = new Date(now);
    tomorrow.setUTCHours(24, 0, 0, 0);
    return Math.max(60, Math.ceil((tomorrow.getTime() - now.getTime()) / 1000));
}
