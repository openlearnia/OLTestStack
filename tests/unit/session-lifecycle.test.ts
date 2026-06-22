import { describe, expect, test } from 'bun:test';
import { loadConfig } from '../../src/core/config/load-config.js';
import {
  computeSessionExpiresAt,
  hoursUntilExpiry,
  shouldPersistRecording,
} from '../../src/db/session-lifecycle.js';

describe('session lifecycle', () => {
  test('computeSessionExpiresAt adds TTL hours', () => {
    const now = new Date('2026-06-22T12:00:00.000Z');
    const expires = computeSessionExpiresAt(24, now);
    expect(expires.toISOString()).toBe('2026-06-23T12:00:00.000Z');
  });

  test('computeSessionExpiresAt falls back for invalid TTL', () => {
    const now = new Date('2026-06-22T12:00:00.000Z');
    const expires = computeSessionExpiresAt(0, now);
    expect(expires.toISOString()).toBe('2026-06-23T12:00:00.000Z');
  });

  test('hoursUntilExpiry rounds up to whole hours', () => {
    const now = new Date('2026-06-22T12:00:00.000Z');
    const expires = new Date('2026-06-22T13:30:00.000Z');
    expect(hoursUntilExpiry(expires, now)).toBe(2);
  });

  test('hoursUntilExpiry returns 0 when past due', () => {
    const now = new Date('2026-06-22T14:00:00.000Z');
    const expires = new Date('2026-06-22T13:00:00.000Z');
    expect(hoursUntilExpiry(expires, now)).toBe(0);
  });

  test('shouldPersistRecording defaults on when DATABASE_URL is set', () => {
    const prev = process.env.DATABASE_URL;
    const prevPersist = process.env.PERSIST_RECORDING;
    process.env.DATABASE_URL = 'postgresql://localhost/test';
    delete process.env.PERSIST_RECORDING;

    const config = loadConfig();
    expect(shouldPersistRecording(config)).toBe(true);

    process.env.PERSIST_RECORDING = 'false';
    expect(shouldPersistRecording(loadConfig())).toBe(false);

    if (prev === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prev;
    if (prevPersist === undefined) delete process.env.PERSIST_RECORDING;
    else process.env.PERSIST_RECORDING = prevPersist;
  });

  test('shouldPersistRecording is false without database URL', () => {
    const prevDb = process.env.DATABASE_URL;
    const prevPersist = process.env.PERSIST_RECORDING;
    delete process.env.DATABASE_URL;
    delete process.env.PERSIST_RECORDING;

    expect(shouldPersistRecording(loadConfig())).toBe(false);

    if (prevDb === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prevDb;
    if (prevPersist === undefined) delete process.env.PERSIST_RECORDING;
    else process.env.PERSIST_RECORDING = prevPersist;
  });
});
