import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const pomodoroSessionsTable = pgTable("pomodoro_sessions", {
  id: serial("id").primaryKey(),
  cardId: text("card_id"),
  durationMinutes: integer("duration_minutes").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertPomodoroSessionSchema = createInsertSchema(
  pomodoroSessionsTable,
).omit({
  id: true,
  createdAt: true,
});

export type InsertPomodoroSession = z.infer<typeof insertPomodoroSessionSchema>;
export type PomodoroSession = typeof pomodoroSessionsTable.$inferSelect;