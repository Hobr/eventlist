import type { D1Database } from "../../types/cloudflare";
import type { SubmissionInput } from "../events/input";
import { requireD1Success, STATUS } from "./index";

export type { EventBaseInput, SubmissionInput } from "../events/input";

export async function insertSubmission(db: D1Database, input: SubmissionInput) {
    const inserted = await db
        .prepare(
            `INSERT INTO events(
                 title, type, scale, division_code, venue, address,
                 start_date, end_date, start_time, end_time, cover_url, description,
                 qq_group, ticket_url, source_url, organizer, schedule_status, admission_method,
                 price_range, admission_start_date, admission_start_time,
                 submitter_contact, tag_suggestions, status
             )
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
            input.title,
            input.type,
            input.scale,
            input.division_code,
            input.venue,
            input.address,
            input.start_date,
            input.end_date,
            input.start_time,
            input.end_time,
            input.cover_url,
            input.description,
            input.qq_group,
            input.ticket_url,
            input.source_url,
            input.organizer,
            input.schedule_status,
            input.admission_method,
            input.price_range,
            input.admission_start_date,
            input.admission_start_time,
            input.submitter_contact,
            input.tag_suggestions,
            STATUS.PENDING
        )
        .run();
    requireD1Success(inserted, "Failed to insert submission");
    if (!inserted.meta.last_row_id) {
        throw new Error("Failed to insert submission");
    }

    return inserted.meta.last_row_id;
}
