import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import type { AppContext } from '../../src/core/context.js';
import { InMemoryRecordingService } from '../../src/core/recording/in-memory-recording.js';
import { SessionRegistry } from '../../src/core/registry/session-registry.js';
import { uploadFiles, pageUploadSchema } from '../../src/domain/actions/upload.js';
import { resolveAllowedUploadPath } from '../../src/domain/shared/resolve-upload-path.js';
import type { CdpNode } from '../../src/cdp/adapter.js';

const PAGE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const BROWSER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const UPLOAD_DIR = join(process.cwd(), 'uploads-test');

function setupUploadDir(): string {
  mkdirSync(UPLOAD_DIR, { recursive: true });
  const filePath = join(UPLOAD_DIR, 'sample.txt');
  writeFileSync(filePath, 'hello');
  return filePath;
}

function createUploadContext(nodes: CdpNode[]): AppContext {
  const registry = new SessionRegistry();
  const recording = new InMemoryRecordingService();

  void registry.createBrowser({
    browserId: BROWSER_ID,
    createdAt: new Date().toISOString(),
    headless: true,
    recordingEnabled: true,
    pageIds: [PAGE_ID],
  });
  void registry.createPage({
    pageId: PAGE_ID,
    browserId: BROWSER_ID,
    url: 'https://example.com/upload',
    title: 'Upload',
    createdAt: new Date().toISOString(),
  });
  recording.initBrowser(BROWSER_ID, true);

  return {
    registry,
    recording,
    cdp: {
      getAccessibilityTree: async () => nodes,
      uploadFiles: async (_page, _node, files) => files,
    },
    config: { uploadDir: UPLOAD_DIR, defaultWaitTimeoutMs: 5000 },
  } as unknown as AppContext;
}

describe('resolveAllowedUploadPath', () => {
  test('allows files under uploadDir and rejects outside paths', () => {
    const filePath = setupUploadDir();
    const allowed = resolveAllowedUploadPath({ uploadDir: UPLOAD_DIR } as never, filePath);
    expect('absolute' in allowed).toBe(true);

    const blocked = resolveAllowedUploadPath({ uploadDir: UPLOAD_DIR } as never, '/etc/passwd');
    expect('error' in blocked).toBe(true);
  });
});

describe('page_upload schema', () => {
  test('requires pageId, files, and element target', () => {
    expect(pageUploadSchema.safeParse({ pageId: PAGE_ID, files: ['a.txt'] }).success).toBe(false);
    expect(
      pageUploadSchema.safeParse({
        pageId: PAGE_ID,
        query: 'Resume',
        files: ['a.txt'],
      }).success,
    ).toBe(true);
  });
});

describe('page_upload handler', () => {
  test('uploads allowed file and records action', async () => {
    const filePath = setupUploadDir();
    const ctx = createUploadContext([
      {
        nodeId: 'file-input',
        role: 'textbox',
        name: 'Resume',
        visible: true,
        tagName: 'input',
      },
    ]);

    const result = await uploadFiles(ctx, {
      pageId: PAGE_ID,
      query: 'Resume',
      files: [filePath],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.uploaded).toBe(true);
      expect(result.data.files).toEqual([filePath]);
    }

    const events = ctx.recording.getEvents(BROWSER_ID);
    expect(events[0]?.payload).toMatchObject({ action: 'upload', query: 'Resume' });
  });

  test('rejects paths outside uploadDir', async () => {
    setupUploadDir();
    const ctx = createUploadContext([
      {
        nodeId: 'file-input',
        role: 'textbox',
        name: 'Resume',
        visible: true,
        tagName: 'input',
      },
    ]);

    const result = await uploadFiles(ctx, {
      pageId: PAGE_ID,
      query: 'Resume',
      files: ['/etc/passwd'],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_INPUT');
    }
  });
});
