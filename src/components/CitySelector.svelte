<script lang="ts">
    import { onMount } from "svelte";
    import type { DivisionOption } from "../lib/divisions";

    interface Props {
        divisions: DivisionOption[];
        selectedDivisionCode?: string | null;
        action?: string;
        name?: string;
        label?: string;
    }

    const STORAGE_KEY = "eventlist.divisionCode";
    let {
        divisions,
        selectedDivisionCode = null,
        action = "/",
        name = "city",
        label = "所在城市",
    }: Props = $props();
    let current = selectedDivisionCode ?? "";

    function hasDivision(value: string) {
        return divisions.some((division) => division.code === value);
    }

    function go(value: string, replace = false) {
        if (!value || !hasDivision(value)) return;

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
        {#each divisions as division}
            <option value={division.code}>{division.label}</option>
        {/each}
    </select>
</label>
