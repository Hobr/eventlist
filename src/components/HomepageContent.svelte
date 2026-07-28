<script lang="ts">
    import { onMount, untrack } from "svelte";
    import type { PublicHomepageData } from "../lib/public/homepage";
    import {
        HOMEPAGE_DATA_EVENT,
        type HomepageDataEventDetail
    } from "../lib/public/homepage-client";
    import FeaturedEventCarousel from "./FeaturedEventCarousel.svelte";
    import HomepagePopularity from "./HomepagePopularity.svelte";
    import HomepageToday from "./HomepageToday.svelte";

    interface Props {
        initialHomepage: PublicHomepageData;
        regionError?: string;
        discoveryError?: string;
        popularityError?: string;
    }

    let {
        initialHomepage,
        regionError: initialRegionError = "",
        discoveryError: initialDiscoveryError = "",
        popularityError: initialPopularityError = ""
    }: Props = $props();

    let homepage = $state(untrack(() => initialHomepage));
    let regionError = $state(untrack(() => initialRegionError));
    let discoveryError = $state(untrack(() => initialDiscoveryError));
    let popularityError = $state(untrack(() => initialPopularityError));

    const carouselKey = $derived(
        `${homepage.division.code}:${homepage.featuredEvents.map((event) => event.id).join(",")}`
    );
    const catalogueHref = $derived(
        `/events?${new URLSearchParams({ city: homepage.division.code }).toString()}`
    );

    onMount(() => {
        const handleHomepageData = (event: Event) => {
            if (!(event instanceof CustomEvent)) return;
            const detail = event.detail as HomepageDataEventDetail;
            homepage = detail.homepage;
            regionError = "";
            discoveryError = "";
            popularityError = "";
        };

        window.addEventListener(HOMEPAGE_DATA_EVENT, handleHomepageData);
        return () => window.removeEventListener(HOMEPAGE_DATA_EVENT, handleHomepageData);
    });
</script>

<div class="flex flex-col">
    {#key carouselKey}
        <FeaturedEventCarousel
            events={homepage.featuredEvents}
            divisionLabel={homepage.division.label}
            {catalogueHref}
        />
    {/key}

    {#if regionError}
        <div
            class="mt-8 rounded-md bg-danger-subtle p-5 text-sm font-semibold text-danger"
            role="alert"
        >
            {regionError}
        </div>
    {/if}

    <HomepagePopularity
        initialPopularity={homepage.popularity}
        divisionCode={homepage.division.code}
        divisionLabel={homepage.division.label}
        initialError={popularityError}
    />

    <HomepageToday
        events={homepage.today}
        divisionCode={homepage.division.code}
        divisionLabel={homepage.division.label}
        initialError={discoveryError}
    />
</div>
