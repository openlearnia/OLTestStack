export interface NetworkEntry {
  requestId: string;
  url: string;
  method: string;
  status: number;
  resourceType: string;
  timestamp: string;
  failed: boolean;
  durationMs?: number;
}

export interface ConsoleEntry {
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  message: string;
  timestamp: string;
  source?: string;
}

export const MAX_NETWORK_ENTRIES = 500;
export const MAX_CONSOLE_ENTRIES = 200;
export const NETWORK_IDLE_QUIET_MS = 500;
