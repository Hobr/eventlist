const TURNSTILE_VERIFY_URL =
    "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export interface TurnstileVerification {
    success: boolean;
    errors: string[];
}

interface TurnstileResponseBody {
    success?: boolean;
    "error-codes"?: string[];
}

export async function verifyTurnstile(
    token: string | null | undefined,
    secret: string | null | undefined,
    remoteIp?: string | null,
): Promise<TurnstileVerification> {
    if (!secret) {
        throw new Error("Turnstile secret is not configured");
    }

    if (!token) {
        return { success: false, errors: ["missing-input-response"] };
    }

    const body = new URLSearchParams({
        secret,
        response: token,
    });
    if (remoteIp) body.set("remoteip", remoteIp);

    let response: Response;
    try {
        response = await fetch(TURNSTILE_VERIFY_URL, {
            method: "POST",
            body,
        });
    } catch {
        throw new Error("Turnstile verification request failed");
    }
    if (!response.ok) {
        throw new Error("Turnstile verification request failed");
    }

    const result = (await response.json()) as TurnstileResponseBody;
    return {
        success: result.success === true,
        errors: result["error-codes"] ?? [],
    };
}
