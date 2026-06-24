import type { AppContext } from '../../core/context.js';
import { createError, success } from '../../core/errors/envelope.js';
import type { McpErrorResponse, McpSuccessResponse } from '../../core/types/responses.js';
import { mapCdpError } from '../../cdp/error-mapper.js';
import { z } from 'zod';
import { resolveRecordingQuery } from '../elements/element-query.js';
import { findDisambiguationSchema } from '../elements/resolve-find-match.js';
import { resolveActionTarget } from '../shared/resolve-action-target.js';
import { resolveAllowedUploadPath } from '../shared/resolve-upload-path.js';
import {
  emitActionRecording,
  resolvePageSession,
  toCdpPage,
} from '../shared/resolve-page.js';

const pageUploadSchema = z
  .object({
    pageId: z.string().uuid(),
    elementId: z.string().uuid().optional(),
    query: z.string().min(1).optional(),
    preferRegion: findDisambiguationSchema.shape.preferRegion,
    preferRole: findDisambiguationSchema.shape.preferRole,
    candidateIndex: findDisambiguationSchema.shape.candidateIndex,
    files: z.array(z.string().min(1)).min(1),
    clear: z.boolean().optional(),
  })
  .strict()
  .refine((data) => data.elementId ?? data.query, {
    message: 'elementId or query is required',
  })
  .refine((data) => !(data.elementId && data.query), {
    message: 'Provide elementId or query, not both',
  });

export interface UploadResult {
  uploaded: true;
  elementId: string;
  files: string[];
  query?: string;
  matchCount?: number;
  selectedReason?: string;
}

export async function uploadFiles(
  ctx: AppContext,
  input: unknown,
): Promise<McpSuccessResponse<UploadResult> | McpErrorResponse> {
  const parsed = pageUploadSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return createError('INVALID_INPUT', issue?.message ?? 'Invalid input', {
      field: issue?.path.join('.') ?? 'input',
    });
  }

  const { pageId, files, clear, ...targetInput } = parsed.data;

  const pageResult = await resolvePageSession(ctx, pageId);
  if ('error' in pageResult) return pageResult.error;

  const targetResult = await resolveActionTarget(ctx, pageId, targetInput);
  if ('error' in targetResult) return targetResult.error;

  const { element, query: findQuery, matchCount, selectedReason } = targetResult.target;

  const resolvedPaths: string[] = [];
  for (const filePath of files) {
    const allowed = resolveAllowedUploadPath(ctx.config, filePath);
    if ('error' in allowed) {
      return createError('INVALID_INPUT', allowed.error, { field: 'files', filePath });
    }
    resolvedPaths.push(allowed.absolute);
  }

  const cdpPage = toCdpPage(pageResult.page);
  const recordingQuery = resolveRecordingQuery(element, findQuery);

  try {
    await ctx.cdp.uploadFiles(cdpPage, element.selector!, resolvedPaths, {
      tag: element.tag,
      clear,
    });

    emitActionRecording(ctx, pageResult.page.browserId, pageId, {
      action: 'upload',
      elementId: element.elementId,
      files,
      query: recordingQuery,
    });

    return success({
      uploaded: true as const,
      elementId: element.elementId,
      files,
      ...(findQuery !== undefined ? { query: findQuery } : {}),
      ...(matchCount !== undefined ? { matchCount } : {}),
      ...(selectedReason !== undefined ? { selectedReason } : {}),
    });
  } catch (error) {
    const mapped = mapCdpError(error, 'page.upload');
    const code =
      mapped.code === 'INTERNAL_ERROR' &&
      (mapped.message.includes('not found') || mapped.message.includes('file input'))
        ? mapped.message.includes('file input')
          ? 'INVALID_INPUT'
          : 'ELEMENT_NOT_FOUND'
        : mapped.code;

    return createError(code, mapped.message, {
      ...mapped.details,
      pageId,
      elementId: element.elementId,
    });
  }
}

export { pageUploadSchema };
