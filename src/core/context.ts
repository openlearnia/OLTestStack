import type { ResolvedConfig } from './config/load-config.js';
import { loadConfig } from './config/load-config.js';
import type { CdpAdapter } from '../cdp/adapter.js';
import { PuppeteerCdpAdapter } from '../cdp/puppeteer-adapter.js';
import { SessionRegistry } from './registry/session-registry.js';
import type { RecordingService } from './recording/recording-service.js';
import { InMemoryRecordingService } from './recording/in-memory-recording.js';

export interface AppContext {
  config: ResolvedConfig;
  registry: SessionRegistry;
  cdp: CdpAdapter;
  recording: RecordingService;
}

export function createAppContext(configOverrides?: Partial<ResolvedConfig>): AppContext {
  const config = { ...loadConfig(), ...configOverrides };
  return {
    config,
    registry: new SessionRegistry(),
    cdp: new PuppeteerCdpAdapter(config),
    recording: new InMemoryRecordingService(),
  };
}
