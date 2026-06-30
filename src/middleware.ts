import { defineMiddleware } from "astro:middleware";
import {
    authenticateAdmin,
    isAdminApiPath,
    isAdminPagePath,
} from "./lib/auth/admin";
import { jsonError } from "./lib/http/json";
import { getRuntimeEnv } from "./lib/runtime/env";

export const onRequest = defineMiddleware(async (context, next) => {
    const pathname = new URL(context.request.url).pathname;
    const adminApiPath = isAdminApiPath(pathname);
    const adminPagePath = isAdminPagePath(pathname);

    if (!adminApiPath && !adminPagePath) {
        return next();
    }

    const runtimeEnv = getRuntimeEnv();
    const authenticated = await authenticateAdmin(context.request, runtimeEnv);

    if (authenticated) {
        context.locals.admin = authenticated;
        return next();
    }

    if (adminApiPath) {
        return jsonError("Unauthorized", 401);
    }

    if (pathname === "/admin/login") {
        return next();
    }

    const loginUrl = new URL("/admin/login", context.url);
    loginUrl.searchParams.set("next", pathname);
    return context.redirect(loginUrl.pathname + loginUrl.search, 302);
});
