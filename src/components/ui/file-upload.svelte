<script lang="ts">
    import type { HTMLInputAttributes } from "svelte/elements";
    import { cn } from "../../lib/utils";

    type Props = Omit<HTMLInputAttributes, "class" | "files" | "type"> & {
        files?: FileList | null;
        elementRef?: HTMLInputElement;
        class?: string;
        wrapperClass?: string;
    };

    let {
        files = $bindable(),
        elementRef = $bindable(),
        class: className = undefined,
        wrapperClass: wrapperClassName = undefined,
        ...restProps
    }: Props = $props();
</script>

<div class={cn("ui-file-wrap", wrapperClassName)}>
    <input
        bind:files
        bind:this={elementRef}
        {...restProps}
        type="file"
        class={cn("ui-file", className)}
    />
</div>
