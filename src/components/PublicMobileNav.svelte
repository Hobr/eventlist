<script lang="ts">
    import {
        CalendarMonthOutline as CalendarDays,
        GlobeOutline as Compass,
        PaperPlaneOutline as Send
    } from "flowbite-svelte-icons";
    import { SITE_NAME, SITE_SLOGAN } from "../lib/site";
    import SidePanel from "./ui/side-panel.svelte";

    interface Props {
        currentPath: string;
    }

    let { currentPath }: Props = $props();

    const items = [
        { href: "/", label: "首页", icon: Compass },
        { href: "/events", label: "活动", icon: CalendarDays },
        { href: "/submit", label: "投稿", icon: Send }
    ];

    function isCurrent(href: string) {
        if (href === "/") return currentPath === "/";
        return currentPath === href || currentPath.startsWith(`${href}/`);
    }
</script>

<SidePanel
    title={SITE_NAME}
    description={SITE_SLOGAN}
    triggerAriaLabel="打开主导航"
    triggerClass="size-10 rounded-full border-border/80 bg-surface/90 p-0 text-foreground"
    contentClass="max-w-sm"
>
    {#snippet trigger()}
        <span class="relative block size-4" aria-hidden="true">
            <span
                class="absolute top-1 left-0 h-px w-4 bg-current transition-transform duration-300 ease-motion group-aria-expanded:translate-y-[3px] group-aria-expanded:rotate-45"
            ></span>
            <span
                class="absolute bottom-1 left-0 h-px w-4 bg-current transition-transform duration-300 ease-motion group-aria-expanded:-translate-y-[3px] group-aria-expanded:-rotate-45"
            ></span>
        </span>
    {/snippet}

    <nav class="flex flex-col gap-2" aria-label="移动端主导航">
        {#each items as item (item.href)}
            {@const Icon = item.icon}
            <a
                href={item.href}
                aria-current={isCurrent(item.href) ? "page" : undefined}
                class="flex h-12 items-center gap-3 rounded-md px-4 text-base font-semibold text-muted-foreground transition-[transform,background-color,color] duration-300 ease-motion hover:bg-surface-subtle hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none active:scale-[0.99] aria-[current=page]:bg-primary-subtle aria-[current=page]:text-primary-subtle-foreground"
            >
                <span
                    class="flex size-8 items-center justify-center rounded-full bg-surface-subtle"
                >
                    <Icon class="size-4" aria-hidden="true" />
                </span>
                {item.label}
            </a>
        {/each}
    </nav>

    <div class="mt-8 border-t border-border pt-6 text-sm text-muted-foreground">
        按地区与日期浏览已审核活动
    </div>
</SidePanel>
