#!/usr/bin/env bun
import { createAppContext } from './core/context.js';
import { scheduleSessionCleanup } from './db/cleanup-expired.js';
import { validateDatabaseConnection } from './db/health.js';
import { shouldPersistRecording } from './db/session-lifecycle.js';
import { startHealthServer } from './health/http.js';
import { startMcpServer } from './mcp/server.js';

async function main(): Promise<void> {
  const ctx = createAppContext();

  if (ctx.config.databaseUrl) {
    await validateDatabaseConnection(ctx.config);
    if (shouldPersistRecording(ctx.config)) {
      console.error('[olteststack] Database connection verified (persistence enabled)');
    } else {
      console.error('[olteststack] Database reachable (PERSIST_RECORDING=false — no writes)');
    }
    scheduleSessionCleanup(ctx.config);
  }

  await startHealthServer(ctx);
  await startMcpServer(ctx);
}

main().catch((error) => {
  console.error('[olteststack] Fatal error:', error);
  process.exit(1);
});
