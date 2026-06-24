export {
  closeDb,
  createDbClient,
  getDb,
  schema,
  type Database,
  type DbClientHandle,
} from './client.js';
export { validateDatabaseConnection } from './health.js';
export { persistRecordedEvents, persistTestReport, type PersistableTestReport } from './persist.js';
export * from './schema.js';
