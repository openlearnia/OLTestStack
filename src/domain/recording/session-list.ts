import type { AppContext } from '../../core/context.js';
import { createError, success } from '../../core/errors/envelope.js';
import type { McpErrorResponse, McpSuccessResponse } from '../../core/types/responses.js';
import { getDb } from '../../db/client.js';
import { listSessions } from '../../dashboard/queries.js';
import type { SessionsListResponse, SessionPersistenceFilter, TestReportStatus } from '../../dashboard/types.js';
import { z } from 'zod';

const sessionListSchema = z
  .object({
    page: z.number().int().min(1).optional().default(1),
    limit: z.number().int().min(1).max(100).optional().default(20),
    status: z.enum(['passed', 'failed', 'error']).optional(),
    search: z.string().min(1).optional(),
    persistence: z.enum(['all', 'saved', 'expiring']).optional(),
  })
  .strict();

export async function listPersistedSessions(
  ctx: AppContext,
  input: unknown,
): Promise<McpSuccessResponse<SessionsListResponse> | McpErrorResponse> {
  const parsed = sessionListSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return createError('INVALID_INPUT', issue?.message ?? 'Invalid input', {
      field: issue?.path.join('.') ?? 'input',
    });
  }

  if (!ctx.config.databaseUrl) {
    return createError(
      'INTERNAL_ERROR',
      'DATABASE_URL is not configured. Persistence requires a PostgreSQL connection.',
    );
  }

  const db = getDb(ctx.config);
  if (!db) {
    return createError('INTERNAL_ERROR', 'Failed to initialize database client');
  }

  const { page, limit, status, search, persistence } = parsed.data;
  const result = await listSessions(db, {
    page,
    limit,
    status: status as TestReportStatus | undefined,
    search,
    persistence: persistence as SessionPersistenceFilter | undefined,
  });

  return success(result);
}

export { sessionListSchema };
