import type { AppContext } from '../../core/context.js';
import type { RecordedEvent } from '../../core/types/sessions.js';
import { elementToQuery } from '../elements/element-query.js';
import type { TestStep } from '../test/step-types.js';
import { SESSION_SCRIPT_VERSION, type SessionScript } from './script-types.js';

async function resolveQueryFromElementId(
  ctx: AppContext,
  pageId: string | undefined,
  elementId: unknown,
): Promise<string | undefined> {
  if (typeof elementId !== 'string' || !pageId) return undefined;
  const element = await ctx.registry.getElement(pageId, elementId);
  if (!element) return undefined;
  if (typeof element.discoveredQuery === 'string' && element.discoveredQuery.length > 0) {
    return element.discoveredQuery;
  }
  return elementToQuery(element);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export async function eventsToScript(
  ctx: AppContext,
  events: RecordedEvent[],
  options: {
    name: string;
    goal?: string;
    browserId?: string;
  },
): Promise<SessionScript> {
  const warnings: string[] = [];
  const steps: TestStep[] = [];
  let startUrl: string | undefined;

  for (const event of events) {
    switch (event.type) {
      case 'navigation': {
        const url = asString(event.payload.url);
        if (!url) {
          warnings.push(`Skipped navigation event without url at ${event.timestamp}`);
          break;
        }
        if (!startUrl) startUrl = url;
        steps.push({ action: 'navigate', url });
        break;
      }

      case 'action': {
        const action = asString(event.payload.action);
        if (!action) {
          warnings.push(`Skipped action event without action at ${event.timestamp}`);
          break;
        }

        switch (action) {
          case 'click': {
            const query =
              asString(event.payload.query) ??
              (await resolveQueryFromElementId(ctx, event.pageId, event.payload.elementId));
            if (!query) {
              warnings.push(
                `Skipped click at ${event.timestamp}: could not resolve query for elementId ${String(event.payload.elementId ?? 'unknown')}`,
              );
              break;
            }
            steps.push({ action: 'click', query });
            break;
          }

          case 'type': {
            const value = asString(event.payload.value);
            if (value === undefined) {
              warnings.push(`Skipped type at ${event.timestamp}: missing value`);
              break;
            }
            const query =
              asString(event.payload.query) ??
              (await resolveQueryFromElementId(ctx, event.pageId, event.payload.elementId));
            if (!query) {
              warnings.push(
                `Skipped type at ${event.timestamp}: could not resolve query for elementId ${String(event.payload.elementId ?? 'unknown')}`,
              );
              break;
            }
            steps.push({ action: 'type', query, value });
            break;
          }

          case 'press': {
            const key = asString(event.payload.key);
            if (!key) {
              warnings.push(`Skipped press at ${event.timestamp}: missing key`);
              break;
            }
            steps.push({ action: 'press', key });
            break;
          }

          case 'scroll': {
            const direction = event.payload.direction;
            if (direction !== 'up' && direction !== 'down' && direction !== 'left' && direction !== 'right') {
              warnings.push(`Skipped scroll at ${event.timestamp}: invalid direction`);
              break;
            }
            steps.push({ action: 'scroll', direction });
            break;
          }

          default:
            warnings.push(`Skipped unsupported action '${action}' at ${event.timestamp}`);
        }
        break;
      }

      case 'assertion': {
        const assertion = asString(event.payload.assertion);
        if (!assertion) {
          warnings.push(`Skipped assertion event without assertion type at ${event.timestamp}`);
          break;
        }

        switch (assertion) {
          case 'exists': {
            const query =
              asString(event.payload.query) ??
              (await resolveQueryFromElementId(ctx, event.pageId, event.payload.elementId));
            if (!query) {
              warnings.push(`Skipped assert.exists at ${event.timestamp}: could not resolve query`);
              break;
            }
            steps.push({ action: 'assert.exists', query });
            break;
          }

          case 'text': {
            const contains =
              asString(event.payload.contains) ??
              asString((event.payload.expected as Record<string, unknown> | undefined)?.text);
            if (!contains) {
              warnings.push(`Skipped assert.text at ${event.timestamp}: missing contains text`);
              break;
            }
            const match =
              event.payload.match === 'equals' || event.payload.match === 'contains'
                ? event.payload.match
                : ((event.payload.expected as Record<string, unknown> | undefined)?.match === 'equals'
                    ? 'equals'
                    : 'contains');
            steps.push({ action: 'assert.text', contains, match });
            break;
          }

          case 'url': {
            const url =
              asString(event.payload.url) ??
              asString((event.payload.expected as Record<string, unknown> | undefined)?.url);
            if (!url) {
              warnings.push(`Skipped assert.url at ${event.timestamp}: missing url`);
              break;
            }
            const match =
              event.payload.match === 'equals' || event.payload.match === 'contains'
                ? event.payload.match
                : ((event.payload.expected as Record<string, unknown> | undefined)?.match === 'equals'
                    ? 'equals'
                    : 'contains');
            steps.push({ action: 'assert.url', url, match });
            break;
          }

          case 'network': {
            const matchedRequest = event.payload.matchedRequest as Record<string, unknown> | undefined;
            const expected = event.payload.expected as Record<string, unknown> | undefined;
            const url = asString(event.payload.url) ?? asString(matchedRequest?.url) ?? asString(expected?.url);
            const status =
              event.payload.status ??
              matchedRequest?.status ??
              expected?.status;
            if (!url || status === undefined) {
              warnings.push(`Skipped assert.network at ${event.timestamp}: missing url or status`);
              break;
            }
            steps.push({
              action: 'assert.network',
              url,
              status: typeof status === 'number' || typeof status === 'string' ? status : String(status),
            });
            break;
          }

          default:
            warnings.push(`Skipped unsupported assertion '${assertion}' at ${event.timestamp}`);
        }
        break;
      }

      case 'screenshot': {
        steps.push({
          action: 'screenshot',
          fullPage: event.payload.fullPage === true,
        });
        break;
      }

      case 'network':
      case 'console':
      case 'error':
        break;
    }
  }

  const dedupedSteps = dedupeInitialNavigate(steps, startUrl);

  return {
    version: SESSION_SCRIPT_VERSION,
    name: options.name,
    goal: options.goal,
    url: startUrl,
    recordedAt: events[0]?.timestamp ?? new Date().toISOString(),
    browserId: options.browserId,
    steps: dedupedSteps,
    ...(warnings.length > 0 ? { exportWarnings: warnings } : {}),
  };
}

function dedupeInitialNavigate(steps: TestStep[], startUrl: string | undefined): TestStep[] {
  if (!startUrl || steps.length === 0) return steps;
  const [first, ...rest] = steps;
  if (first?.action === 'navigate' && first.url === startUrl) {
    return rest;
  }
  return steps;
}
