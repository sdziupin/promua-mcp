import { chromium, type BrowserContext, type Page } from "playwright";
import type { Config } from "../config.js";

export const PROM_URLS = {
  home: "https://prom.ua/ua/",
  login: "https://prom.ua/ua/sign-in?next=https%3A%2F%2Fmy.prom.ua%2Fuk%2Fcabinet%2Fuser%2Ffavorites",
  favorites: "https://my.prom.ua/uk/cabinet/user/favorites",
  orders: "https://my.prom.ua/uk/cabinet/user/orders",
  cart: "https://prom.ua/ua/cart",
} as const;

function browserError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (/executable|browser.*not found|playwright install/i.test(message)) {
    return new Error(`Chromium is not installed for buyer mode. Run: npm run buyer:install-browser. Original error: ${message}`);
  }
  return error instanceof Error ? error : new Error(message);
}

export class BuyerBrowser {
  private contextPromise?: Promise<BrowserContext>;
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly config: Config) {}

  private async context(): Promise<BrowserContext> {
    if (!this.contextPromise) {
      this.contextPromise = chromium.launchPersistentContext(this.config.buyerProfileDir, {
        headless: this.config.buyerHeadless,
        locale: "uk-UA",
        viewport: { width: 1440, height: 1000 },
      }).catch((error) => {
        this.contextPromise = undefined;
        throw browserError(error);
      });
    }
    return this.contextPromise;
  }

  async run<T>(fn: (page: Page) => Promise<T>): Promise<T> {
    let release!: () => void;
    const previous = this.queue;
    this.queue = new Promise<void>((resolve) => { release = resolve; });
    await previous;

    try {
      const context = await this.context();
      const page = context.pages()[0] ?? await context.newPage();
      page.setDefaultTimeout(this.config.buyerActionTimeoutMs);
      return await fn(page);
    } finally {
      release();
    }
  }

  async openLogin(): Promise<{ opened: true; url: string; headless: boolean }> {
    if (this.config.buyerHeadless) {
      throw new Error("Interactive login requires PROM_BUYER_HEADLESS=false");
    }
    return this.run(async (page) => {
      await page.goto(PROM_URLS.login, { waitUntil: "domcontentloaded" });
      return { opened: true, url: page.url(), headless: false };
    });
  }

  async status(): Promise<Record<string, unknown>> {
    return this.run(async (page) => {
      await page.goto(PROM_URLS.favorites, { waitUntil: "domcontentloaded" });
      const finalUrl = page.url();
      return {
        authenticated: !/\/sign-in(?:[/?#]|$)/i.test(finalUrl),
        current_url: finalUrl,
        headless: this.config.buyerHeadless,
        mutations_enabled: this.config.buyerAllowMutations,
        profile_dir: this.config.buyerProfileDir,
      };
    });
  }

  async close(): Promise<void> {
    if (!this.contextPromise) return;
    try {
      const context = await this.contextPromise;
      await context.close();
    } finally {
      this.contextPromise = undefined;
    }
  }
}

export function assertPromProductUrl(value: string): URL {
  const url = new URL(value);
  if (!(url.hostname === "prom.ua" || url.hostname.endsWith(".prom.ua"))) {
    throw new Error("Only Prom.ua URLs are allowed");
  }
  if (!/\/p\d+/i.test(url.pathname)) {
    throw new Error("Expected a Prom.ua product URL");
  }
  return url;
}
