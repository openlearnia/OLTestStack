import { describe, expect, test } from 'bun:test';
import { testRunSchema } from '../../src/domain/test/run-test.js';
import { testSuiteSchema, loadTestSuiteFromFile } from '../../src/domain/recording/load-script.js';

describe('test_run suite schema', () => {
  test('accepts scripts array', () => {
    const parsed = testRunSchema.safeParse({
      goal: 'Suite run',
      scripts: [
        {
          version: '1.0',
          name: 'One',
          steps: [{ action: 'press', key: 'Enter' }],
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  test('rejects scripts and suiteFile together', () => {
    const parsed = testRunSchema.safeParse({
      goal: 'Suite run',
      scripts: [
        {
          version: '1.0',
          name: 'One',
          steps: [{ action: 'press', key: 'Enter' }],
        },
      ],
      suiteFile: 'scripts/suite.json',
    });
    expect(parsed.success).toBe(false);
  });
});

describe('test suite loader', () => {
  test('loads suite object from example script path as single-script array wrapper', () => {
    const suite = testSuiteSchema.parse({
      scripts: [
        {
          version: '1.0',
          name: 'Example',
          steps: [{ action: 'press', key: 'Enter' }],
        },
      ],
    });
    expect(suite.scripts).toHaveLength(1);
  });

  test('loadTestSuiteFromFile reads scripts/example-login.olteststack.json when wrapped', () => {
    const script = loadTestSuiteFromFile('scripts/example-login.olteststack.json');
    expect(script.scripts[0]?.name).toBe('Example login flow');
  });
});
