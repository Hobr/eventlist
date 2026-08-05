<script lang="ts">
    import { Button as FlowbiteButton } from "flowbite-svelte";
    import type { HTMLButtonOrAnchorAttributes } from "flowbite-svelte";
    import { cn } from "../../lib/utils";

    type Variant = "default" | "outline" | "ghost" | "destructive" | "tonal";
    type Size = "sm" | "md" | "lg" | "icon";

    type Props = Omit<
        HTMLButtonOrAnchorAttributes,
        "children" | "class" | "color" | "onclick" | "size"
    > & {
        variant?: Variant;
        size?: Size;
        href?: string;
        disabled?: boolean;
        ariaLabel?: string;
        class?: string;
        onclick?: (event: MouseEvent) => void;
        children?: import("svelte").Snippet;
    };

    let {
        variant = "default",
        size = "md",
        href = undefined,
        type = undefined,
        disabled = false,
        ariaLabel = undefined,
        class: className = undefined,
        onclick,
        children,
        ...restProps
    }: Props = $props();

    const variants: Record<Variant, string> = {
        default:
            "bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-primary! dark:text-primary-foreground! dark:hover:bg-primary/90!",
        outline:
            "border-border-strong bg-surface text-foreground hover:bg-surface-subtle dark:border-border-strong! dark:bg-surface! dark:text-foreground! dark:hover:bg-surface-subtle!",
        ghost: "border-transparent bg-transparent text-muted-foreground hover:bg-surface-subtle dark:border-transparent! dark:bg-transparent! dark:text-muted-foreground! dark:hover:bg-surface-subtle!",
        destructive:
            "bg-danger text-danger-foreground hover:bg-danger/90 dark:bg-danger! dark:text-danger-foreground! dark:hover:bg-danger/90!",
        tonal: "border-transparent bg-primary-subtle text-primary-subtle-foreground hover:bg-primary-subtle/80 dark:border-transparent! dark:bg-primary-subtle! dark:text-primary-subtle-foreground! dark:hover:bg-primary-subtle/80!"
    };

    const colors = {
        default: "primary",
        outline: "alternative",
        ghost: "alternative",
        destructive: "red",
        tonal: "primary"
    } as const;

    const flowbiteSizes = {
        sm: "xs",
        md: "sm",
        lg: "lg",
        icon: "sm"
    } as const;

    const sizes: Record<Size, string> = {
        sm: "h-8 gap-1.5 px-3 text-xs",
        md: "h-10 gap-2 px-4 text-sm",
        lg: "h-11 gap-2 px-6 text-base",
        icon: "h-10 w-10 p-0"
    };

    let classes = $derived(
        cn(
            "shrink-0 rounded-md font-semibold whitespace-nowrap transition-[transform,background-color,color,border-color,box-shadow] duration-300 ease-motion focus-within:ring-ring/60 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100 dark:focus-within:ring-ring/60!",
            variants[variant],
            sizes[size],
            className
        )
    );
    let resolvedAriaLabel = $derived(ariaLabel ?? restProps["aria-label"]);
    let resolvedTabindex = $derived(disabled ? -1 : restProps.tabindex);

    function handleAnchorClick(event: MouseEvent) {
        if (disabled) {
            event.preventDefault();
            event.stopPropagation();
            return;
        }

        onclick?.(event);
    }
</script>

{#if href}
    <FlowbiteButton
        {...restProps}
        tag="a"
        href={disabled ? undefined : href}
        color={colors[variant]}
        outline={variant === "outline"}
        size={flowbiteSizes[size]}
        {disabled}
        class={classes}
        aria-disabled={disabled || undefined}
        aria-label={resolvedAriaLabel}
        tabindex={resolvedTabindex}
        onclick={handleAnchorClick}
    >
        {@render children?.()}
    </FlowbiteButton>
{:else}
    <FlowbiteButton
        {...restProps}
        type={type ?? "button"}
        color={colors[variant]}
        outline={variant === "outline"}
        size={flowbiteSizes[size]}
        {disabled}
        class={classes}
        aria-label={resolvedAriaLabel}
        {onclick}
    >
        {@render children?.()}
    </FlowbiteButton>
{/if}
