<script lang="ts">
    import { cn } from "../../lib/utils";

    interface Props {
        id?: string;
        name?: string;
        required?: boolean;
        disabled?: boolean;
        placeholder?: string;
        rows?: number;
        class?: string;
    }
    let {
        id = undefined,
        name = undefined,
        required = false,
        disabled = false,
        placeholder = undefined,
        rows = 4,
        class: className = undefined
    }: Props = $props();
    let classes = $derived(
        cn(
            "flex w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-foreground transition-colors placeholder:text-muted focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 resize-y min-h-32",
            className
        )
    );
</script>

<textarea {id} {name} {required} {disabled} {placeholder} {rows} class={classes}></textarea>
