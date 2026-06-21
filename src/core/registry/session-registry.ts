import type { BrowserSession, Element, PageSession } from '../types/sessions.js';

export class SessionRegistry {
  private readonly browsers = new Map<string, BrowserSession>();
  private readonly pages = new Map<string, PageSession>();
  private readonly elements = new Map<string, Map<string, Element>>();
  private mutex: Promise<void> = Promise.resolve();

  private async withLock<T>(fn: () => T | Promise<T>): Promise<T> {
    const result = this.mutex.then(() => fn());
    this.mutex = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async createBrowser(session: BrowserSession): Promise<void> {
    await this.withLock(() => {
      this.browsers.set(session.browserId, session);
    });
  }

  async getBrowser(browserId: string): Promise<BrowserSession | undefined> {
    return this.withLock(() => this.browsers.get(browserId));
  }

  async markBrowserCrashed(browserId: string): Promise<void> {
    await this.withLock(() => {
      const browser = this.browsers.get(browserId);
      if (browser) {
        browser.crashed = true;
      }
    });
  }

  async deleteBrowser(browserId: string): Promise<string[]> {
    return this.withLock(() => {
      const browser = this.browsers.get(browserId);
      if (!browser) return [];

      const pageIds = [...browser.pageIds];
      for (const pageId of pageIds) {
        this.pages.delete(pageId);
        this.elements.delete(pageId);
      }
      this.browsers.delete(browserId);
      return pageIds;
    });
  }

  async createPage(session: PageSession): Promise<void> {
    await this.withLock(() => {
      this.pages.set(session.pageId, session);
      const browser = this.browsers.get(session.browserId);
      if (browser && !browser.pageIds.includes(session.pageId)) {
        browser.pageIds.push(session.pageId);
      }
    });
  }

  async getPage(pageId: string): Promise<PageSession | undefined> {
    return this.withLock(() => this.pages.get(pageId));
  }

  async updatePage(pageId: string, updates: Partial<Pick<PageSession, 'url' | 'title'>>): Promise<void> {
    await this.withLock(() => {
      const page = this.pages.get(pageId);
      if (!page) return;
      if (updates.url !== undefined) page.url = updates.url;
      if (updates.title !== undefined) page.title = updates.title;
    });
  }

  async deletePage(pageId: string): Promise<string | undefined> {
    return this.withLock(() => {
      const page = this.pages.get(pageId);
      if (!page) return undefined;

      const browser = this.browsers.get(page.browserId);
      if (browser) {
        browser.pageIds = browser.pageIds.filter((id) => id !== pageId);
      }
      this.pages.delete(pageId);
      this.elements.delete(pageId);
      return page.browserId;
    });
  }

  async invalidateElements(pageId: string): Promise<void> {
    await this.withLock(() => {
      this.elements.delete(pageId);
    });
  }

  async setElements(pageId: string, elements: Map<string, Element>): Promise<void> {
    await this.withLock(() => {
      this.elements.set(pageId, elements);
    });
  }

  async getElement(pageId: string, elementId: string): Promise<Element | undefined> {
    return this.withLock(() => this.elements.get(pageId)?.get(elementId));
  }

  async getElementsForPage(pageId: string): Promise<Map<string, Element>> {
    return this.withLock(() => new Map(this.elements.get(pageId) ?? []));
  }

  async registerElement(pageId: string, element: Element): Promise<void> {
    await this.withLock(() => {
      let pageElements = this.elements.get(pageId);
      if (!pageElements) {
        pageElements = new Map();
        this.elements.set(pageId, pageElements);
      }
      pageElements.set(element.elementId, element);
    });
  }
}
