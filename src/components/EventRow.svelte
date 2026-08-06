<script lang="ts">
    import ArrowUpRight from "phosphor-svelte/lib/ArrowUpRight";
    import CalendarDays from "phosphor-svelte/lib/CalendarDots";
    import MapPin from "phosphor-svelte/lib/MapPin";
    import { getDivisionLabel } from "../lib/divisions";
    import { getDisplayCoverUrl } from "../lib/events/cover";
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
        const coverUrl = getDisplayCoverUrl(event.cover_url);
        if (!coverUrl) return "";

        // Keep the failure fallback working for both hydrated homepage rows and SSR-only catalogue rows.
        return `<img src="${escapeAttribute(coverUrl)}" alt="" width="1200" height="900" loading="${priority ? "eager" : "lazy"}" decoding="async" fetchpriority="${priority ? "high" : "auto"}" referrerpolicy="no-referrer" class="event-row-image" onerror="this.remove()" />`;
    });
</script>

<a href={`/events/${event.id}`} class="event-row">
    <div class="event-row-artwork" role="img" aria-label={`${event.title} 封面`}>
        <img
            src={fallbackUrl}
            alt=""
            width="1200"
            height="900"
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            class="event-row-image"
        />
        {@html coverImageHtml}
    </div>
    <div class="event-row-content">
        <div class="event-row-badges">
            <Badge tone="primary">{typeLabel}</Badge>
            <Badge>{scaleLabel}</Badge>
        </div>
        <h3>
            {event.title}
        </h3>
        <div class="event-row-meta">
            <span>
                <CalendarDays size={15} aria-hidden="true" />
                {dateLabel}
            </span>
            <span>
                <MapPin size={15} aria-hidden="true" />
                <span>{divisionLabel} · {event.venue}</span>
            </span>
        </div>
        {#if tags.length > 0}
            <div class="event-row-tags">
                {#each tags as tag}
                    <Badge>{tag}</Badge>
                {/each}
            </div>
        {/if}
    </div>
    <ArrowUpRight size={20} class="event-row-arrow" aria-hidden="true" />
</a>
