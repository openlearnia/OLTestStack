import { createError } from '../../core/errors/envelope.js';
import type { McpErrorResponse } from '../../core/types/responses.js';
import type { TestStep } from '../test/step-types.js';

const VARIABLE_PATTERN = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;
const MAX_SUBSTITUTION_PASSES = 10;
const ESCAPE_SENTINEL_PREFIX = '\uE000';
const ESCAPE_SENTINEL_SUFFIX = '\uE001';

export class MissingVariableError extends Error {
  readonly variable: string;
  readonly field?: string;
  readonly stepIndex?: number;

  constructor(variable: string, options?: { field?: string; stepIndex?: number }) {
    const location =
      options?.stepIndex !== undefined
        ? ` in step ${options.stepIndex}${options.field ? ` (${options.field})` : ''}`
        : options?.field
          ? ` in ${options.field}`
          : '';
    super(`Missing variable: ${variable}${location}`);
    this.name = 'MissingVariableError';
    this.variable = variable;
    this.field = options?.field;
    this.stepIndex = options?.stepIndex;
  }
}

export function resolveVariableString(
  value: string,
  variables: Record<string, string>,
  context?: { field?: string; stepIndex?: number },
): string {
  const protectedValue = protectEscapedPlaceholders(value);
  let result = protectedValue;

  for (let pass = 0; pass < MAX_SUBSTITUTION_PASSES; pass++) {
    const next = substituteVariablesOnce(result, variables, context);
    if (next === result) break;
    result = next;
  }

  const unresolved = result.match(VARIABLE_PATTERN);
  if (unresolved) {
    const name = unresolved[0].slice(2, -1);
    throw new MissingVariableError(name, context);
  }

  return restoreEscapedPlaceholders(result);
}

function protectEscapedPlaceholders(value: string): string {
  return value
    .replace(
      /\$\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g,
      (_, name: string) => `${ESCAPE_SENTINEL_PREFIX}${name}${ESCAPE_SENTINEL_SUFFIX}`,
    )
    .replace(
      /\\\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g,
      (_, name: string) => `${ESCAPE_SENTINEL_PREFIX}${name}${ESCAPE_SENTINEL_SUFFIX}`,
    );
}

function restoreEscapedPlaceholders(value: string): string {
  return value.replace(
    new RegExp(`${ESCAPE_SENTINEL_PREFIX}([A-Za-z_][A-Za-z0-9_]*)${ESCAPE_SENTINEL_SUFFIX}`, 'g'),
    '${$1}',
  );
}

function substituteVariablesOnce(
  value: string,
  variables: Record<string, string>,
  context?: { field?: string; stepIndex?: number },
): string {
  return value.replace(VARIABLE_PATTERN, (_, name: string) => {
    if (!(name in variables)) {
      throw new MissingVariableError(name, context);
    }
    return variables[name] ?? '';
  });
}

function substituteStepField(
  value: string,
  variables: Record<string, string>,
  context: { field: string; stepIndex: number },
): string {
  return resolveVariableString(value, variables, context);
}

export function substituteVariablesInSteps(
  steps: TestStep[],
  variables: Record<string, string>,
): TestStep[] | McpErrorResponse {
  try {
    return steps.map((step, stepIndex) => substituteVariablesInStep(step, variables, stepIndex));
  } catch (error) {
    if (error instanceof MissingVariableError) {
      return createError('INVALID_INPUT', error.message, {
        variable: error.variable,
        ...(error.field !== undefined ? { field: error.field } : {}),
        ...(error.stepIndex !== undefined ? { stepIndex: error.stepIndex } : {}),
      });
    }
    throw error;
  }
}

function substituteVariablesInStep(
  step: TestStep,
  variables: Record<string, string>,
  stepIndex: number,
): TestStep {
  const ctx = (field: string) => ({ field, stepIndex });

  switch (step.action) {
    case 'navigate':
      return {
        ...step,
        url: substituteStepField(step.url, variables, ctx('url')),
      };
    case 'click':
      return {
        ...step,
        query: substituteStepField(step.query, variables, ctx('query')),
      };
    case 'type':
      return {
        ...step,
        query: substituteStepField(step.query, variables, ctx('query')),
        value: substituteStepField(step.value, variables, ctx('value')),
      };
    case 'press':
      return {
        ...step,
        key: substituteStepField(step.key, variables, ctx('key')),
      };
    case 'wait':
      return {
        ...step,
        ...(step.query !== undefined
          ? { query: substituteStepField(step.query, variables, ctx('query')) }
          : {}),
        ...(step.value !== undefined
          ? { value: substituteStepField(step.value, variables, ctx('value')) }
          : {}),
      };
    case 'assert.exists':
      return {
        ...step,
        query: substituteStepField(step.query, variables, ctx('query')),
      };
    case 'assert.text':
      return {
        ...step,
        contains: substituteStepField(step.contains, variables, ctx('contains')),
      };
    case 'assert.url':
      return {
        ...step,
        url: substituteStepField(step.url, variables, ctx('url')),
      };
    case 'assert.network':
      return {
        ...step,
        url: substituteStepField(step.url, variables, ctx('url')),
        status:
          typeof step.status === 'string'
            ? substituteStepField(step.status, variables, ctx('status'))
            : step.status,
      };
    default:
      return step;
  }
}

export function substituteVariablesInUrl(
  url: string,
  variables: Record<string, string>,
): string | McpErrorResponse {
  try {
    return resolveVariableString(url, variables, { field: 'url' });
  } catch (error) {
    if (error instanceof MissingVariableError) {
      return createError('INVALID_INPUT', error.message, {
        variable: error.variable,
        field: 'url',
      });
    }
    throw error;
  }
}
