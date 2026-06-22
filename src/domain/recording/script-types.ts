import type { TestStep } from '../test/step-types.js';

export const SESSION_SCRIPT_VERSION = '1.0' as const;

export interface SessionScript {
  version: typeof SESSION_SCRIPT_VERSION;
  name: string;
  goal?: string;
  url?: string;
  recordedAt?: string;
  browserId?: string;
  steps: TestStep[];
  exportWarnings?: string[];
}

export interface SessionExportResult {
  script: SessionScript;
  eventCount: number;
  stepCount: number;
  skippedCount: number;
}
