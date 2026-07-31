<script lang="ts">
    import { ArrowRightOutline as ArrowRight } from "flowbite-svelte-icons";
    import type { PublicEventRow } from "../lib/public/homepage";
    import EventRow from "./EventRow.svelte";

    interface Props {
        events: PublicEventRow[];
        divisionCode: string;
        divisionLabel: string;
        initialError?: string;
    }

    let { events, divisionCode, divisionLabel, initialError = "" }: Props = $props();
    const eventsHref = $derived(`/events?city=${encodeURIComponent(divisionCode)}`);
</script>

<section id="today" aria-labelledby="today-heading" data-reveal class="scroll-mt-28 pb-20 sm:pb-24">
    <header class="border-t border-border/80 pt-6">
        <h2 id="today-heading" class="mt-3 text-3xl font-black text-foreground sm:text-4xl">
            今日{divisionLabel}的活动
        </h2>
    </header>

    {#if initialError}
        <div
            class="mt-5 rounded-md bg-danger-subtle p-5 text-sm font-semibold text-danger"
            role="alert"
        >
            {initialError}
        </div>
    {:else if events.length > 0}
        <div class="mt-10 border-t border-border/80">
            {#each events as event (event.id)}
                <EventRow {event} />
            {/each}
        </div>
    {:else}
        <div class="mt-8 border-y border-border/80 py-10">
            <h3 class="text-xl font-black text-foreground">今天暂无本地活动</h3>
            <p class="mt-2 text-sm text-muted-foreground">
                可以进入活动目录查看这个地区接下来举办的活动
            </p>
        </div>
    {/if}

    <div class="mt-8 flex justify-end pt-6">
        <a
            href={eventsHref}
            class="group inline-flex h-12 items-center gap-3 rounded-full bg-foreground py-1 pr-1 pl-5 text-sm font-bold text-background transition-transform duration-300 ease-motion focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:outline-none active:scale-[0.98]"
        >
            浏览更多本地活动
            <span
                class="flex size-10 items-center justify-center rounded-full bg-background text-foreground transition-transform duration-300 ease-motion group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:scale-105"
            >
                <ArrowRight class="size-4" aria-hidden="true" />
            </span>
        </a>
    </div>
</section>
