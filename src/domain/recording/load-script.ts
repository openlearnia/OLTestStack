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

export const testSuiteSchema = z
  .object({
    name: z.string().min(1).optional(),
    scripts: z.array(sessionScriptSchema).min(1),
  })
  .strict();

export type TestSuite = z.infer<typeof testSuiteSchema>;

export function loadTestSuiteFromFile(suiteFile: string): TestSuite {
  const absolutePath = resolve(suiteFile);
  const raw = readFileSync(absolutePath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;

  if (Array.isArray(parsed)) {
    return testSuiteSchema.parse({ scripts: parsed });
  }

  const asSuite = testSuiteSchema.safeParse(parsed);
  if (asSuite.success) {
    return asSuite.data;
  }

  const asScript = sessionScriptSchema.safeParse(parsed);
  if (asScript.success) {
    return { scripts: [asScript.data] };
  }

  return testSuiteSchema.parse(parsed);
}
