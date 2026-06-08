import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        alias: {
            "cloudflare:workers": new URL(
                "./tests/setup/cloudflare-workers.ts",
                import.meta.url,
            ).pathname,
        },
    },
    test: {
        environment: "node",
        globals: true,
        include: ["tests/**/*.test.ts"],
        setupFiles: ["tests/setup/vitest.setup.ts"],
    },
});
