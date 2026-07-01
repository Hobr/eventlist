<script lang="ts">
    import { cn } from "../../lib/utils";

    interface Props {
        id?: string;
        name?: string;
        type?: string;
        value?: string | number;
        required?: boolean;
        disabled?: boolean;
        placeholder?: string;
        autocomplete?: string;
        list?: string;
        min?: string | number;
        max?: string | number;
        class?: string;
        onchange?: (e: Event) => void;
        oninput?: (e: Event) => void;
        onkeydown?: (e: KeyboardEvent) => void;
    }
    let {
        id = undefined,
        name = undefined,
        type = "text",
        value = undefined,
        required = false,
        disabled = false,
        placeholder = undefined,
        autocomplete = undefined,
        list = undefined,
        min = undefined,
        max = undefined,
        class: className = undefined,
        onchange,
        oninput,
        onkeydown
    }: Props = $props();
    let classes = $derived(
        cn(
            "flex h-10 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-foreground transition-colors placeholder:text-muted focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50",
            className
        )
    );
</script>

<input
    {id}
    {name}
    {type}
    {value}
    {required}
    {disabled}
    {placeholder}
    {autocomplete}
    {list}
    {min}
    {max}
    {onchange}
    {oninput}
    {onkeydown}
    class={classes}
/>
