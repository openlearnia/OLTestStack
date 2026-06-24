import { describe, expect, test } from 'bun:test';
import { lintScript, scriptLintSchema } from '../../src/domain/recording/script-lint.js';

const VALID_SCRIPT = {
  version: '1.0' as const,
  name: 'Login',
  url: 'https://example.com/login',
  steps: [{ action: 'click' as const, query: 'Submit' }],
};

describe('script_lint schema', () => {
  test('requires script or scriptFile', () => {
    expect(scriptLintSchema.safeParse({}).success).toBe(false);
    expect(scriptLintSchema.safeParse({ script: VALID_SCRIPT }).success).toBe(true);
  });
});

describe('script_lint handler', () => {
  test('returns valid for well-formed script', async () => {
    const result = await lintScript({ config: {} } as never, { script: VALID_SCRIPT });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.valid).toBe(true);
      expect(result.data.stepCount).toBe(1);
    }
  });

  test('returns issues for invalid script', async () => {
    const result = await lintScript({ config: {} } as never, {
      script: { version: '1.0', name: 'Bad', steps: [] },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.valid).toBe(false);
      expect(result.data.issues.length).toBeGreaterThan(0);
    }
  });

  test('lints scriptFile on disk', async () => {
    const result = await lintScript({ config: {} } as never, {
      scriptFile: 'scripts/example-login.olteststack.json',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.valid).toBe(true);
    }
  });
});
