<script lang="ts">
    import { onMount } from "svelte";
    import {
        ChevronDownOutline as ChevronDown,
        MapPinAltOutline as MapPin
    } from "flowbite-svelte-icons";
    import CitySelector from "./CitySelector.svelte";
    import SidePanel from "./ui/side-panel.svelte";
    import { restoreStoredDivision } from "../lib/division-preference";

    interface Props {
        selectedDivisionCode: string;
        shortLabel?: string;
        fullLabel?: string;
        sourceLabel?: string;
        action?: string;
    }

    let {
        selectedDivisionCode,
        shortLabel = "选择地区",
        fullLabel = "尚未选择地区",
        sourceLabel = "",
        action = "/"
    }: Props = $props();

    onMount(() => {
        restoreStoredDivision({ selectedDivisionCode, action, name: "city" });
    });
</script>

<SidePanel
    title="浏览地区"
    description={sourceLabel ? `当前：${fullLabel} · ${sourceLabel}` : `当前：${fullLabel}`}
    triggerAriaLabel={`更改地区，当前为${fullLabel}`}
    triggerClass="h-9 max-w-[8.5rem] gap-1.5 rounded-full border-border/80 bg-surface/88 px-2.5 text-xs text-foreground shadow-none hover:bg-surface-subtle sm:h-10 sm:max-w-[10rem] sm:px-3 sm:text-sm"
    contentClass="max-w-sm"
>
    {#snippet trigger()}
        <MapPin class="size-3.5 shrink-0 text-primary sm:size-4" aria-hidden="true" />
        <span class="min-w-0 truncate">{shortLabel}</span>
        <ChevronDown
            class="size-3 shrink-0 text-muted transition-transform duration-300 ease-motion group-aria-expanded:rotate-180"
            aria-hidden="true"
        />
    {/snippet}

    <CitySelector {selectedDivisionCode} {action} label="选择省、市和区县" />
</SidePanel>
