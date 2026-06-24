import { describe, expect, test } from 'bun:test';
import type { Element } from '../../src/core/types/sessions.ts';
import {
  filterVisible,
  matchesQuery,
  rankFindMatches,
  scoreFindMatch,
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

  test('toPublicElements strips internal fields', () => {
    const withQuery: Element = { ...sample, discoveredQuery: 'Submit' };
    const publicElements = toPublicElements([withQuery]);
    expect(publicElements[0]).not.toHaveProperty('selector');
    expect(publicElements[0]).not.toHaveProperty('discoveredQuery');
    expect(publicElements[0]?.elementId).toBe('el-1');
  });

  test('scoreFindMatch prefers input over column header for same query', () => {
    const filterInput: Element = {
      elementId: 'filter',
      role: 'textbox',
      text: 'Name',
      visible: true,
      tag: 'input',
      selector: 'dom:1:input',
    };
    const header: Element = {
      elementId: 'header',
      role: 'columnheader',
      text: 'Name',
      visible: true,
      tag: 'div',
      selector: 'dom:2:div',
    };

    const inputScore = scoreFindMatch(filterInput, 'Name', 'filter');
    const headerScore = scoreFindMatch(header, 'Name', 'grid-header');
    expect(inputScore).toBeGreaterThan(headerScore);
  });

  test('rankFindMatches orders input before column header', () => {
    const filterInput: Element = {
      elementId: 'filter',
      role: 'textbox',
      text: 'Name',
      visible: true,
      tag: 'input',
      selector: 'dom:1:input',
    };
    const header: Element = {
      elementId: 'header',
      role: 'columnheader',
      text: 'Name',
      visible: true,
      tag: 'div',
      selector: 'dom:2:div',
    };

    const regionHints = new Map([
      ['dom:1:input', 'filter'],
      ['dom:2:div', 'grid-header'],
    ]);
    const ranked = rankFindMatches([header, filterInput], 'Name', regionHints);
    expect(ranked[0]?.element.tag).toBe('input');
    expect(ranked[0]?.reason).toMatch(/input|toolbar|filter/);
  });
});
