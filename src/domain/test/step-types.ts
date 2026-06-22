export type TestStep =
  | { action: 'navigate'; url: string; waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' }
  | { action: 'click'; query: string }
  | { action: 'type'; query: string; value: string }
  | { action: 'press'; key: string }
  | { action: 'scroll'; direction: 'up' | 'down' | 'left' | 'right' }
  | {
      action: 'wait';
      condition: 'element' | 'url' | 'networkIdle' | 'timeout';
      query?: string;
      value?: string;
      match?: 'equals' | 'contains';
      durationMs?: number;
    }
  | { action: 'screenshot'; fullPage?: boolean }
  | { action: 'assert.exists'; query: string }
  | { action: 'assert.text'; contains: string; match?: 'contains' | 'equals' }
  | { action: 'assert.url'; url: string; match?: 'equals' | 'contains' }
  | { action: 'assert.network'; url: string; status: number | string };

export interface StepExecutionResult {
  success: boolean;
  failed: boolean;
  assertionFailure: boolean;
  message?: string;
}
