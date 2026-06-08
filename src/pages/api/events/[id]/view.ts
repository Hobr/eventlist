import type { APIRoute } from "astro";
import { getClientIp, getWorkerEnv } from "../../../../server/env";
import { recordEventView } from "../../../../server/events/hotness";
import { hashVisitorIp } from "../../../../server/security/ip-hash";

export const POST: APIRoute = async ({ params, request }) => {
    const eventId = params.id;
    const env = getWorkerEnv();

    if (!eventId || !env) {
        return new Response(null, { status: 204 });
    }

    try {
        const visitorHash = await hashVisitorIp(
            getClientIp(request),
            env.IP_HASH_SECRET || "development-ip-secret",
        );
        await recordEventView({ eventId, visitorHash });
    } catch {
        return new Response(null, { status: 204 });
    }

    return new Response(null, { status: 204 });
};
