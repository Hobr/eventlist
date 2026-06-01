/// <reference path="../.astro/types.d.ts" />
/// <reference path="../worker-configuration.d.ts" />

type Env = {
    DB: D1Database;
    BUCKET: R2Bucket;
    RATE_LIMIT: KVNamespace;
    SESSION: KVNamespace;
    TURNSTILE_SECRET_KEY: string;
    PUBLIC_TURNSTILE_SITE_KEY: string;
    PUBLIC_R2_BASE_URL: string;
    PUBLIC_SITE_URL: string;
    DEV_ADMIN_EMAIL: string;
    ADMIN_EMAILS: string;
};

declare module "cloudflare:workers" {
    export const env: Env;
}

declare namespace App {
    interface Locals {
        cf: IncomingRequestCfProperties;
    }
}
