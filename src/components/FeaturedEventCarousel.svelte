<script lang="ts">
    import { Carousel, CarouselIndicators, Controls } from "flowbite-svelte";
    import {
        ArrowRightOutline as ArrowRight,
        ChevronLeftOutline as ChevronLeft,
        ChevronRightOutline as ChevronRight,
        MapPinAltOutline as MapPinned,
        PauseOutline as Pause,
        PlayOutline as Play
    } from "flowbite-svelte-icons";
    import { onMount, untrack } from "svelte";
    import { fade } from "svelte/transition";
    import { SITE_NAME, SITE_SLOGAN } from "../lib/site";
    import { getDisplayCoverUrl } from "../lib/events/cover";
    import { formatEventSchedule } from "../lib/events/datetime";
    import { getEventScaleLabel } from "../lib/events/options";
    import type { PublicFeaturedEvent } from "../lib/public/homepage";

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

    const images = $derived(
        events.map((event, eventIndex) => ({
            src: getDisplayCoverUrl(event.cover_url) || fallbackCover,
            alt: `${event.title} 封面`,
            loading: eventIndex === 0 ? ("eager" as const) : ("lazy" as const),
            decoding: "async" as const,
            referrerpolicy: "no-referrer" as const,
            onerror: handleCoverError
        }))
    );
    const snapshotKey = $derived(
        `${divisionLabel}:${events
            .map((event) => `${event.id}:${event.cover_url ?? ""}`)
            .join(",")}`
    );

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
        const shell = carouselShell;
        const updateReducedMotion = () => {
            reducedMotion = mediaQuery.matches;
        };
        const handleMouseEnter = () => {
            hovered = true;
        };
        const handleMouseLeave = () => {
            hovered = false;
        };
        const handleFocusIn = () => {
            focusWithin = true;
        };

        updateReducedMotion();
        mediaQuery.addEventListener("change", updateReducedMotion);
        shell?.addEventListener("mouseenter", handleMouseEnter);
        shell?.addEventListener("mouseleave", handleMouseLeave);
        shell?.addEventListener("focusin", handleFocusIn);
        shell?.addEventListener("focusout", handleFocusOut);
        shell?.addEventListener("keydown", handleKeydown);

        return () => {
            mediaQuery.removeEventListener("change", updateReducedMotion);
            shell?.removeEventListener("mouseenter", handleMouseEnter);
            shell?.removeEventListener("mouseleave", handleMouseLeave);
            shell?.removeEventListener("focusin", handleFocusIn);
            shell?.removeEventListener("focusout", handleFocusOut);
            shell?.removeEventListener("keydown", handleKeydown);
        };
    });

    $effect(() => {
        const currentIndex = index;
        if (events.length < 2 || hovered || focusWithin || userPaused || reducedMotion) return;

        const timer = window.setInterval(() => {
            if (
                carouselShell?.matches(":hover") ||
                carouselShell?.contains(document.activeElement)
            ) {
                return;
            }

            index = (currentIndex + 1) % events.length;
        }, 6000);

        return () => window.clearInterval(timer);
    });

    function handleCoverError(event: Event) {
        const image = event.currentTarget;
        if (!(image instanceof HTMLImageElement) || image.dataset.fallbackApplied === "true") {
            return;
        }

        image.dataset.fallbackApplied = "true";
        image.src = fallbackCover;
    }

    function handleFocusOut(event: FocusEvent) {
        const nextTarget = event.relatedTarget;
        if (!(nextTarget instanceof Node) || !event.currentTarget?.contains(nextTarget)) {
            focusWithin = false;
        }
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
</script>

{#snippet brandHeader(reserveControlSpace = false)}
    <header class="max-w-3xl">
        <p
            class={reserveControlSpace
                ? "inline-flex max-w-[55%] items-center gap-2 text-sm font-semibold text-white/80 sm:max-w-[70%]"
                : "inline-flex max-w-full items-center gap-2 text-sm font-semibold text-white/80"}
        >
            <MapPinned class="size-4 shrink-0" aria-hidden="true" />
            <span class="truncate">{divisionLabel}</span>
        </p>
    </header>
{/snippet}

{#snippet recommendation(event: PublicFeaturedEvent)}
    <div class="pointer-events-auto max-w-3xl pb-10 sm:pb-8">
        <h1 class="mt-2 text-2xl leading-tight font-bold text-balance text-white sm:text-3xl">
            {event.title}
        </h1>
        <p class="mt-3 font-mono text-sm text-white/78 tabular-nums">
            {getEventScaleLabel(event.scale)} · {formatEventSchedule(event)}
        </p>
        <a
            href={`/events/${event.id}`}
            class="group mt-6 inline-flex h-12 items-center gap-3 rounded-full bg-white py-1 pr-1 pl-5 text-sm font-bold text-black transition-[transform,background-color] duration-300 ease-motion hover:bg-white/92 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none active:scale-[0.98]"
        >
            查看
            <span
                class="flex size-10 items-center justify-center rounded-full bg-black text-white transition-transform duration-300 ease-motion group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:scale-105"
            >
                <ArrowRight class="size-4" aria-hidden="true" />
            </span>
        </a>
    </div>
{/snippet}

{#snippet emptyRecommendation()}
    <div class="pointer-events-auto max-w-xl">
        <h2 class="text-2xl font-bold text-white">这个地区还没有近期活动</h2>
        <p class="mt-2 text-sm leading-6 text-white/75">可以切换地区，或先浏览完整活动目录。</p>
        <a
            href={catalogueHref}
            class="group mt-6 inline-flex h-12 items-center gap-3 rounded-full bg-white py-1 pr-1 pl-5 text-sm font-bold text-black transition-transform duration-300 ease-motion focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none active:scale-[0.98]"
        >
            浏览活动目录
            <span class="flex size-10 items-center justify-center rounded-full bg-black text-white">
                <ArrowRight class="size-4" aria-hidden="true" />
            </span>
        </a>
    </div>
{/snippet}

{#if events.length > 1}
    <div bind:this={carouselShell}>
        <Carousel
            {images}
            bind:index
            duration={0}
            slideDuration={reducedMotion ? 0 : 500}
            aria-label={`${divisionLabel}推荐活动`}
            aria-roledescription="carousel"
            role="region"
            tabindex={0}
            class="h-[31rem] rounded-md bg-foreground bg-cover bg-center text-white shadow-elevated ring-1 ring-black/10 sm:h-[35rem] lg:h-[38rem] xl:!h-[38rem] 2xl:!h-[38rem]"
            style={`background-image: url('${fallbackCover}')`}
            classes={{ slide: "size-full object-cover" }}
        >
            {#snippet children(carouselIndex)}
                {@const event = events[carouselIndex] ?? events[0]}
                <div class="pointer-events-none absolute inset-0 z-10 bg-black/60"></div>
                <div
                    class="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between gap-12 p-6 sm:p-10 lg:p-14"
                >
                    {@render brandHeader(true)}
                    {#if event}
                        {#key event.id}
                            <div in:fade={{ duration: reducedMotion ? 0 : 220 }}>
                                {@render recommendation(event)}
                            </div>
                        {/key}
                    {/if}
                </div>

                <Controls>
                    {#snippet children(changeSlide)}
                        <div
                            class="absolute top-4 right-4 z-30 flex items-center gap-2 sm:top-6 sm:right-6"
                        >
                            <button
                                type="button"
                                aria-label="上一张"
                                title="上一张"
                                class="flex size-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-[transform,background-color] duration-300 ease-motion hover:bg-black/75 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none active:scale-95"
                                onclick={() => changeSlide(false)}
                            >
                                <ChevronLeft class="size-5" aria-hidden="true" />
                            </button>
                            <button
                                type="button"
                                aria-label={userPaused ? "恢复自动播放" : "暂停自动播放"}
                                aria-pressed={userPaused}
                                title={userPaused ? "恢复自动播放" : "暂停自动播放"}
                                class="flex size-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-[transform,background-color] duration-300 ease-motion hover:bg-black/75 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none active:scale-95"
                                onclick={() => (userPaused = !userPaused)}
                            >
                                {#if userPaused}
                                    <Play class="size-5" aria-hidden="true" />
                                {:else}
                                    <Pause class="size-5" aria-hidden="true" />
                                {/if}
                            </button>
                            <button
                                type="button"
                                aria-label="下一张"
                                title="下一张"
                                class="flex size-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-[transform,background-color] duration-300 ease-motion hover:bg-black/75 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none active:scale-95"
                                onclick={() => changeSlide(true)}
                            >
                                <ChevronRight class="size-5" aria-hidden="true" />
                            </button>
                        </div>
                    {/snippet}
                </Controls>
                <CarouselIndicators
                    class="bottom-5 z-30"
                    activeClass="bg-white opacity-100"
                    inactiveClass="bg-white/55 opacity-100 hover:bg-white/80"
                />
            {/snippet}
        </Carousel>
    </div>
{:else}
    {@const event = events[0] ?? null}
    {@const coverUrl = getDisplayCoverUrl(event?.cover_url)}
    <section
        aria-labelledby="home-heading"
        class="relative isolate overflow-hidden rounded-md bg-foreground text-white shadow-elevated ring-1 ring-black/10"
    >
        <img
            src={fallbackCover}
            alt=""
            width="1200"
            height="675"
            loading="eager"
            decoding="async"
            class="absolute inset-0 size-full object-cover"
        />
        {#if coverUrl}
            <img
                src={coverUrl}
                alt=""
                width="1200"
                height="675"
                loading="eager"
                decoding="async"
                fetchpriority="high"
                referrerpolicy="no-referrer"
                class="absolute inset-0 size-full object-cover"
                onerror={handleCoverError}
            />
        {/if}
        <div class="absolute inset-0 bg-black/60"></div>
        <div
            class="relative flex min-h-[31rem] flex-col justify-between gap-12 p-6 sm:min-h-[35rem] sm:p-10 lg:min-h-[38rem] lg:p-14"
        >
            {@render brandHeader()}
            {#if event}
                {@render recommendation(event)}
            {:else}
                {@render emptyRecommendation()}
            {/if}
        </div>
    </section>
{/if}
