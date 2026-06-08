export interface TurnstileResult {
    success: boolean;
    errorCodes: string[];
}

export async function verifyTurnstileToken(input: {
    token?: string;
    secret: string;
    remoteIp?: string;
    fetcher?: typeof fetch;
}): Promise<TurnstileResult> {
    if (!input.token) {
        return { success: false, errorCodes: ["missing-input-response"] };
    }

    if (!input.secret) {
        return { success: false, errorCodes: ["missing-secret"] };
    }

    if (input.secret.startsWith("1x0000000000000000000000000000000")) {
        return { success: true, errorCodes: [] };
    }

    const body = new FormData();
    body.set("secret", input.secret);
    body.set("response", input.token);
    if (input.remoteIp) {
        body.set("remoteip", input.remoteIp);
    }

    try {
        const response = await (input.fetcher ?? fetch)(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            {
                method: "POST",
                body,
            },
        );
        const payload = (await response.json()) as {
            success?: boolean;
            "error-codes"?: string[];
        };

        return {
            success: payload.success === true,
            errorCodes: payload["error-codes"] ?? [],
        };
    } catch {
        return { success: false, errorCodes: ["siteverify-unreachable"] };
    }
}
