// @ts-check
import { defineConfig } from "astro/config";

import cloudflare from "@astrojs/cloudflare";
import svelte from "@astrojs/svelte";
import sitemap from "@astrojs/sitemap";

const phosphorIcons = [
    "ArrowLeft",
    "ArrowRight",
    "ArrowUpRight",
    "ArrowsClockwise",
    "CalendarDots",
    "CaretDown",
    "CaretLeft",
    "CaretRight",
    "CaretUpDown",
    "Check",
    "CheckCircle",
    "Clock",
    "Compass",
    "DownloadSimple",
    "FileArrowDown",
    "FileCsv",
    "Fire",
    "FloppyDisk",
    "Funnel",
    "GitFork",
    "Intersect",
    "List",
    "LockKey",
    "MapPin",
    "PaperPlaneTilt",
    "Pause",
    "PencilSimple",
    "Play",
    "Plus",
    "Scales",
    "Shapes",
    "ShieldCheck",
    "SlidersHorizontal",
    "Storefront",
    "Tag",
    "Ticket",
    "Tray",
    "UploadSimple",
    "WarningCircle",
    "X",
    "XCircle"
].map((icon) => `phosphor-svelte/lib/${icon}`);

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
        optimizeDeps: {
            include: ["astro/logger/json"],
            exclude: phosphorIcons
        }
    }
});
