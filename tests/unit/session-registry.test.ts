import { describe, expect, test } from 'bun:test';
import { SessionRegistry } from '../../src/core/registry/session-registry.ts';

describe('SessionRegistry', () => {
  test('cascade delete removes browser and pages', async () => {
    const registry = new SessionRegistry();

    await registry.createBrowser({
      browserId: 'browser-1',
      createdAt: new Date().toISOString(),
      headless: true,
      recordingEnabled: true,
      pageIds: [],
    });

    await registry.createPage({
      pageId: 'page-1',
      browserId: 'browser-1',
      url: 'about:blank',
      title: '',
      createdAt: new Date().toISOString(),
    });

    await registry.createPage({
      pageId: 'page-2',
      browserId: 'browser-1',
      url: 'about:blank',
      title: '',
      createdAt: new Date().toISOString(),
    });

    const deletedPages = await registry.deleteBrowser('browser-1');
    expect(deletedPages).toEqual(['page-1', 'page-2']);
    expect(await registry.getBrowser('browser-1')).toBeUndefined();
    expect(await registry.getPage('page-1')).toBeUndefined();
  });

  test('invalidateElements clears element map', async () => {
    const registry = new SessionRegistry();

    await registry.registerElement('page-1', {
      elementId: 'el-1',
      role: 'button',
      text: 'Submit',
      visible: true,
    });

    await registry.invalidateElements('page-1');
    expect(await registry.getElement('page-1', 'el-1')).toBeUndefined();
  });
});
