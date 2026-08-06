<script lang="ts">
    import ArrowUpRight from "phosphor-svelte/lib/ArrowUpRight";
    import MapPin from "phosphor-svelte/lib/MapPin";
    import { getDivisionLabel } from "../lib/divisions";
    import type { PublicHomepageRankedEvent } from "../lib/public/homepage";

    interface Props {
        headingId: string;
        title: string;
        scene: "unopened" | "unended";
        events: PublicHomepageRankedEvent[];
    }

    let { headingId, title, scene, events }: Props = $props();

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

<section aria-labelledby={headingId} class="ranked-list">
    <header class="ranked-list-header">
        <div>
            <h4 id={headingId}>{title}</h4>
        </div>
    </header>

    {#if events.length > 0}
        <ol class="ranked-items">
            {#each events as event, index (event.id)}
                <li>
                    <a href={`/events/${event.id}`} class="ranked-link">
                        <span class="ranked-position">
                            {String(index + 1).padStart(2, "0")}
                        </span>
                        <span class="ranked-copy">
                            <strong class="ranked-title" title={event.title}>
                                {event.title}
                            </strong>
                            <span class="ranked-timing">
                                {primaryTiming(event)}
                            </span>
                            <span class="ranked-location">
                                <MapPin size={14} aria-hidden="true" />
                                <span>
                                    {getDivisionLabel(event.division_code) ?? "未知地区"}
                                </span>
                                <span>活动 {eventSchedule(event)}</span>
                            </span>
                        </span>
                        <span class="ranked-heat">
                            <span
                                aria-label={`近期开启详情页的独立访客 ${event.unique_visitors} 人`}
                            >
                                <strong>
                                    {numberFormat.format(event.unique_visitors)}
                                </strong>
                                <span>热度</span>
                            </span>
                            <ArrowUpRight size={16} aria-hidden="true" />
                        </span>
                    </a>
                </li>
            {/each}
        </ol>
    {:else}
        <div class="ranked-empty">
            <p>暂无符合条件的活动</p>
        </div>
    {/if}
</section>
