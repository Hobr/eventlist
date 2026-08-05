<script lang="ts">
    import { Fileupload as FlowbiteFileupload } from "flowbite-svelte";
    import type { FileuploadProps } from "flowbite-svelte";
    import { cn } from "../../lib/utils";

    type Props = Omit<
        FileuploadProps,
        "class" | "color" | "elementRef" | "files" | "wrapperClass"
    > & {
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

    let classes = $derived(
        cn(
            "block h-10 w-full cursor-pointer rounded-md border border-border-strong bg-surface text-sm text-foreground file:mr-3 file:h-full file:border-0 file:border-r file:border-border file:bg-surface-subtle file:px-3 file:text-sm file:font-semibold file:text-foreground focus:border-ring focus:ring-ring/40 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-border-strong! dark:bg-surface! dark:text-foreground! dark:file:border-border! dark:file:bg-surface-subtle! dark:file:text-foreground! dark:focus:border-ring! dark:focus:ring-ring/40!",
            className
        )
    );
</script>

<FlowbiteFileupload
    bind:files
    bind:elementRef
    {...restProps}
    color="default"
    class={classes}
    wrapperClass={cn("w-full", wrapperClassName)}
/>
