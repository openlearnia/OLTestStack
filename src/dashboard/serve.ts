#!/usr/bin/env bun
import { DEFAULT_HEALTH_PORT, loadConfig } from '../core/config/load-config.js';
import { scheduleSessionCleanup } from '../db/cleanup-expired.js';
import { validateDatabaseConnection } from '../db/health.js';
import { startHealthServer } from '../health/http.js';

const config = loadConfig({
  healthPort: Number.parseInt(process.env.HEALTH_PORT ?? String(DEFAULT_HEALTH_PORT), 10),
  dashboardEnabled: true,
});

if (config.databaseUrl) {
  await validateDatabaseConnection(config);
  scheduleSessionCleanup(config);
}

await startHealthServer(config);

console.error('[olteststack] Dashboard-only mode — MCP server not started');
