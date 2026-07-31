// @ts-check
import { defineConfig } from "astro/config";

import cloudflare from "@astrojs/cloudflare";
import svelte from "@astrojs/svelte";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
    site: "https://acg.hobr.site",
    adapter: cloudflare(),
    integrations: [
        svelte(),
        sitemap({
            filter: (page) => {
                const pathname = new URL(page).pathname;
                return !(
                    pathname === "/admin" ||
                    pathname.startsWith("/admin/") ||
                    pathname === "/api" ||
                    pathname.startsWith("/api/")
                );
            }
        })
    ],
    vite: {
        plugins: [tailwindcss()]
    }
});
