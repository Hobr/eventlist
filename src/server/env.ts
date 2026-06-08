import { env as workerEnv } from "cloudflare:workers";

export function getWorkerEnv(): Env | undefined {
    return workerEnv as Env | undefined;
}

export function getClientIp(request: Request): string {
    return (
        request.headers.get("cf-connecting-ip") ??
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        "127.0.0.1"
    );
}
