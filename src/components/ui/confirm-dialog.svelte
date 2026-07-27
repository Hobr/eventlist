<script lang="ts">
    import { Button, Modal, Spinner } from "flowbite-svelte";
    import { CloseOutline } from "flowbite-svelte-icons";
    import { cn } from "../../lib/utils";

    interface Props {
        title: string;
        description: string;
        confirmLabel?: string;
        cancelLabel?: string;
        tone?: "danger" | "primary";
        pending?: boolean;
        disabled?: boolean;
        confirmDisabled?: boolean;
        trigger: import("svelte").Snippet;
        children?: import("svelte").Snippet;
        onconfirm: () => boolean | Promise<boolean>;
        triggerClass?: string;
        contentClass?: string;
    }

    let {
        title,
        description,
        confirmLabel = "确认",
        cancelLabel = "取消",
        tone = "danger",
        pending = false,
        disabled = false,
        confirmDisabled = false,
        trigger,
        children = undefined,
        onconfirm,
        triggerClass = undefined,
        contentClass = undefined
    }: Props = $props();

    let open = $state(false);
    let triggerElement: HTMLButtonElement | null = null;
    const MODAL_TRANSITION_MS = 100;
    const modalTransition = { duration: MODAL_TRANSITION_MS };
    let hasOpened = false;
    let focusRestoreTimer: ReturnType<typeof setTimeout> | undefined;
    let focusRestoreFrame: number | undefined;
    const color = $derived(tone === "danger" ? "red" : "primary");

    $effect(() => {
        if (open) {
            hasOpened = true;
            return;
        }

        if (!hasOpened) return;
        hasOpened = false;
        focusRestoreTimer = setTimeout(() => {
            focusRestoreTimer = undefined;
            focusRestoreFrame = requestAnimationFrame(() => {
                // Svelte may start the outro on the first frame; the next frame follows dialog cleanup.
                focusRestoreFrame = requestAnimationFrame(() => {
                    focusRestoreFrame = undefined;
                    if (!open && triggerElement?.isConnected) triggerElement.focus();
                });
            });
        }, MODAL_TRANSITION_MS);

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

    function openDialog(event: MouseEvent) {
        triggerElement = event.currentTarget as HTMLButtonElement;
        open = true;
    }

    async function handleConfirm(event: MouseEvent) {
        event.preventDefault();
        if (pending || confirmDisabled) return;
        if (await onconfirm()) open = false;
    }
</script>

<Button
    type="button"
    {color}
    size="xs"
    {disabled}
    aria-haspopup="dialog"
    aria-expanded={open}
    onclick={openDialog}
    class={cn("h-8 w-full rounded-md px-3 text-xs font-semibold", triggerClass)}
>
    {@render trigger()}
</Button>

<Modal
    bind:open
    size="xs"
    role="alertdialog"
    aria-label={title}
    dismissable={false}
    outsideclose={!pending}
    focustrap
    permanent={pending}
    transitionParams={modalTransition}
    class={cn(
        "border border-border bg-surface-raised text-foreground shadow-popover dark:border-border dark:bg-surface-raised dark:text-foreground",
        contentClass
    )}
    classes={{
        header: "border-b-0 p-5 pb-0 sm:p-6 sm:pb-0",
        body: "space-y-0 p-5 sm:p-6",
        footer: "border-t-0 p-5 pt-0 sm:p-6 sm:pt-0"
    }}
>
    {#snippet header()}
        <h2 class="pr-4 text-lg font-bold text-foreground">{title}</h2>
        <Button
            type="button"
            color="alternative"
            size="xs"
            disabled={pending}
            aria-label="关闭"
            onclick={() => (open = false)}
            class="size-9 rounded-md p-0 text-muted-foreground"
        >
            <CloseOutline class="size-4" />
        </Button>
    {/snippet}

    <p class="text-sm leading-6 text-muted-foreground">{description}</p>
    {#if children}
        <div class="mt-5">{@render children()}</div>
    {/if}

    {#snippet footer()}
        <Button
            type="button"
            color="alternative"
            disabled={pending}
            onclick={() => (open = false)}
            class="h-10 rounded-md px-4 text-sm font-semibold"
        >
            {cancelLabel}
        </Button>
        <Button
            type="button"
            {color}
            disabled={pending || confirmDisabled}
            aria-busy={pending}
            onclick={handleConfirm}
            class="h-10 rounded-md px-4 text-sm font-semibold"
        >
            {#if pending}
                <Spinner size="4" />
            {/if}
            {pending ? "处理中" : confirmLabel}
        </Button>
    {/snippet}
</Modal>
