<script lang="ts">
    import type { HTMLTextareaAttributes } from "svelte/elements";
    import { cn } from "../../lib/utils";

    type Props = Omit<HTMLTextareaAttributes, "class" | "value"> & {
        value?: string;
        elementRef?: HTMLTextAreaElement;
        class?: string;
    };

    let {
        value = $bindable(),
        elementRef = $bindable(),
        class: className = undefined,
        ...restProps
    }: Props = $props();
</script>

<textarea bind:value bind:this={elementRef} {...restProps} class={cn("ui-textarea", className)}
></textarea>
