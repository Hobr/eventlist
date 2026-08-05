<script lang="ts">
    import {
        ArrowUpRightFromSquareOutline as ArrowUpRight,
        MapPinOutline as MapPin
    } from "flowbite-svelte-icons";
    import { getDivisionLabel } from "../lib/divisions";
    import type { PublicHomepageRankedEvent } from "../lib/public/homepage";

    interface Props {
        headingId: string;
        title: string;
        scope: string;
        scene: "unopened" | "unended";
        events: PublicHomepageRankedEvent[];
    }

    let { headingId, title, scope, scene, events }: Props = $props();

    const numberFormat = new Intl.NumberFormat("zh-CN");
    const clockParts = Object.fromEntries(
        new Intl.DateTimeFormat("en", {
            timeZone: "Asia/Shanghai",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23"
        })
            .formatToParts(new Date())
            .map(({ type, value }) => [type, value])
    );
    const chinaToday = `${clockParts.year}-${clockParts.month}-${clockParts.day}`;
    const chinaTime = `${clockParts.hour}:${clockParts.minute}`;

    function shortDate(value: string) {
        const [, month, day] = value.split("-");
        return `${Number(month)}/${Number(day)}`;
    }

    function eventSchedule(event: PublicHomepageRankedEvent) {
        const start = `${shortDate(event.start_date)}${event.start_time ? ` ${event.start_time}` : ""}`;
        if (event.end_date === event.start_date) return start;
        return `${start} - ${shortDate(event.end_date)}${event.end_time ? ` ${event.end_time}` : ""}`;
    }

    function hasStarted(event: PublicHomepageRankedEvent) {
        return (
            event.start_date < chinaToday ||
            (event.start_date === chinaToday &&
                (event.start_time === null || event.start_time <= chinaTime))
        );
    }

    function primaryTiming(event: PublicHomepageRankedEvent) {
        if (scene === "unended") {
            return hasStarted(event)
                ? "进行中"
                : `${shortDate(event.start_date)}${event.start_time ? ` ${event.start_time}` : " 全天"}`;
        }

        if (!event.admission_start_date) return "开票时间待定";
        if (event.admission_start_date === chinaToday) {
            return event.admission_start_time
                ? `今日 ${event.admission_start_time} 开票`
                : "今日开票: 时间待定";
        }
        return event.admission_start_time
            ? `${shortDate(event.admission_start_date)} ${event.admission_start_time} 开票`
            : `${shortDate(event.admission_start_date)} 开票: 时间待定`;
    }
</script>

<section aria-labelledby={headingId} class="min-w-0 border-t border-border/80 pt-5">
    <header class="flex items-end justify-between gap-4 pb-3">
        <div class="min-w-0">
            <h4 id={headingId} class="text-base font-black text-foreground sm:text-lg">{title}</h4>
            <p class="mt-1 truncate text-xs text-muted">{scope}</p>
        </div>
    </header>

    {#if events.length > 0}
        <ol class="divide-y divide-border/75 border-b border-border/80">
            {#each events as event, index (event.id)}
                <li>
                    <a
                        href={`/events/${event.id}`}
                        class="group grid min-w-0 grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-3 py-3.5 transition-[transform,background-color] duration-300 ease-motion hover:translate-x-1 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none active:scale-[0.995]"
                    >
                        <span class="text-sm font-black text-primary tabular-nums">
                            {String(index + 1).padStart(2, "0")}
                        </span>
                        <span class="min-w-0">
                            <strong
                                class="block truncate text-sm text-foreground transition-colors duration-300 ease-motion group-hover:text-primary sm:text-base"
                                title={event.title}
                            >
                                {event.title}
                            </strong>
                            <span
                                class="mt-1 block truncate text-xs font-semibold text-muted-foreground"
                            >
                                {primaryTiming(event)}
                            </span>
                            <span class="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted">
                                <MapPin class="size-3.5 shrink-0" aria-hidden="true" />
                                <span class="truncate">
                                    {getDivisionLabel(event.division_code) ?? "未知地区"}
                                </span>
                                <span class="shrink-0 tabular-nums"
                                    >活动 {eventSchedule(event)}</span
                                >
                            </span>
                        </span>
                        <span class="flex shrink-0 items-center gap-2 text-right">
                            <span
                                aria-label={`近期开启详情页的独立访客 ${event.unique_visitors} 人`}
                            >
                                <strong class="block text-sm text-foreground tabular-nums">
                                    {numberFormat.format(event.unique_visitors)}
                                </strong>
                                <span class="block text-[0.65rem] text-muted">热度</span>
                            </span>
                            <ArrowUpRight
                                class="size-4 text-muted transition-transform duration-300 ease-motion group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:scale-105"
                                aria-hidden="true"
                            />
                        </span>
                    </a>
                </li>
            {/each}
        </ol>
    {:else}
        <div class="border-y border-border/80 py-8">
            <p class="text-sm font-semibold text-muted-foreground">暂无符合条件的活动</p>
        </div>
    {/if}
</section>
