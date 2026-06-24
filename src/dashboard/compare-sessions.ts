import type { Database } from '../db/client.js';
import { loadRecordedEventsForReport, loadTestReportById } from '../db/load-recorded-events.js';
import { eventsToScript } from '../domain/recording/events-to-script.js';
import type { AppContext } from '../core/context.js';

export interface SessionCompareSummary {
  reportId: string;
  testName: string;
  status: string;
  eventCount: number;
  stepCount: number;
  assertionPassCount: number;
  assertionFailCount: number;
}

export interface SessionCompareResult {
  baseline: SessionCompareSummary;
  candidate: SessionCompareSummary;
  diff: {
    eventCountDelta: number;
    stepCountDelta: number;
    assertionPassDelta: number;
    assertionFailDelta: number;
    statusChanged: boolean;
    testNameChanged: boolean;
  };
}

async function summarizeSession(
  ctx: AppContext,
  db: Database,
  reportId: string,
): Promise<SessionCompareSummary | null> {
  const report = await loadTestReportById(db, reportId);
  if (!report) return null;

  const events = await loadRecordedEventsForReport(db, reportId);
  const script = await eventsToScript(ctx, events, {
    name: report.testName,
    browserId: report.browserId ?? undefined,
  });

  const assertionPassCount = events.filter(
    (event) => event.type === 'assertion' && event.payload.passed === true,
  ).length;
  const assertionFailCount = events.filter(
    (event) => event.type === 'assertion' && event.payload.passed === false && !event.payload.soft,
  ).length;

  return {
    reportId,
    testName: report.testName,
    status: report.status,
    eventCount: events.length,
    stepCount: script.steps.length,
    assertionPassCount,
    assertionFailCount,
  };
}

export async function compareSessions(
  ctx: AppContext,
  db: Database,
  baselineId: string,
  candidateId: string,
): Promise<SessionCompareResult | null> {
  const baseline = await summarizeSession(ctx, db, baselineId);
  const candidate = await summarizeSession(ctx, db, candidateId);

  if (!baseline || !candidate) return null;

  return {
    baseline,
    candidate,
    diff: {
      eventCountDelta: candidate.eventCount - baseline.eventCount,
      stepCountDelta: candidate.stepCount - baseline.stepCount,
      assertionPassDelta: candidate.assertionPassCount - baseline.assertionPassCount,
      assertionFailDelta: candidate.assertionFailCount - baseline.assertionFailCount,
      statusChanged: baseline.status !== candidate.status,
      testNameChanged: baseline.testName !== candidate.testName,
    },
  };
}
