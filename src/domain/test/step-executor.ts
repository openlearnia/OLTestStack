import type { AppContext } from '../../core/context.js';
import { isErrorResponse } from '../../core/errors/envelope.js';
import type { McpErrorResponse, McpSuccessResponse } from '../../core/types/responses.js';
import { assertExists } from '../assertions/exists.js';
import { assertNetwork } from '../assertions/network.js';
import { assertText } from '../assertions/text.js';
import { assertUrl } from '../assertions/url.js';
import { clickElement } from '../actions/click.js';
import { pressKey } from '../actions/press.js';
import { scrollPage } from '../actions/scroll.js';
import { typeIntoElement } from '../actions/type.js';
import { findElement } from '../elements/find-element.js';
import { captureScreenshot } from '../inspection/screenshot.js';
import { navigatePage } from '../page/navigate-page.js';
import { waitForCondition } from '../waiting/wait.js';
import type { StepExecutionResult, TestStep } from './step-types.js';

function isSoftAssertSuccess(result: { ok: boolean; data?: unknown }): boolean {
  return (
    result.ok === true &&
    typeof result.data === 'object' &&
    result.data !== null &&
    'passed' in result.data &&
    (result.data as { passed?: boolean }).passed === false &&
    'soft' in result.data &&
    (result.data as { soft?: boolean }).soft === true
  );
}

async function handleAssertStepResult(
  result: McpSuccessResponse<unknown> | McpErrorResponse,
  captureOnPass: () => Promise<unknown>,
): Promise<StepExecutionResult> {
  if (isErrorResponse(result)) {
    const assertionFailure = result.error.code === 'ASSERTION_FAILED';
    if (assertionFailure) {
      await captureOnPass();
    }
    return {
      success: false,
      failed: true,
      assertionFailure,
      message: result.error.message,
    };
  }

  if (isSoftAssertSuccess(result)) {
    return {
      success: true,
      failed: false,
      assertionFailure: false,
      softFailure: true,
      message: String((result.data as { message?: string }).message ?? 'Soft assertion failed'),
    };
  }

  await captureOnPass();
  return { success: true, failed: false, assertionFailure: false };
}

async function resolveElementId(
  ctx: AppContext,
  pageId: string,
  query: string,
): Promise<{ elementId: string } | McpErrorResponse> {
  const result = await findElement(ctx, { pageId, query });
  if (isErrorResponse(result)) return result;
  return { elementId: result.data.element.elementId };
}

export async function executeStep(
  ctx: AppContext,
  pageId: string,
  step: TestStep,
): Promise<StepExecutionResult> {
  switch (step.action) {
    case 'navigate': {
      const result = await navigatePage(ctx, {
        pageId,
        url: step.url,
        waitUntil: step.waitUntil,
      });
      if (isErrorResponse(result)) {
        return { success: false, failed: true, assertionFailure: false, message: result.error.message };
      }
      return { success: true, failed: false, assertionFailure: false };
    }

    case 'click': {
      const resolved = await resolveElementId(ctx, pageId, step.query);
      if ('ok' in resolved) {
        return {
          success: false,
          failed: true,
          assertionFailure: false,
          message: resolved.error.message,
        };
      }
      const result = await clickElement(ctx, { pageId, elementId: resolved.elementId });
      if (isErrorResponse(result)) {
        return { success: false, failed: true, assertionFailure: false, message: result.error.message };
      }
      return { success: true, failed: false, assertionFailure: false };
    }

    case 'type': {
      const resolved = await resolveElementId(ctx, pageId, step.query);
      if ('ok' in resolved) {
        return {
          success: false,
          failed: true,
          assertionFailure: false,
          message: resolved.error.message,
        };
      }
      const result = await typeIntoElement(ctx, {
        pageId,
        elementId: resolved.elementId,
        value: step.value,
      });
      if (isErrorResponse(result)) {
        return { success: false, failed: true, assertionFailure: false, message: result.error.message };
      }
      return { success: true, failed: false, assertionFailure: false };
    }

    case 'press': {
      const result = await pressKey(ctx, { pageId, key: step.key });
      if (isErrorResponse(result)) {
        return { success: false, failed: true, assertionFailure: false, message: result.error.message };
      }
      return { success: true, failed: false, assertionFailure: false };
    }

    case 'scroll': {
      const result = await scrollPage(ctx, { pageId, direction: step.direction });
      if (isErrorResponse(result)) {
        return { success: false, failed: true, assertionFailure: false, message: result.error.message };
      }
      return { success: true, failed: false, assertionFailure: false };
    }

    case 'wait': {
      const result = await waitForCondition(ctx, {
        pageId,
        condition: step.condition,
        query: step.query,
        value: step.value,
        match: step.match,
        durationMs: step.durationMs,
      });
      if (isErrorResponse(result)) {
        return { success: false, failed: true, assertionFailure: false, message: result.error.message };
      }
      return { success: true, failed: false, assertionFailure: false };
    }

    case 'screenshot': {
      const result = await captureScreenshot(ctx, { pageId, fullPage: step.fullPage });
      if (isErrorResponse(result)) {
        return { success: false, failed: true, assertionFailure: false, message: result.error.message };
      }
      return { success: true, failed: false, assertionFailure: false };
    }

    case 'assert.exists': {
      const result = await assertExists(ctx, { pageId, query: step.query, soft: step.soft });
      return handleAssertStepResult(result, () => captureScreenshot(ctx, { pageId }));
    }

    case 'assert.text': {
      const result = await assertText(ctx, {
        pageId,
        contains: step.contains,
        match: step.match,
        soft: step.soft,
      });
      return handleAssertStepResult(result, () => captureScreenshot(ctx, { pageId }));
    }

    case 'assert.url': {
      const result = await assertUrl(ctx, {
        pageId,
        url: step.url,
        match: step.match,
        soft: step.soft,
      });
      return handleAssertStepResult(result, () => captureScreenshot(ctx, { pageId }));
    }

    case 'assert.network': {
      const result = await assertNetwork(ctx, {
        pageId,
        url: step.url,
        status: step.status,
        soft: step.soft,
      });
      return handleAssertStepResult(result, () => captureScreenshot(ctx, { pageId }));
    }

    default:
      return {
        success: false,
        failed: true,
        assertionFailure: false,
        message: 'Unknown step action',
      };
  }
}
