<script lang="ts">
    import ArrowRight from "phosphor-svelte/lib/ArrowRight";
    import ChevronLeft from "phosphor-svelte/lib/CaretLeft";
    import ChevronRight from "phosphor-svelte/lib/CaretRight";
    import MapPinned from "phosphor-svelte/lib/MapPin";
    import Pause from "phosphor-svelte/lib/Pause";
    import Play from "phosphor-svelte/lib/Play";
    import { onMount, untrack } from "svelte";
    import { getDisplayCoverUrl } from "../lib/events/cover";
    import { formatEventSchedule } from "../lib/events/datetime";
    import { getEventScaleLabel } from "../lib/events/options";
    import type { PublicFeaturedEvent } from "../lib/public/homepage";
    import Button from "./ui/button.svelte";

    interface Props {
        events: PublicFeaturedEvent[];
        divisionLabel: string;
        catalogueHref: string;
    }

    let { events, divisionLabel, catalogueHref }: Props = $props();
    const fallbackCover = "/images/event-fallback.webp";
    let index = $state(0);
    let hovered = $state(false);
    let focusWithin = $state(false);
    let userPaused = $state(false);
    let reducedMotion = $state(false);
    let carouselShell = $state<HTMLDivElement>();

    const snapshotKey = $derived(
        `${divisionLabel}:${events.map((event) => `${event.id}:${event.cover_url ?? ""}`).join(",")}`
    );
    const activeEvent = $derived(events[index] ?? events[0] ?? null);
    const activeCover = $derived(getDisplayCoverUrl(activeEvent?.cover_url) || fallbackCover);

    $effect(() => {
        const nextSnapshotKey = snapshotKey;
        untrack(() => {
            void nextSnapshotKey;
            index = 0;
            hovered = false;
            focusWithin = false;
            userPaused = false;
        });
    });

    onMount(() => {
        const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
        const updateReducedMotion = () => (reducedMotion = mediaQuery.matches);
        const startHover = () => (hovered = true);
        const endHover = () => (hovered = false);
        const startFocus = () => (focusWithin = true);
        updateReducedMotion();
        mediaQuery.addEventListener("change", updateReducedMotion);
        carouselShell?.addEventListener("mouseenter", startHover);
        carouselShell?.addEventListener("mouseleave", endHover);
        carouselShell?.addEventListener("focusin", startFocus);
        carouselShell?.addEventListener("focusout", handleFocusOut);
        carouselShell?.addEventListener("keydown", handleKeydown);
        return () => {
            mediaQuery.removeEventListener("change", updateReducedMotion);
            carouselShell?.removeEventListener("mouseenter", startHover);
            carouselShell?.removeEventListener("mouseleave", endHover);
            carouselShell?.removeEventListener("focusin", startFocus);
            carouselShell?.removeEventListener("focusout", handleFocusOut);
            carouselShell?.removeEventListener("keydown", handleKeydown);
        };
    });

    $effect(() => {
        const currentIndex = index;
        if (events.length < 2 || hovered || focusWithin || userPaused || reducedMotion) return;
        const timer = window.setInterval(() => {
            if (carouselShell?.matches(":hover") || carouselShell?.contains(document.activeElement))
                return;
            index = (currentIndex + 1) % events.length;
        }, 6000);
        return () => window.clearInterval(timer);
    });

    function handleCoverError(event: Event) {
        const image = event.currentTarget;
        if (!(image instanceof HTMLImageElement) || image.dataset.fallbackApplied === "true")
            return;
        image.dataset.fallbackApplied = "true";
        image.src = fallbackCover;
    }

    function handleFocusOut(event: FocusEvent) {
        const nextTarget = event.relatedTarget;
        if (!(nextTarget instanceof Node) || !event.currentTarget?.contains(nextTarget))
            focusWithin = false;
    }

    function handleKeydown(event: KeyboardEvent) {
        if (events.length < 2) return;
        if (event.key === "ArrowLeft") {
            event.preventDefault();
            index = (index - 1 + events.length) % events.length;
        } else if (event.key === "ArrowRight") {
            event.preventDefault();
            index = (index + 1) % events.length;
        }
    }

    function changeSlide(direction: -1 | 1) {
        index = (index + direction + events.length) % events.length;
    }

    $effect(() => {
        if (!carouselShell) return;
        carouselShell.tabIndex = events.length > 1 ? 0 : -1;
    });
</script>

<div
    class="featured-editorial"
    role="group"
    aria-label={`${divisionLabel}推荐活动`}
    aria-roledescription="carousel"
    bind:this={carouselShell}
>
    <div class="featured-main">
        <img
            src={activeCover}
            alt={activeEvent ? `${activeEvent.title} 封面` : ""}
            width="1200"
            height="675"
            loading="eager"
            decoding="async"
            fetchpriority="high"
            referrerpolicy="no-referrer"
            onerror={handleCoverError}
        />
        <div class="featured-shade"></div>
        <div class="featured-copy">
            <p class="featured-location">
                <MapPinned size={17} aria-hidden="true" />
                {divisionLabel}
            </p>
            {#if activeEvent}
                <div>
                    <p class="featured-kicker">本期推荐</p>
                    <h1>{activeEvent.title}</h1>
                    <p class="featured-meta">
                        {getEventScaleLabel(activeEvent.scale)} · {formatEventSchedule(activeEvent)}
                    </p>
                    <a href={`/events/${activeEvent.id}`} class="featured-link">
                        查看活动 <ArrowRight size={18} aria-hidden="true" />
                    </a>
                </div>
            {:else}
                <div>
                    <h1>这个地区还没有近期活动</h1>
                    <p class="featured-meta">可以切换地区, 或先浏览完整活动目录</p>
                    <a href={catalogueHref} class="featured-link">
                        浏览活动目录 <ArrowRight size={18} aria-hidden="true" />
                    </a>
                </div>
            {/if}
        </div>
        {#if events.length > 1}
            <div class="featured-controls">
                <Button
                    size="icon"
                    variant="ghost"
                    ariaLabel="上一张"
                    onclick={() => changeSlide(-1)}
                >
                    <ChevronLeft size={20} aria-hidden="true" />
                </Button>
                <Button
                    size="icon"
                    variant="ghost"
                    ariaLabel={userPaused ? "恢复自动播放" : "暂停自动播放"}
                    aria-pressed={userPaused}
                    onclick={() => (userPaused = !userPaused)}
                >
                    {#if userPaused}<Play size={19} aria-hidden="true" />{:else}<Pause
                            size={19}
                            aria-hidden="true"
                        />{/if}
                </Button>
                <Button
                    size="icon"
                    variant="ghost"
                    ariaLabel="下一张"
                    onclick={() => changeSlide(1)}
                >
                    <ChevronRight size={20} aria-hidden="true" />
                </Button>
            </div>
        {/if}
    </div>

    {#if events.length > 1}
        <ol class="featured-rail" aria-label="推荐活动列表">
            {#each events as event, eventIndex (event.id)}
                <li>
                    <button
                        type="button"
                        class="featured-rail-button"
                        aria-current={eventIndex === index ? "true" : undefined}
                        onclick={() => (index = eventIndex)}
                    >
                        <span>{String(eventIndex + 1).padStart(2, "0")}</span>
                        <strong>{event.title}</strong>
                        <small>{formatEventSchedule(event)}</small>
                    </button>
                </li>
            {/each}
        </ol>
    {/if}
</div>
