<script lang="ts">
    import { Button } from "bits-ui";
    import type { HTMLAnchorAttributes, HTMLButtonAttributes } from "svelte/elements";
    import { cn } from "../../lib/utils";

    type Variant = "default" | "outline" | "ghost" | "destructive" | "tonal";
    type Size = "sm" | "md" | "lg" | "icon";
    type SharedProps = {
        variant?: Variant;
        size?: Size;
        disabled?: boolean;
        ariaLabel?: string;
        class?: string;
        children?: import("svelte").Snippet;
    };
    type Props = SharedProps &
        (
            | ({ href: string; type?: never } & Omit<
                  HTMLAnchorAttributes,
                  "children" | "class" | "href"
              >)
            | ({ href?: undefined } & Omit<HTMLButtonAttributes, "children" | "class">)
        );

    let {
        variant = "default",
        size = "md",
        href = undefined,
        type = undefined,
        disabled = false,
        ariaLabel = undefined,
        class: className = undefined,
        children,
        onclick,
        ...restProps
    }: Props = $props();

    let classes = $derived(cn("ui-button", className));
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
    <Button.Root
        {...restProps}
        {href}
        class={classes}
        data-variant={variant}
        data-size={size}
        aria-disabled={disabled || undefined}
        aria-label={resolvedAriaLabel}
        tabindex={resolvedTabindex}
        onclick={handleAnchorClick}
    >
        {@render children?.()}
    </Button.Root>
{:else}
    <Button.Root
        {...restProps}
        type={type ?? "button"}
        {disabled}
        class={classes}
        data-variant={variant}
        data-size={size}
        aria-label={resolvedAriaLabel}
        {onclick}
    >
        {@render children?.()}
    </Button.Root>
{/if}
