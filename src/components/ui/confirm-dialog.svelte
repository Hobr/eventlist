<script lang="ts">
    import { AlertDialog } from "bits-ui";
    import LoaderCircle from "@lucide/svelte/icons/loader-circle";
    import X from "@lucide/svelte/icons/x";
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

    const triggerTone = $derived(
        tone === "danger"
            ? "bg-danger text-danger-foreground hover:bg-danger/90"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
    );
    const confirmTone = $derived(
        tone === "danger"
            ? "bg-danger text-danger-foreground hover:bg-danger/90"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
    );

    async function handleConfirm(event: MouseEvent) {
        event.preventDefault();
        if (pending || confirmDisabled) return;
        if (await onconfirm()) open = false;
    }
</script>

<AlertDialog.Root bind:open>
    <AlertDialog.Trigger
        type="button"
        {disabled}
        class={cn(
            "focus-visible:ring-ring/60 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
            triggerTone,
            triggerClass
        )}
    >
        {@render trigger()}
    </AlertDialog.Trigger>
    <AlertDialog.Portal>
        <AlertDialog.Overlay class="fixed inset-0 z-50 bg-black/45" />
        <AlertDialog.Content
            class={cn(
                "bg-surface-raised border-border shadow-popover fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-md border p-5 focus:outline-none sm:p-6",
                contentClass
            )}
        >
            <div class="flex items-start justify-between gap-4">
                <div>
                    <AlertDialog.Title class="text-foreground text-lg font-bold">
                        {title}
                    </AlertDialog.Title>
                    <AlertDialog.Description class="text-muted-foreground mt-1 text-sm leading-6">
                        {description}
                    </AlertDialog.Description>
                </div>
                <AlertDialog.Cancel
                    aria-label="关闭"
                    class="text-muted-foreground hover:bg-surface-subtle focus-visible:ring-ring/60 inline-flex size-9 shrink-0 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none"
                >
                    <X class="size-4" aria-hidden="true" />
                </AlertDialog.Cancel>
            </div>

            {#if children}
                <div class="mt-5">{@render children()}</div>
            {/if}

            <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <AlertDialog.Cancel
                    class="border-border-strong bg-surface text-foreground hover:bg-surface-subtle focus-visible:ring-ring/60 inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
                >
                    {cancelLabel}
                </AlertDialog.Cancel>
                <button
                    type="button"
                    disabled={pending || confirmDisabled}
                    aria-busy={pending}
                    onclick={handleConfirm}
                    class={cn(
                        "focus-visible:ring-ring/60 inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
                        confirmTone
                    )}
                >
                    {#if pending}
                        <LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
                    {/if}
                    {pending ? "处理中" : confirmLabel}
                </button>
            </div>
        </AlertDialog.Content>
    </AlertDialog.Portal>
</AlertDialog.Root>
