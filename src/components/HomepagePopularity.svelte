<script lang="ts">
    import { Spinner } from "flowbite-svelte";
    import {
        ArrowUpRightFromSquareOutline as ArrowUpRight,
        MapPinOutline as MapPin
    } from "flowbite-svelte-icons";
    import { onDestroy, onMount, untrack } from "svelte";
    import { getDivisionLabel } from "../lib/divisions";
    import { POPULARITY_WINDOWS, type PopularityWindow } from "../lib/events/popularity";
    import type { PublicHomepagePopularity, PublicPopularEvent } from "../lib/public/homepage";
    import {
        buildHomepageUrl,
        homepagePopularityCacheKey,
        mergeHomepageHistoryState,
        readHomepageHistoryState,
        readPopularityResponse
    } from "../lib/public/homepage-client";

    interface Props {
        initialPopularity: PublicHomepagePopularity;
        divisionCode: string;
        divisionLabel: string;
        initialError?: string;
    }

    let { initialPopularity, divisionCode, divisionLabel, initialError = "" }: Props = $props();

    const numberFormat = new Intl.NumberFormat("zh-CN");
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
        const eventSignature = [snapshot.local, snapshot.nationwide]
            .map((events) =>
                events
                    .map(
                        (event) =>
                            `${event.id}:${event.title}:${event.division_code}:${event.start_date}:${event.unique_visitors}`
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
        return `/?${searchParams.toString()}#popular`;
    }

    function updateUrl(city: string, trend: PopularityWindow) {
        const url = buildHomepageUrl(new URL(window.location.href), city, trend);
        url.hash = "popular";
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
                        : "热门活动加载失败, 请稍后重试";
                throw new Error(message);
            }

            const nextPopularity = readPopularityResponse(body, trend);
            if (!nextPopularity) throw new Error("热门活动返回内容无效, 请稍后重试");
            if (requestId !== requestSequence || requestCity !== divisionCode) return;

            cache.set(cacheKey, nextPopularity);
            popularity = nextPopularity;
            pendingWindow = null;
            errorMessage = "";
            updateUrl(requestCity, trend);
        } catch (error) {
            if (controller.signal.aborted || requestId !== requestSequence) return;
            pendingWindow = null;
            errorMessage = error instanceof Error ? error.message : "热门活动加载失败, 请稍后重试";
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

{#snippet popularList(
    headingId: string,
    title: string,
    scope: string,
    events: PublicPopularEvent[]
)}
    <section aria-labelledby={headingId} class="min-w-0 border-t border-border/80 pt-5">
        <header class="flex items-end justify-between gap-4 pb-3">
            <div class="min-w-0">
                <h3 id={headingId} class="text-lg font-black text-foreground">{title}</h3>
                <p class="mt-1 text-xs text-muted">{scope}</p>
            </div>
        </header>

        {#if events.length > 0}
            <ol class="divide-y divide-border/75">
                {#each events as event, index (event.id)}
                    <li>
                        <a
                            href={`/events/${event.id}`}
                            class="group grid min-w-0 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 py-3 transition-[transform,background-color] duration-300 ease-motion hover:translate-x-1 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none active:scale-[0.995]"
                        >
                            <span class="font-mono text-lg font-black text-primary">
                                {String(index + 1).padStart(2, "0")}
                            </span>
                            <span class="min-w-0">
                                <strong
                                    class="block truncate text-sm text-foreground transition-colors duration-300 ease-motion group-hover:text-primary sm:text-base"
                                >
                                    {event.title}
                                </strong>
                                <span
                                    class="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted"
                                >
                                    <MapPin class="size-3.5 shrink-0" aria-hidden="true" />
                                    <span class="truncate">
                                        {getDivisionLabel(event.division_code) ?? "未知地区"}
                                    </span>
                                    <span class="shrink-0">{event.start_date}</span>
                                </span>
                            </span>
                            <span class="flex shrink-0 items-center gap-2 text-right">
                                <span>
                                    <strong class="block font-mono text-sm text-foreground">
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
            <div class="border-t border-border py-8">
                <p class="text-sm font-semibold text-muted-foreground">暂无足够浏览数据</p>
                <p class="mt-1 text-xs text-muted">详情页产生访问后会显示排行</p>
            </div>
        {/if}
    </section>
{/snippet}

<section
    id="popular"
    aria-labelledby="popular-heading"
    data-reveal
    class="scroll-mt-28 py-20 sm:py-24"
>
    <header
        class="flex flex-col gap-5 border-t border-border/80 pt-6 sm:flex-row sm:items-end sm:justify-between"
    >
        <div>
            <h2 id="popular-heading" class="mt-3 text-3xl font-black text-foreground sm:text-4xl">
                热门活动
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
                    id={`popular-window-${trend}`}
                    href={trendHref(trend)}
                    role="tab"
                    aria-selected={selected}
                    aria-controls="popular-results-panel"
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
                            aria-label={`正在加载近 ${trend} 日热门活动`}
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
        id="popular-results-panel"
        role="tabpanel"
        aria-labelledby={`popular-window-${popularity.window}`}
        aria-live="polite"
        aria-busy={pendingWindow !== null}
        class="mt-10 grid gap-12 lg:grid-cols-2"
    >
        {@render popularList(
            "local-popular-heading",
            "本地热门",
            `${divisionLabel}, 近 ${popularity.window} 日`,
            popularity.local
        )}
        {@render popularList(
            "nationwide-popular-heading",
            "全国热门",
            `全国范围, 近 ${popularity.window} 日`,
            popularity.nationwide
        )}
    </div>
</section>
