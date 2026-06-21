import { describe, expect, test } from 'bun:test';
import type { Element } from '../../src/core/types/sessions.ts';
import {
  filterVisible,
  matchesQuery,
  toPublicElements,
} from '../../src/domain/elements/element-matcher.ts';

describe('element-matcher', () => {
  const sample: Element = {
    elementId: 'el-1',
    role: 'button',
    text: 'Submit Form',
    visible: true,
    tag: 'button',
    selector: 'node-1',
  };

  test('matchesQuery is case-insensitive on text', () => {
    expect(matchesQuery(sample, 'submit')).toBe(true);
    expect(matchesQuery(sample, 'FORM')).toBe(true);
  });

  test('matchesQuery matches role and aria-label', () => {
    expect(matchesQuery(sample, 'button')).toBe(true);
    expect(matchesQuery({ ...sample, text: '' }, 'submit', 'Submit Form')).toBe(true);
  });

  test('filterVisible excludes hidden elements by default', () => {
    const hidden: Element = { ...sample, elementId: 'el-2', visible: false };
    expect(filterVisible([sample, hidden], false)).toHaveLength(1);
    expect(filterVisible([sample, hidden], true)).toHaveLength(2);
  });

  test('toPublicElements strips selector', () => {
    const publicElements = toPublicElements([sample]);
    expect(publicElements[0]).not.toHaveProperty('selector');
    expect(publicElements[0]?.elementId).toBe('el-1');
  });
});
