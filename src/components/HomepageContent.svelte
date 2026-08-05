<script lang="ts">
    import { onMount, untrack } from "svelte";
    import type { PublicHomepageData } from "../lib/public/homepage";
    import {
        HOMEPAGE_DATA_EVENT,
        type HomepageDataEventDetail
    } from "../lib/public/homepage-client";
    import FeaturedEventCarousel from "./FeaturedEventCarousel.svelte";
    import HomepageIntentFeed from "./HomepageIntentFeed.svelte";
    import Alert from "./ui/alert.svelte";

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
    <div data-reveal>
        {#key carouselKey}
            <FeaturedEventCarousel
                events={homepage.featuredEvents}
                divisionLabel={homepage.division.label}
                {catalogueHref}
            />
        {/key}
    </div>

    {#if regionError || discoveryError}
        <Alert tone="danger" class="mt-8 p-5 font-semibold">
            {regionError || discoveryError}
        </Alert>
    {/if}

    <HomepageIntentFeed
        initialPopularity={homepage.popularity}
        divisionCode={homepage.division.code}
        divisionLabel={homepage.division.label}
        initialError={popularityError}
    />
</div>
