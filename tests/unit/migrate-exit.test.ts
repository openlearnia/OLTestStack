import { describe, expect, test } from 'bun:test';
import { createDbClient } from '../../src/db/client.js';

describe('migrate client lifecycle', () => {
  test('createDbClient exposes close to release postgres pool', () => {
    const handle = createDbClient('postgresql://invalid:invalid@127.0.0.1:1/nodb');
    expect(typeof handle.close).toBe('function');
    expect(handle.db).toBeDefined();
  });

  test('close resolves without throwing when pool never connected', async () => {
    const handle = createDbClient('postgresql://invalid:invalid@127.0.0.1:1/nodb');
    await expect(handle.close()).resolves.toBeUndefined();
  });
});

describe('migrate script', () => {
  test('exits when DATABASE_URL is missing', async () => {
    const prev = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    const proc = Bun.spawn(['bun', 'run', 'src/db/migrate.ts'], {
      cwd: import.meta.dir + '/../..',
      env: { ...process.env, DATABASE_URL: undefined },
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();

    if (prev === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prev;

    expect(exitCode).toBe(1);
    expect(stderr).toContain('DATABASE_URL is required');
  });
});
