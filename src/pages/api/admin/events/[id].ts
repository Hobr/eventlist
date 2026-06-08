import type { APIRoute } from "astro";
import { getAdminIdentity } from "../../../../server/admin/auth";
import {
    archiveAdminEvent,
    approveAdminEvent,
    getAdminEvent,
    rejectAdminEvent,
    restoreAdminEvent,
    updateAdminEvent,
} from "../../../../server/admin/events";
import { setCoverStatus } from "../../../../server/admin/covers";
import { getWorkerEnv } from "../../../../server/env";
import { readOptional, readRequired } from "../../../../server/events/utils";

export const GET: APIRoute = async ({ params, request }) => {
    const env = getWorkerEnv();
    const identity = await getAdminIdentity(request, env ?? {});
    if (!identity) return forbidden();

    const event = params.id ? await getAdminEvent(params.id) : null;
    return event ? json({ event }, 200) : json({ error: "not_found" }, 404);
};

export const POST: APIRoute = async ({ params, request }) => {
    const env = getWorkerEnv();
    const identity = await getAdminIdentity(request, env ?? {});
    if (!identity) return forbidden();
    if (!params.id) return json({ error: "missing_id" }, 400);

    const formData = await request.formData();
    const action = readRequired(formData.get("action"));

    if (action === "approve") {
        const event = await approveAdminEvent(
            params.id,
            {
                typeId: readRequired(formData.get("typeId")),
                eventIpId: readRequired(formData.get("eventIpId")),
                scaleId: readRequired(formData.get("scaleId")),
                note: readOptional(formData.get("note")),
            },
            identity.email,
        );
        return respond(request, { event }, 200, `/admin/events/${event.id}`);
    }

    if (action === "reject") {
        const event = await rejectAdminEvent(
            params.id,
            identity.email,
            readOptional(formData.get("internalNote")),
        );
        return respond(request, { event }, 200, `/admin/events/${event.id}`);
    }

    if (action === "archive") {
        const event = await archiveAdminEvent(
            params.id,
            identity.email,
            readOptional(formData.get("internalNote")),
        );
        return respond(request, { event }, 200, `/admin/events/${event.id}`);
    }

    if (action === "restore") {
        const event = await restoreAdminEvent(
            params.id,
            identity.email,
            readOptional(formData.get("internalNote")),
        );
        return respond(request, { event }, 200, `/admin/events/${event.id}`);
    }

    if (action === "cover") {
        const cover = await setCoverStatus(
            readRequired(formData.get("coverId")),
            readRequired(formData.get("coverStatus")) as
                | "approved"
                | "rejected"
                | "removed",
            identity.email,
            { publicUrl: readOptional(formData.get("publicUrl")) },
        );
        return respond(request, { cover }, 200, `/admin/events/${params.id}`);
    }

    const event = await updateAdminEvent(
        params.id,
        {
            name: readOptional(formData.get("name")),
            city: readOptional(formData.get("city")),
            venue: readOptional(formData.get("venue")),
            address: readOptional(formData.get("address")),
            startsAt: readOptional(formData.get("startsAt")),
            endsAt: readOptional(formData.get("endsAt")),
            typeId: readOptional(formData.get("typeId")),
            eventIpId: readOptional(formData.get("eventIpId")),
            scaleId: readOptional(formData.get("scaleId")),
            officialQqGroup: readOptional(formData.get("officialQqGroup")),
            ticketUrl: readOptional(formData.get("ticketUrl")),
            description: readOptional(formData.get("description")),
            internalNote: readOptional(formData.get("internalNote")),
        },
        identity.email,
    );
    return respond(request, { event }, 200, `/admin/events/${event.id}`);
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
