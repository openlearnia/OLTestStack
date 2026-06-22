import { and, count, desc, eq, gt, ilike, isNotNull, sql } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { mapSessionPersistence } from '../db/save-session-db.js';
import { recordedEvents, testReports } from '../db/schema.js';
import type {
  RecordedEventDto,
  SessionDetailResponse,
  SessionEventsResponse,
  SessionsListResponse,
  SessionsQueryParams,
  SessionPersistenceFilter,
  SessionSummary,
} from './types.js';
function jsonArrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function toIso(value: Date | null | undefined): string {
  return value?.toISOString() ?? new Date(0).toISOString();
}

function mapEvent(row: typeof recordedEvents.$inferSelect): RecordedEventDto {
  return {
    id: row.id,
    timestamp: toIso(row.timestamp),
    action: row.action,
    target: row.target,
    pageId: row.pageId,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  };
}

function mapSummary(
  row: typeof testReports.$inferSelect,
  eventCount: number,
  now: Date = new Date(),
): SessionSummary {
  const persistence = mapSessionPersistence(row, now);
  return {
    id: row.id,
    testName: row.testName,
    status: row.status,
    executionTimeMs: row.executionTimeMs,
    createdAt: toIso(row.createdAt),
    actionCount: jsonArrayLength(row.actionsPerformed),
    assertionsPassedCount: jsonArrayLength(row.assertionsPassed),
    assertionsFailedCount: jsonArrayLength(row.assertionsFailed),
    eventCount,
    ...persistence,
  };
}

function parsePersistenceFilter(value: string | null): SessionPersistenceFilter | undefined {
  if (value === 'saved' || value === 'expiring' || value === 'all') {
    return value;
  }
  return undefined;
}

function persistenceConditions(filter: SessionPersistenceFilter | undefined, now: Date) {
  if (filter === 'saved') {
    return eq(testReports.saved, true);
  }
  if (filter === 'expiring') {
    return and(
      eq(testReports.saved, false),
      isNotNull(testReports.expiresAt),
      gt(testReports.expiresAt, now),
    );
  }
  return undefined;
}

export function parseSessionsQueryParams(url: URL): SessionsQueryParams {
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const rawLimit = Number.parseInt(url.searchParams.get('limit') ?? '20', 10) || 20;
  const limit = Math.min(100, Math.max(1, rawLimit));

  const statusParam = url.searchParams.get('status');
  const status =
    statusParam === 'passed' || statusParam === 'failed' || statusParam === 'error'
      ? statusParam
      : undefined;

  const search = url.searchParams.get('search')?.trim() || undefined;
  const persistence = parsePersistenceFilter(url.searchParams.get('persistence'));

  return { page, limit, status, search, persistence };
}

export async function listSessions(
  db: Database,
  params: SessionsQueryParams,
): Promise<SessionsListResponse> {
  const now = new Date();
  const conditions = [];
  if (params.status) {
    conditions.push(eq(testReports.status, params.status));
  }
  if (params.search) {
    conditions.push(ilike(testReports.testName, `%${params.search}%`));
  }
  const persistenceClause = persistenceConditions(params.persistence, now);
  if (persistenceClause) {
    conditions.push(persistenceClause);
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db
    .select({ total: count() })
    .from(testReports)
    .where(whereClause);

  const offset = (params.page - 1) * params.limit;

  const rows = await db
    .select({
      report: testReports,
      eventCount: sql<number>`coalesce((
        select count(*)::int from ${recordedEvents}
        where ${recordedEvents.reportId} = ${testReports.id}
      ), 0)`.as('event_count'),
    })
    .from(testReports)
    .where(whereClause)
    .orderBy(desc(testReports.createdAt))
    .limit(params.limit)
    .offset(offset);

  const sessions = rows.map((row) => mapSummary(row.report, row.eventCount, now));
  const totalPages = total === 0 ? 0 : Math.ceil(total / params.limit);

  return {
    sessions,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages,
    },
    dbAvailable: true,
    message:
      total === 0
        ? 'No sessions yet. Sessions persist automatically when DATABASE_URL is set.'
        : undefined,
  };
}

export async function getSessionDetail(
  db: Database,
  reportId: string,
): Promise<SessionDetailResponse | null> {
  const [report] = await db.select().from(testReports).where(eq(testReports.id, reportId)).limit(1);

  if (!report) return null;

  const events = await db
    .select()
    .from(recordedEvents)
    .where(eq(recordedEvents.reportId, reportId))
    .orderBy(recordedEvents.timestamp);

  const persistence = mapSessionPersistence(report);

  return {
    report: {
      id: report.id,
      browserId: report.browserId,
      testName: report.testName,
      status: report.status,
      actionsPerformed: report.actionsPerformed as unknown[],
      assertionsPassed: report.assertionsPassed as unknown[],
      assertionsFailed: report.assertionsFailed as unknown[],
      screenshots: report.screenshots as string[],
      networkErrors: report.networkErrors as unknown[],
      consoleErrors: report.consoleErrors as unknown[],
      errors: report.errors as unknown[],
      executionTimeMs: report.executionTimeMs,
      startedAt: toIso(report.startedAt),
      completedAt: toIso(report.completedAt),
      createdAt: toIso(report.createdAt),
      ...persistence,
    },
    events: events.map(mapEvent),
    dbAvailable: true,
  };
}

export async function getSessionEvents(
  db: Database,
  reportId: string,
): Promise<SessionEventsResponse | null> {
  const [report] = await db
    .select({ id: testReports.id })
    .from(testReports)
    .where(eq(testReports.id, reportId))
    .limit(1);

  if (!report) return null;

  const events = await db
    .select()
    .from(recordedEvents)
    .where(eq(recordedEvents.reportId, reportId))
    .orderBy(recordedEvents.timestamp);

  return {
    reportId,
    events: events.map(mapEvent),
    dbAvailable: true,
  };
}

export function emptySessionsResponse(message: string): SessionsListResponse {
  return {
    sessions: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    dbAvailable: false,
    message,
  };
}

export function dbUnavailableMessage(databaseUrl?: string): string {
  if (!databaseUrl) {
    return 'DATABASE_URL is not configured. Set it to store and browse sessions.';
  }
  return 'Database is unreachable. Check DATABASE_URL and that Postgres is running.';
}

export function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
