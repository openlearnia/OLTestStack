import { describe, expect, test } from 'bun:test';
import {
  MissingVariableError,
  resolveVariableString,
  substituteVariablesInSteps,
  substituteVariablesInUrl,
} from '../../src/domain/recording/resolve-variables.js';
import type { TestStep } from '../../src/domain/test/step-types.js';

describe('resolveVariableString', () => {
  test('substitutes simple placeholders', () => {
    expect(
      resolveVariableString('${BASE_URL}/login', { BASE_URL: 'https://app.example.com' }),
    ).toBe('https://app.example.com/login');
  });

  test('resolves nested variable references across passes', () => {
    expect(
      resolveVariableString('${FULL_PATH}', {
        FULL_PATH: '${BASE_URL}/dashboard',
        BASE_URL: 'https://app.example.com',
      }),
    ).toBe('https://app.example.com/dashboard');
  });

  test('throws MissingVariableError for undefined variables', () => {
    expect(() => resolveVariableString('${MISSING}', {})).toThrow(MissingVariableError);
    try {
      resolveVariableString('${MISSING}', {});
    } catch (error) {
      expect(error).toBeInstanceOf(MissingVariableError);
      expect((error as MissingVariableError).variable).toBe('MISSING');
    }
  });

  test('preserves literal placeholders escaped with $$', () => {
    expect(
      resolveVariableString('Price is $${AMOUNT} today', { AMOUNT: '9.99' }),
    ).toBe('Price is ${AMOUNT} today');
  });

  test('preserves literal placeholders escaped with backslash', () => {
    expect(resolveVariableString('Use \\${VAR} syntax', { VAR: 'ignored' })).toBe('Use ${VAR} syntax');
  });

  test('leaves strings without placeholders unchanged', () => {
    expect(resolveVariableString('plain text', { UNUSED: 'value' })).toBe('plain text');
  });
});

describe('substituteVariablesInSteps', () => {
  test('substitutes across navigate, type, and assert steps', () => {
    const steps: TestStep[] = [
      { action: 'navigate', url: '${BASE_URL}/login' },
      { action: 'type', query: 'Email', value: '${EMAIL}' },
      { action: 'assert.url', url: '${BASE_URL}/dashboard', match: 'contains' },
      { action: 'assert.text', contains: 'Welcome, ${USER}' },
    ];

    const result = substituteVariablesInSteps(steps, {
      BASE_URL: 'https://app.example.com',
      EMAIL: 'user@example.com',
      USER: 'Ada',
    });

    expect(result).toEqual([
      { action: 'navigate', url: 'https://app.example.com/login' },
      { action: 'type', query: 'Email', value: 'user@example.com' },
      { action: 'assert.url', url: 'https://app.example.com/dashboard', match: 'contains' },
      { action: 'assert.text', contains: 'Welcome, Ada' },
    ]);
  });

  test('returns INVALID_INPUT envelope for missing variables', () => {
    const result = substituteVariablesInSteps(
      [{ action: 'type', query: 'Email', value: '${EMAIL}' }],
      {},
    );

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'INVALID_INPUT',
        message: 'Missing variable: EMAIL in step 0 (value)',
        details: { variable: 'EMAIL', field: 'value', stepIndex: 0 },
      },
    });
  });
});

describe('substituteVariablesInUrl', () => {
  test('substitutes top-level replay url', () => {
    const result = substituteVariablesInUrl('${BASE_URL}/login', {
      BASE_URL: 'https://app.example.com',
    });
    expect(result).toBe('https://app.example.com/login');
  });

  test('returns INVALID_INPUT when url variable is missing', () => {
    const result = substituteVariablesInUrl('${BASE_URL}/login', {});
    expect(result).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT', details: { variable: 'BASE_URL', field: 'url' } },
    });
  });
});
