<script lang="ts">
    import { onMount } from "svelte";
    import DivisionPicker from "./DivisionPicker.svelte";
    import { isRegionCode, type DivisionTree } from "../lib/divisions";

    interface Props {
        tree?: DivisionTree;
        selectedDivisionCode?: string | null;
        action?: string;
        name?: string;
        label?: string;
    }

    const STORAGE_KEY = "eventlist.divisionCode";
    let {
        tree = undefined,
        selectedDivisionCode = null,
        action = "/",
        name = "city",
        label = "所在地区"
    }: Props = $props();

    function go(value: string, replace = false) {
        if (!value || !isRegionCode(value)) return;

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

    function handleChange(value: string) {
        go(value);
    }

    onMount(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        const searchParams = new URLSearchParams(window.location.search);
        if (saved && saved !== selectedDivisionCode && !searchParams.has(name)) {
            go(saved, true);
        }
    });
</script>

<DivisionPicker
    {tree}
    {name}
    {label}
    mode="region"
    value={selectedDivisionCode}
    allowEmpty={false}
    onchange={handleChange}
/>
