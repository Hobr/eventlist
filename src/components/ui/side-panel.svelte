<script lang="ts">
    import { Dialog } from "bits-ui";
    import X from "@lucide/svelte/icons/x";
    import { cn } from "../../lib/utils";

    interface Props {
        title: string;
        description?: string;
        trigger: import("svelte").Snippet;
        children: import("svelte").Snippet;
        footer?: import("svelte").Snippet;
        triggerClass?: string;
        contentClass?: string;
    }

    let {
        title,
        description = undefined,
        trigger,
        children,
        footer = undefined,
        triggerClass = undefined,
        contentClass = undefined
    }: Props = $props();
</script>

<Dialog.Root>
    <Dialog.Trigger
        class={cn(
            "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border-strong bg-surface px-4 text-sm font-semibold text-foreground transition-colors hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
            triggerClass
        )}
    >
        {@render trigger()}
    </Dialog.Trigger>
    <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-50 bg-black/45" />
        <Dialog.Content
            class={cn(
                "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-surface-raised shadow-popover focus:outline-none",
                contentClass
            )}
        >
            <div class="flex items-start justify-between gap-4 border-b border-border p-5">
                <div>
                    <Dialog.Title class="text-lg font-bold text-foreground">{title}</Dialog.Title>
                    {#if description}
                        <Dialog.Description class="mt-1 text-sm text-muted-foreground">
                            {description}
                        </Dialog.Description>
                    {/if}
                </div>
                <Dialog.Close
                    aria-label="关闭"
                    class="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
                >
                    <X class="size-4" aria-hidden="true" />
                </Dialog.Close>
            </div>
            <div class="min-h-0 flex-1 overflow-y-auto p-5">{@render children()}</div>
            {#if footer}
                <div class="border-t border-border p-5">{@render footer()}</div>
            {/if}
        </Dialog.Content>
    </Dialog.Portal>
</Dialog.Root>
