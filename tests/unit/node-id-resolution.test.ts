import { describe, expect, test } from 'bun:test';
import {
  parseDomIndexFromNodeId,
  parseDomTagFromNodeId,
  parseRoleNameFromNodeId,
} from '../../src/cdp/puppeteer-adapter.ts';

describe('nodeId resolution helpers', () => {
  test('parseDomIndexFromNodeId extracts DOM scan index', () => {
    expect(parseDomIndexFromNodeId('page-id:2:dom:5:input')).toBe(5);
    expect(parseDomIndexFromNodeId('page-id:0:dom:0:button')).toBe(0);
  });

  test('parseDomIndexFromNodeId returns null for accessibility nodeIds', () => {
    expect(parseDomIndexFromNodeId('page-id:1:page-id:101020202:textbox:Password')).toBeNull();
  });

  test('parseRoleNameFromNodeId extracts role and name from accessibility nodeIds', () => {
    expect(
      parseRoleNameFromNodeId('c18b9459-e323-4cbf-92de-19c8270d0c97:1:c18b9459-e323-4cbf-92de-19c8270d0c97:101020202:textbox:Password'),
    ).toEqual({ role: 'textbox', name: 'Password' });
    expect(
      parseRoleNameFromNodeId('abc:0:abc:0:textbox:Email'),
    ).toEqual({ role: 'textbox', name: 'Email' });
  });

  test('parseRoleNameFromNodeId returns null for DOM nodeIds', () => {
    expect(parseRoleNameFromNodeId('page-id:2:dom:5:input')).toBeNull();
  });

  test('parseDomTagFromNodeId extracts tag from DOM nodeIds', () => {
    expect(parseDomTagFromNodeId('page-id:2:dom:5:input')).toBe('input');
    expect(parseDomTagFromNodeId('page-id:0:dom:0:button')).toBe('button');
  });

  test('parseDomTagFromNodeId returns null for accessibility nodeIds', () => {
    expect(parseDomTagFromNodeId('page-id:1:textbox:Email')).toBeNull();
  });
});
