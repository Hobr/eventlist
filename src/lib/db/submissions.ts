import type { D1Database } from "../../types/cloudflare";
import type {
    EventAdmissionMethod,
    EventScale,
    EventScheduleStatus,
    EventType
} from "../events/options";
import { requireD1Success, STATUS } from "./index";

export interface EventBaseInput {
    title: string;
    type: EventType;
    scale: EventScale;
    division_code: string;
    venue: string;
    address: string | null;
    start_date: string;
    end_date: string;
    start_time: string | null;
    end_time: string | null;
    cover_url: string | null;
    description: string | null;
    qq_group: string | null;
    ticket_url: string | null;
    source_url: string;
    organizer: string | null;
    schedule_status: EventScheduleStatus | null;
    admission_method: EventAdmissionMethod | null;
    price_range: string | null;
    admission_start_date: string | null;
    admission_start_time: string | null;
    submitter_contact: string;
}

export interface SubmissionInput extends EventBaseInput {
    tag_suggestions: string | null;
}

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
