<script lang="ts">
    import { onMount } from "svelte";

    interface Props {
        siteKey?: string | null;
    }

    interface TurnstileApi {
        render: (container: HTMLElement, options: Record<string, unknown>) => string;
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

        loadScript()
            .then(() => {
                if (!window.turnstile || !container) return;
                window.turnstile.render(container, {
                    sitekey: siteKey,
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
                errorMessage = "人机校验加载失败，请刷新后重试";
            });
    });
</script>

<div class="flex flex-col gap-1.5">
    <input type="hidden" name="cf-turnstile-response" value={token} />
    {#if siteKey}
        <div bind:this={container}></div>
    {:else}
        <p class="text-sm font-semibold text-danger">投稿保护未配置</p>
    {/if}
    {#if errorMessage}
        <p class="text-sm font-semibold text-danger">{errorMessage}</p>
    {/if}
</div>
