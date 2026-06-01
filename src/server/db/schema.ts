import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  province: text("province").notNull(),
  city: text("city").notNull(),
  venue: text("venue").notNull(),
  address: text("address"),
  startDate: text("start_date").notNull(),
  endDate: text("end_date"),
  eventType: text("event_type", { enum: ["doujin", "concert"] }).notNull(),
  scale: text("scale"),
  qqGroup: text("qq_group"),
  ticketUrl: text("ticket_url"),
  posterKey: text("poster_key"),
  priceInfo: text("price_info"),
  description: text("description"),
  viewCount: integer("view_count").notNull().default(0),
  status: text("status", { enum: ["pending", "approved", "rejected"] })
    .notNull()
    .default("pending"),
  deletedAt: text("deleted_at"),
  createdAt: text("created_at")
    .notNull()
    .default("(datetime('now'))"),
  updatedAt: text("updated_at")
    .notNull()
    .default("(datetime('now'))"),
});

export const eventWorks = sqliteTable(
  "event_works",
  {
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    workName: text("work_name").notNull(),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.workName] })]
);
