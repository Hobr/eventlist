<script lang="ts">
    import { onMount } from "svelte";
    import DivisionPicker from "./DivisionPicker.svelte";
    import type { DivisionTree } from "../lib/divisions";
    import { navigateToDivision, restoreStoredDivision } from "../lib/division-preference";

    interface Props {
        tree?: DivisionTree;
        selectedDivisionCode?: string | null;
        action?: string;
        name?: string;
        label?: string;
        navigateOnChange?: boolean;
        onchange?: (value: string) => void;
    }

    let {
        tree = undefined,
        selectedDivisionCode = null,
        action = "/",
        name = "city",
        label = "所在地区",
        navigateOnChange = true,
        onchange
    }: Props = $props();

    function handleChange(value: string) {
        onchange?.(value);
        if (navigateOnChange) navigateToDivision({ value, action, name });
    }

    onMount(() => {
        if (navigateOnChange) restoreStoredDivision({ selectedDivisionCode, action, name });
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
