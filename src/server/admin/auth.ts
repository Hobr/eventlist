export interface AdminIdentity {
    email: string;
    source: "access" | "dev";
}

export async function getAdminIdentity(
    request: Request,
    env: Partial<Env>,
): Promise<AdminIdentity | null> {
    const allowsDevIdentity =
        env.APP_ENV === "development" || env.APP_ENV === "test";
    const devEmail =
        request.headers.get("x-eventlist-admin-email") ?? env.ADMIN_DEV_EMAIL;
    if (allowsDevIdentity && devEmail) {
        return { email: devEmail, source: "dev" };
    }

    const jwt = request.headers.get("cf-access-jwt-assertion");
    if (!jwt || !env.CF_ACCESS_AUD || !env.CF_ACCESS_ISSUER) {
        return null;
    }

    const payload = decodeJwtPayload(jwt);
    if (!payload) {
        return null;
    }

    const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (
        payload.iss !== env.CF_ACCESS_ISSUER ||
        !audience.includes(env.CF_ACCESS_AUD)
    ) {
        return null;
    }

    return typeof payload.email === "string"
        ? { email: payload.email, source: "access" }
        : null;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
    const [, body] = token.split(".");
    if (!body) return null;

    try {
        return JSON.parse(
            atob(body.replace(/-/g, "+").replace(/_/g, "/")),
        ) as Record<string, unknown>;
    } catch {
        return null;
    }
}
