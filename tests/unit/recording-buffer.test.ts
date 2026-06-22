import { describe, expect, test } from 'bun:test';
import {
  InMemoryRecordingService,
  RECORDING_BUFFER_MAX_BYTES,
} from '../../src/core/recording/in-memory-recording.js';

describe('InMemoryRecordingService buffer limits', () => {
  test('drops oldest non-error/non-assertion events when over 10 MB', () => {
    const recording = new InMemoryRecordingService();
    const browserId = 'browser-1';
    recording.initBrowser(browserId, true);

    const largePayload = 'x'.repeat(512 * 1024);
    const eventsToAdd = Math.ceil(RECORDING_BUFFER_MAX_BYTES / (512 * 1024)) + 4;

    for (let i = 0; i < eventsToAdd; i++) {
      recording.emit(browserId, {
        type: 'action',
        payload: { index: i, blob: largePayload },
      });
    }

    const events = recording.getEvents(browserId);
    const totalBytes = events.reduce(
      (sum, event) => sum + new TextEncoder().encode(JSON.stringify(event)).length,
      0,
    );

    expect(totalBytes).toBeLessThanOrEqual(RECORDING_BUFFER_MAX_BYTES);
    expect(events.some((e) => (e.payload as { index?: number }).index === eventsToAdd - 1)).toBe(true);
    expect(events.some((e) => (e.payload as { index?: number }).index === 0)).toBe(false);
  });

  test('preserves error and assertion events during trim', () => {
    const recording = new InMemoryRecordingService();
    const browserId = 'browser-2';
    recording.initBrowser(browserId, true);

    const largePayload = 'y'.repeat(512 * 1024);
    const eventsToAdd = Math.ceil(RECORDING_BUFFER_MAX_BYTES / (512 * 1024)) + 2;

    recording.emit(browserId, { type: 'error', payload: { message: 'critical failure' } });
    recording.emit(browserId, {
      type: 'assertion',
      payload: { passed: false, message: 'expected text' },
    });

    for (let i = 0; i < eventsToAdd; i++) {
      recording.emit(browserId, {
        type: 'navigation',
        payload: { index: i, blob: largePayload },
      });
    }

    const events = recording.getEvents(browserId);
    expect(events.some((e) => e.type === 'error')).toBe(true);
    expect(events.some((e) => e.type === 'assertion')).toBe(true);
  });
});
