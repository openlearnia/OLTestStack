import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { ResolvedConfig } from '../core/config/load-config.js';
import * as schema from './schema.js';

export type Database = PostgresJsDatabase<typeof schema>;

let sqlClient: ReturnType<typeof postgres> | undefined;
let dbInstance: Database | undefined;

export function createDbClient(databaseUrl: string): Database {
  const client = postgres(databaseUrl, { max: 10 });
  return drizzle(client, { schema });
}

export function getDb(config: ResolvedConfig): Database | undefined {
  if (!config.databaseUrl) return undefined;

  if (!dbInstance) {
    sqlClient = postgres(config.databaseUrl, { max: 10 });
    dbInstance = drizzle(sqlClient, { schema });
  }

  return dbInstance;
}

export async function closeDb(): Promise<void> {
  if (sqlClient) {
    await sqlClient.end();
    sqlClient = undefined;
    dbInstance = undefined;
  }
}

export { schema };
