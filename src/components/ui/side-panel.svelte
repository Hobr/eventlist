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
            "border-border-strong bg-surface text-foreground hover:bg-surface-subtle focus-visible:ring-ring/60 inline-flex h-10 items-center justify-center gap-2 rounded-md border px-4 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none",
            triggerClass
        )}
    >
        {@render trigger()}
    </Dialog.Trigger>
    <Dialog.Portal>
        <Dialog.Overlay class="fixed inset-0 z-50 bg-black/45" />
        <Dialog.Content
            class={cn(
                "bg-surface-raised border-border shadow-popover fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l focus:outline-none",
                contentClass
            )}
        >
            <div class="border-border flex items-start justify-between gap-4 border-b p-5">
                <div>
                    <Dialog.Title class="text-foreground text-lg font-bold">{title}</Dialog.Title>
                    {#if description}
                        <Dialog.Description class="text-muted-foreground mt-1 text-sm">
                            {description}
                        </Dialog.Description>
                    {/if}
                </div>
                <Dialog.Close
                    aria-label="关闭"
                    class="text-muted-foreground hover:bg-surface-subtle focus-visible:ring-ring/60 inline-flex size-9 shrink-0 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none"
                >
                    <X class="size-4" aria-hidden="true" />
                </Dialog.Close>
            </div>
            <div class="min-h-0 flex-1 overflow-y-auto p-5">{@render children()}</div>
            {#if footer}
                <div class="border-border border-t p-5">{@render footer()}</div>
            {/if}
        </Dialog.Content>
    </Dialog.Portal>
</Dialog.Root>
