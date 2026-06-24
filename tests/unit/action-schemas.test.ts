import { describe, expect, test } from 'bun:test';
import { clickSchema } from '../../src/domain/actions/click.ts';
import { pressSchema } from '../../src/domain/actions/press.ts';
import { typeSchema } from '../../src/domain/actions/type.ts';
import { scrollSchema } from '../../src/domain/actions/scroll.ts';

describe('action schemas', () => {
  test('clickSchema accepts optional query', () => {
    const withQuery = clickSchema.safeParse({
      pageId: '550e8400-e29b-41d4-a716-446655440000',
      elementId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      query: 'Submit',
    });
    expect(withQuery.success).toBe(true);
  });

  test('typeSchema accepts optional query', () => {
    const withQuery = typeSchema.safeParse({
      pageId: '550e8400-e29b-41d4-a716-446655440000',
      elementId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      value: 'hello',
      query: 'Email',
    });
    expect(withQuery.success).toBe(true);
  });

  test('pressSchema accepts optional elementId', () => {
    const withElement = pressSchema.safeParse({
      pageId: '550e8400-e29b-41d4-a716-446655440000',
      key: 'Enter',
      elementId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    });
    expect(withElement.success).toBe(true);

    const withoutElement = pressSchema.safeParse({
      pageId: '550e8400-e29b-41d4-a716-446655440000',
      key: 'Tab',
    });
    expect(withoutElement.success).toBe(true);
  });

  test('scrollSchema accepts optional elementId', () => {
    const withElement = scrollSchema.safeParse({
      pageId: '550e8400-e29b-41d4-a716-446655440000',
      direction: 'down',
      amount: 200,
      elementId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    });
    expect(withElement.success).toBe(true);

    const withoutElement = scrollSchema.safeParse({
      pageId: '550e8400-e29b-41d4-a716-446655440000',
      direction: 'up',
    });
    expect(withoutElement.success).toBe(true);
  });
});
