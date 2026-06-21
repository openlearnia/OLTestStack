import type { RecordedEvent } from '../types/sessions.js';
import type { RecordingService } from './recording-service.js';

interface RecordingContext {
  enabled: boolean;
  events: RecordedEvent[];
}

export class InMemoryRecordingService implements RecordingService {
  private readonly contexts = new Map<string, RecordingContext>();

  initBrowser(browserId: string, enabled: boolean): void {
    this.contexts.set(browserId, { enabled, events: [] });
  }

  emit(browserId: string, event: Omit<RecordedEvent, 'timestamp'>): void {
    const context = this.contexts.get(browserId);
    if (!context?.enabled) return;
    context.events.push({ ...event, timestamp: new Date().toISOString() });
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
