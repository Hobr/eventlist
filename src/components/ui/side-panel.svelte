<script lang="ts">
    import { Button, Drawer, Drawerhead } from "flowbite-svelte";
    import { cn } from "../../lib/utils";

    interface Props {
        title: string;
        description?: string;
        trigger: import("svelte").Snippet;
        children: import("svelte").Snippet;
        footer?: import("svelte").Snippet;
        triggerClass?: string;
        triggerAriaLabel?: string;
        contentClass?: string;
    }

    let {
        title,
        description = undefined,
        trigger,
        children,
        footer = undefined,
        triggerClass = undefined,
        triggerAriaLabel = undefined,
        contentClass = undefined
    }: Props = $props();

    let open = $state(false);
    let triggerElement: HTMLButtonElement | null = null;
    const DRAWER_TRANSITION_MS = 300;
    const drawerTransition = { duration: DRAWER_TRANSITION_MS };
    let hasOpened = false;
    let focusRestoreTimer: ReturnType<typeof setTimeout> | undefined;
    let focusRestoreFrame: number | undefined;

    function restoreFocusAfterDialogCleanup() {
        focusRestoreFrame = undefined;
        if (open) return;

        const dialogIsOpen = [...document.querySelectorAll("dialog[open]")].some(
            (dialog) => dialog.getAttribute("aria-label") === title
        );
        if (dialogIsOpen) {
            focusRestoreFrame = requestAnimationFrame(restoreFocusAfterDialogCleanup);
            return;
        }

        focusRestoreFrame = requestAnimationFrame(() => {
            focusRestoreFrame = undefined;
            if (!open && triggerElement?.isConnected) triggerElement.focus();
        });
    }

    $effect(() => {
        if (open) {
            hasOpened = true;
            return;
        }

        if (!hasOpened) return;
        hasOpened = false;
        focusRestoreTimer = setTimeout(() => {
            focusRestoreTimer = undefined;
            focusRestoreFrame = requestAnimationFrame(restoreFocusAfterDialogCleanup);
        }, DRAWER_TRANSITION_MS);

        return () => {
            if (focusRestoreTimer !== undefined) {
                clearTimeout(focusRestoreTimer);
                focusRestoreTimer = undefined;
            }
            if (focusRestoreFrame !== undefined) {
                cancelAnimationFrame(focusRestoreFrame);
                focusRestoreFrame = undefined;
            }
        };
    });

    function openPanel(event: MouseEvent) {
        triggerElement = event.currentTarget as HTMLButtonElement;
        open = true;
    }

    function handlePanelKeydown(event: KeyboardEvent) {
        if (event.key !== "Escape" || !open) return;
        event.preventDefault();
        open = false;
    }
</script>

<Button
    type="button"
    color="alternative"
    size="sm"
    aria-haspopup="dialog"
    aria-expanded={open}
    aria-label={triggerAriaLabel}
    onclick={openPanel}
    class={cn(
        "group h-10 rounded-md px-4 text-sm font-semibold transition-[transform,background-color,color,border-color] duration-300 ease-motion active:scale-[0.98]",
        triggerClass
    )}
>
    {@render trigger()}
</Button>

<Drawer
    bind:open
    placement="right"
    width="full"
    modal
    dismissable={false}
    outsideclose
    focustrap
    onkeydown={handlePanelKeydown}
    transitionParams={drawerTransition}
    aria-label={title}
    class={cn(
        "flex w-full max-w-md translate-x-0 flex-col border-l border-border bg-surface-raised p-0 text-foreground shadow-popover dark:border-border dark:bg-surface-raised",
        contentClass
    )}
>
    <Drawerhead
        aria-label="关闭"
        onclick={() => (open = false)}
        class="shrink-0 border-b border-border p-5"
        classes={{
            button: "size-9 rounded-md text-muted-foreground transition-[transform,background-color,color] duration-300 ease-motion hover:bg-surface-subtle hover:text-foreground active:scale-[0.96] dark:hover:bg-surface-subtle dark:hover:text-foreground",
            svg: "size-4"
        }}
    >
        <div class="min-w-0 pr-4">
            <h2 class="text-lg font-bold text-foreground">{title}</h2>
            {#if description}
                <p class="mt-1 text-sm text-muted-foreground">{description}</p>
            {/if}
        </div>
    </Drawerhead>
    <div class="min-h-0 flex-1 overflow-y-auto p-5">{@render children()}</div>
    {#if footer}
        <div class="shrink-0 border-t border-border p-5">{@render footer()}</div>
    {/if}
</Drawer>
