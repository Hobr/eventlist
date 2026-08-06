<script lang="ts">
    import ChevronDown from "phosphor-svelte/lib/CaretDown";
    import MapPin from "phosphor-svelte/lib/MapPin";
    import { onMount, untrack } from "svelte";
    import { isRegionCode } from "../lib/divisions";
    import { parsePopularityWindow, type PopularityWindow } from "../lib/events/popularity";
    import { readDivisionPreference, writeDivisionPreference } from "../lib/division-preference";
    import type { PublicHomepageDivision } from "../lib/public/homepage";
    import {
        buildHomepageUrl,
        HOMEPAGE_DATA_EVENT,
        mergeHomepageHistoryState,
        readHomepageHistoryState,
        readHomepageResponse,
        type HomepageDataEventDetail
    } from "../lib/public/homepage-client";
    import Button from "./ui/button.svelte";
    import Alert from "./ui/alert.svelte";
    import SidePanel from "./ui/side-panel.svelte";
    import CitySelector from "./CitySelector.svelte";
    import Spinner from "./ui/spinner.svelte";

    interface Props {
        selectedDivisionCode: string;
        initialTrend: PopularityWindow;
        shortLabel?: string;
        fullLabel?: string;
        sourceLabel?: string;
    }

    type HistoryMode = "push" | "replace" | "none";

    interface LoadOptions {
        historyMode: HistoryMode;
        sourceLabel: string;
        closePanel?: boolean;
        fallbackToNavigation?: boolean;
    }

    let {
        selectedDivisionCode,
        initialTrend,
        shortLabel = "选择地区",
        fullLabel = "尚未选择地区",
        sourceLabel = ""
    }: Props = $props();

    let currentDivision = $state<PublicHomepageDivision>(
        untrack(() => ({
            code: selectedDivisionCode,
            name: shortLabel,
            label: fullLabel
        }))
    );
    let currentSourceLabel = $state(untrack(() => sourceLabel));
    let draftDivisionCode = $state(untrack(() => selectedDivisionCode));
    let pendingDivisionCode = $state<string | null>(null);
    let errorMessage = $state("");
    let fallbackHref = $state("");
    let panelOpen = $state(false);
    let requestController: AbortController | null = null;
    let requestSequence = 0;
    let wasPanelOpen = false;
    let restoreFrame: number | undefined;

    $effect(() => {
        if (panelOpen && !wasPanelOpen) {
            draftDivisionCode = currentDivision.code;
            errorMessage = "";
            fallbackHref = "";
        }
        wasPanelOpen = panelOpen;
    });

    function currentPopularityWindow() {
        return (
            readHomepageHistoryState(history.state)?.trend ??
            parsePopularityWindow(new URL(window.location.href).searchParams.get("trend"))
        );
    }

    function toDocumentHref(url: URL) {
        return `${url.pathname}${url.search}${url.hash}`;
    }

    function readApiError(body: unknown, fallback: string) {
        if (!body || typeof body !== "object" || !("error" in body)) return fallback;
        return typeof body.error === "string" ? body.error : fallback;
    }

    function commitHomepageHistory(
        mode: Exclude<HistoryMode, "none">,
        city: string,
        trend: PopularityWindow,
        nextSourceLabel: string
    ) {
        const url = buildHomepageUrl(new URL(window.location.href), city, trend);
        const state = mergeHomepageHistoryState(history.state, {
            city,
            trend,
            sourceLabel: nextSourceLabel
        });
        history[mode === "push" ? "pushState" : "replaceState"](state, "", url);
    }

    async function loadHomepage(city: string, trend: PopularityWindow, options: LoadOptions) {
        if (!isRegionCode(city)) return false;

        requestController?.abort();
        const controller = new AbortController();
        const requestId = ++requestSequence;
        requestController = controller;
        pendingDivisionCode = city;
        errorMessage = "";
        const targetUrl = buildHomepageUrl(new URL(window.location.href), city, trend);
        fallbackHref = toDocumentHref(targetUrl);

        try {
            const searchParams = new URLSearchParams({
                city,
                trend: String(trend)
            });
            const response = await fetch(`/api/homepage?${searchParams.toString()}`, {
                headers: { Accept: "application/json" },
                signal: controller.signal
            });
            const body = await response.json().catch(() => null);
            if (!response.ok) {
                throw new Error(readApiError(body, "地区活动加载失败, 请稍后重试"));
            }

            const homepage = readHomepageResponse(body, city, trend);
            if (!homepage) throw new Error("首页返回内容无效, 请稍后重试");
            if (controller.signal.aborted || requestId !== requestSequence) return false;

            if (options.historyMode !== "none") {
                commitHomepageHistory(
                    options.historyMode,
                    homepage.division.code,
                    homepage.popularity.window,
                    options.sourceLabel
                );
            }
            window.dispatchEvent(
                new CustomEvent<HomepageDataEventDetail>(HOMEPAGE_DATA_EVENT, {
                    detail: { homepage }
                })
            );
            currentDivision = homepage.division;
            currentSourceLabel = options.sourceLabel;
            draftDivisionCode = homepage.division.code;
            try {
                writeDivisionPreference(homepage.division.code);
            } catch {
                // Browser privacy settings may deny localStorage while the page remains usable.
            }
            errorMessage = "";
            fallbackHref = "";
            if (options.closePanel) panelOpen = false;
            return true;
        } catch (error) {
            if (controller.signal.aborted || requestId !== requestSequence) return false;
            errorMessage = error instanceof Error ? error.message : "地区活动加载失败, 请稍后重试";
            if (options.fallbackToNavigation) {
                window.location.assign(targetUrl.href);
            }
            return false;
        } finally {
            if (requestController === controller) requestController = null;
            if (requestId === requestSequence) pendingDivisionCode = null;
        }
    }

    function handleDraftChange(value: string) {
        draftDivisionCode = value;
        errorMessage = "";
        fallbackHref = "";
    }

    function applyDraftDivision() {
        if (!isRegionCode(draftDivisionCode) || pendingDivisionCode !== null) return;
        if (draftDivisionCode === currentDivision.code) {
            panelOpen = false;
            return;
        }

        void loadHomepage(draftDivisionCode, currentPopularityWindow(), {
            historyMode: "push",
            sourceLabel: "手动选择",
            closePanel: true
        });
    }

    onMount(() => {
        const initialState = mergeHomepageHistoryState(history.state, {
            city: currentDivision.code,
            trend: initialTrend,
            sourceLabel: currentSourceLabel
        });
        history.replaceState(initialState, "", window.location.href);

        const handlePopState = () => {
            const url = new URL(window.location.href);
            const state = readHomepageHistoryState(history.state);
            const urlCity = url.searchParams.get("city")?.trim() ?? "";
            const city = state?.city ?? (isRegionCode(urlCity) ? urlCity : null);
            if (!city) {
                window.location.assign(window.location.href);
                return;
            }

            const trend = state?.trend ?? parsePopularityWindow(url.searchParams.get("trend"));
            void loadHomepage(city, trend, {
                historyMode: "none",
                sourceLabel: state?.sourceLabel ?? "手动选择",
                fallbackToNavigation: true
            });
        };
        window.addEventListener("popstate", handlePopState);

        const url = new URL(window.location.href);
        let savedDivision: string | null = null;
        try {
            savedDivision = readDivisionPreference();
        } catch {
            savedDivision = null;
        }
        const divisionToRestore = savedDivision;
        if (
            !url.searchParams.has("city") &&
            divisionToRestore &&
            divisionToRestore !== currentDivision.code
        ) {
            restoreFrame = requestAnimationFrame(() => {
                restoreFrame = undefined;
                void loadHomepage(divisionToRestore, initialTrend, {
                    historyMode: "replace",
                    sourceLabel: "已保存地区"
                });
            });
        }

        return () => {
            window.removeEventListener("popstate", handlePopState);
            if (restoreFrame !== undefined) cancelAnimationFrame(restoreFrame);
            requestController?.abort();
            requestSequence += 1;
        };
    });
</script>

<SidePanel
    bind:open={panelOpen}
    title="浏览地区"
    description={currentSourceLabel
        ? `当前：${currentDivision.label} · ${currentSourceLabel}`
        : `当前：${currentDivision.label}`}
    triggerAriaLabel={`更改地区, 当前为${currentDivision.label}`}
    triggerClass="location-trigger"
    contentClass="location-sheet"
>
    {#snippet trigger()}
        <MapPin size={16} aria-hidden="true" />
        <span class="location-name">{currentDivision.name}</span>
        {#if pendingDivisionCode}
            <Spinner label="正在切换地区" />
        {:else}
            <ChevronDown size={13} aria-hidden="true" />
        {/if}
    {/snippet}

    {#snippet footer()}
        <div class="location-footer">
            <Button
                class="location-apply"
                disabled={!isRegionCode(draftDivisionCode) || pendingDivisionCode !== null}
                onclick={applyDraftDivision}
            >
                {#if pendingDivisionCode}
                    <Spinner label="正在应用地区" />
                    正在应用
                {:else}
                    应用地区
                {/if}
            </Button>
            {#if pendingDivisionCode}
                <p class="location-status" aria-live="polite">
                    正在加载所选地区, 当前内容仍可继续浏览
                </p>
            {/if}
        </div>
    {/snippet}

    <div class="location-content">
        <CitySelector
            selectedDivisionCode={draftDivisionCode}
            label="选择省、市和区县"
            navigateOnChange={false}
            onchange={handleDraftChange}
        />

        {#if errorMessage}
            <Alert tone="danger">
                <p class="location-error">{errorMessage}</p>
                {#if fallbackHref}
                    <a href={fallbackHref} class="location-fallback">
                        使用普通页面导航打开该地区
                    </a>
                {/if}
            </Alert>
        {/if}
    </div>
</SidePanel>
