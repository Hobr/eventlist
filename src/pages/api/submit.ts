import type { APIRoute } from "astro";
import { handleSubmissionRequest } from "../../lib/public/submission-handler";
import { getRuntimeEnv } from "../../lib/runtime/env";

export const prerender = false;

export const POST: APIRoute = ({ request }) => handleSubmissionRequest(request, getRuntimeEnv());
