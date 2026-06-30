import { env } from "cloudflare:workers";
import type { RuntimeEnv } from "../../types/cloudflare";

export function getRuntimeEnv(): RuntimeEnv {
    return env as RuntimeEnv;
}

export function getAuthMode(runtimeEnv: RuntimeEnv): "access" | "token" {
    return runtimeEnv.AUTH_MODE === "token" ? "token" : "access";
}
