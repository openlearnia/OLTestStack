import { describe, expect, test } from 'bun:test';
import type { Element } from '../../src/core/types/sessions.js';
import { elementToQuery, resolveRecordingQuery } from '../../src/domain/elements/element-query.js';

const baseElement: Element = {
  elementId: 'el-1',
  role: 'button',
  text: 'Sign In',
  visible: true,
};

describe('element-query', () => {
  test('elementToQuery prefers text over role', () => {
    expect(elementToQuery(baseElement)).toBe('Sign In');
    expect(elementToQuery({ ...baseElement, text: '  ', role: 'textbox' })).toBe('textbox');
  });

  test('resolveRecordingQuery prefers explicit query', () => {
    expect(resolveRecordingQuery(baseElement, 'Login')).toBe('Login');
  });

  test('resolveRecordingQuery uses discoveredQuery before text', () => {
    expect(resolveRecordingQuery({ ...baseElement, discoveredQuery: 'Email' })).toBe('Email');
  });

  test('resolveRecordingQuery falls back to element text', () => {
    expect(resolveRecordingQuery(baseElement)).toBe('Sign In');
  });
});
