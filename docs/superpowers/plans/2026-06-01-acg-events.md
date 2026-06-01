# ACG 活动查询网站 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack ACG event listing website with SSR, user submissions, admin review, and Cloudflare deployment.

**Architecture:** Astro 6 SSR with React 19 islands for interactive components, backed by Cloudflare D1 (database), R2 (image storage), KV (rate limiting + view dedup). API routes handle submission (HMAC-signed two-step flow), event queries, and admin CRUD. Cloudflare Access protects admin routes.

**Tech Stack:** Astro 6, React 19, Tailwind v4, Drizzle ORM, Cloudflare Workers (D1 + R2 + KV), Vitest, TypeScript

---

## File Structure

```
eventlist/
├── astro.config.mjs
├── wrangler.jsonc
├── drizzle.config.ts
├── vitest.config.ts
├── tsconfig.json
├── data/
│   └── provinces.json
├── migrations/
│   └── 0000_initial.sql
├── seeds/
│   └── demo.sql
├── public/
│   └── placeholder-poster.svg
├── src/
│   ├── env.d.ts
│   ├── middleware.ts
│   ├── styles/global.css
│   ├── types/event.ts
│   ├── lib/
│   │   ├── ulid.ts
│   │   ├── hmac.ts
│   │   ├── rate-limit.ts
│   │   ├── turnstile.ts
│   │   └── poster-url.ts
│   ├── server/
│   │   └── db/
│   │       ├── schema.ts
│   │       └── index.ts
│   ├── components/
│   │   ├── EventCard.tsx
│   │   ├── EventCard.astro
│   │   ├── FilterBar.tsx
│   │   ├── NearbyEvents.astro
│   │   ├── PopularEvents.astro
│   │   ├── EventList.tsx
│   │   ├── SubmitForm.tsx
│   │   ├── PosterLightbox.tsx
│   │   └── CopyButton.tsx
│   └── pages/
│       ├── index.astro
│       ├── event/[id].astro
│       ├── submit.astro
│       ├── admin.astro
│       └── api/
│           ├── submit/
│           │   ├── sign.ts
│           │   └── commit.ts
│           ├── events.ts
│           ├── events/[id]/view.ts
│           └── admin/
│               ├── events.ts
│               └── events/[id].ts
└── tests/
    ├── ulid.test.ts
    ├── hmac.test.ts
    ├── rate-limit.test.ts
    ├── turnstile.test.ts
    ├── poster-url.test.ts
    └── api/
        ├── events.test.ts
        └── submit.test.ts
```

---

## Task 1: Project Scaffolding

**Files:**

- Create: `package.json`, `astro.config.mjs`, `wrangler.jsonc`, `tsconfig.json`, `drizzle.config.ts`, `vitest.config.ts`
- Create: `src/env.d.ts`, `src/styles/global.css`

- [ ] **Step 1: Initialize Astro project**

Run in an empty directory (or move existing docs aside temporarily):

```bash
pnpm create astro@latest . -- --template minimal --no-install --no-git --typescript strict
```

- [ ] **Step 2: Install core dependencies**

```bash
pnpm add astro @astrojs/cloudflare @astrojs/react @astrojs/tailwind react react-dom drizzle-orm
pnpm add -D @cloudflare/workers-types wrangler drizzle-kit vitest @types/react @types/react-dom
pnpm add lucide-react yet-another-react-lightbox browser-image-compression
```

- [ ] **Step 3: Configure Astro**

`astro.config.mjs`:

```js
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";

export default defineConfig({
    output: "server",
    adapter: cloudflare(),
    integrations: [react(), tailwind()],
});
```

- [ ] **Step 4: Configure wrangler.jsonc**

`wrangler.jsonc`:

```jsonc
{
    "name": "acg-events",
    "main": "./dist/server/entry.mjs",
    "compatibility_date": "2025-01-01",
    "compatibility_flags": ["nodejs_compat"],
    "assets": {
        "directory": "./dist/client",
        "binding": "ASSETS",
    },
    "d1_databases": [
        {
            "binding": "DB",
            "database_name": "acg-events",
            "database_id": "placeholder",
        },
    ],
    "r2_buckets": [
        {
            "binding": "BUCKET",
            "bucket_name": "acg-events-posters",
        },
    ],
    "kv_namespaces": [
        {
            "binding": "RATE_LIMIT",
            "id": "placeholder",
        },
        {
            "binding": "SESSION",
            "id": "placeholder",
        },
    ],
    "vars": {
        "PUBLIC_TURNSTILE_SITE_KEY": "",
        "PUBLIC_R2_BASE_URL": "",
        "PUBLIC_SITE_URL": "http://localhost:4321",
    },
}
```

- [ ] **Step 5: Configure TypeScript**

`tsconfig.json`:

```json
{
    "extends": "astro/tsconfigs/strict",
    "compilerOptions": {
        "jsx": "react-jsx",
        "jsxImportSource": "react",
        "types": ["@cloudflare/workers-types"]
    }
}
```

- [ ] **Step 6: Create env.d.ts**

`src/env.d.ts`:

```ts
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
```

- [ ] **Step 7: Create global.css**

`src/styles/global.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
    --color-primary: #6366f1;
    --color-accent: #f59e0b;
}

body {
    @apply bg-gray-50 text-gray-900 min-h-screen;
}
```

- [ ] **Step 8: Configure vitest**

`vitest.config.ts`:

```ts
import { getViteConfig } from "astro/config";

export default getViteConfig({
    test: {
        globals: true,
        environment: "node",
        include: ["tests/**/*.test.ts"],
    },
});
```

- [ ] **Step 9: Configure drizzle**

`drizzle.config.ts`:

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
    schema: "./src/server/db/schema.ts",
    out: "./migrations",
    dialect: "sqlite",
    dbCredentials: {
        url: ".wrangler/state/v3/d1/miniflare-D1DatabaseObject/eventlist.sqlite",
    },
});
```

- [ ] **Step 10: Add pnpm scripts**

Add to `package.json`:

```json
{
    "scripts": {
        "dev": "astro dev",
        "build": "astro build",
        "preview": "astro build && wrangler dev -c dist/server/wrangler.json",
        "typecheck": "astro check",
        "test": "vitest run",
        "test:watch": "vitest",
        "format": "prettier --write .",
        "db:generate": "drizzle-kit generate",
        "db:migrate:local": "wrangler d1 migrations apply acg-events --local",
        "db:migrate:prod": "wrangler d1 migrations apply acg-events --remote",
        "cf-typegen": "wrangler types",
        "deploy": "astro build && wrangler deploy -c dist/server/wrangler.json"
    }
}
```

- [ ] **Step 11: Verify build works**

```bash
pnpm run build
```

Expected: Build completes without errors.

- [ ] **Step 12: Commit**

```bash
git add -A && git commit -m "chore: scaffold Astro 6 + React + Tailwind + Cloudflare project"
```

---

## Task 2: Database Schema & Migration

**Files:**

- Create: `src/server/db/schema.ts`, `src/server/db/index.ts`
- Create: `migrations/0000_initial.sql`

- [ ] **Step 1: Define Drizzle schema**

`src/server/db/schema.ts`:

```ts
import {
    sqliteTable,
    text,
    integer,
    primaryKey,
} from "drizzle-orm/sqlite-core";

export const events = sqliteTable("events", {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    province: text("province").notNull(),
    city: text("city").notNull(),
    venue: text("venue").notNull(),
    address: text("address"),
    startDate: text("start_date").notNull(),
    endDate: text("end_date"),
    eventType: text("event_type", { enum: ["doujin", "concert"] }).notNull(),
    scale: text("scale"),
    qqGroup: text("qq_group"),
    ticketUrl: text("ticket_url"),
    posterKey: text("poster_key"),
    priceInfo: text("price_info"),
    description: text("description"),
    viewCount: integer("view_count").notNull().default(0),
    status: text("status", { enum: ["pending", "approved", "rejected"] })
        .notNull()
        .default("pending"),
    deletedAt: text("deleted_at"),
    createdAt: text("created_at").notNull().default("(datetime('now'))"),
    updatedAt: text("updated_at").notNull().default("(datetime('now'))"),
});

export const eventWorks = sqliteTable(
    "event_works",
    {
        eventId: text("event_id")
            .notNull()
            .references(() => events.id, { onDelete: "cascade" }),
        workName: text("work_name").notNull(),
    },
    (t) => [primaryKey({ columns: [t.eventId, t.workName] })],
);
```

- [ ] **Step 2: Create DB helper**

`src/server/db/index.ts`:

```ts
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDB(env: CloudflareEnv) {
    return drizzle(env.DB, { schema });
}
```

- [ ] **Step 3: Generate migration SQL**

```bash
pnpm run db:generate
```

Then edit the generated `migrations/0000_initial.sql` to add the indexes:

```sql
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  province TEXT NOT NULL,
  city TEXT NOT NULL,
  venue TEXT NOT NULL,
  address TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT,
  event_type TEXT NOT NULL,
  scale TEXT,
  qq_group TEXT,
  ticket_url TEXT,
  poster_key TEXT,
  price_info TEXT,
  description TEXT,
  view_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS event_works (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  work_name TEXT NOT NULL,
  PRIMARY KEY (event_id, work_name)
);

CREATE INDEX IF NOT EXISTS idx_events_status_date ON events(status, start_date);
CREATE INDEX IF NOT EXISTS idx_events_province ON events(province, city);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_works_name ON event_works(work_name);
```

- [ ] **Step 4: Apply migration locally**

```bash
pnpm run db:migrate:local
```

Expected: Migration applied successfully.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add Drizzle schema with events + event_works tables and indexes"
```

---

## Task 3: Core Utilities

**Files:**

- Create: `src/lib/ulid.ts`, `src/lib/hmac.ts`, `src/lib/poster-url.ts`
- Create: `tests/ulid.test.ts`, `tests/hmac.test.ts`, `tests/poster-url.test.ts`

- [ ] **Step 1: Write failing test for ULID**

`tests/ulid.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { generateUlid } from "../src/lib/ulid";

describe("generateUlid", () => {
    it("returns a 26-character string", () => {
        const id = generateUlid();
        expect(id).toHaveLength(26);
    });

    it("starts with a valid Crockford base32 character", () => {
        const id = generateUlid();
        expect(id[0]).toMatch(/^[0-9A-HJKMNP-TV-Z]$/);
    });

    it("generates unique IDs", () => {
        const ids = new Set(Array.from({ length: 1000 }, () => generateUlid()));
        expect(ids.size).toBe(1000);
    });

    it("encodes timestamp in first 10 characters (sortable)", () => {
        const before = Date.now();
        const id = generateUlid();
        const after = Date.now();

        const timestampChars = id.slice(0, 10);
        const decoded = decodeUlidTimestamp(timestampChars);
        expect(decoded).toBeGreaterThanOrEqual(before);
        expect(decoded).toBeLessThanOrEqual(after + 1);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm run test -- tests/ulid.test.ts
```

Expected: FAIL — `Cannot find module '../src/lib/ulid'`

- [ ] **Step 3: Implement ULID**

`src/lib/ulid.ts`:

```ts
const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ENCODING_LEN = ENCODING.length;

function encodeTime(now: number, len: number): string {
    let str = "";
    for (let i = len - 1; i >= 0; i--) {
        const mod = now % ENCODING_LEN;
        str = ENCODING[mod] + str;
        now = (now - mod) / ENCODING_LEN;
    }
    return str;
}

function encodeRandom(len: number): string {
    const bytes = new Uint8Array(len);
    crypto.getRandomValues(bytes);
    let str = "";
    for (let i = 0; i < len; i++) {
        str += ENCODING[bytes[i] % ENCODING_LEN];
    }
    return str;
}

export function generateUlid(): string {
    return encodeTime(Date.now(), 10) + encodeRandom(16);
}

export function decodeUlidTimestamp(encoded: string): number {
    let t = 0;
    for (let i = 0; i < encoded.length; i++) {
        t = t * ENCODING_LEN + ENCODING.indexOf(encoded[i]);
    }
    return t;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm run test -- tests/ulid.test.ts
```

Expected: PASS

- [ ] **Step 5: Write failing test for HMAC**

`tests/hmac.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { signTicket, verifyTicket } from "../src/lib/hmac";

const SECRET = "test-secret-key-at-least-32-chars!!";

describe("signTicket / verifyTicket", () => {
    it("signs and verifies a ticket", async () => {
        const payload = { title: "Test Event", city: "上海" };
        const ticket = await signTicket(payload, SECRET, 60);
        const result = await verifyTicket(ticket, SECRET);
        expect(result).toEqual(payload);
    });

    it("rejects expired ticket", async () => {
        const payload = { title: "Test" };
        const ticket = await signTicket(payload, SECRET, -1);
        await expect(verifyTicket(ticket, SECRET)).rejects.toThrow("expired");
    });

    it("rejects tampered ticket", async () => {
        const payload = { title: "Test" };
        const ticket = await signTicket(payload, SECRET, 60);
        const tampered = ticket.slice(0, -2) + "XX";
        await expect(verifyTicket(tampered, SECRET)).rejects.toThrow("invalid");
    });
});
```

- [ ] **Step 6: Run test to verify it fails**

```bash
pnpm run test -- tests/hmac.test.ts
```

Expected: FAIL

- [ ] **Step 7: Implement HMAC**

`src/lib/hmac.ts`:

```ts
const encoder = new TextEncoder();

async function hmacKey(secret: string) {
    return crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign", "verify"],
    );
}

async function hmacSign(data: string, secret: string): Promise<string> {
    const key = await hmacKey(secret);
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
    return btoa(String.fromCharCode(...new Uint8Array(sig)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

export async function signTicket(
    payload: Record<string, unknown>,
    secret: string,
    ttlSeconds: number,
): Promise<string> {
    const body = {
        p: payload,
        exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    };
    const json = JSON.stringify(body);
    const b64 = btoa(json)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    const sig = await hmacSign(b64, secret);
    return `${b64}.${sig}`;
}

export async function verifyTicket(
    ticket: string,
    secret: string,
): Promise<Record<string, unknown>> {
    const [b64, sig] = ticket.split(".");
    if (!b64 || !sig) throw new Error("invalid ticket format");

    const expectedSig = await hmacSign(b64, secret);
    if (sig !== expectedSig) throw new Error("invalid signature");

    const json = atob(b64.replace(/-/g, "+").replace(/_/g, "/"));
    const body = JSON.parse(json);

    if (body.exp < Math.floor(Date.now() / 1000)) {
        throw new Error("ticket expired");
    }
    return body.p;
}
```

- [ ] **Step 8: Run HMAC test**

```bash
pnpm run test -- tests/hmac.test.ts
```

Expected: PASS

- [ ] **Step 9: Write failing test for poster-url**

`tests/poster-url.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getPosterUrl } from "../src/lib/poster-url";

describe("getPosterUrl", () => {
    it("returns R2 base URL when configured", () => {
        const url = getPosterUrl("posters/abc.webp", "https://cdn.example.com");
        expect(url).toBe("https://cdn.example.com/posters/abc.webp");
    });

    it("returns same-origin fallback when base is empty", () => {
        const url = getPosterUrl("posters/abc.webp", "");
        expect(url).toBe("/r2/posters/abc.webp");
    });

    it("returns placeholder when key is null", () => {
        const url = getPosterUrl(null, "https://cdn.example.com");
        expect(url).toBe("/placeholder-poster.svg");
    });
});
```

- [ ] **Step 10: Run test to verify it fails**

```bash
pnpm run test -- tests/poster-url.test.ts
```

Expected: FAIL

- [ ] **Step 11: Implement poster-url**

`src/lib/poster-url.ts`:

```ts
export function getPosterUrl(
    key: string | null | undefined,
    r2BaseUrl: string,
): string {
    if (!key) return "/placeholder-poster.svg";
    if (r2BaseUrl) return `${r2BaseUrl}/${key}`;
    return `/r2/${key}`;
}
```

- [ ] **Step 12: Run poster-url test**

```bash
pnpm run test -- tests/poster-url.test.ts
```

Expected: PASS

- [ ] **Step 13: Commit**

```bash
git add -A && git commit -m "feat: add ULID, HMAC signing, and poster URL utilities with tests"
```

---

## Task 4: Turnstile Verification & Rate Limiting

**Files:**

- Create: `src/lib/turnstile.ts`, `src/lib/rate-limit.ts`
- Create: `tests/turnstile.test.ts`, `tests/rate-limit.test.ts`

- [ ] **Step 1: Write failing test for Turnstile**

`tests/turnstile.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { verifyTurnstile } from "../src/lib/turnstile";

describe("verifyTurnstile", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("returns true for valid token", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                json: () => Promise.resolve({ success: true }),
            }),
        );

        const result = await verifyTurnstile(
            "valid-token",
            "secret",
            "1.2.3.4",
        );
        expect(result).toBe(true);
        expect(fetch).toHaveBeenCalledWith(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            expect.objectContaining({ method: "POST" }),
        );
    });

    it("returns false for invalid token", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                json: () =>
                    Promise.resolve({
                        success: false,
                        "error-codes": ["invalid-input-response"],
                    }),
            }),
        );

        const result = await verifyTurnstile("bad-token", "secret");
        expect(result).toBe(false);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm run test -- tests/turnstile.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement Turnstile**

`src/lib/turnstile.ts`:

```ts
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(
    token: string,
    secret: string,
    ip?: string,
): Promise<boolean> {
    const formData = new FormData();
    formData.append("secret", secret);
    formData.append("response", token);
    if (ip) formData.append("remoteip", ip);

    const res = await fetch(VERIFY_URL, { method: "POST", body: formData });
    const data = await res.json();
    return data.success === true;
}
```

- [ ] **Step 4: Run Turnstile test**

```bash
pnpm run test -- tests/turnstile.test.ts
```

Expected: PASS

- [ ] **Step 5: Write failing test for rate limiting**

`tests/rate-limit.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit } from "../src/lib/rate-limit";

function createMockKV(): KVNamespace {
    const store = new Map<string, string>();
    return {
        get: (key: string) => Promise.resolve(store.get(key) ?? null),
        put: (key: string, value: string, opts?: KVNamespacePutOptions) => {
            store.set(key, value);
            return Promise.resolve();
        },
        delete: (key: string) => {
            store.delete(key);
            return Promise.resolve();
        },
        list: () =>
            Promise.resolve({
                keys: [],
                list_complete: true,
                cacheStatus: null,
            }),
        getWithMetadata: () => Promise.resolve({ value: null, metadata: null }),
    } as unknown as KVNamespace;
}

describe("checkRateLimit", () => {
    let kv: KVNamespace;

    beforeEach(() => {
        kv = createMockKV();
    });

    it("allows first request", async () => {
        const result = await checkRateLimit(kv, "test-ip", 10, 30);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(9);
    });

    it("blocks after daily limit", async () => {
        for (let i = 0; i < 10; i++) {
            await checkRateLimit(kv, "test-ip", 10, 30);
        }
        const result = await checkRateLimit(kv, "test-ip", 10, 30);
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
    });

    it("blocks during cooldown period", async () => {
        await checkRateLimit(kv, "test-ip", 10, 30);
        const result = await checkRateLimit(kv, "test-ip", 10, 30);
        expect(result.allowed).toBe(false);
        expect(result.cooldown).toBe(true);
    });
});
```

- [ ] **Step 6: Run test to verify it fails**

```bash
pnpm run test -- tests/rate-limit.test.ts
```

Expected: FAIL

- [ ] **Step 7: Implement rate limiting**

`src/lib/rate-limit.ts`:

```ts
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
```

- [ ] **Step 8: Run rate-limit test**

```bash
pnpm run test -- tests/rate-limit.test.ts
```

Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: add Turnstile verification and KV-based rate limiting with tests"
```

---

## Task 5: Type Definitions & Province Data

**Files:**

- Create: `src/types/event.ts`
- Create: `data/provinces.json`

- [ ] **Step 1: Define Event types**

`src/types/event.ts`:

```ts
export type EventType = "doujin" | "concert";
export type EventStatus = "pending" | "approved" | "rejected";

export interface Event {
    id: string;
    title: string;
    province: string;
    city: string;
    venue: string;
    address: string | null;
    startDate: string;
    endDate: string | null;
    eventType: EventType;
    scale: string | null;
    qqGroup: string | null;
    ticketUrl: string | null;
    posterKey: string | null;
    priceInfo: string | null;
    description: string | null;
    viewCount: number;
    status: EventStatus;
    deletedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface EventWithWorks extends Event {
    works: string[];
}

export interface EventFilters {
    province?: string;
    city?: string;
    eventType?: EventType;
    work?: string;
    scale?: string;
    month?: string;
    page?: number;
}
```

- [ ] **Step 2: Create provinces data**

`data/provinces.json` — create a JSON file with all 34 provincial-level divisions and their major cities. Example structure:

```json
[
    { "province": "北京", "cities": ["北京"] },
    { "province": "上海", "cities": ["上海"] },
    { "province": "广东", "cities": ["广州", "深圳", "东莞", "佛山", "珠海"] },
    { "province": "浙江", "cities": ["杭州", "宁波", "温州", "嘉兴"] },
    { "province": "江苏", "cities": ["南京", "苏州", "无锡", "常州"] },
    { "province": "四川", "cities": ["成都", "绵阳"] },
    { "province": "湖北", "cities": ["武汉"] },
    { "province": "湖南", "cities": ["长沙"] },
    { "province": "山东", "cities": ["济南", "青岛"] },
    { "province": "河南", "cities": ["郑州"] },
    { "province": "河北", "cities": ["石家庄"] },
    { "province": "福建", "cities": ["福州", "厦门"] },
    { "province": "安徽", "cities": ["合肥"] },
    { "province": "江西", "cities": ["南昌"] },
    { "province": "辽宁", "cities": ["沈阳", "大连"] },
    { "province": "吉林", "cities": ["长春"] },
    { "province": "黑龙江", "cities": ["哈尔滨"] },
    { "province": "陕西", "cities": ["西安"] },
    { "province": "甘肃", "cities": ["兰州"] },
    { "province": "重庆", "cities": ["重庆"] },
    { "province": "天津", "cities": ["天津"] },
    { "province": "云南", "cities": ["昆明"] },
    { "province": "贵州", "cities": ["贵阳"] },
    { "province": "广西", "cities": ["南宁", "桂林"] },
    { "province": "山西", "cities": ["太原"] },
    { "province": "内蒙古", "cities": ["呼和浩特"] },
    { "province": "西藏", "cities": ["拉萨"] },
    { "province": "新疆", "cities": ["乌鲁木齐"] },
    { "province": "宁夏", "cities": ["银川"] },
    { "province": "青海", "cities": ["西宁"] },
    { "province": "海南", "cities": ["海口"] },
    { "province": "台湾", "cities": ["台北"] },
    { "province": "香港", "cities": ["香港"] },
    { "province": "澳门", "cities": ["澳门"] }
]
```

- [ ] **Step 3: Verify types compile**

```bash
pnpm run typecheck
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add Event types and province/city data"
```

---

## Task 6: Seed Data

**Files:**

- Create: `seeds/demo.sql`

- [ ] **Step 1: Create seed SQL**

`seeds/demo.sql`:

```sql
INSERT INTO events (id, title, province, city, venue, address, start_date, end_date, event_type, scale, qq_group, ticket_url, poster_key, price_info, description, view_count, status)
VALUES
  ('01JZ001A2B3C4D5E6F7G8H9J0K', 'Comicup 31', '上海', '上海', '国家会展中心', '青浦区崧泽大道333号', '2026-07-15', '2026-07-16', 'doujin', '全国大型', '123456789', 'https://ticket.example.com/cp31', NULL, '预售50元/现场60元', '国内最大的同人展会之一', 1520, 'approved'),
  ('01JZ002B3C4D5E6F7G8H9J0K1', 'BW2026', '上海', '上海', '上海世博展览馆', '浦东新区国展路1099号', '2026-08-20', '2026-08-22', 'doujin', '全国大型', NULL, NULL, NULL, '待定', 'Bilibili World 2026', 890, 'approved'),
  ('01JZ003C4D5E6F7G8H9J0K1L', '明日方舟音律联觉', '上海', '上海', '梅赛德斯-奔驰文化中心', '浦东新区世博大道1200号', '2026-09-10', NULL, 'concert', '全国大型', '987654321', 'https://ticket.example.com/ark', NULL, '280-1280元', '明日方舟主题演唱会', 2100, 'approved'),
  ('01JZ004D5E6F7G8H9J0K1L2', '广州萤火虫动漫展', '广东', '广州', '广州保利世贸博览馆', '海珠区新港东路1000号', '2026-07-01', '2026-07-03', 'doujin', '区域中型', '111222333', NULL, NULL, '预售45元/现场55元', '华南地区大型漫展', 650, 'approved'),
  ('01JZ005E6F7G8H9J0K1L2M', 'CP30', '上海', '上海', '上海新国际博览中心', '浦东新区龙阳路2345号', '2026-10-01', '2026-10-02', 'doujin', '全国大型', NULL, NULL, NULL, '待定', '中国最大的同人展会', 3200, 'approved');

INSERT INTO event_works (event_id, work_name) VALUES
  ('01JZ001A2B3C4D5E6F7G8H9J0K', '原神'),
  ('01JZ001A2B3C4D5E6F7G8H9J0K', '明日方舟'),
  ('01JZ001A2B3C4D5E6F7G8H9J0K', '崩坏：星穹铁道'),
  ('01JZ002B3C4D5E6F7G8H9J0K1', 'Bilibili'),
  ('01JZ003C4D5E6F7G8H9J0K1L', '明日方舟'),
  ('01JZ004D5E6F7G8H9J0K1L', '原神'),
  ('01JZ004D5E6F7G8H9J0K1L', '初音未来'),
  ('01JZ005E6F7G8H9J0K1L2M', '东方Project'),
  ('01JZ005E6F7G8H9J0K1L2M', 'VOCALOID');
```

- [ ] **Step 2: Apply seed data**

```bash
wrangler d1 execute acg-events --local --file seeds/demo.sql
```

Expected: Inserted rows successfully.

- [ ] **Step 3: Verify data**

```bash
wrangler d1 execute acg-events --local --command "SELECT id, title, status FROM events"
```

Expected: 5 rows returned, all with `status = 'approved'`.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add demo seed data with 5 events and work associations"
```

---

## Task 7: Events List API

**Files:**

- Create: `src/pages/api/events.ts`
- Create: `tests/api/events.test.ts`

- [ ] **Step 1: Write failing test for events API query building**

`tests/api/events.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildEventsQuery } from "../../src/pages/api/events";

describe("buildEventsQuery", () => {
    it("returns base query with no filters", () => {
        const result = buildEventsQuery({});
        expect(result.where).toContain("status = 'approved'");
        expect(result.where).toContain("deleted_at IS NULL");
        expect(result.where).toContain("start_date >= ?");
    });

    it("adds province filter", () => {
        const result = buildEventsQuery({ province: "上海" });
        expect(result.where).toContain("province = ?");
        expect(result.params).toContain("上海");
    });

    it("adds event_type filter", () => {
        const result = buildEventsQuery({ eventType: "doujin" });
        expect(result.where).toContain("event_type = ?");
        expect(result.params).toContain("doujin");
    });

    it("adds work join filter", () => {
        const result = buildEventsQuery({ work: "原神" });
        expect(result.join).toContain("event_works");
        expect(result.where).toContain("work_name = ?");
    });

    it("sets offset for pagination", () => {
        const result = buildEventsQuery({ page: 3 });
        expect(result.limit).toBe(20);
        expect(result.offset).toBe(40);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm run test -- tests/api/events.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement events API**

`src/pages/api/events.ts`:

```ts
import type { APIRoute } from "astro";
import { getDB } from "../../server/db";
import { eq, and, gte, sql } from "drizzle-orm";
import { events, eventWorks } from "../../server/db/schema";
import type { EventFilters, EventWithWorks } from "../../types/event";

interface QueryResult {
    where: string;
    join: string;
    params: unknown[];
    limit: number;
    offset: number;
}

export function buildEventsQuery(filters: EventFilters): QueryResult {
    const conditions: string[] = ["status = 'approved'", "deleted_at IS NULL"];
    const params: unknown[] = [];
    let join = "";

    conditions.push("start_date >= ?");
    params.push(new Date().toISOString().slice(0, 10));

    if (filters.province) {
        conditions.push("province = ?");
        params.push(filters.province);
    }
    if (filters.city) {
        conditions.push("city = ?");
        params.push(filters.city);
    }
    if (filters.eventType) {
        conditions.push("event_type = ?");
        params.push(filters.eventType);
    }
    if (filters.scale) {
        conditions.push("scale = ?");
        params.push(filters.scale);
    }
    if (filters.month) {
        conditions.push("start_date LIKE ?");
        params.push(`${filters.month}%`);
    }
    if (filters.work) {
        join = `INNER JOIN event_works ON events.id = event_works.event_id`;
        conditions.push("work_name = ?");
        params.push(filters.work);
    }

    const page = filters.page ?? 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    return { where: conditions.join(" AND "), join, params, limit, offset };
}

export const GET: APIRoute = async ({ request, locals }) => {
    const db = getDB(locals.runtime.env);
    const url = new URL(request.url);

    const typeParam = url.searchParams.get("type");
    const filters: EventFilters = {
        province: url.searchParams.get("province") ?? undefined,
        city: url.searchParams.get("city") ?? undefined,
        eventType:
            typeParam === "doujin" || typeParam === "concert"
                ? typeParam
                : undefined,
        work: url.searchParams.get("work") ?? undefined,
        scale: url.searchParams.get("scale") ?? undefined,
        month: url.searchParams.get("month") ?? undefined,
        page: url.searchParams.get("page")
            ? Number(url.searchParams.get("page"))
            : 1,
    };

    const q = buildEventsQuery(filters);

    const countSql = `SELECT COUNT(*) as total FROM events ${q.join} WHERE ${q.where}`;
    const countResult = await locals.runtime.env.DB.prepare(countSql)
        .bind(...q.params)
        .first<{ total: number }>();
    const total = countResult?.total ?? 0;

    const dataSql = `SELECT events.* FROM events ${q.join} WHERE ${q.where} ORDER BY start_date ASC LIMIT ? OFFSET ?`;
    const rows = await locals.runtime.env.DB.prepare(dataSql)
        .bind(...q.params, q.limit, q.offset)
        .all();

    const eventIds = (rows.results as Record<string, unknown>[]).map(
        (r) => r.id as string,
    );
    let worksMap: Record<string, string[]> = {};

    if (eventIds.length > 0) {
        const placeholders = eventIds.map(() => "?").join(",");
        const worksRows = await locals.runtime.env.DB.prepare(
            `SELECT event_id, work_name FROM event_works WHERE event_id IN (${placeholders})`,
        )
            .bind(...eventIds)
            .all();

        for (const w of worksRows.results as Record<string, unknown>[]) {
            const eid = w.event_id as string;
            if (!worksMap[eid]) worksMap[eid] = [];
            worksMap[eid].push(w.work_name as string);
        }
    }

    const items: EventWithWorks[] = (
        rows.results as Record<string, unknown>[]
    ).map((r) => ({
        id: r.id as string,
        title: r.title as string,
        province: r.province as string,
        city: r.city as string,
        venue: r.venue as string,
        address: r.address as string | null,
        startDate: r.start_date as string,
        endDate: r.end_date as string | null,
        eventType: r.event_type as "doujin" | "concert",
        scale: r.scale as string | null,
        qqGroup: r.qq_group as string | null,
        ticketUrl: r.ticket_url as string | null,
        posterKey: r.poster_key as string | null,
        priceInfo: r.price_info as string | null,
        description: r.description as string | null,
        viewCount: r.view_count as number,
        status: r.status as "pending" | "approved" | "rejected",
        deletedAt: r.deleted_at as string | null,
        createdAt: r.created_at as string,
        updatedAt: r.updated_at as string,
        works: worksMap[r.id as string] ?? [],
    }));

    return new Response(
        JSON.stringify({ items, total, page: filters.page ?? 1 }),
        {
            headers: { "Content-Type": "application/json" },
        },
    );
};
```

- [ ] **Step 4: Run test**

```bash
pnpm run test -- tests/api/events.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add events list API with filtering and pagination"
```

---

## Task 8: View Count API

**Files:**

- Create: `src/pages/api/events/[id]/view.ts`

- [ ] **Step 1: Implement view count API**

`src/pages/api/events/[id]/view.ts`:

```ts
import type { APIRoute } from "astro";
import { hashIp } from "../../../../lib/rate-limit";

export const POST: APIRoute = async ({ params, request, locals }) => {
    const { id } = params;
    if (!id) return new Response("Missing id", { status: 400 });

    const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
    const ipHash = await hashIp(ip);
    const key = `event:${id}:ip:${ipHash}`;

    const existing = await locals.runtime.env.RATE_LIMIT.get(key);
    if (existing) {
        return new Response(JSON.stringify({ counted: false }), {
            headers: { "Content-Type": "application/json" },
        });
    }

    await locals.runtime.env.RATE_LIMIT.put(key, "1", { expirationTtl: 86400 });
    await locals.runtime.env.DB.prepare(
        "UPDATE events SET view_count = view_count + 1 WHERE id = ?",
    )
        .bind(id)
        .run();

    return new Response(JSON.stringify({ counted: true }), {
        headers: { "Content-Type": "application/json" },
    });
};
```

- [ ] **Step 2: Verify it compiles**

```bash
pnpm run typecheck
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add view count API with KV-based IP dedup"
```

---

## Task 9: Submit Sign API

**Files:**

- Create: `src/pages/api/submit/sign.ts`

- [ ] **Step 1: Implement submit sign endpoint**

`src/pages/api/submit/sign.ts`:

```ts
import type { APIRoute } from "astro";
import { verifyTurnstile } from "../../../lib/turnstile";
import { checkRateLimit, hashIp } from "../../../lib/rate-limit";
import { signTicket } from "../../../lib/hmac";

const MAX_FIELD_LEN = 2000;

export const POST: APIRoute = async ({ request, locals }) => {
    const env = locals.runtime.env;

    let body: Record<string, unknown>;
    try {
        body = await request.json();
    } catch {
        return new Response(JSON.stringify({ error: "无效的请求格式" }), {
            status: 400,
        });
    }

    const turnstileToken = body.turnstileToken as string | undefined;
    if (!turnstileToken) {
        return new Response(JSON.stringify({ error: "请完成验证码" }), {
            status: 400,
        });
    }

    const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
    const ipHash = await hashIp(ip);

    const turnstileOk = await verifyTurnstile(
        turnstileToken,
        env.TURNSTILE_SECRET_KEY,
        ip,
    );
    if (!turnstileOk) {
        return new Response(JSON.stringify({ error: "验证码验证失败" }), {
            status: 400,
        });
    }

    const rateLimit = await checkRateLimit(env.RATE_LIMIT, ipHash, 10, 30);
    if (!rateLimit.allowed) {
        return new Response(
            JSON.stringify({
                error: rateLimit.cooldown
                    ? "提交过于频繁，请30秒后重试"
                    : "今日提交次数已达上限",
            }),
            { status: 429 },
        );
    }

    const required = [
        "title",
        "province",
        "city",
        "venue",
        "startDate",
        "eventType",
    ];
    for (const field of required) {
        if (!body[field] || String(body[field]).trim() === "") {
            return new Response(
                JSON.stringify({ error: `缺少必填字段: ${field}` }),
                { status: 400 },
            );
        }
    }

    for (const [key, val] of Object.entries(body)) {
        if (typeof val === "string" && val.length > MAX_FIELD_LEN) {
            return new Response(JSON.stringify({ error: `字段 ${key} 过长` }), {
                status: 400,
            });
        }
    }

    const works = Array.isArray(body.works)
        ? (body.works as string[])
              .filter((w) => typeof w === "string" && w.trim())
              .slice(0, 20)
        : [];

    const ticketPayload = {
        title: String(body.title).trim(),
        province: String(body.province).trim(),
        city: String(body.city).trim(),
        venue: String(body.venue).trim(),
        address: body.address ? String(body.address).trim() : null,
        startDate: String(body.startDate),
        endDate: body.endDate ? String(body.endDate) : null,
        eventType: String(body.eventType),
        scale: body.scale ? String(body.scale) : null,
        works,
        qqGroup: body.qqGroup ? String(body.qqGroup).trim() : null,
        ticketUrl: body.ticketUrl ? String(body.ticketUrl).trim() : null,
        priceInfo: body.priceInfo ? String(body.priceInfo).trim() : null,
        description: body.description ? String(body.description).trim() : null,
        ipHash,
    };

    const ticket = await signTicket(
        ticketPayload,
        env.TURNSTILE_SECRET_KEY,
        300,
    );

    return new Response(JSON.stringify({ ticket }), {
        headers: { "Content-Type": "application/json" },
    });
};
```

- [ ] **Step 2: Verify it compiles**

```bash
pnpm run typecheck
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add submit sign API with Turnstile, rate limiting, and HMAC signing"
```

---

## Task 10: Submit Commit API

**Files:**

- Create: `src/pages/api/submit/commit.ts`

- [ ] **Step 1: Implement submit commit endpoint**

`src/pages/api/submit/commit.ts`:

```ts
import type { APIRoute } from "astro";
import { verifyTicket } from "../../../lib/hmac";
import { generateUlid } from "../../../lib/ulid";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const POST: APIRoute = async ({ request, locals }) => {
    const env = locals.runtime.env;

    let formData: FormData;
    try {
        formData = await request.formData();
    } catch {
        return new Response(JSON.stringify({ error: "无效的表单数据" }), {
            status: 400,
        });
    }

    const ticket = formData.get("ticket") as string | null;
    if (!ticket) {
        return new Response(JSON.stringify({ error: "缺少签名票据" }), {
            status: 400,
        });
    }

    let payload: Record<string, unknown>;
    try {
        payload = await verifyTicket(ticket, env.TURNSTILE_SECRET_KEY);
    } catch (e) {
        const msg = e instanceof Error ? e.message : "验证失败";
        return new Response(JSON.stringify({ error: msg }), { status: 400 });
    }

    const posterFile = formData.get("poster") as File | null;
    let posterKey: string | null = null;

    if (posterFile && posterFile.size > 0) {
        if (posterFile.size > MAX_FILE_SIZE) {
            return new Response(
                JSON.stringify({ error: "图片文件不能超过5MB" }),
                { status: 400 },
            );
        }
        if (!ALLOWED_TYPES.includes(posterFile.type)) {
            return new Response(
                JSON.stringify({ error: "仅支持 JPG/PNG/WebP 格式" }),
                { status: 400 },
            );
        }

        const ext =
            posterFile.type === "image/png"
                ? "png"
                : posterFile.type === "image/webp"
                  ? "webp"
                  : "jpg";
        posterKey = `posters/${generateUlid()}.${ext}`;
        await env.BUCKET.put(posterKey, posterFile.stream(), {
            httpMetadata: { contentType: posterFile.type },
        });
    }

    const eventId = generateUlid();
    const now = new Date().toISOString();

    await env.DB.prepare(
        `INSERT INTO events (id, title, province, city, venue, address, start_date, end_date, event_type, scale, qq_group, ticket_url, poster_key, price_info, description, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    )
        .bind(
            eventId,
            payload.title,
            payload.province,
            payload.city,
            payload.venue,
            payload.address,
            payload.startDate,
            payload.endDate,
            payload.eventType,
            payload.scale,
            payload.qqGroup,
            payload.ticketUrl,
            posterKey,
            payload.priceInfo,
            payload.description,
            now,
            now,
        )
        .run();

    const works = payload.works as string[] | undefined;
    if (works && works.length > 0) {
        for (const work of works) {
            await env.DB.prepare(
                "INSERT INTO event_works (event_id, work_name) VALUES (?, ?)",
            )
                .bind(eventId, work)
                .run();
        }
    }

    return new Response(JSON.stringify({ id: eventId, status: "pending" }), {
        headers: { "Content-Type": "application/json" },
    });
};
```

- [ ] **Step 2: Verify it compiles**

```bash
pnpm run typecheck
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add submit commit API with R2 upload and D1 insert"
```

---

## Task 11: Admin API

**Files:**

- Create: `src/middleware.ts`
- Create: `src/pages/api/admin/events.ts`, `src/pages/api/admin/events/[id].ts`

- [ ] **Step 1: Create admin middleware**

`src/middleware.ts`:

```ts
import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware((context, next) => {
    const { pathname } = new URL(context.request.url);

    if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
        const email =
            context.request.headers.get("Cf-Access-Authenticated-User-Email") ??
            context.locals.runtime.env.DEV_ADMIN_EMAIL ??
            null;

        if (!email) {
            return new Response("Unauthorized", { status: 401 });
        }
    }

    return next();
});
```

- [ ] **Step 2: Implement admin list/approve/reject**

`src/pages/api/admin/events.ts`:

```ts
import type { APIRoute } from "astro";
import { getDB } from "../../../server/db";
import { events } from "../../../server/db/schema";
import { eq, desc } from "drizzle-orm";

export const GET: APIRoute = async ({ request, locals }) => {
    const db = getDB(locals.runtime.env);
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? "pending";

    const rows = await db
        .select()
        .from(events)
        .where(eq(events.status, status as "pending" | "approved" | "rejected"))
        .orderBy(desc(events.createdAt));

    return new Response(JSON.stringify(rows), {
        headers: { "Content-Type": "application/json" },
    });
};
```

- [ ] **Step 3: Implement admin approve/reject/edit/delete**

`src/pages/api/admin/events/[id].ts`:

```ts
import type { APIRoute } from "astro";
import { getDB } from "../../../../server/db";
import { events } from "../../../../server/db/schema";
import { eq } from "drizzle-orm";

export const POST: APIRoute = async ({ params, request, locals }) => {
    const db = getDB(locals.runtime.env);
    const { id } = params;
    if (!id) return new Response("Missing id", { status: 400 });

    const body = await request.json();
    const action = body.action as string;

    if (action === "approve") {
        await db
            .update(events)
            .set({ status: "approved", updatedAt: new Date().toISOString() })
            .where(eq(events.id, id));
        return new Response(JSON.stringify({ status: "approved" }));
    }

    if (action === "reject") {
        await db
            .update(events)
            .set({ status: "rejected", updatedAt: new Date().toISOString() })
            .where(eq(events.id, id));
        return new Response(JSON.stringify({ status: "rejected" }));
    }

    return new Response("Invalid action", { status: 400 });
};

export const PUT: APIRoute = async ({ params, request, locals }) => {
    const db = getDB(locals.runtime.env);
    const { id } = params;
    if (!id) return new Response("Missing id", { status: 400 });

    const body = await request.json();
    const updates: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
    };

    const allowedFields = [
        "title",
        "province",
        "city",
        "venue",
        "address",
        "startDate",
        "endDate",
        "eventType",
        "scale",
        "qqGroup",
        "ticketUrl",
        "priceInfo",
        "description",
    ];
    const dbFieldMap: Record<string, string> = {
        startDate: "start_date",
        endDate: "end_date",
        eventType: "event_type",
        qqGroup: "qq_group",
        ticketUrl: "ticket_url",
        priceInfo: "price_info",
    };

    for (const field of allowedFields) {
        if (body[field] !== undefined) {
            const dbField = dbFieldMap[field] ?? field;
            updates[dbField] = body[field];
        }
    }

    await db.update(events).set(updates).where(eq(events.id, id));
    return new Response(JSON.stringify({ ok: true }));
};

export const DELETE: APIRoute = async ({ params, locals }) => {
    const db = getDB(locals.runtime.env);
    const { id } = params;
    if (!id) return new Response("Missing id", { status: 400 });

    await db
        .update(events)
        .set({
            deletedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        })
        .where(eq(events.id, id));

    return new Response(JSON.stringify({ ok: true }));
};
```

- [ ] **Step 4: Verify compiles**

```bash
pnpm run typecheck
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add admin API with middleware auth, approve/reject/edit/delete"
```

---

## Task 12: Placeholder Poster & Base Layout

**Files:**

- Create: `public/placeholder-poster.svg`
- Create: `src/layouts/Base.astro`

- [ ] **Step 1: Create placeholder poster SVG**

`public/placeholder-poster.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400">
  <rect width="300" height="400" fill="#e5e7eb"/>
  <text x="150" y="190" text-anchor="middle" fill="#9ca3af" font-family="sans-serif" font-size="16">暂无海报</text>
  <text x="150" y="220" text-anchor="middle" fill="#9ca3af" font-family="sans-serif" font-size="12">No Poster</text>
</svg>
```

- [ ] **Step 2: Create base layout**

`src/layouts/Base.astro`:

```astro
---
import "../styles/global.css";

interface Props {
  title?: string;
  description?: string;
  ogImage?: string;
}

const {
  title = "ACG 活动查询",
  description = "查询中国境内 ACG 线下活动",
  ogImage,
} = Astro.props;

const siteUrl = Astro.locals.runtime.env.PUBLIC_SITE_URL ?? "";
---

<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <meta name="description" content={description} />
    {ogImage && <meta property="og:image" content={ogImage} />}
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
  </head>
  <body>
    <header class="bg-white shadow-sm">
      <div class="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <a href="/" class="text-xl font-bold text-indigo-600">ACG 活动查询</a>
        <nav class="flex gap-4 text-sm">
          <a href="/" class="hover:text-indigo-600">首页</a>
          <a href="/submit" class="hover:text-indigo-600">提交活动</a>
        </nav>
      </div>
    </header>
    <main class="max-w-6xl mx-auto px-4 py-6">
      <slot />
    </main>
    <footer class="bg-gray-100 mt-12">
      <div class="max-w-6xl mx-auto px-4 py-6 text-sm text-gray-500 text-center">
        ACG 活动查询 · 数据由用户提交，管理员审核后发布
      </div>
    </footer>
  </body>
</html>
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add placeholder poster SVG and base layout"
```

---

## Task 13: EventCard Component

**Files:**

- Create: `src/components/EventCard.tsx`, `src/components/EventCard.astro`

- [ ] **Step 1: Create React EventCard component**

`src/components/EventCard.tsx`:

```tsx
import type { EventWithWorks } from "../types/event";
import { getPosterUrl } from "../lib/poster-url";

interface Props {
    event: EventWithWorks;
    r2BaseUrl: string;
}

export default function EventCard({ event, r2BaseUrl }: Props) {
    const posterUrl = getPosterUrl(event.posterKey, r2BaseUrl);
    const typeLabel = event.eventType === "doujin" ? "漫展" : "演唱会";
    const dateStr = event.endDate
        ? `${event.startDate} ~ ${event.endDate}`
        : event.startDate;

    return (
        <a
            href={`/event/${event.id}`}
            className="block bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden"
        >
            <div className="aspect-[3/4] bg-gray-100 overflow-hidden">
                <img
                    src={posterUrl}
                    alt={event.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                />
            </div>
            <div className="p-3">
                <h3 className="font-semibold text-sm line-clamp-2 mb-1">
                    {event.title}
                </h3>
                <p className="text-xs text-gray-500 mb-1">{dateStr}</p>
                <p className="text-xs text-gray-500 mb-2">
                    {event.city} · {event.venue}
                </p>
                <div className="flex items-center justify-between">
                    <span
                        className={`text-xs px-2 py-0.5 rounded ${
                            event.eventType === "doujin"
                                ? "bg-pink-100 text-pink-700"
                                : "bg-blue-100 text-blue-700"
                        }`}
                    >
                        {typeLabel}
                    </span>
                    <span className="text-xs text-gray-400">
                        🔥 {event.viewCount}
                    </span>
                </div>
            </div>
        </a>
    );
}
```

- [ ] **Step 2: Create Astro wrapper**

`src/components/EventCard.astro`:

```astro
---
import type { EventWithWorks } from "../types/event";
import EventCardReact from "./EventCard";

interface Props {
  event: EventWithWorks;
  r2BaseUrl: string;
}

const { event, r2BaseUrl } = Astro.props;
---

<EventCardReact event={event} r2BaseUrl={r2BaseUrl} client:load />
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add EventCard component with poster, type badge, and view count"
```

---

## Task 14: FilterBar Component

**Files:**

- Create: `src/components/FilterBar.tsx`

- [ ] **Step 1: Create FilterBar React Island**

`src/components/FilterBar.tsx`:

```tsx
import { useState, useEffect } from "react";
import provincesData from "../../data/provinces.json";

interface Props {
    initialFilters: Record<string, string>;
}

const SCALES = ["全国大型", "区域中型", "地方小型"];

function getMonths() {
    const months: string[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        months.push(d.toISOString().slice(0, 7));
    }
    return months;
}

export default function FilterBar({ initialFilters }: Props) {
    const [province, setProvince] = useState(initialFilters.province ?? "");
    const [city, setCity] = useState(initialFilters.city ?? "");
    const [type, setType] = useState(initialFilters.type ?? "");
    const [work, setWork] = useState(initialFilters.work ?? "");
    const [scale, setScale] = useState(initialFilters.scale ?? "");
    const [month, setMonth] = useState(initialFilters.month ?? "");

    const cities = province
        ? (provincesData.find((p) => p.province === province)?.cities ?? [])
        : [];

    function applyFilters() {
        const params = new URLSearchParams();
        if (province) params.set("province", province);
        if (city) params.set("city", city);
        if (type) params.set("type", type);
        if (work) params.set("work", work);
        if (scale) params.set("scale", scale);
        if (month) params.set("month", month);
        window.location.search = params.toString();
    }

    function clearFilters() {
        window.location.search = "";
    }

    return (
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <select
                    value={province}
                    onChange={(e) => {
                        setProvince(e.target.value);
                        setCity("");
                    }}
                    className="border rounded px-2 py-1.5 text-sm"
                >
                    <option value="">全部省份</option>
                    {provincesData.map((p) => (
                        <option key={p.province} value={p.province}>
                            {p.province}
                        </option>
                    ))}
                </select>

                <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="border rounded px-2 py-1.5 text-sm"
                    disabled={!province}
                >
                    <option value="">全部城市</option>
                    {cities.map((c) => (
                        <option key={c} value={c}>
                            {c}
                        </option>
                    ))}
                </select>

                <div className="flex border rounded overflow-hidden text-sm">
                    {["", "doujin", "concert"].map((t) => (
                        <button
                            key={t}
                            onClick={() => setType(t)}
                            className={`flex-1 px-2 py-1.5 ${type === t ? "bg-indigo-600 text-white" : "hover:bg-gray-50"}`}
                        >
                            {t === ""
                                ? "全部"
                                : t === "doujin"
                                  ? "漫展"
                                  : "演唱会"}
                        </button>
                    ))}
                </div>

                <input
                    type="text"
                    value={work}
                    onChange={(e) => setWork(e.target.value)}
                    placeholder="关联作品"
                    className="border rounded px-2 py-1.5 text-sm"
                />

                <select
                    value={scale}
                    onChange={(e) => setScale(e.target.value)}
                    className="border rounded px-2 py-1.5 text-sm"
                >
                    <option value="">不限规模</option>
                    {SCALES.map((s) => (
                        <option key={s} value={s}>
                            {s}
                        </option>
                    ))}
                </select>

                <select
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                    className="border rounded px-2 py-1.5 text-sm"
                >
                    <option value="">全部月份</option>
                    {getMonths().map((m) => (
                        <option key={m} value={m}>
                            {m}
                        </option>
                    ))}
                </select>
            </div>

            <div className="flex gap-2 mt-3">
                <button
                    onClick={applyFilters}
                    className="bg-indigo-600 text-white px-4 py-1.5 rounded text-sm hover:bg-indigo-700"
                >
                    筛选
                </button>
                <button
                    onClick={clearFilters}
                    className="text-gray-500 px-4 py-1.5 rounded text-sm hover:bg-gray-100"
                >
                    清除
                </button>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
pnpm run typecheck
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add FilterBar component with province/city/type/work/scale/month filters"
```

---

## Task 15: Homepage

**Files:**

- Create: `src/pages/index.astro`
- Create: `src/components/NearbyEvents.astro`, `src/components/PopularEvents.astro`, `src/components/EventList.tsx`

- [ ] **Step 1: Create EventList with pagination**

`src/components/EventList.tsx`:

```tsx
import { useState } from "react";
import EventCard from "./EventCard";
import type { EventWithWorks } from "../types/event";

interface Props {
    initialItems: EventWithWorks[];
    initialTotal: number;
    initialPage: number;
    filters: Record<string, string>;
    r2BaseUrl: string;
}

export default function EventList({
    initialItems,
    initialTotal,
    initialPage,
    filters,
    r2BaseUrl,
}: Props) {
    const [items, setItems] = useState(initialItems);
    const [page, setPage] = useState(initialPage);
    const [loading, setLoading] = useState(false);
    const totalPages = Math.ceil(initialTotal / 20);

    async function loadMore() {
        setLoading(true);
        const params = new URLSearchParams(filters);
        params.set("page", String(page + 1));
        const res = await fetch(`/api/events?${params}`);
        const data = await res.json();
        setItems((prev) => [...prev, ...data.items]);
        setPage(page + 1);
        setLoading(false);
    }

    return (
        <div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {items.map((event) => (
                    <EventCard
                        key={event.id}
                        event={event}
                        r2BaseUrl={r2BaseUrl}
                    />
                ))}
            </div>
            {items.length === 0 && (
                <p className="text-center text-gray-400 py-12">
                    暂无符合条件的活动
                </p>
            )}
            {page < totalPages && (
                <div className="text-center mt-6">
                    <button
                        onClick={loadMore}
                        disabled={loading}
                        className="bg-white border px-6 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
                    >
                        {loading ? "加载中..." : "加载更多"}
                    </button>
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Create NearbyEvents**

`src/components/NearbyEvents.astro`:

```astro
---
import type { EventWithWorks } from "../types/event";
import EventCard from "./EventCard";

interface Props {
  events: EventWithWorks[];
  r2BaseUrl: string;
}

const { events, r2BaseUrl } = Astro.props;
---

{events.length > 0 && (
  <section class="mb-8">
    <h2 class="text-lg font-semibold mb-4">📍 你附近的活动</h2>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      {events.map((event) => (
        <EventCard event={event} r2BaseUrl={r2BaseUrl} />
      ))}
    </div>
  </section>
)}
```

- [ ] **Step 3: Create PopularEvents**

`src/components/PopularEvents.astro`:

```astro
---
import type { EventWithWorks } from "../types/event";
import EventCard from "./EventCard";

interface Props {
  events: EventWithWorks[];
  r2BaseUrl: string;
}

const { events, r2BaseUrl } = Astro.props;
---

{events.length > 0 && (
  <section class="mb-8">
    <h2 class="text-lg font-semibold mb-4">🔥 热门即将举办的活动</h2>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      {events.map((event) => (
        <EventCard event={event} r2BaseUrl={r2BaseUrl} />
      ))}
    </div>
  </section>
)}
```

- [ ] **Step 4: Create homepage**

`src/pages/index.astro`:

```astro
---
import Base from "../layouts/Base.astro";
import FilterBar from "../components/FilterBar";
import NearbyEvents from "../components/NearbyEvents.astro";
import PopularEvents from "../components/PopularEvents.astro";
import EventList from "../components/EventList";
import { getDB } from "../server/db";
import { getPosterUrl } from "../lib/poster-url";
import type { EventWithWorks } from "../types/event";

const env = Astro.locals.runtime.env;
const db = getDB(env);
const cf = Astro.locals.cf;
const today = new Date().toISOString().slice(0, 10);

const filters: Record<string, string> = {};
for (const [k, v] of Astro.url.searchParams.entries()) {
  filters[k] = v;
}

const r2BaseUrl = env.PUBLIC_R2_BASE_URL ?? "";

const nearbyCity = cf?.city ?? "";
const nearbyRegion = cf?.region ?? "";

let nearbyEvents: EventWithWorks[] = [];
if (nearbyRegion) {
  const rows = await env.DB.prepare(
    "SELECT * FROM events WHERE status = 'approved' AND deleted_at IS NULL AND province = ? AND start_date >= ? ORDER BY start_date ASC LIMIT 8"
  )
    .bind(nearbyRegion, today)
    .all();

  nearbyEvents = (rows.results as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    title: r.title as string,
    province: r.province as string,
    city: r.city as string,
    venue: r.venue as string,
    address: r.address as string | null,
    startDate: r.start_date as string,
    endDate: r.end_date as string | null,
    eventType: r.event_type as "doujin" | "concert",
    scale: r.scale as string | null,
    qqGroup: r.qq_group as string | null,
    ticketUrl: r.ticket_url as string | null,
    posterKey: r.poster_key as string | null,
    priceInfo: r.price_info as string | null,
    description: r.description as string | null,
    viewCount: r.view_count as number,
    status: r.status as "pending" | "approved" | "rejected",
    deletedAt: r.deleted_at as string | null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    works: [],
  }));
}

const popularRows = await env.DB.prepare(
  "SELECT * FROM events WHERE status = 'approved' AND deleted_at IS NULL AND start_date >= ? ORDER BY view_count DESC LIMIT 8"
)
  .bind(today)
  .all();

const popularEvents: EventWithWorks[] = (popularRows.results as Record<string, unknown>[]).map((r) => ({
  id: r.id as string,
  title: r.title as string,
  province: r.province as string,
  city: r.city as string,
  venue: r.venue as string,
  address: r.address as string | null,
  startDate: r.start_date as string,
  endDate: r.end_date as string | null,
  eventType: r.event_type as "doujin" | "concert",
  scale: r.scale as string | null,
  qqGroup: r.qq_group as string | null,
  ticketUrl: r.ticket_url as string | null,
  posterKey: r.poster_key as string | null,
  priceInfo: r.price_info as string | null,
  description: r.description as string | null,
  viewCount: r.view_count as number,
  status: r.status as "pending" | "approved" | "rejected",
  deletedAt: r.deleted_at as string | null,
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
  works: [],
}));

const conditions = ["status = 'approved'", "deleted_at IS NULL", "start_date >= ?"];
const params: unknown[] = [today];

if (filters.province) { conditions.push("province = ?"); params.push(filters.province); }
if (filters.city) { conditions.push("city = ?"); params.push(filters.city); }
if (filters.type) { conditions.push("event_type = ?"); params.push(filters.type); }
if (filters.scale) { conditions.push("scale = ?"); params.push(filters.scale); }
if (filters.month) { conditions.push("start_date LIKE ?"); params.push(`${filters.month}%`); }

let joinClause = "";
if (filters.work) {
  joinClause = "INNER JOIN event_works ON events.id = event_works.event_id";
  conditions.push("work_name = ?");
  params.push(filters.work);
}

const whereClause = conditions.join(" AND ");

const countResult = await env.DB.prepare(
  `SELECT COUNT(*) as total FROM events ${joinClause} WHERE ${whereClause}`
)
  .bind(...params)
  .first<{ total: number }>();
const total = countResult?.total ?? 0;

const allRows = await env.DB.prepare(
  `SELECT events.* FROM events ${joinClause} WHERE ${whereClause} ORDER BY start_date ASC LIMIT 20 OFFSET 0`
)
  .bind(...params)
  .all();

const eventIds = (allRows.results as Record<string, unknown>[]).map((r) => r.id as string);
let worksMap: Record<string, string[]> = {};
if (eventIds.length > 0) {
  const placeholders = eventIds.map(() => "?").join(",");
  const worksRows = await env.DB.prepare(
    `SELECT event_id, work_name FROM event_works WHERE event_id IN (${placeholders})`
  )
    .bind(...eventIds)
    .all();
  for (const w of worksRows.results as Record<string, unknown>[]) {
    const eid = w.event_id as string;
    if (!worksMap[eid]) worksMap[eid] = [];
    worksMap[eid].push(w.work_name as string);
  }
}

const allEvents: EventWithWorks[] = (allRows.results as Record<string, unknown>[]).map((r) => ({
  id: r.id as string,
  title: r.title as string,
  province: r.province as string,
  city: r.city as string,
  venue: r.venue as string,
  address: r.address as string | null,
  startDate: r.start_date as string,
  endDate: r.end_date as string | null,
  eventType: r.event_type as "doujin" | "concert",
  scale: r.scale as string | null,
  qqGroup: r.qq_group as string | null,
  ticketUrl: r.ticket_url as string | null,
  posterKey: r.poster_key as string | null,
  priceInfo: r.price_info as string | null,
  description: r.description as string | null,
  viewCount: r.view_count as number,
  status: r.status as "pending" | "approved" | "rejected",
  deletedAt: r.deleted_at as string | null,
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
  works: worksMap[r.id as string] ?? [],
}));
---

<Base title="ACG 活动查询 - 发现你身边的二次元活动">
  <FilterBar initialFilters={filters} client:load />

  <NearbyEvents events={nearbyEvents} r2BaseUrl={r2BaseUrl} />
  <PopularEvents events={popularEvents} r2BaseUrl={r2BaseUrl} />

  <section>
    <h2 class="text-lg font-semibold mb-4">📋 全部活动</h2>
    <EventList
      initialItems={allEvents}
      initialTotal={total}
      initialPage={1}
      filters={filters}
      r2BaseUrl={r2BaseUrl}
      client:load
    />
  </section>
</Base>
```

- [ ] **Step 5: Verify build**

```bash
pnpm run build
```

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add homepage with nearby, popular, and filtered event lists"
```

---

## Task 16: Event Detail Page

**Files:**

- Create: `src/pages/event/[id].astro`
- Create: `src/components/PosterLightbox.tsx`, `src/components/CopyButton.tsx`

- [ ] **Step 1: Create CopyButton**

`src/components/CopyButton.tsx`:

```tsx
import { useState } from "react";

interface Props {
    text: string;
    label?: string;
}

export default function CopyButton({ text, label = "复制" }: Props) {
    const [copied, setCopied] = useState(false);

    async function handleCopy() {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    return (
        <button
            onClick={handleCopy}
            className="text-indigo-600 text-sm hover:underline ml-2"
        >
            {copied ? "已复制!" : label}
        </button>
    );
}
```

- [ ] **Step 2: Create PosterLightbox**

`src/components/PosterLightbox.tsx`:

```tsx
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { useState } from "react";

interface Props {
    src: string;
    alt: string;
}

export default function PosterLightbox({ src, alt }: Props) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <img
                src={src}
                alt={alt}
                className="w-full max-w-sm rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setOpen(true)}
            />
            <Lightbox
                open={open}
                close={() => setOpen(false)}
                slides={[{ src }]}
            />
        </>
    );
}
```

- [ ] **Step 3: Create event detail page**

`src/pages/event/[id].astro`:

```astro
---
import Base from "../../layouts/Base.astro";
import CopyButton from "../../components/CopyButton";
import PosterLightbox from "../../components/PosterLightbox";
import { getDB } from "../../server/db";
import { getPosterUrl } from "../../lib/poster-url";

const { id } = Astro.params;
if (!id) return Astro.redirect("/");

const env = Astro.locals.runtime.env;

const row = await env.DB.prepare(
  "SELECT * FROM events WHERE id = ? AND status = 'approved' AND deleted_at IS NULL"
)
  .bind(id)
  .first();

if (!row) return Astro.redirect("/");

const event = row as Record<string, unknown>;

const worksRows = await env.DB.prepare(
  "SELECT work_name FROM event_works WHERE event_id = ?"
)
  .bind(id)
  .all();
const works = (worksRows.results as Record<string, unknown>[]).map(
  (r) => r.work_name as string
);

const posterUrl = getPosterUrl(
  event.poster_key as string | null,
  env.PUBLIC_R2_BASE_URL ?? ""
);
const typeLabel = event.event_type === "doujin" ? "漫展" : "演唱会";
const dateStr = event.end_date
  ? `${event.start_date} ~ ${event.end_date}`
  : (event.start_date as string);
const siteUrl = env.PUBLIC_SITE_URL ?? "";
const ogImage = event.poster_key
  ? `${siteUrl}${posterUrl}`
  : undefined;
---

<Base
  title={`${event.title as string} - ACG 活动查询`}
  description={`查看活动详情：${event.title as string}，${dateStr}，${event.city as string} ${event.venue as string}`}
  ogImage={ogImage}
>
  <a href="/" class="text-indigo-600 text-sm hover:underline mb-4 inline-block">← 返回列表</a>

  <div class="bg-white rounded-lg shadow-sm p-6">
    <div class="flex flex-col md:flex-row gap-6">
      <div class="flex-shrink-0">
        <PosterLightbox src={posterUrl} alt={event.title as string} client:load />
      </div>
      <div class="flex-1">
        <h1 class="text-2xl font-bold mb-2">{event.title as string}</h1>
        <div class="flex items-center gap-2 mb-4">
          <span class={`text-xs px-2 py-0.5 rounded ${
            event.event_type === "doujin" ? "bg-pink-100 text-pink-700" : "bg-blue-100 text-blue-700"
          }`}>{typeLabel}</span>
          {event.scale && <span class="text-xs text-gray-500">{event.scale as string}</span>}
          <span class="text-xs text-gray-400">🔥 {(event.view_count as number).toLocaleString()} 人关注</span>
        </div>

        <dl class="space-y-3 text-sm">
          <div><dt class="inline font-medium">📅 日期：</dt><dd class="inline">{dateStr}</dd></div>
          <div><dt class="inline font-medium">📍 地点：</dt><dd class="inline">{event.city as string} {event.venue as string}{event.address ? ` · ${event.address as string}` : ""}</dd></div>
          {event.price_info && <div><dt class="inline font-medium">💰 票价：</dt><dd class="inline">{event.price_info as string}</dd></div>}
          {event.ticket_url && (
            <div>
              <dt class="inline font-medium">🎫 购票：</dt>
              <a href={event.ticket_url as string} target="_blank" rel="noopener" class="text-indigo-600 hover:underline">前往购票</a>
            </div>
          )}
          {event.qq_group && (
            <div>
              <dt class="inline font-medium">💬 QQ群：</dt>
              <dd class="inline">{event.qq_group as string}</dd>
              <CopyButton text={event.qq_group as string} client:load />
            </div>
          )}
          {works.length > 0 && (
            <div>
              <dt class="inline font-medium">🏷️ 关联作品：</dt>
              <dd class="inline">{works.join(" | ")}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>

    {event.description && (
      <div class="mt-6 pt-6 border-t">
        <p class="text-sm text-gray-700 whitespace-pre-wrap">{event.description as string}</p>
      </div>
    )}
  </div>
</Base>

<script define:vars={{ id }}>
  fetch(`/api/events/${id}/view`, { method: "POST" }).catch(() => {});
</script>
```

- [ ] **Step 4: Verify build**

```bash
pnpm run build
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add event detail page with lightbox, copy button, and view counting"
```

---

## Task 17: Submit Page

**Files:**

- Create: `src/pages/submit.astro`
- Create: `src/components/SubmitForm.tsx`

- [ ] **Step 1: Create SubmitForm component**

`src/components/SubmitForm.tsx`:

```tsx
import { useState, useRef } from "react";
import provincesData from "../../data/provinces.json";

const SCALES = ["全国大型", "区域中型", "地方小型"];

interface Props {
    turnstileSiteKey: string;
}

export default function SubmitForm({ turnstileSiteKey }: Props) {
    const [province, setProvince] = useState("");
    const [city, setCity] = useState("");
    const [works, setWorks] = useState<string[]>([]);
    const [workInput, setWorkInput] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [posterFile, setPosterFile] = useState<File | null>(null);
    const formRef = useRef<HTMLFormElement>(null);

    const cities = province
        ? (provincesData.find((p) => p.province === province)?.cities ?? [])
        : [];

    function addWork() {
        const trimmed = workInput.trim();
        if (trimmed && !works.includes(trimmed) && works.length < 20) {
            setWorks([...works, trimmed]);
            setWorkInput("");
        }
    }

    function removeWork(w: string) {
        setWorks(works.filter((x) => x !== w));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        setError("");

        try {
            const form = formRef.current!;
            const fd = new FormData(form);
            const turnstileToken = (
                document.querySelector(
                    '[name="cf-turnstile-response"]',
                ) as HTMLInputElement
            )?.value;

            if (!turnstileToken) {
                setError("请完成验证码");
                setSubmitting(false);
                return;
            }

            const signBody = {
                title: fd.get("title"),
                province: fd.get("province"),
                city: fd.get("city"),
                venue: fd.get("venue"),
                address: fd.get("address"),
                startDate: fd.get("startDate"),
                endDate: fd.get("endDate") || null,
                eventType: fd.get("eventType"),
                scale: fd.get("scale") || null,
                works,
                qqGroup: fd.get("qqGroup") || null,
                ticketUrl: fd.get("ticketUrl") || null,
                priceInfo: fd.get("priceInfo") || null,
                description: fd.get("description") || null,
                turnstileToken,
            };

            const signRes = await fetch("/api/submit/sign", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(signBody),
            });

            if (!signRes.ok) {
                const data = await signRes.json();
                throw new Error(data.error ?? "签名失败");
            }

            const { ticket } = await signRes.json();

            const commitFd = new FormData();
            commitFd.append("ticket", ticket);
            if (posterFile) commitFd.append("poster", posterFile);

            const commitRes = await fetch("/api/submit/commit", {
                method: "POST",
                body: commitFd,
            });

            if (!commitRes.ok) {
                const data = await commitRes.json();
                throw new Error(data.error ?? "提交失败");
            }

            setSuccess(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : "提交失败");
        } finally {
            setSubmitting(false);
        }
    }

    if (success) {
        return (
            <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
                <h2 className="text-xl font-semibold text-green-800 mb-2">
                    提交成功!
                </h2>
                <p className="text-green-700">
                    活动已提交，待管理员审核后发布。
                </p>
                <a
                    href="/"
                    className="text-indigo-600 hover:underline mt-4 inline-block"
                >
                    返回首页
                </a>
            </div>
        );
    }

    return (
        <form
            ref={formRef}
            onSubmit={handleSubmit}
            className="bg-white rounded-lg shadow-sm p-6 space-y-4"
        >
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">
                    {error}
                </div>
            )}

            <div>
                <label className="block text-sm font-medium mb-1">
                    活动名称 *
                </label>
                <input
                    name="title"
                    required
                    className="w-full border rounded px-3 py-2 text-sm"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">
                        省/直辖市 *
                    </label>
                    <select
                        name="province"
                        required
                        value={province}
                        onChange={(e) => {
                            setProvince(e.target.value);
                            setCity("");
                        }}
                        className="w-full border rounded px-3 py-2 text-sm"
                    >
                        <option value="">请选择</option>
                        {provincesData.map((p) => (
                            <option key={p.province} value={p.province}>
                                {p.province}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">
                        城市 *
                    </label>
                    <select
                        name="city"
                        required
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="w-full border rounded px-3 py-2 text-sm"
                        disabled={!province}
                    >
                        <option value="">请选择</option>
                        {cities.map((c) => (
                            <option key={c} value={c}>
                                {c}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">
                    具体场馆 *
                </label>
                <input
                    name="venue"
                    required
                    className="w-full border rounded px-3 py-2 text-sm"
                />
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">
                    场馆地址
                </label>
                <input
                    name="address"
                    className="w-full border rounded px-3 py-2 text-sm"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">
                        开始日期 *
                    </label>
                    <input
                        name="startDate"
                        type="date"
                        required
                        className="w-full border rounded px-3 py-2 text-sm"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">
                        结束日期
                    </label>
                    <input
                        name="endDate"
                        type="date"
                        className="w-full border rounded px-3 py-2 text-sm"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">
                        活动类型 *
                    </label>
                    <select
                        name="eventType"
                        required
                        className="w-full border rounded px-3 py-2 text-sm"
                    >
                        <option value="doujin">漫展/同人展</option>
                        <option value="concert">演唱会/Live</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">
                        规模
                    </label>
                    <select
                        name="scale"
                        className="w-full border rounded px-3 py-2 text-sm"
                    >
                        <option value="">不限</option>
                        {SCALES.map((s) => (
                            <option key={s} value={s}>
                                {s}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">
                    关联作品
                </label>
                <div className="flex gap-2">
                    <input
                        value={workInput}
                        onChange={(e) => setWorkInput(e.target.value)}
                        onKeyDown={(e) =>
                            e.key === "Enter" && (e.preventDefault(), addWork())
                        }
                        className="flex-1 border rounded px-3 py-2 text-sm"
                        placeholder="输入作品名后按回车"
                    />
                    <button
                        type="button"
                        onClick={addWork}
                        className="bg-gray-100 px-3 py-2 rounded text-sm hover:bg-gray-200"
                    >
                        添加
                    </button>
                </div>
                {works.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                        {works.map((w) => (
                            <span
                                key={w}
                                className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-xs flex items-center gap-1"
                            >
                                {w}
                                <button
                                    type="button"
                                    onClick={() => removeWork(w)}
                                    className="hover:text-red-500"
                                >
                                    ×
                                </button>
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">
                        QQ群号
                    </label>
                    <input
                        name="qqGroup"
                        className="w-full border rounded px-3 py-2 text-sm"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">
                        购票链接
                    </label>
                    <input
                        name="ticketUrl"
                        type="url"
                        className="w-full border rounded px-3 py-2 text-sm"
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">
                    票价信息
                </label>
                <input
                    name="priceInfo"
                    className="w-full border rounded px-3 py-2 text-sm"
                    placeholder="如: 预售50元/现场60元"
                />
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">海报图</label>
                <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setPosterFile(e.target.files?.[0] ?? null)}
                    className="w-full text-sm"
                />
            </div>

            <div>
                <label className="block text-sm font-medium mb-1">
                    补充描述
                </label>
                <textarea
                    name="description"
                    rows={4}
                    className="w-full border rounded px-3 py-2 text-sm"
                />
            </div>

            <div className="cf-turnstile" data-sitekey={turnstileSiteKey} />

            <button
                type="submit"
                disabled={submitting}
                className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
                {submitting ? "提交中..." : "提交活动"}
            </button>
        </form>
    );
}
```

- [ ] **Step 2: Create submit page**

`src/pages/submit.astro`:

```astro
---
import Base from "../layouts/Base.astro";
import SubmitForm from "../components/SubmitForm";

const turnstileSiteKey = Astro.locals.runtime.env.PUBLIC_TURNSTILE_SITE_KEY ?? "";
---

<Base title="提交活动 - ACG 活动查询">
  <div class="max-w-2xl mx-auto">
    <h1 class="text-2xl font-bold mb-6">提交新活动</h1>
    <p class="text-sm text-gray-500 mb-4">提交后需管理员审核，审核通过后将在首页展示。</p>

    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>

    <SubmitForm turnstileSiteKey={turnstileSiteKey} client:load />
  </div>
</Base>
```

- [ ] **Step 3: Verify build**

```bash
pnpm run build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add submit page with form, image upload, and Turnstile integration"
```

---

## Task 18: Admin Page

**Files:**

- Create: `src/pages/admin.astro`

- [ ] **Step 1: Create admin page**

`src/pages/admin.astro`:

```astro
---
import Base from "../layouts/Base.astro";

const email =
  Astro.request.headers.get("Cf-Access-Authenticated-User-Email") ??
  Astro.locals.runtime.env.DEV_ADMIN_EMAIL ??
  "未知用户";
---

<Base title="管理后台 - ACG 活动查询">
  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold">管理后台</h1>
    <span class="text-sm text-gray-500">管理员: {email}</span>
  </div>

  <div class="flex gap-4 mb-6">
    <button id="tab-pending" class="tab-btn active" data-status="pending">待审核</button>
    <button id="tab-approved" class="tab-btn" data-status="approved">已通过</button>
    <button id="tab-rejected" class="tab-btn" data-status="rejected">已拒绝</button>
  </div>

  <div id="event-list" class="space-y-4"></div>

  <style>
    .tab-btn {
      @apply px-4 py-2 rounded-lg text-sm font-medium border;
    }
    .tab-btn.active {
      @apply bg-indigo-600 text-white border-indigo-600;
    }
    .event-item {
      @apply bg-white rounded-lg shadow-sm p-4 flex items-center justify-between;
    }
  </style>

  <script>
    let currentStatus = "pending";

    async function loadEvents(status: string) {
      currentStatus = status;
      document.querySelectorAll(".tab-btn").forEach((btn) => {
        btn.classList.toggle("active", (btn as HTMLElement).dataset.status === status);
      });

      const res = await fetch(`/api/admin/events?status=${status}`);
      const events = await res.json();
      const container = document.getElementById("event-list")!;

      if (events.length === 0) {
        container.innerHTML = `<p class="text-gray-400 text-center py-8">暂无${status === "pending" ? "待审核" : status === "approved" ? "已通过" : "已拒绝"}的活动</p>`;
        return;
      }

      container.innerHTML = events
        .map(
          (e: Record<string, unknown>) => `
        <div class="event-item" data-id="${e.id}">
          <div>
            <a href="/event/${e.id}" class="font-medium hover:text-indigo-600">${e.title}</a>
            <p class="text-xs text-gray-500 mt-1">${e.city} · ${e.venue} · ${e.start_date}</p>
          </div>
          <div class="flex gap-2">
            ${status === "pending" ? `
              <button onclick="approveEvent('${e.id}')" class="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600">通过</button>
              <button onclick="rejectEvent('${e.id}')" class="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600">拒绝</button>
            ` : `
              <button onclick="deleteEvent('${e.id}')" class="text-red-500 hover:text-red-700 text-sm">删除</button>
            `}
          </div>
        </div>`
        )
        .join("");
    }

    async function approveEvent(id: string) {
      await fetch(`/api/admin/events/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      loadEvents(currentStatus);
    }

    async function rejectEvent(id: string) {
      await fetch(`/api/admin/events/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      });
      loadEvents(currentStatus);
    }

    async function deleteEvent(id: string) {
      if (!confirm("确认删除此活动？")) return;
      await fetch(`/api/admin/events/${id}`, { method: "DELETE" });
      loadEvents(currentStatus);
    }

    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => loadEvents((btn as HTMLElement).dataset.status!));
    });

    loadEvents("pending");
  </script>
</Base>
```

- [ ] **Step 2: Verify build**

```bash
pnpm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add admin page with pending/approved/rejected tabs and approve/reject/delete"
```

---

## Task 19: Final Polish & Deployment Config

**Files:**

- Modify: `wrangler.jsonc`
- Create: `.dev.vars.example`, `.env.development`, `.env.production`

- [ ] **Step 1: Create .dev.vars.example**

`.dev.vars.example`:

```
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
DEV_ADMIN_EMAIL=admin@example.com
```

- [ ] **Step 2: Create .env.development**

`.env.development`:

```
PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
PUBLIC_R2_BASE_URL=
PUBLIC_SITE_URL=http://localhost:4321
```

- [ ] **Step 3: Create .env.production**

`.env.production`:

```
PUBLIC_TURNSTILE_SITE_KEY=your_production_site_key
PUBLIC_R2_BASE_URL=https://your-r2-domain.com
PUBLIC_SITE_URL=https://your-domain.com
```

- [ ] **Step 4: Final build verification**

```bash
pnpm run build
pnpm run typecheck
pnpm run test
```

Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: add env templates and final build verification"
```

---

## Self-Review Checklist

### Spec Coverage

| Spec Section                                                        | Covered In      |
| ------------------------------------------------------------------- | --------------- |
| §2 Tech Stack (Astro 6, React 19, Tailwind v4, CF Workers, Drizzle) | Task 1          |
| §3 Page Routes (/, /event/[id], /submit, /admin, API routes)        | Tasks 15-18     |
| §4 Data Model (events, event_works, indexes, ULID)                  | Tasks 2, 3, 6   |
| §5 Homepage (nearby/popular/all, filter bar, event cards)           | Tasks 14, 15    |
| §6 Event Detail (poster lightbox, copy, view count, SEO)            | Task 16         |
| §7 Submit Flow (form, compression, sign, commit, HMAC)              | Tasks 9, 10, 17 |
| §8 Admin (CF Access auth, approve/reject/edit/delete)               | Tasks 11, 18    |
| §9 Anti-abuse (rate limiting, Turnstile, soft delete)               | Tasks 4, 9      |
| §10 Env vars / bindings                                             | Tasks 1, 19     |
| §11 Project structure                                               | All tasks       |
| §12 Init commands                                                   | Task 1          |
| §13 Deployment                                                      | Task 19         |
| §14 pnpm scripts                                                    | Task 1          |

### Uncovered Items (intentional scope limits)

- **Client-side image compression** (`browser-image-compression`): The submit form accepts file upload but does not yet compress images client-side. This is a UX enhancement that can be added to `SubmitForm.tsx` after the core flow works. The `browser-image-compression` package is installed in Task 1.
- **Lightbox CSS import**: `yet-another-react-lightbox` styles need to be imported. Verified that the import is in `PosterLightbox.tsx`.
- **Province data completeness**: The `data/provinces.json` example includes all 34 provincial divisions but some may have incomplete city lists. Can be expanded incrementally.
