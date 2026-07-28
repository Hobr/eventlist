<script lang="ts">
    import {
        ArrowUpRightFromSquareOutline as ArrowUpRight,
        CalendarMonthOutline as CalendarDays,
        MapPinOutline as MapPin
    } from "flowbite-svelte-icons";
    import { getDivisionLabel } from "../lib/divisions";
    import { formatEventSchedule } from "../lib/events/datetime";
    import { getEventScaleLabel, getEventTypeLabel } from "../lib/events/options";
    import type { PublicEventRow } from "../lib/public/homepage";
    import Badge from "./ui/badge.svelte";

    interface Props {
        event: PublicEventRow;
        priority?: boolean;
    }

    let { event, priority = false }: Props = $props();

    const fallbackUrl = "/images/event-fallback.webp";
    const tags = $derived(event.tags ? event.tags.split("、").filter(Boolean).slice(0, 3) : []);
    const divisionLabel = $derived(getDivisionLabel(event.division_code) ?? "未知地区");
    const typeLabel = $derived(getEventTypeLabel(event.type));
    const scaleLabel = $derived(getEventScaleLabel(event.scale));
    const dateLabel = $derived(formatEventSchedule(event));

    function escapeAttribute(value: string) {
        return value
            .replaceAll("&", "&amp;")
            .replaceAll('"', "&quot;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;");
    }

    const coverImageHtml = $derived.by(() => {
        const coverUrl = event.cover_url?.trim();
        if (!coverUrl) return "";

        // Keep the failure fallback working for both hydrated homepage rows and SSR-only catalogue rows.
        return `<img src="${escapeAttribute(coverUrl)}" alt="" width="1200" height="900" loading="${priority ? "eager" : "lazy"}" decoding="async" fetchpriority="${priority ? "high" : "auto"}" class="absolute inset-0 size-full object-cover" onerror="this.remove()" />`;
    });
</script>

<a
    href={`/events/${event.id}`}
    class="group grid min-w-0 grid-cols-[6.5rem_minmax(0,1fr)] gap-4 border-b border-border/75 py-4 transition-[transform,background-color] duration-300 ease-motion hover:translate-x-1 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none active:scale-[0.995] sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:items-center"
>
    <div
        class="relative isolate aspect-[4/3] w-full overflow-hidden rounded-md bg-surface-subtle"
        role="img"
        aria-label={`${event.title} 封面`}
    >
        <img
            src={fallbackUrl}
            alt=""
            width="1200"
            height="900"
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            class="absolute inset-0 size-full object-cover"
        />
        {@html coverImageHtml}
    </div>
    <div class="min-w-0">
        <div class="mb-2 flex flex-wrap gap-1.5">
            <Badge tone="primary">{typeLabel}</Badge>
            <Badge>{scaleLabel}</Badge>
        </div>
        <h3 class="text-base leading-tight font-bold text-foreground sm:text-lg">
            {event.title}
        </h3>
        <div
            class="mt-2 flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-4 sm:text-sm"
        >
            <span class="inline-flex items-center gap-1.5">
                <CalendarDays class="size-3.5" aria-hidden="true" />
                {dateLabel}
            </span>
            <span class="inline-flex min-w-0 items-center gap-1.5">
                <MapPin class="size-3.5 shrink-0" aria-hidden="true" />
                <span class="truncate">{divisionLabel} · {event.venue}</span>
            </span>
        </div>
        {#if tags.length > 0}
            <div class="mt-3 hidden flex-wrap gap-1.5 sm:flex">
                {#each tags as tag}
                    <Badge>{tag}</Badge>
                {/each}
            </div>
        {/if}
    </div>
    <ArrowUpRight
        class="hidden size-5 text-muted transition-transform duration-300 ease-motion group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:scale-105 sm:block"
        aria-hidden="true"
    />
</a>
