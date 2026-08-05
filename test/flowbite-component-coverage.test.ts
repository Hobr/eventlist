import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

function readSource(path: string) {
    return readFile(new URL(path, projectRoot), "utf8");
}

test("共享 UI 适配器由 Flowbite 组件承载并保留可绑定合同", async () => {
    const adapters = await Promise.all(
        [
            ["src/components/ui/button.svelte", "Button", "FlowbiteButton"],
            ["src/components/ui/input.svelte", "Input", "FlowbiteInput"],
            ["src/components/ui/textarea.svelte", "Textarea", "FlowbiteTextarea"],
            ["src/components/ui/label.svelte", "Label", "FlowbiteLabel"],
            ["src/components/ui/card.svelte", "Card", "FlowbiteCard"],
            ["src/components/ui/separator.svelte", "Hr", "FlowbiteHr"],
            ["src/components/ui/alert.svelte", "Alert", "FlowbiteAlert"],
            ["src/components/ui/checkbox.svelte", "Checkbox", "FlowbiteCheckbox"],
            ["src/components/ui/file-upload.svelte", "Fileupload", "FlowbiteFileupload"]
        ].map(async ([path, exportName, alias]) => ({
            path,
            exportName,
            alias,
            source: await readSource(path)
        }))
    );

    for (const { path, exportName, alias, source } of adapters) {
        assert.match(
            source,
            new RegExp(`import \\{ ${exportName} as ${alias} \\} from "flowbite-svelte"`),
            path
        );
        assert.match(source, new RegExp(`<${alias}\\b`), path);
    }

    assert.match(adapters.find(({ path }) => path.endsWith("input.svelte"))!.source, /bind:value/);
    assert.match(
        adapters.find(({ path }) => path.endsWith("textarea.svelte"))!.source,
        /bind:value/
    );
    assert.match(
        adapters.find(({ path }) => path.endsWith("checkbox.svelte"))!.source,
        /bind:checked/
    );
    const fileUpload = adapters.find(({ path }) => path.endsWith("file-upload.svelte"))!.source;
    assert.match(fileUpload, /bind:files/);
    assert.match(fileUpload, /bind:elementRef/);
    const button = adapters.find(({ path }) => path.endsWith("button.svelte"))!.source;
    assert.match(button, /disabled \? -1 : restProps\.tabindex/);
    assert.match(button, /tabindex=\{resolvedTabindex\}/);
});

test("高价值表单和批量导入不再复制可见原生控件", async () => {
    const [sources, submissionSection] = await Promise.all([
        Promise.all(
            [
                "src/pages/submit.astro",
                "src/pages/admin/login.astro",
                "src/components/admin/AdminEventForm.astro",
                "src/components/admin/BulkEventImport.svelte"
            ].map(readSource)
        ),
        readSource("src/components/SubmissionSection.astro")
    ]);

    for (const source of sources) {
        assert.doesNotMatch(source, /<input\b(?![^>]*\btype=["']hidden["'])/);
        assert.doesNotMatch(source, /<(textarea|button|table)\b/);
    }

    assert.match(sources[0]!, /<SubmissionSection[\s\S]*optional/);
    assert.match(submissionSection, /<details/);
    assert.match(sources[0]!, /<Turnstile/);
    assert.match(sources[3]!, /<FileUpload/);
    assert.match(sources[3]!, /<Table/);
});

test("公开结构组件保留 SSR 链接和专用原生边界", async () => {
    const [categories, mobileNav, publicPagination, adminPagination, eventCard] = await Promise.all(
        [
            "src/pages/categories.astro",
            "src/components/PublicMobileNav.svelte",
            "src/pages/events/index.astro",
            "src/components/admin/Pagination.astro",
            "src/components/EventCard.astro"
        ].map(readSource)
    );

    assert.match(categories, /import \{ Listgroup, ListgroupItem \} from "flowbite-svelte"/);
    assert.equal(categories.match(/<Listgroup\b/g)?.length, 3);
    assert.match(mobileNav, /<ListgroupItem[\s\S]*href=\{item\.href\}/);
    assert.match(publicPagination, /<PaginationItem[\s\S]*href=\{nextHref/);
    assert.match(adminPagination, /<PaginationItem[\s\S]*href=\{hrefFor/);
    assert.equal(eventCard.match(/<Card\b/g)?.length, 2);
    assert.match(eventCard, /variant === "compact"[\s\S]*<a[\s\S]*href=\{href\}/);
    assert.match(eventCard, /variant === "row"[\s\S]*<EventRow/);
});

test("首页控件使用 ButtonGroup 和 Button 且保留链接与 ARIA 合同", async () => {
    const [intentFeed, carousel] = await Promise.all(
        [
            "src/components/HomepageIntentFeed.svelte",
            "src/components/FeaturedEventCarousel.svelte"
        ].map(readSource)
    );

    assert.match(intentFeed, /import \{ ButtonGroup, Spinner \} from "flowbite-svelte"/);
    assert.match(intentFeed, /<ButtonGroup/);
    assert.match(intentFeed, /href=\{trendHref\(trend\)\}/);
    assert.match(intentFeed, /role="tab"/);
    assert.match(intentFeed, /aria-selected=\{selected\}/);
    assert.match(intentFeed, /onkeydown=\{\(event\) => handleTabKeydown/);
    assert.doesNotMatch(intentFeed, /<button\b/);
    assert.equal(carousel.match(/<Button\b/g)?.length, 3);
    assert.doesNotMatch(carousel, /<button\b/);
});

test("特殊 Button 配色显式覆盖 Flowbite dark variant", async () => {
    const [eventDetail, eventList, notFound, carousel, tagInput] = await Promise.all(
        [
            "src/pages/events/[id].astro",
            "src/pages/events/index.astro",
            "src/pages/404.astro",
            "src/components/FeaturedEventCarousel.svelte",
            "src/components/TagInput.svelte"
        ].map(readSource)
    );

    assert.match(eventDetail, /dark:bg-foreground!/);
    assert.match(eventDetail, /dark:bg-surface-subtle!/);
    assert.match(eventList, /dark:bg-foreground!/);
    assert.match(notFound, /dark:bg-white!/);
    assert.equal(carousel.match(/dark:bg-black\/55!/g)?.length, 3);
    assert.match(tagInput, /dark:hover:bg-surface-raised!/);
});

test("生产源码只保留批准的原生控件并禁止第二套 UI runtime", async () => {
    const sourceRoot = new URL("src/", projectRoot);
    const sourceFiles = (await readdir(sourceRoot, { recursive: true }))
        .filter((path) => /\.(astro|svelte|ts|js)$/.test(path))
        .sort();
    const productionSource = (
        await Promise.all(sourceFiles.map((path) => readFile(new URL(path, sourceRoot), "utf8")))
    ).join("\n");

    const nativeInputs = productionSource.match(/<input\b[^>]*>/g) ?? [];
    assert.ok(nativeInputs.length > 0);
    assert.ok(nativeInputs.every((input) => /\btype=["']hidden["']/.test(input)));
    assert.doesNotMatch(productionSource, /<(textarea|button|select|table)\b/);
    assert.match(
        productionSource,
        /document\.createElement\("input"\)[\s\S]*input\.type = "checkbox"/
    );
    assert.doesNotMatch(
        productionSource,
        /initFlowbite|from ["'](?:bits-ui|@melt-ui|daisyui)["']|data-(?:drawer|modal|dropdown)-/
    );
});
