import type { ConsoleEntry } from '../../cdp/adapter.js';
import type { AppContext } from '../../core/context.js';
import { createError, success } from '../../core/errors/envelope.js';
import type { McpErrorResponse, McpSuccessResponse } from '../../core/types/responses.js';
import { z } from 'zod';
import { resolvePageSession, toCdpPage } from '../shared/resolve-page.js';

const consoleSchema = z
  .object({
    pageId: z.string().uuid(),
    level: z.enum(['all', 'error', 'warn', 'log', 'info', 'debug']).optional(),
  })
  .strict();

export interface ConsoleResult {
  messages: ConsoleEntry[];
  count: number;
  errorCount: number;
  warnCount: number;
}

export function filterConsoleEntries(
  entries: ConsoleEntry[],
  level: ConsoleSchemaLevel = 'all',
): ConsoleEntry[] {
  if (level === 'all') return entries;
  return entries.filter((entry) => entry.level === level);
}

type ConsoleSchemaLevel = 'all' | 'error' | 'warn' | 'log' | 'info' | 'debug';

export async function queryConsole(
  ctx: AppContext,
  input: unknown,
): Promise<McpSuccessResponse<ConsoleResult> | McpErrorResponse> {
  const parsed = consoleSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return createError('INVALID_INPUT', issue?.message ?? 'Invalid input', {
      field: issue?.path.join('.') ?? 'input',
    });
  }

  const { pageId, level = 'all' } = parsed.data;
  const pageResult = await resolvePageSession(ctx, pageId);
  if ('error' in pageResult) return pageResult.error;

  const cdpPage = toCdpPage(pageResult.page);
  const allMessages = ctx.cdp.getConsoleEntries(cdpPage);
  const messages = filterConsoleEntries(allMessages, level);
  const errorCount = allMessages.filter((entry) => entry.level === 'error').length;
  const warnCount = allMessages.filter((entry) => entry.level === 'warn').length;

  return success({ messages, count: messages.length, errorCount, warnCount });
}

export { consoleSchema };
