/// <reference path="../.astro/types.d.ts" />

interface CloudflareEnv {
  DB: D1Database;
  BUCKET: R2Bucket;
  RATE_LIMIT: KVNamespace;
  SESSION: KVNamespace;
  TURNSTILE_SECRET_KEY: string;
  PUBLIC_TURNSTILE_SITE_KEY: string;
  PUBLIC_R2_BASE_URL: string;
  PUBLIC_SITE_URL: string;
  DEV_ADMIN_EMAIL?: string;
}

declare namespace App {
  interface Locals {
    cf: IncomingRequestCfProperties;
    runtime: { env: CloudflareEnv };
  }
}
