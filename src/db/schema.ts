import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const testReportStatusEnum = pgEnum('test_report_status', ['passed', 'failed', 'error']);

export const testReports = pgTable(
  'test_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    browserId: varchar('browser_id', { length: 64 }),
    testName: varchar('test_name', { length: 512 }).notNull(),
    status: testReportStatusEnum('status').notNull(),
    actionsPerformed: jsonb('actions_performed').notNull().default([]),
    assertionsPassed: jsonb('assertions_passed').notNull().default([]),
    assertionsFailed: jsonb('assertions_failed').notNull().default([]),
    screenshots: jsonb('screenshots').notNull().default([]),
    networkErrors: jsonb('network_errors').notNull().default([]),
    consoleErrors: jsonb('console_errors').notNull().default([]),
    errors: jsonb('errors').notNull().default([]),
    executionTimeMs: integer('execution_time_ms').notNull().default(0),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('test_reports_browser_id_idx').on(table.browserId)],
);

export const recordedEvents = pgTable(
  'recorded_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reportId: uuid('report_id').references(() => testReports.id, { onDelete: 'cascade' }),
    browserId: varchar('browser_id', { length: 64 }).notNull(),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
    action: varchar('action', { length: 64 }).notNull(),
    target: text('target'),
    pageId: varchar('page_id', { length: 64 }),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('recorded_events_report_id_idx').on(table.reportId),
    index('recorded_events_browser_id_idx').on(table.browserId),
    index('recorded_events_timestamp_idx').on(table.timestamp),
  ],
);

/** Optional audit trail — active sessions stay in-memory; rows written on close. */
export const browserSessions = pgTable(
  'browser_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    browserId: varchar('browser_id', { length: 64 }).notNull().unique(),
    headless: varchar('headless', { length: 8 }).notNull(),
    recordingEnabled: varchar('recording_enabled', { length: 8 }).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('browser_sessions_browser_id_idx').on(table.browserId)],
);

export const pageSessions = pgTable(
  'page_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pageId: varchar('page_id', { length: 64 }).notNull().unique(),
    browserId: varchar('browser_id', { length: 64 }).notNull(),
    url: text('url').notNull().default(''),
    title: text('title').notNull().default(''),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('page_sessions_page_id_idx').on(table.pageId),
    index('page_sessions_browser_id_idx').on(table.browserId),
  ],
);

export type TestReportRow = typeof testReports.$inferSelect;
export type RecordedEventRow = typeof recordedEvents.$inferSelect;
