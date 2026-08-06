<script lang="ts">
    import { Dialog } from "bits-ui";
    import X from "phosphor-svelte/lib/X";
    import { cn } from "../../lib/utils";

    interface Props {
        title: string;
        open?: boolean;
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
        open = $bindable(false),
        description = undefined,
        trigger,
        children,
        footer = undefined,
        triggerClass = undefined,
        triggerAriaLabel = undefined,
        contentClass = undefined
    }: Props = $props();
</script>

<Dialog.Root bind:open>
    <Dialog.Trigger
        class={cn("ui-button", triggerClass)}
        data-variant="outline"
        data-size="md"
        aria-label={triggerAriaLabel}
    >
        {@render trigger()}
    </Dialog.Trigger>
    <Dialog.Portal>
        <Dialog.Overlay class="ui-dialog-overlay" />
        <Dialog.Content class={cn("ui-dialog-content ui-dialog-sheet", contentClass)}>
            <header class="ui-dialog-header">
                <div>
                    <Dialog.Title class="ui-dialog-title">{title}</Dialog.Title>
                    {#if description}
                        <Dialog.Description class="ui-dialog-description">
                            {description}
                        </Dialog.Description>
                    {/if}
                </div>
                <Dialog.Close
                    class="ui-button"
                    data-variant="ghost"
                    data-size="icon"
                    aria-label="关闭"
                >
                    <X size={18} aria-hidden="true" />
                </Dialog.Close>
            </header>
            <div class="ui-dialog-body">{@render children()}</div>
            {#if footer}<footer class="ui-dialog-footer">{@render footer()}</footer>{/if}
        </Dialog.Content>
    </Dialog.Portal>
</Dialog.Root>
