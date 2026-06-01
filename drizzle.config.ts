import { defineConfig } from "drizzle-kit";

export default defineConfig({
    schema: "./src/server/db/schema.ts",
    out: "./migrations",
    dialect: "sqlite",
    dbCredentials: {
        url: ".wrangler/state/v3/d1/miniflare-D1DatabaseObject/acg-events.sqlite",
    },
});
