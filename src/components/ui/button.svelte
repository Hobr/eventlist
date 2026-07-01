<script lang="ts">
    import { cn } from "../../lib/utils";

    type Variant = "default" | "outline" | "ghost" | "destructive" | "tonal";
    type Size = "sm" | "md" | "lg" | "icon";

    interface Props {
        variant?: Variant;
        size?: Size;
        href?: string;
        type?: "button" | "submit" | "reset";
        name?: string;
        value?: string;
        disabled?: boolean;
        class?: string;
        children?: import("svelte").Snippet;
    }

    let {
        variant = "default",
        size = "md",
        href = undefined,
        type = "button",
        name = undefined,
        value = undefined,
        disabled = false,
        class: className = undefined,
        children
    }: Props = $props();

    const variants: Record<Variant, string> = {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline: "border border-border-strong bg-surface text-foreground hover:bg-surface-subtle",
        ghost: "text-muted-foreground hover:bg-surface-subtle",
        destructive: "bg-danger text-danger-foreground hover:bg-danger/90",
        tonal: "bg-primary-subtle text-primary-subtle-foreground hover:bg-primary-subtle/80"
    };

    const sizes: Record<Size, string> = {
        sm: "h-8 gap-1.5 px-3 text-xs",
        md: "h-10 gap-2 px-4 text-sm",
        lg: "h-11 gap-2 px-6 text-base",
        icon: "h-10 w-10 p-0"
    };

    let classes = $derived(
        cn(
            "inline-flex shrink-0 items-center justify-center rounded-md font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-50",
            variants[variant],
            sizes[size],
            className
        )
    );
</script>

{#if href}
    <a {href} class={classes} aria-disabled={disabled || undefined}>
        {@render children?.()}
    </a>
{:else}
    <button {type} {name} {value} {disabled} class={classes}>
        {@render children?.()}
    </button>
{/if}
