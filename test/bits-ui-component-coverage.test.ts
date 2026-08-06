import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

function readSource(path: string) {
    return readFile(new URL(path, projectRoot), "utf8");
}

test("shared interactive contracts use Bits UI primitives", async () => {
    const sources = await Promise.all(
        [
            ["src/components/ui/button.svelte", "Button"],
            ["src/components/ui/label.svelte", "Label"],
            ["src/components/ui/separator.svelte", "Separator"],
            ["src/components/ui/checkbox.svelte", "Checkbox"],
            ["src/components/ui/side-panel.svelte", "Dialog"],
            ["src/components/ui/confirm-dialog.svelte", "AlertDialog"],
            ["src/components/SelectField.svelte", "Select"],
            ["src/components/TagInput.svelte", "Combobox"]
        ].map(async ([path, primitive]) => ({ path, primitive, source: await readSource(path!) }))
    );

    for (const { path, primitive, source } of sources) {
        assert.match(source, new RegExp(`import \\{ ${primitive} \\} from "bits-ui"`), path);
        assert.match(source, new RegExp(`<${primitive}\\.`), path);
    }

    const [checkbox, sidePanel, confirmDialog, homepageIntent] = await Promise.all(
        [
            "src/components/ui/checkbox.svelte",
            "src/components/ui/side-panel.svelte",
            "src/components/ui/confirm-dialog.svelte",
            "src/components/HomepageIntentFeed.svelte"
        ].map(readSource)
    );

    assert.match(checkbox, /bind:checked/);
    assert.match(checkbox, /aria-labelledby=\{children \? `\$\{id\}-label` : undefined\}/);
    assert.match(checkbox, /<label id=\{`\$\{id\}-label`\} for=\{id\}/);
    assert.match(sidePanel, /<Dialog\.Portal>/);
    assert.match(confirmDialog, /<AlertDialog\.Portal>/);
    assert.match(homepageIntent, /import \{ Tabs, ToggleGroup \} from "bits-ui"/);
    assert.match(homepageIntent, /<Tabs\.Root/);
    assert.match(homepageIntent, /<ToggleGroup\.Root/);
});

test("Bits UI select participates in named native forms", async () => {
    const select = await readSource("src/components/SelectField.svelte");

    assert.match(select, /<Select\.Root/);
    assert.match(select, /type="single"/);
    assert.match(select, /\{name\}/);
    assert.match(select, /\{items\}/);
    assert.match(select, /required=\{required && !disabled\}/);
    assert.match(select, /onValueChange=\{updateValue\}/);
    assert.match(select, /<Select\.Item/);
});

test("navigation and pagination keep real SSR links", async () => {
    const [mobileNav, publicEvents, adminPagination, eventCard, homepageIntent] = await Promise.all(
        [
            "src/components/PublicMobileNav.svelte",
            "src/pages/events/index.astro",
            "src/components/admin/Pagination.astro",
            "src/components/EventCard.astro",
            "src/components/HomepageIntentFeed.svelte"
        ].map(readSource)
    );

    assert.match(mobileNav, /<a[\s\S]*href=\{item\.href\}/);
    assert.match(publicEvents, /href=\{nextHref\(filters\.page - 1\)\}/);
    assert.match(publicEvents, /href=\{nextHref\(\(filters\.page \?\? 1\) \+ 1\)\}/);
    assert.match(adminPagination, /<Button[\s\S]*href=\{hrefFor\(page - 1\)\}/);
    assert.match(adminPagination, /<Button[\s\S]*href=\{hrefFor\(page \+ 1\)\}/);
    assert.match(eventCard, /variant === "compact"[\s\S]*<a href=\{href\}/);
    assert.match(homepageIntent, /href=\{trendHref\(trend\)\}/);
});

test("native elements remain only at documented semantic boundaries", async () => {
    const [input, textarea, table, submissionSection, newEvent, eventTable, carousel] =
        await Promise.all(
            [
                "src/components/ui/input.svelte",
                "src/components/ui/textarea.svelte",
                "src/components/ui/table.svelte",
                "src/components/SubmissionSection.astro",
                "src/pages/admin/events/new.astro",
                "src/components/admin/EventTable.astro",
                "src/components/FeaturedEventCarousel.svelte"
            ].map(readSource)
        );

    assert.match(input, /<input\b/);
    assert.match(textarea, /<textarea\b/);
    assert.match(table, /<table\b/);
    assert.match(submissionSection, /<details/);
    assert.match(newEvent, /document\.createElement\("input"\)/);
    assert.match(newEvent, /input\.type = "checkbox"/);
    assert.match(eventTable, /<table class="admin-event-table">/);
    assert.match(carousel, /<button[\s\S]*class="featured-rail-button"/);
});

test("production source and build configuration ban legacy UI dependencies", async () => {
    const sourceRoot = new URL("src/", projectRoot);
    const sourceFiles = (await readdir(sourceRoot, { recursive: true }))
        .filter((path) => /\.(astro|svelte|ts|js|css)$/.test(path))
        .sort();
    const productionSource = (
        await Promise.all(sourceFiles.map((path) => readFile(new URL(path, sourceRoot), "utf8")))
    ).join("\n");
    const [packageSource, astroConfig, prettierConfig] = await Promise.all(
        ["package.json", "astro.config.mjs", ".prettierrc"].map(readSource)
    );
    const packageJson = JSON.parse(packageSource) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
    };
    const packages = { ...packageJson.dependencies, ...packageJson.devDependencies };

    for (const dependency of [
        "flowbite",
        "flowbite-svelte",
        "flowbite-svelte-icons",
        "tailwindcss",
        "@tailwindcss/forms",
        "@tailwindcss/vite",
        "tailwind-merge",
        "prettier-plugin-tailwindcss"
    ]) {
        assert.equal(packages[dependency], undefined, dependency);
    }

    assert.doesNotMatch(
        productionSource,
        /from ["'](?:flowbite|flowbite-svelte|flowbite-svelte-icons|tailwind-merge)["']/
    );
    assert.doesNotMatch(productionSource, /from ["']phosphor-svelte["']/);
    assert.match(astroConfig, /exclude: phosphorIcons/);
    assert.doesNotMatch(
        productionSource,
        /class(?:=|:)[^\n>]*(?:dark|sm|md|lg|xl|2xl|hover|focus|focus-visible|data-\[[^\]]+\]):/
    );
    assert.doesNotMatch(productionSource, /@(?:tailwind|plugin|source)\b/);
    assert.doesNotMatch(`${astroConfig}\n${prettierConfig}`, /tailwind|flowbite/i);
});
