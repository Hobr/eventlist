import { handle } from "@astrojs/cloudflare/handler";
import { getDB } from "./lib/db";
import { deleteExpiredEventVisitors } from "./lib/db/views";

const worker = {
    fetch: handle,
    async scheduled(_controller, env) {
        try {
            const deleted = await deleteExpiredEventVisitors(getDB({ DB: env.DB }));
            console.info(
                JSON.stringify({
                    event: "event_visitors_cleanup",
                    status: "completed",
                    deleted
                })
            );
        } catch {
            console.error(
                JSON.stringify({
                    event: "event_visitors_cleanup",
                    status: "failed"
                })
            );
            throw new Error("Event visitor cleanup failed");
        }
    }
} satisfies ExportedHandler<Env>;

export default worker;
