import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware((context, next) => {
  const { pathname } = new URL(context.request.url);

  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    const email =
      context.request.headers.get("Cf-Access-Authenticated-User-Email") ??
      context.locals.runtime.env.DEV_ADMIN_EMAIL ??
      null;

    if (!email) {
      return new Response("Unauthorized", { status: 401 });
    }

    const allowedEmails = context.locals.runtime.env.ADMIN_EMAILS;
    if (allowedEmails) {
      const allowed = allowedEmails.split(",").map((e) => e.trim().toLowerCase());
      if (!allowed.includes(email.toLowerCase())) {
        return new Response("Forbidden", { status: 403 });
      }
    }
  }

  return next();
});
