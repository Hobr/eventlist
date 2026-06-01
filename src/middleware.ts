import { defineMiddleware } from "astro:middleware";
import { env } from "cloudflare:workers";

export const onRequest = defineMiddleware((context, next) => {
    const { pathname } = new URL(context.request.url);

    if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
        const email =
            context.request.headers.get("Cf-Access-Authenticated-User-Email") ??
            env.DEV_ADMIN_EMAIL ??
            null;

        if (!email) {
            return new Response("Unauthorized", { status: 401 });
        }

        const allowedEmails: string = env.ADMIN_EMAILS ?? "";
        if (allowedEmails) {
            const allowed = allowedEmails
                .split(",")
                .map((e: string) => e.trim().toLowerCase());
            if (!allowed.includes(email.toLowerCase())) {
                return new Response("Forbidden", { status: 403 });
            }
        }
    }

    return next();
});
