// @ts-check
import { defineConfig } from "astro/config";

import cloudflare from "@astrojs/cloudflare";
import svelte from "@astrojs/svelte";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
    adapter: cloudflare(),
    integrations: [svelte()],

    vite: {
        // Astro components must be compiled by Astro instead of Vite's dev dependency optimizer.
        optimizeDeps: {
            exclude: ["@lucide/astro"]
        },
        plugins: [tailwindcss()]
    }
});
