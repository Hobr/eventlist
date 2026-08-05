<script lang="ts">
    import { Spinner } from "flowbite-svelte";
    import { onDestroy, onMount, untrack } from "svelte";
    import { POPULARITY_WINDOWS, type PopularityWindow } from "../lib/events/popularity";
    import type { PublicHomepagePopularity } from "../lib/public/homepage";
    import {
        buildHomepageUrl,
        homepagePopularityCacheKey,
        mergeHomepageHistoryState,
        readHomepageHistoryState,
        readPopularityResponse
    } from "../lib/public/homepage-client";
    import HomepageRankedList from "./HomepageRankedList.svelte";

    interface Props {
        initialPopularity: PublicHomepagePopularity;
        divisionCode: string;
        divisionLabel: string;
        initialError?: string;
    }

    let { initialPopularity, divisionCode, divisionLabel, initialError = "" }: Props = $props();

    const initialSnapshot = untrack(() => initialPopularity);
    const initialErrorMessage = untrack(() => initialError);
    const initialDivisionCode = untrack(() => divisionCode);
    const cache = new Map<string, PublicHomepagePopularity>();
    if (!initialErrorMessage) {
        cache.set(
            homepagePopularityCacheKey(initialDivisionCode, initialSnapshot.window),
            initialSnapshot
        );
    }

    let popularity = $state(initialSnapshot);
    let pendingWindow = $state<PopularityWindow | null>(null);
    let errorMessage = $state(initialErrorMessage);
    let hydrated = $state(false);
    let mobileScene = $state<"unended" | "unopened">("unended");
    let requestController: AbortController | null = null;
    let requestSequence = 0;
    let lastPropSignature = snapshotSignature(
        initialDivisionCode,
        initialSnapshot,
        initialErrorMessage
    );

    onMount(() => {
        hydrated = true;
    });

    onDestroy(() => {
        requestController?.abort();
        requestSequence += 1;
    });

    $effect(() => {
        const nextPopularity = initialPopularity;
        const nextDivisionCode = divisionCode;
        const nextError = initialError;
        const nextSignature = snapshotSignature(nextDivisionCode, nextPopularity, nextError);
        if (nextSignature === lastPropSignature) return;
        lastPropSignature = nextSignature;

        untrack(() => {
            requestController?.abort();
            requestController = null;
            requestSequence += 1;
            popularity = nextPopularity;
            pendingWindow = null;
            errorMessage = nextError;
            if (!nextError) {
                cache.set(
                    homepagePopularityCacheKey(nextDivisionCode, nextPopularity.window),
                    nextPopularity
                );
            }
        });
    });

    function snapshotSignature(
        city: string,
        snapshot: PublicHomepagePopularity,
        snapshotError: string
    ) {
        const eventSignature = [
            snapshot.unopened.local,
            snapshot.unopened.nationwide,
            snapshot.unended.local,
            snapshot.unended.nationwide
        ]
            .map((events) =>
                events
                    .map(
                        (event) =>
                            `${event.id}:${event.title}:${event.division_code}:${event.start_date}:${event.admission_start_date}:${event.unique_visitors}`
                    )
                    .join(",")
            )
            .join("|");
        return `${city}:${snapshot.window}:${snapshotError}:${eventSignature}`;
    }

    function trendHref(trend: PopularityWindow) {
        const searchParams = new URLSearchParams({
            city: divisionCode,
            trend: String(trend)
        });
        return `/?${searchParams.toString()}#intent-feed`;
    }

    function updateUrl(city: string, trend: PopularityWindow) {
        const url = buildHomepageUrl(new URL(window.location.href), city, trend);
        url.hash = "intent-feed";
        const currentState = readHomepageHistoryState(history.state);
        const nextState = mergeHomepageHistoryState(history.state, {
            city,
            trend,
            sourceLabel: currentState?.sourceLabel ?? "手动选择"
        });
        history.replaceState(nextState, "", url);
    }

    async function selectWindow(event: MouseEvent, trend: PopularityWindow) {
        const link = event.currentTarget;
        if (
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey ||
            !(link instanceof HTMLAnchorElement) ||
            link.target === "_blank"
        ) {
            return;
        }

        event.preventDefault();
        if (pendingWindow === trend) return;

        requestController?.abort();
        requestController = null;
        const requestId = ++requestSequence;
        const requestCity = divisionCode;
        const cacheKey = homepagePopularityCacheKey(requestCity, trend);
        const cached = cache.get(cacheKey);
        if (cached) {
            popularity = cached;
            pendingWindow = null;
            errorMessage = "";
            updateUrl(requestCity, trend);
            return;
        }

        const controller = new AbortController();
        requestController = controller;
        pendingWindow = trend;
        errorMessage = "";

        try {
            const searchParams = new URLSearchParams({
                city: requestCity,
                trend: String(trend)
            });
            const response = await fetch(`/api/popularity?${searchParams.toString()}`, {
                headers: { Accept: "application/json" },
                signal: controller.signal
            });
            const body = await response.json().catch(() => null);
            if (!response.ok) {
                const message =
                    body && typeof body === "object" && "error" in body
                        ? String(body.error)
                        : "活动榜单加载失败, 请稍后重试";
                throw new Error(message);
            }

            const nextPopularity = readPopularityResponse(body, trend);
            if (!nextPopularity) throw new Error("活动榜单返回内容无效, 请稍后重试");
            if (requestId !== requestSequence || requestCity !== divisionCode) return;

            cache.set(cacheKey, nextPopularity);
            popularity = nextPopularity;
            pendingWindow = null;
            errorMessage = "";
            updateUrl(requestCity, trend);
        } catch (error) {
            if (controller.signal.aborted || requestId !== requestSequence) return;
            pendingWindow = null;
            errorMessage = error instanceof Error ? error.message : "活动榜单加载失败, 请稍后重试";
        } finally {
            if (requestController === controller) requestController = null;
        }
    }

    function handleTabKeydown(event: KeyboardEvent, currentIndex: number) {
        let nextIndex: number | null = null;
        if (event.key === "ArrowLeft") {
            nextIndex = (currentIndex - 1 + POPULARITY_WINDOWS.length) % POPULARITY_WINDOWS.length;
        } else if (event.key === "ArrowRight") {
            nextIndex = (currentIndex + 1) % POPULARITY_WINDOWS.length;
        } else if (event.key === "Home") {
            nextIndex = 0;
        } else if (event.key === "End") {
            nextIndex = POPULARITY_WINDOWS.length - 1;
        }

        if (nextIndex === null) return;
        event.preventDefault();
        const tablist = (event.currentTarget as HTMLElement).closest('[role="tablist"]');
        const tabs = tablist?.querySelectorAll<HTMLAnchorElement>('[role="tab"]');
        tabs?.[nextIndex]?.focus();
    }
</script>

<section
    id="intent-feed"
    aria-labelledby="intent-feed-heading"
    data-reveal
    class="scroll-mt-28 py-20 sm:py-24"
>
    <header
        class="flex flex-col gap-5 border-t border-border/80 pt-6 sm:flex-row sm:items-end sm:justify-between"
    >
        <div>
            <h2 id="intent-feed-heading" class="text-3xl font-black text-foreground sm:text-4xl">
                活动发现
            </h2>
        </div>
        <div
            class="grid h-10 w-full grid-cols-3 overflow-hidden rounded-full bg-surface-subtle p-1 sm:w-60"
            aria-label="热度统计时间范围"
            role="tablist"
        >
            {#each POPULARITY_WINDOWS as trend, trendIndex}
                {@const selected = popularity.window === trend}
                <a
                    id={`intent-window-${trend}`}
                    href={trendHref(trend)}
                    role="tab"
                    aria-selected={selected}
                    aria-controls="intent-results"
                    aria-busy={pendingWindow === trend}
                    tabindex={hydrated && !selected ? -1 : 0}
                    class:bg-primary={selected}
                    class:text-primary-foreground={selected}
                    class:text-muted-foreground={!selected}
                    class:hover:text-foreground={!selected}
                    class="inline-flex items-center justify-center gap-1.5 rounded-full px-3 text-sm font-bold transition-[transform,background-color,color] duration-300 ease-motion focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none active:scale-[0.98]"
                    onclick={(event) => void selectWindow(event, trend)}
                    onkeydown={(event) => handleTabKeydown(event, trendIndex)}
                >
                    {#if pendingWindow === trend}
                        <Spinner
                            size="4"
                            class="size-3.5"
                            aria-label={`正在加载近 ${trend} 日活动榜单`}
                        />
                    {/if}
                    {trend} 日
                </a>
            {/each}
        </div>
    </header>

    {#if errorMessage}
        <div
            class="mt-5 rounded-md bg-danger-subtle p-5 text-sm font-semibold text-danger"
            role="alert"
        >
            {errorMessage}
        </div>
    {/if}

    <div
        class:pointer-events-none={!hydrated}
        class:invisible={!hydrated}
        class="mt-8 grid h-10 grid-cols-2 rounded-full bg-surface-subtle p-1 lg:hidden"
        role="group"
        aria-label="活动场景"
        aria-hidden={!hydrated}
    >
        <button
            type="button"
            aria-pressed={mobileScene === "unended"}
            tabindex={hydrated ? 0 : -1}
            class:bg-primary={mobileScene === "unended"}
            class:text-primary-foreground={mobileScene === "unended"}
            class:text-muted-foreground={mobileScene !== "unended"}
            class="rounded-full px-3 text-sm font-bold focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
            onclick={() => (mobileScene = "unended")}
        >
            未结束
        </button>
        <button
            type="button"
            aria-pressed={mobileScene === "unopened"}
            tabindex={hydrated ? 0 : -1}
            class:bg-primary={mobileScene === "unopened"}
            class:text-primary-foreground={mobileScene === "unopened"}
            class:text-muted-foreground={mobileScene !== "unopened"}
            class="rounded-full px-3 text-sm font-bold focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
            onclick={() => (mobileScene = "unopened")}
        >
            未开票
        </button>
    </div>

    <div
        id="intent-results"
        aria-live="polite"
        aria-busy={pendingWindow !== null}
        class="mt-10 grid gap-14 lg:grid-cols-2 lg:gap-0"
    >
        <section
            aria-labelledby="unended-heading"
            class:hidden={hydrated && mobileScene !== "unended"}
            class="order-1 min-w-0 lg:order-2 lg:block lg:border-l lg:border-border/80 lg:pl-10"
        >
            <header class="mb-8">
                <h3 id="unended-heading" class="text-2xl font-black text-foreground">未结束</h3>
                <p class="mt-2 text-sm text-muted-foreground">正在进行和即将开始</p>
            </header>
            <div class="grid gap-10">
                <HomepageRankedList
                    headingId="unended-local-heading"
                    title="本地热门"
                    scope={`${divisionLabel}, 近 ${popularity.window} 日`}
                    scene="unended"
                    events={popularity.unended.local}
                />
                <HomepageRankedList
                    headingId="unended-nationwide-heading"
                    title="全国热门"
                    scope={`全国, 近 ${popularity.window} 日`}
                    scene="unended"
                    events={popularity.unended.nationwide}
                />
            </div>
        </section>

        <section
            aria-labelledby="unopened-heading"
            class:hidden={hydrated && mobileScene !== "unopened"}
            class="order-2 min-w-0 lg:order-1 lg:block lg:pr-10"
        >
            <header class="mb-8">
                <h3 id="unopened-heading" class="text-2xl font-black text-foreground">未开票</h3>
                <p class="mt-2 text-sm text-muted-foreground">未来 14 日内开始售票</p>
            </header>
            <div class="grid gap-10">
                <HomepageRankedList
                    headingId="unopened-local-heading"
                    title="本地热门"
                    scope={`${divisionLabel}, 近 ${popularity.window} 日`}
                    scene="unopened"
                    events={popularity.unopened.local}
                />
                <HomepageRankedList
                    headingId="unopened-nationwide-heading"
                    title="全国热门"
                    scope={`全国, 近 ${popularity.window} 日`}
                    scene="unopened"
                    events={popularity.unopened.nationwide}
                />
            </div>
        </section>
    </div>
</section>
