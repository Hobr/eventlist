import type { APIRoute } from "astro";
import { getAdminIdentity } from "../../../server/admin/auth";
import {
    createScale,
    createVocabularyTerm,
    listVocabularySnapshot,
    updateScale,
    updateVocabularyTerm,
} from "../../../server/admin/vocabularies";
import { getWorkerEnv } from "../../../server/env";
import {
    readOptional,
    readRequired,
    slugify,
} from "../../../server/events/utils";

export const GET: APIRoute = async ({ request }) => {
    const env = getWorkerEnv();
    const identity = await getAdminIdentity(request, env ?? {});
    if (!identity) return forbidden();
    return json(await listVocabularySnapshot({ includeInactive: true }), 200);
};

export const POST: APIRoute = async ({ request }) => {
    const env = getWorkerEnv();
    const identity = await getAdminIdentity(request, env ?? {});
    if (!identity) return forbidden();
    const formData = await request.formData();
    const action = readRequired(formData.get("action")) || "create";
    const kind = readRequired(formData.get("kind"));
    const name = readRequired(formData.get("name"));
    const returnTo =
        readOptional(formData.get("returnTo")) ?? "/admin/vocabularies";

    if (action === "update") {
        const id = readRequired(formData.get("id"));

        if (kind === "scale") {
            const scale = await updateScale(
                id,
                {
                    name,
                    slug: readOptional(formData.get("slug")),
                    priority: Number(
                        readOptional(formData.get("priority")) ?? "0",
                    ),
                    isActive: readRequired(formData.get("isActive")) === "true",
                },
                identity.email,
            );
            return respond(request, { scale }, 200, returnTo);
        }

        if (kind === "event_type" || kind === "event_ip") {
            const term = await updateVocabularyTerm(
                id,
                {
                    kind,
                    name,
                    slug: readOptional(formData.get("slug")),
                    sortOrder: Number(
                        readOptional(formData.get("sortOrder")) ?? "0",
                    ),
                    isActive: readRequired(formData.get("isActive")) === "true",
                },
                identity.email,
            );
            return respond(request, { term }, 200, returnTo);
        }
    }

    if (kind === "scale") {
        const scale = await createScale(
            {
                name,
                slug: readOptional(formData.get("slug")) ?? slugify(name),
                priority: Number(readOptional(formData.get("priority")) ?? "0"),
            },
            identity.email,
        );
        return respond(request, { scale }, 201, returnTo);
    }

    if (kind === "event_type" || kind === "event_ip") {
        const term = await createVocabularyTerm(
            {
                kind,
                name,
                slug: readOptional(formData.get("slug")) ?? slugify(name),
                sortOrder: Number(
                    readOptional(formData.get("sortOrder")) ?? "0",
                ),
            },
            identity.email,
        );
        return respond(request, { term }, 201, returnTo);
    }

    return json({ error: "invalid_kind" }, 400);
};

function forbidden(): Response {
    return json({ error: "forbidden" }, 403);
}

function json(payload: unknown, status: number): Response {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { "content-type": "application/json; charset=utf-8" },
    });
}

function respond(
    request: Request,
    payload: unknown,
    status: number,
    redirectPath: string,
): Response {
    if (request.headers.get("accept")?.includes("application/json")) {
        return json(payload, status);
    }

    return Response.redirect(new URL(redirectPath, request.url), 303);
}
