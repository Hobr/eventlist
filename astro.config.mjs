// @ts-check
import { defineConfig } from "astro/config";

import cloudflare from "@astrojs/cloudflare";

import react from "@astrojs/react";

import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
    adapter: cloudflare(),
    integrations: [react()],

    vite: {
        plugins: [tailwindcss()],

        server: {
            watch: {
                ignored: [
                    "**/.direnv/**",
                    "**/.git/**",
                    "**/node_modules/**",
                    "**/.wrangler/**",
                ],
            },
        },
    },
});
