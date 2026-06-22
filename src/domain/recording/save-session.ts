import type { AppContext } from '../../core/context.js';
import { createError, success } from '../../core/errors/envelope.js';
import type { McpErrorResponse, McpSuccessResponse } from '../../core/types/responses.js';
import { getDb } from '../../db/client.js';
import { promoteSessionToSaved, type SavedSessionMetadata } from '../../db/save-session-db.js';
import { z } from 'zod';

const saveSessionSchema = z
  .object({
    reportId: z.string().uuid().optional(),
    sessionId: z.string().uuid().optional(),
    name: z.string().min(1).optional(),
  })
  .strict()
  .refine((data) => data.reportId ?? data.sessionId, {
    message: 'reportId or sessionId is required',
  });

export async function saveSession(
  ctx: AppContext,
  input: unknown,
): Promise<McpSuccessResponse<SavedSessionMetadata> | McpErrorResponse> {
  const parsed = saveSessionSchema.safeParse(input);
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

  const reportId = parsed.data.reportId ?? parsed.data.sessionId!;
  const result = await promoteSessionToSaved(db, reportId, parsed.data.name);

  if (!result) {
    return createError('SESSION_NOT_FOUND', `Session '${reportId}' not found`, { reportId });
  }

  return success(result);
}

export { saveSessionSchema };
