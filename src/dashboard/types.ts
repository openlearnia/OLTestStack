export type TestReportStatus = 'passed' | 'failed' | 'error';
export type SessionPersistenceFilter = 'all' | 'saved' | 'expiring';

export interface SessionSummary {
  id: string;
  testName: string;
  status: TestReportStatus;
  executionTimeMs: number;
  createdAt: string;
  actionCount: number;
  assertionsPassedCount: number;
  assertionsFailedCount: number;
  eventCount: number;
  saved: boolean;
  savedAt: string | null;
  expiresAt: string | null;
  expiresInHours: number | null;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface SessionsListResponse {
  sessions: SessionSummary[];
  pagination: PaginationMeta;
  dbAvailable: boolean;
  message?: string;
}

export interface RecordedEventDto {
  id: string;
  timestamp: string;
  action: string;
  target: string | null;
  pageId: string | null;
  metadata: Record<string, unknown>;
}

export interface SessionDetailResponse {
  report: {
    id: string;
    browserId: string | null;
    testName: string;
    status: TestReportStatus;
    actionsPerformed: unknown[];
    assertionsPassed: unknown[];
    assertionsFailed: unknown[];
    screenshots: string[];
    networkErrors: unknown[];
    consoleErrors: unknown[];
    errors: unknown[];
    executionTimeMs: number;
    startedAt: string;
    completedAt: string;
    createdAt: string;
    saved: boolean;
    savedAt: string | null;
    expiresAt: string | null;
    expiresInHours: number | null;
  };
  events: RecordedEventDto[];
  dbAvailable: boolean;
  message?: string;
}

export interface SessionEventsResponse {
  reportId: string;
  events: RecordedEventDto[];
  dbAvailable: boolean;
  message?: string;
}

export interface SessionsQueryParams {
  page: number;
  limit: number;
  status?: TestReportStatus;
  search?: string;
  persistence?: SessionPersistenceFilter;
}
