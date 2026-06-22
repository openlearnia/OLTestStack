import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { SESSION_SCRIPT_VERSION } from './script-types.js';
import type { SessionScript } from './script-types.js';
import { testStepSchema } from '../test/step-schema.js';

export const sessionScriptSchema = z
  .object({
    version: z.literal(SESSION_SCRIPT_VERSION),
    name: z.string().min(1),
    goal: z.string().optional(),
    url: z.string().optional(),
    recordedAt: z.string().optional(),
    browserId: z.string().optional(),
    steps: z.array(testStepSchema).min(1),
    exportWarnings: z.array(z.string()).optional(),
  })
  .strict();

export function loadSessionScriptFromFile(scriptFile: string): SessionScript {
  const absolutePath = resolve(scriptFile);
  const raw = readFileSync(absolutePath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  return sessionScriptSchema.parse(parsed);
}
