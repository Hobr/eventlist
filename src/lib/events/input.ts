import type { EventAdmissionMethod, EventScale, EventScheduleStatus, EventType } from "./options";

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

export interface AdminEventInput extends EventBaseInput {
    tags: string[];
}
