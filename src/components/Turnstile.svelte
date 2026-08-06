<script lang="ts">
    import { onMount } from "svelte";

    const TURNSTILE_ACTION = "turnstile-spin-v2";
    const TURNSTILE_RESET_EVENT = "turnstile-reset";

    interface Props {
        siteKey?: string | null;
    }

    interface TurnstileApi {
        render: (container: HTMLElement, options: Record<string, unknown>) => string;
        remove: (widgetId: string) => void;
        reset: (widgetId: string) => void;
    }

    declare global {
        interface Window {
            turnstile?: TurnstileApi;
        }
    }

    let { siteKey = null }: Props = $props();
    let token = $state("");
    let container = $state<HTMLDivElement>();
    let errorMessage = $state("");
    let widgetId: string | null = null;

    function resetWidget() {
        token = "";
        if (widgetId && window.turnstile) window.turnstile.reset(widgetId);
    }

    function loadScript() {
        if (window.turnstile) return Promise.resolve();

        return new Promise<void>((resolve, reject) => {
            const existing = document.querySelector<HTMLScriptElement>(
                "script[data-turnstile-script]"
            );
            if (existing) {
                existing.addEventListener("load", () => resolve(), { once: true });
                existing.addEventListener("error", () => reject(), { once: true });
                return;
            }

            const script = document.createElement("script");
            script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
            script.async = true;
            script.defer = true;
            script.dataset.turnstileScript = "true";
            script.addEventListener("load", () => resolve(), { once: true });
            script.addEventListener("error", () => reject(), { once: true });
            document.head.append(script);
        });
    }

    onMount(() => {
        if (!siteKey || !container) return;

        let disposed = false;
        const form = container.closest("form");
        form?.addEventListener(TURNSTILE_RESET_EVENT, resetWidget);

        loadScript()
            .then(() => {
                if (disposed || !window.turnstile || !container) return;
                widgetId = window.turnstile.render(container, {
                    sitekey: siteKey,
                    action: TURNSTILE_ACTION,
                    "response-field": false,
                    callback: (value: string) => {
                        token = value;
                    },
                    "expired-callback": () => {
                        token = "";
                    },
                    "error-callback": () => {
                        token = "";
                    }
                });
            })
            .catch(() => {
                if (disposed) return;
                errorMessage = "人机校验加载失败, 请刷新后重试";
            });

        return () => {
            disposed = true;
            form?.removeEventListener(TURNSTILE_RESET_EVENT, resetWidget);
            if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
            widgetId = null;
            token = "";
        };
    });
</script>

<div class="turnstile-field">
    <input type="hidden" name="cf-turnstile-response" value={token} />
    {#if siteKey}
        <div
            class="cf-turnstile"
            data-sitekey={siteKey}
            data-action="turnstile-spin-v2"
            bind:this={container}
        ></div>
    {:else}
        <p class="turnstile-error">投稿保护未配置</p>
    {/if}
    {#if errorMessage}
        <p class="turnstile-error">{errorMessage}</p>
    {/if}
</div>
