<script lang="ts">
    import { cn } from "../../lib/utils";
    interface Props {
        class?: string;
        label?: string;
    }
    let { class: className = undefined, label = "加载中" }: Props = $props();
</script>

<span class={cn("ui-spinner", className)} aria-hidden="true"></span>
<span class="sr-only">{label}</span>
