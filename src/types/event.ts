export type EventType = "doujin" | "concert";
export type EventStatus = "pending" | "approved" | "rejected";

export interface Event {
  id: string;
  title: string;
  province: string;
  city: string;
  venue: string;
  address: string | null;
  startDate: string;
  endDate: string | null;
  eventType: EventType;
  scale: string | null;
  qqGroup: string | null;
  ticketUrl: string | null;
  posterKey: string | null;
  priceInfo: string | null;
  description: string | null;
  viewCount: number;
  status: EventStatus;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EventWithWorks extends Event {
  works: string[];
}

export interface EventFilters {
  province?: string;
  city?: string;
  eventType?: EventType;
  work?: string;
  scale?: string;
  month?: string;
  page?: number;
}
