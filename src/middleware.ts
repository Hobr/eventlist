import { defineMiddleware } from "astro:middleware";
import { getAdminIdentity } from "./server/admin/auth";
import { getWorkerEnv } from "./server/env";

export const onRequest = defineMiddleware(async (context, next) => {
    const { pathname } = context.url;

    if (!pathname.startsWith("/admin") && !pathname.startsWith("/api/admin")) {
        return next();
    }

    const identity = await getAdminIdentity(
        context.request,
        getWorkerEnv() ?? {},
    );

    if (!identity) {
        return new Response("Forbidden", {
            status: 403,
            headers: { "content-type": "text/plain; charset=utf-8" },
        });
    }

    context.locals.adminIdentity = identity;
    return next();
});
