import type { AppContext } from '../../core/context.js';
import { createError, isErrorResponse, success } from '../../core/errors/envelope.js';
import type { McpErrorResponse, McpSuccessResponse } from '../../core/types/responses.js';
import type { TestReport } from '../recording/generate-report.js';
import { launchBrowser } from '../browser/launch-browser.js';
import { closeBrowser } from '../browser/close-browser.js';
import { createPage } from '../page/create-page.js';
import { navigatePage } from '../page/navigate-page.js';
import { generateReport } from '../recording/generate-report.js';
import { executeStep } from './step-executor.js';
import type { TestStep } from './step-types.js';
import { testStepSchema } from './step-schema.js';
import {
  loadSessionScriptFromFile,
  loadTestSuiteFromFile,
  sessionScriptSchema,
} from '../recording/load-script.js';
import type { SessionScript } from '../recording/script-types.js';
import {
  substituteVariablesInSteps,
  substituteVariablesInUrl,
} from '../recording/resolve-variables.js';
import { z } from 'zod';

const testRunSchema = z
  .object({
    goal: z.string().min(1),
    name: z.string().optional(),
    url: z.string().optional(),
    steps: z.array(testStepSchema).optional(),
    script: sessionScriptSchema.optional(),
    scriptFile: z.string().min(1).optional(),
    scripts: z.array(sessionScriptSchema).min(1).optional(),
    suiteFile: z.string().min(1).optional(),
    variables: z.record(z.string(), z.string()).optional(),
    headless: z.boolean().optional(),
    stopOnFailure: z.boolean().optional(),
    timeoutMs: z.number().int().min(5000).optional(),
  })
  .strict()
  .refine((data) => !(data.scripts && data.suiteFile), {
    message: 'Provide scripts or suiteFile, not both',
  });

export interface TestRunResult {
  report: TestReport;
}

export interface TestSuiteRunResult {
  mode: 'suite';
  suiteStatus: TestReport['status'];
  reports: TestReport[];
}

export interface TestRunGuidance {
  mode: 'agent-driven';
  goal: string;
  guidance: string;
  suggestedTools: string[];
}

interface ResolvedScriptRun {
  testName: string;
  url?: string;
  steps: TestStep[];
}

function isRunError(result: TestReport | McpErrorResponse): result is McpErrorResponse {
  return 'ok' in result && result.ok === false;
}

interface ExecuteRunOptions {
  headless?: boolean;
  stopOnFailure?: boolean;
  timeoutMs: number;
}

async function executeScriptRun(
  ctx: AppContext,
  run: ResolvedScriptRun,
  options: ExecuteRunOptions,
): Promise<TestReport | McpErrorResponse> {
  const { stopOnFailure = true } = options;
  const deadline = Date.now() + options.timeoutMs;
  let browserId: string | undefined;
  let pageId: string | undefined;
  let errorOccurred = false;
  let timedOut = false;
  let report: TestReport | undefined;

  try {
    const launchResult = await launchBrowser(ctx, {
      headless: options.headless ?? ctx.config.headless,
      recordingEnabled: true,
    });
    if (isErrorResponse(launchResult)) return launchResult;
    browserId = launchResult.data.browserId;

    const pageResult = await createPage(ctx, { browserId });
    if (isErrorResponse(pageResult)) {
      errorOccurred = true;
    } else {
      pageId = pageResult.data.pageId;

      if (run.url) {
        const navResult = await navigatePage(ctx, { pageId, url: run.url });
        if (isErrorResponse(navResult) && stopOnFailure) {
          errorOccurred = true;
        }
      }

      if (!errorOccurred || !stopOnFailure) {
        for (const step of run.steps) {
          if (Date.now() > deadline) {
            timedOut = true;
            errorOccurred = true;
            ctx.recording.emit(browserId, {
              type: 'error',
              pageId,
              payload: { message: 'Test exceeded timeoutMs', timeoutMs: options.timeoutMs },
            });
            break;
          }

          const result = await executeStep(ctx, pageId, step);
          if (result.failed && stopOnFailure) {
            break;
          }
        }
      }
    }
  } catch (error) {
    errorOccurred = true;
    if (browserId && ctx.recording.isEnabled(browserId)) {
      ctx.recording.emit(browserId, {
        type: 'error',
        pageId,
        payload: {
          message: error instanceof Error ? error.message : 'Unexpected test error',
        },
      });
    }
  } finally {
    if (browserId) {
      const events = ctx.recording.getEvents(browserId);
      report = generateReport(events, run.testName, { errorOccurred: errorOccurred || timedOut });

      if (timedOut) {
        report.status = 'error';
      }

      await closeBrowser(ctx, { browserId, testName: report.testName });
    }
  }

  if (!report) {
    return createError('INTERNAL_ERROR', 'Failed to launch browser for test run');
  }

  return report;
}

function resolveScriptRun(
  script: SessionScript,
  fallbackName: string,
  fallbackUrl?: string,
): ResolvedScriptRun {
  return {
    testName: script.name ?? fallbackName,
    url: fallbackUrl ?? script.url,
    steps: script.steps as TestStep[],
  };
}

function suiteStatusFromReports(reports: TestReport[]): TestReport['status'] {
  if (reports.some((report) => report.status === 'error')) return 'error';
  if (reports.some((report) => report.status === 'failed')) return 'failed';
  return 'passed';
}

export async function runTest(
  ctx: AppContext,
  input: unknown,
): Promise<
  McpSuccessResponse<TestRunResult | TestSuiteRunResult | TestRunGuidance> | McpErrorResponse
> {
  const parsed = testRunSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return createError('INVALID_INPUT', issue?.message ?? 'Invalid input', {
      field: issue?.path.join('.') ?? 'input',
    });
  }

  const {
    goal,
    name,
    url: inputUrl,
    steps: inputSteps,
    script,
    scriptFile,
    scripts,
    suiteFile,
    variables,
    headless,
    stopOnFailure = true,
    timeoutMs = 60_000,
  } = parsed.data;

  let suiteScripts: SessionScript[] | undefined;

  if (suiteFile) {
    try {
      const suite = loadTestSuiteFromFile(suiteFile);
      suiteScripts = suite.scripts;
    } catch (error) {
      return createError(
        'INVALID_INPUT',
        error instanceof Error ? error.message : 'Failed to load suite file',
        { suiteFile },
      );
    }
  } else if (scripts) {
    suiteScripts = scripts;
  }

  if (suiteScripts) {
    const reports: TestReport[] = [];

    for (const suiteScript of suiteScripts) {
      let run = resolveScriptRun(suiteScript, name ?? goal, inputUrl);

      if (variables && Object.keys(variables).length > 0) {
        const substitutedSteps = substituteVariablesInSteps(run.steps, variables);
        if (!Array.isArray(substitutedSteps)) return substitutedSteps;

        run = { ...run, steps: substitutedSteps };

        if (run.url) {
          const substitutedUrl = substituteVariablesInUrl(run.url, variables);
          if (typeof substitutedUrl !== 'string') return substitutedUrl;
          run = { ...run, url: substitutedUrl };
        }
      }

      const result = await executeScriptRun(ctx, run, { headless, stopOnFailure, timeoutMs });
      if (isRunError(result)) return result;

      reports.push(result);
      if (stopOnFailure && result.status !== 'passed') {
        break;
      }
    }

    return success({
      mode: 'suite' as const,
      suiteStatus: suiteStatusFromReports(reports),
      reports,
    });
  }

  let resolvedSteps = inputSteps;
  let resolvedUrl = inputUrl;
  let resolvedName = name;

  if (scriptFile) {
    try {
      const loaded = loadSessionScriptFromFile(scriptFile);
      resolvedSteps = loaded.steps;
      resolvedUrl = resolvedUrl ?? loaded.url;
      resolvedName = resolvedName ?? loaded.name;
    } catch (error) {
      return createError(
        'INVALID_INPUT',
        error instanceof Error ? error.message : 'Failed to load script file',
        { scriptFile },
      );
    }
  } else if (script) {
    resolvedSteps = script.steps;
    resolvedUrl = resolvedUrl ?? script.url;
    resolvedName = resolvedName ?? script.name;
  }

  if (variables && Object.keys(variables).length > 0) {
    if (resolvedSteps) {
      const substitutedSteps = substituteVariablesInSteps(resolvedSteps, variables);
      if (!Array.isArray(substitutedSteps)) return substitutedSteps;
      resolvedSteps = substitutedSteps;
    }

    if (resolvedUrl) {
      const substitutedUrl = substituteVariablesInUrl(resolvedUrl, variables);
      if (typeof substitutedUrl !== 'string') return substitutedUrl;
      resolvedUrl = substitutedUrl;
    }
  }

  if (!resolvedSteps || resolvedSteps.length === 0) {
    return success({
      mode: 'agent-driven' as const,
      goal,
      guidance:
        'No steps provided. For server-side execution, supply a steps array, script, scripts suite, or suiteFile. For agent-driven flows, call browser_launch, page_create, and individual tools directly.',
      suggestedTools: [
        'browser_launch',
        'page_create',
        'page_navigate',
        'page_find',
        'page_click',
        'page_type',
        'assert_exists',
        'assert_text',
        'assert_url',
        'browser_close',
      ],
    });
  }

  const report = await executeScriptRun(
    ctx,
    {
      testName: resolvedName ?? goal,
      url: resolvedUrl,
      steps: resolvedSteps as TestStep[],
    },
    { headless, stopOnFailure, timeoutMs },
  );

  if (isRunError(report)) return report;

  return success({ report });
}

export { testRunSchema, testStepSchema };
