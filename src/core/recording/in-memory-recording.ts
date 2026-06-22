import type { RecordedEvent, RecordedEventType } from '../types/sessions.js';
import type { RecordingService } from './recording-service.js';

/** NFR-10-001: per-browser recording buffer cap */
export const RECORDING_BUFFER_MAX_BYTES = 10 * 1024 * 1024;

/** Event types preserved when trimming (NFR-10-001) */
const PRESERVED_EVENT_TYPES = new Set<RecordedEventType>(['error', 'assertion']);

interface RecordingContext {
  enabled: boolean;
  events: RecordedEvent[];
  bytes: number;
}

function estimateEventBytes(event: RecordedEvent): number {
  return new TextEncoder().encode(JSON.stringify(event)).length;
}

export class InMemoryRecordingService implements RecordingService {
  private readonly contexts = new Map<string, RecordingContext>();

  initBrowser(browserId: string, enabled: boolean): void {
    this.contexts.set(browserId, { enabled, events: [], bytes: 0 });
  }

  emit(browserId: string, event: Omit<RecordedEvent, 'timestamp'>): void {
    const context = this.contexts.get(browserId);
    if (!context?.enabled) return;

    const recorded: RecordedEvent = { ...event, timestamp: new Date().toISOString() };
    context.events.push(recorded);
    context.bytes += estimateEventBytes(recorded);
    this.trimBuffer(context);
  }

  releaseBrowser(browserId: string): void {
    this.contexts.delete(browserId);
  }

  isEnabled(browserId: string): boolean {
    return this.contexts.get(browserId)?.enabled ?? false;
  }

  getEvents(browserId: string): RecordedEvent[] {
    return [...(this.contexts.get(browserId)?.events ?? [])];
  }

  private trimBuffer(context: RecordingContext): void {
    while (context.bytes > RECORDING_BUFFER_MAX_BYTES) {
      const dropIndex = context.events.findIndex((e) => !PRESERVED_EVENT_TYPES.has(e.type));
      if (dropIndex === -1) break;
      const [removed] = context.events.splice(dropIndex, 1);
      context.bytes -= estimateEventBytes(removed);
    }
  }
}

export class NoopRecordingService implements RecordingService {
  initBrowser(_browserId: string, _enabled: boolean): void {}
  emit(_browserId: string, _event: Omit<RecordedEvent, 'timestamp'>): void {}
  releaseBrowser(_browserId: string): void {}
  isEnabled(_browserId: string): boolean {
    return false;
  }
  getEvents(_browserId: string): RecordedEvent[] {
    return [];
  }
}
