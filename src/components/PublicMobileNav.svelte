<script lang="ts">
    import CalendarDays from "phosphor-svelte/lib/CalendarDots";
    import Compass from "phosphor-svelte/lib/Compass";
    import Send from "phosphor-svelte/lib/PaperPlaneTilt";
    import Tags from "phosphor-svelte/lib/Tag";
    import { SITE_NAME, SITE_SLOGAN } from "../lib/site";
    import SidePanel from "./ui/side-panel.svelte";

    interface Props {
        currentPath: string;
    }
    let { currentPath }: Props = $props();

    const items = [
        { href: "/", label: "首页", icon: Compass },
        { href: "/events", label: "活动", icon: CalendarDays },
        { href: "/categories", label: "分类", icon: Tags },
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
    triggerClass="mobile-nav-trigger"
    contentClass="public-nav-sheet"
>
    {#snippet trigger()}<span class="menu-lines" aria-hidden="true"></span>{/snippet}
    <nav class="mobile-nav-list" aria-label="移动端主导航">
        {#each items as item (item.href)}
            {@const Icon = item.icon}
            <a
                href={item.href}
                class="mobile-nav-link"
                aria-current={isCurrent(item.href) ? "page" : undefined}
            >
                <span class="mobile-nav-icon"><Icon size={18} aria-hidden="true" /></span>
                {item.label}
            </a>
        {/each}
    </nav>
    <p class="mobile-nav-note">按地区与日期浏览已审核活动</p>
</SidePanel>
