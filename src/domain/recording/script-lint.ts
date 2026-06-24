import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AppContext } from '../../core/context.js';
import { createError, success } from '../../core/errors/envelope.js';
import type { McpErrorResponse, McpSuccessResponse } from '../../core/types/responses.js';
import { z } from 'zod';
import { sessionScriptSchema } from './load-script.js';
import type { SessionScript } from './script-types.js';

const scriptLintSchema = z
  .object({
    script: z.unknown().optional(),
    scriptFile: z.string().min(1).optional(),
  })
  .strict()
  .refine((data) => data.script ?? data.scriptFile, {
    message: 'script or scriptFile is required',
  })
  .refine((data) => !(data.script && data.scriptFile), {
    message: 'Provide script or scriptFile, not both',
  });

export interface ScriptLintIssue {
  path: string;
  message: string;
}

export interface ScriptLintResult {
  valid: boolean;
  script?: SessionScript;
  stepCount?: number;
  issues: ScriptLintIssue[];
}

function zodIssuesToLintIssues(error: z.ZodError): ScriptLintIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.') || 'root',
    message: issue.message,
  }));
}

export async function lintScript(
  _ctx: AppContext,
  input: unknown,
): Promise<McpSuccessResponse<ScriptLintResult> | McpErrorResponse> {
  const parsed = scriptLintSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return createError('INVALID_INPUT', issue?.message ?? 'Invalid input', {
      field: issue?.path.join('.') ?? 'input',
    });
  }

  let raw: unknown;
  if (parsed.data.scriptFile) {
    try {
      const absolutePath = resolve(parsed.data.scriptFile);
      raw = JSON.parse(readFileSync(absolutePath, 'utf8'));
    } catch (error) {
      return createError(
        'INVALID_INPUT',
        error instanceof Error ? error.message : 'Failed to read script file',
        { scriptFile: parsed.data.scriptFile },
      );
    }
  } else {
    raw = parsed.data.script;
  }

  const validated = sessionScriptSchema.safeParse(raw);
  if (!validated.success) {
    return success({
      valid: false,
      issues: zodIssuesToLintIssues(validated.error),
    });
  }

  const warnings: ScriptLintIssue[] = [];
  if (!validated.data.url) {
    warnings.push({ path: 'url', message: 'Script has no starting URL — first step should be navigate or provide url' });
  }
  if (validated.data.steps.length === 0) {
    warnings.push({ path: 'steps', message: 'Script has no steps' });
  }

  return success({
    valid: true,
    script: validated.data,
    stepCount: validated.data.steps.length,
    issues: warnings,
  });
}

export { scriptLintSchema };
