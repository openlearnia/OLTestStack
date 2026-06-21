import type { RecordedEvent } from '../types/sessions.js';

export interface RecordingService {
  initBrowser(browserId: string, enabled: boolean): void;
  emit(browserId: string, event: Omit<RecordedEvent, 'timestamp'>): void;
  releaseBrowser(browserId: string): void;
  isEnabled(browserId: string): boolean;
  getEvents(browserId: string): RecordedEvent[];
}
