#!/usr/bin/env bun
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDbClient } from './client.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('[olteststack] DATABASE_URL is required to run migrations');
  process.exit(1);
}

const { db, close } = createDbClient(databaseUrl);

let exitCode = 0;
try {
  await migrate(db, { migrationsFolder: './drizzle' });
  console.error('[olteststack] Database migrations applied successfully');
} catch (error) {
  console.error('[olteststack] Migration failed:', error);
  exitCode = 1;
} finally {
  await close();
}

process.exit(exitCode);
