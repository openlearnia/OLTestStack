#!/usr/bin/env bun
import { createAppContext } from '../core/context.js';
import { DEFAULT_HEALTH_PORT } from '../core/config/load-config.js';
import { scheduleSessionCleanup } from '../db/cleanup-expired.js';
import { validateDatabaseConnection } from '../db/health.js';
import { startHealthServer } from '../health/http.js';

const ctx = createAppContext({
  healthPort: Number.parseInt(process.env.HEALTH_PORT ?? String(DEFAULT_HEALTH_PORT), 10),
  dashboardEnabled: true,
});

if (ctx.config.databaseUrl) {
  await validateDatabaseConnection(ctx.config);
  scheduleSessionCleanup(ctx.config);
}

await startHealthServer(ctx);

console.error('[olteststack] Dashboard-only mode — MCP server not started');
