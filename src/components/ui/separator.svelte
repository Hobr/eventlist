<script lang="ts">
    import { Hr as FlowbiteHr } from "flowbite-svelte";
    import type { HrProps } from "flowbite-svelte";
    import { cn } from "../../lib/utils";

    type Props = Omit<HrProps, "children" | "class" | "classes"> & {
        class?: string;
    };

    let { class: className = undefined, ...restProps }: Props = $props();
    let classes = $derived(cn("my-0 h-px w-full border-0", className));
</script>

<FlowbiteHr {...restProps} classes={{ bg: "bg-border dark:bg-border!" }} class={classes} />
