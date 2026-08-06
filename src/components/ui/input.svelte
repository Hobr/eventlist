<script lang="ts">
    import type { HTMLInputAttributes } from "svelte/elements";
    import { cn } from "../../lib/utils";

    type Props = Omit<HTMLInputAttributes, "class" | "value"> & {
        value?: HTMLInputAttributes["value"];
        elementRef?: HTMLInputElement;
        class?: string;
    };

    let {
        value = $bindable(),
        elementRef = $bindable(),
        class: className = undefined,
        ...restProps
    }: Props = $props();
</script>

<input bind:value bind:this={elementRef} {...restProps} class={cn("ui-field", className)} />
