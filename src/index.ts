#!/usr/bin/env bun
import { createAppContext } from './core/context.js';
import { validateDatabaseConnection } from './db/health.js';
import { startHealthServer } from './health/http.js';
import { startMcpServer } from './mcp/server.js';

async function main(): Promise<void> {
  const ctx = createAppContext();

  if (ctx.config.persistRecording) {
    await validateDatabaseConnection(ctx.config);
    console.error('[olteststack] Database connection verified');
  }

  await startHealthServer(ctx.config);
  await startMcpServer(ctx);
}

main().catch((error) => {
  console.error('[olteststack] Fatal error:', error);
  process.exit(1);
});
