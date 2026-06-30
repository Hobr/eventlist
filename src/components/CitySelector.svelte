<script lang="ts">
    import { onMount } from "svelte";
    import type { OptionRow } from "../lib/db/queries";

    interface Props {
        cities: OptionRow[];
        selectedCityId?: number | null;
        action?: string;
        name?: string;
        label?: string;
    }

    const STORAGE_KEY = "eventlist.cityId";
    let {
        cities,
        selectedCityId = null,
        action = "/",
        name = "city",
        label = "所在城市",
    }: Props = $props();
    let current = selectedCityId ? String(selectedCityId) : "";

    function hasCity(value: string) {
        return cities.some((city) => String(city.id) === value);
    }

    function go(value: string, replace = false) {
        if (!value || !hasCity(value)) return;

        localStorage.setItem(STORAGE_KEY, value);
        const url = new URL(action, window.location.origin);
        url.searchParams.set(name, value);
        const next = `${url.pathname}${url.search}`;
        if (replace) {
            window.location.replace(next);
            return;
        }
        window.location.assign(next);
    }

    function handleChange(event: Event) {
        const select = event.currentTarget;
        if (!(select instanceof HTMLSelectElement)) return;
        current = select.value;
        go(current);
    }

    onMount(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        const searchParams = new URLSearchParams(window.location.search);
        if (saved && saved !== current && !searchParams.has(name)) {
            go(saved, true);
        }
    });
</script>

<label class="field">
    <span>{label}</span>
    <select name={name} bind:value={current} onchange={handleChange}>
        {#each cities as city}
            <option value={String(city.id)}>{city.name}{city.province ? ` / ${city.province}` : ""}</option>
        {/each}
    </select>
</label>
