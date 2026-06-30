import type { RuntimeEnv } from "../../types/cloudflare";
import { getAuthMode } from "../runtime/env";
import { verifyAccessJWT } from "./access";
import { verifyTokenCookie } from "./token";

export interface AdminAuthResult {
    email?: string;
    mode: "access" | "token";
}

export function isAdminPagePath(pathname: string) {
    return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function isAdminApiPath(pathname: string) {
    return pathname === "/api/admin" || pathname.startsWith("/api/admin/");
}

export async function authenticateAdmin(request: Request, runtimeEnv: RuntimeEnv) {
    const mode = getAuthMode(runtimeEnv);

    if (mode === "token") {
        const valid = await verifyTokenCookie(request.headers.get("cookie"), runtimeEnv);
        return valid ? ({ mode } satisfies AdminAuthResult) : null;
    }

    const payload = await verifyAccessJWT(
        request.headers.get("cf-access-jwt-assertion"),
        runtimeEnv
    );
    return payload ? ({ mode, email: payload.email } satisfies AdminAuthResult) : null;
}
