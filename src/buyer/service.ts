import type { Page } from "playwright";
import type { Config } from "../config.js";
import { BuyerBrowser, PROM_URLS, assertPromProductUrl } from "./browser.js";
import { SavedSearchStore } from "./saved-searches.js";
import type { BuyerProduct, BuyerSearchArgs } from "./types.js";

const PRODUCT_LINK_SELECTOR = 'a[href*="/ua/p"], a[href*="/p"]';

function clamp(value: number | undefined, fallback: number, min: number, max: number): number {
  const n = Number.isFinite(value) ? Math.trunc(value!) : fallback;
  return Math.max(min, Math.min(max, n));
}

function priceFromText(text: string): number | undefined {
  const matches = [...text.matchAll(/(\d[\d\s]*(?:[.,]\d{1,2})?)\s*(?:₴|грн\.?)/gi)];
  if (!matches.length) return undefined;
  const raw = matches[0]![1]!.replace(/\s/g, "").replace(",", ".");
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : undefined;
}

function percentFromText(text: string): number | undefined {
  const matches = [...text.matchAll(/(?:^|\n|\s)(\d{1,3})\s*%/g)];
  for (const match of matches.reverse()) {
    const value = Number.parseInt(match[1]!, 10);
    if (value >= 0 && value <= 100) return value;
  }
  return undefined;
}

function productRatingFromText(text: string): number | undefined {
  const patterns = [
    /(?:рейтинг|оцінка)[^\d]{0,12}(\d(?:[.,]\d)?)/i,
    /(\d(?:[.,]\d)?)\s*(?:\/\s*5|з\s*5)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const value = Number.parseFloat(match[1]!.replace(",", "."));
    if (value >= 0 && value <= 5) return value;
  }
  return undefined;
}

function sellerFromText(text: string): string | undefined {
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const sellerIndex = lines.findIndex((line) => /^продавець\b/i.test(line));
  if (sellerIndex >= 0) {
    const inline = lines[sellerIndex]!.replace(/^продавець\s*/i, "").trim();
    if (inline) return inline.replace(/\s+\d{1,3}%.*$/, "").trim() || undefined;
    return lines[sellerIndex + 1]?.replace(/\s+\d{1,3}%.*$/, "").trim() || undefined;
  }

  for (let i = 1; i < lines.length; i += 1) {
    if (/^\d{1,3}%$/.test(lines[i]!)) {
      const candidate = lines[i - 1]!;
      if (!/(грн|₴|купити|відправки|наявност)/i.test(candidate)) return candidate;
    }
  }
  return undefined;
}

function normalizeProduct(raw: { title: string; url: string; text: string }): BuyerProduct {
  const text = raw.text.replace(/\n{3,}/g, "\n\n").trim();
  return {
    title: raw.title.trim(),
    url: raw.url,
    price_uah: priceFromText(text),
    available: /(готово до відправки|в наявності|є в наявності)/i.test(text)
      ? true
      : /(немає в наявності|не в наявності)/i.test(text)
        ? false
        : undefined,
    prom_payment: /пром[-\s]?оплат/i.test(text) ? true : undefined,
    seller: sellerFromText(text),
    seller_rating: percentFromText(text),
    product_rating: productRatingFromText(text),
    raw_text: text.slice(0, 1800),
  };
}

async function extractProducts(page: Page): Promise<BuyerProduct[]> {
  const raw = await page.locator(PRODUCT_LINK_SELECTOR).evaluateAll((anchors) => {
    const items: Array<{ title: string; url: string; text: string }> = [];
    const seen = new Set<string>();

    for (const node of anchors) {
      const anchor = node as HTMLAnchorElement;
      let url: URL;
      try {
        url = new URL(anchor.href, location.href);
      } catch {
        continue;
      }
      if (!(url.hostname === "prom.ua" || url.hostname.endsWith(".prom.ua"))) continue;
      if (!/\/p\d+/i.test(url.pathname)) continue;
      const canonical = `${url.origin}${url.pathname}`;
      if (seen.has(canonical)) continue;

      let container: HTMLElement | null = anchor.closest("article, li, [data-qaid]");
      if (!container) {
        let current = anchor.parentElement;
        for (let depth = 0; current && depth < 6; depth += 1, current = current.parentElement) {
          const text = current.innerText?.trim() ?? "";
          if (text.length >= 30 && text.length <= 3000) {
            container = current;
            break;
          }
        }
      }

      const title = (
        anchor.getAttribute("title")
        || anchor.querySelector("img")?.getAttribute("alt")
        || anchor.textContent
        || ""
      ).trim();
      const text = (container?.innerText || anchor.parentElement?.innerText || title).trim();
      if (!title || text.length < 10) continue;

      seen.add(canonical);
      items.push({ title, url: canonical, text });
    }
    return items;
  });

  return raw.map(normalizeProduct);
}

function filterProducts(products: BuyerProduct[], args: BuyerSearchArgs): BuyerProduct[] {
  let output = products.filter((product) => {
    if (args.min_price !== undefined && (product.price_uah === undefined || product.price_uah < args.min_price)) return false;
    if (args.max_price !== undefined && (product.price_uah === undefined || product.price_uah > args.max_price)) return false;
    if (args.available_only && product.available !== true) return false;
    if (args.prom_payment && product.prom_payment !== true) return false;
    if (args.seller && !product.seller?.toLowerCase().includes(args.seller.toLowerCase())) return false;
    if (args.min_seller_rating !== undefined && (product.seller_rating === undefined || product.seller_rating < args.min_seller_rating)) return false;
    if (args.min_product_rating !== undefined && (product.product_rating === undefined || product.product_rating < args.min_product_rating)) return false;
    return true;
  });

  switch (args.sort) {
    case "price_asc":
      output = output.sort((a, b) => (a.price_uah ?? Number.POSITIVE_INFINITY) - (b.price_uah ?? Number.POSITIVE_INFINITY));
      break;
    case "price_desc":
      output = output.sort((a, b) => (b.price_uah ?? -1) - (a.price_uah ?? -1));
      break;
    case "seller_rating":
      output = output.sort((a, b) => (b.seller_rating ?? -1) - (a.seller_rating ?? -1));
      break;
    case "product_rating":
      output = output.sort((a, b) => (b.product_rating ?? -1) - (a.product_rating ?? -1));
      break;
  }

  return output;
}

function searchUrl(args: BuyerSearchArgs, pageNumber: number): string {
  const query = [args.query, args.category].filter(Boolean).join(" ").trim();
  const base = args.category_url ? new URL(args.category_url) : new URL("https://prom.ua/ua/search");
  if (!(base.hostname === "prom.ua" || base.hostname.endsWith(".prom.ua"))) {
    throw new Error("category_url must point to Prom.ua");
  }
  if (query) base.searchParams.set("search_term", query);
  if (pageNumber > 1) base.searchParams.set("page", String(pageNumber));
  else base.searchParams.delete("page");
  return base.toString();
}

async function clickFirst(page: Page, selectors: string[], names: RegExp[]): Promise<string> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.count() && await locator.isVisible().catch(() => false)) {
      await locator.click();
      return selector;
    }
  }
  for (const name of names) {
    const locator = page.getByRole("button", { name }).first();
    if (await locator.count() && await locator.isVisible().catch(() => false)) {
      await locator.click();
      return name.source;
    }
  }
  throw new Error("Could not find the expected Prom.ua control. The site UI may have changed.");
}

function productId(url: string): string {
  const parsed = assertPromProductUrl(url);
  const match = parsed.pathname.match(/\/p(\d+)/i);
  if (!match) throw new Error("Could not determine product id from URL");
  return match[1]!;
}

export class BuyerService {
  readonly browser: BuyerBrowser;
  readonly savedSearches: SavedSearchStore;

  constructor(private readonly config: Config) {
    this.browser = new BuyerBrowser(config);
    this.savedSearches = new SavedSearchStore(config.buyerSavedSearchesFile);
  }

  private assertMutations(): void {
    if (!this.config.buyerAllowMutations) {
      throw new Error("Buyer mutations are disabled. Set PROM_BUYER_ALLOW_MUTATIONS=true to enable favorites/cart changes.");
    }
  }

  status(): Promise<Record<string, unknown>> {
    return this.browser.status();
  }

  openLogin(): Promise<Record<string, unknown>> {
    return this.browser.openLogin();
  }

  async search(args: BuyerSearchArgs): Promise<Record<string, unknown>> {
    if (!args.query?.trim() && !args.category_url) throw new Error("query or category_url is required");
    const maxPages = clamp(args.max_pages, 3, 1, 10);
    const limit = clamp(args.limit, 50, 1, 100);

    return this.browser.run(async (page) => {
      const found = new Map<string, BuyerProduct>();
      let pagesScanned = 0;

      for (let current = 1; current <= maxPages && found.size < limit * 2; current += 1) {
        await page.goto(searchUrl(args, current), { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(this.config.buyerPageDelayMs);
        const products = await extractProducts(page);
        pagesScanned += 1;
        if (!products.length && current > 1) break;
        for (const product of products) found.set(product.url, product);
      }

      const filtered = filterProducts([...found.values()], args).slice(0, limit);
      return {
        query: args.query,
        filters: args,
        pages_scanned: pagesScanned,
        products_scanned: found.size,
        returned: filtered.length,
        results: filtered,
      };
    });
  }

  async product(url: string): Promise<BuyerProduct> {
    const target = assertPromProductUrl(url).toString();
    return this.browser.run(async (page) => {
      await page.goto(target, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(this.config.buyerPageDelayMs);
      const title = (await page.locator("h1").first().textContent().catch(() => null))?.trim()
        || (await page.title()).trim();
      const body = (await page.locator("body").innerText()).slice(0, 12000);
      return normalizeProduct({ title, url: target, text: body });
    });
  }

  async favorites(): Promise<Record<string, unknown>> {
    return this.browser.run(async (page) => {
      await page.goto(PROM_URLS.favorites, { waitUntil: "domcontentloaded" });
      if (/\/sign-in(?:[/?#]|$)/i.test(page.url())) throw new Error("Prom.ua buyer login required. Run prom_buyer_open_login first.");
      await page.waitForTimeout(this.config.buyerPageDelayMs);
      const results = await extractProducts(page);
      return { count: results.length, results };
    });
  }

  async favorite(url: string, wanted: boolean): Promise<Record<string, unknown>> {
    this.assertMutations();
    const target = assertPromProductUrl(url).toString();
    return this.browser.run(async (page) => {
      await page.goto(target, { waitUntil: "domcontentloaded" });
      if (/\/sign-in(?:[/?#]|$)/i.test(page.url())) throw new Error("Prom.ua buyer login required.");

      const favoriteControls = page.locator(
        'button[aria-label*="обран" i], button[title*="обран" i], [data-qaid*="favorite" i], [data-qaid*="wishlist" i]'
      );
      if (await favoriteControls.count()) {
        const control = favoriteControls.first();
        const label = [
          await control.getAttribute("aria-label"),
          await control.getAttribute("title"),
          await control.textContent(),
        ].filter(Boolean).join(" ");
        const pressed = await control.getAttribute("aria-pressed");
        const current = pressed === "true"
          ? true
          : pressed === "false"
            ? false
            : /видалити|прибрати|в обраному/i.test(label)
              ? true
              : /додати|до обраного/i.test(label)
                ? false
                : undefined;

        if (current === wanted) return { changed: false, favorite: wanted, url: target };
        await control.click();
        await page.waitForTimeout(400);
        return { changed: true, favorite: wanted, url: target };
      }

      await clickFirst(
        page,
        [],
        wanted
          ? [/додати.*обран/i, /до обраного/i]
          : [/видалити.*обран/i, /прибрати.*обран/i],
      );
      return { changed: true, favorite: wanted, url: target };
    });
  }

  async cart(): Promise<Record<string, unknown>> {
    return this.browser.run(async (page) => {
      await page.goto(PROM_URLS.cart, { waitUntil: "domcontentloaded" });
      if (/404|not-found/i.test(page.url())) {
        await page.goto(PROM_URLS.home, { waitUntil: "domcontentloaded" });
        const cartLink = page.getByRole("link", { name: /кошик/i }).first();
        if (await cartLink.count()) await cartLink.click();
      }
      await page.waitForTimeout(this.config.buyerPageDelayMs);
      const results = await extractProducts(page);
      return { count: results.length, results, url: page.url() };
    });
  }

  async cartAdd(url: string): Promise<Record<string, unknown>> {
    this.assertMutations();
    const target = assertPromProductUrl(url).toString();
    return this.browser.run(async (page) => {
      await page.goto(target, { waitUntil: "domcontentloaded" });
      const matched = await clickFirst(
        page,
        ['[data-qaid*="buy" i]', 'button[data-qaid*="cart" i]'],
        [/^купити$/i, /до кошика/i, /додати.*кошик/i],
      );
      await page.waitForTimeout(500);
      return { added: true, url: target, control: matched };
    });
  }

  async cartRemove(url: string): Promise<Record<string, unknown>> {
    this.assertMutations();
    const id = productId(url);
    return this.browser.run(async (page) => {
      await page.goto(PROM_URLS.cart, { waitUntil: "domcontentloaded" });
      const link = page.locator(`a[href*="/p${id}"]`).first();
      if (!await link.count()) throw new Error("Product is not present in the cart");
      const card = link.locator("xpath=ancestor::*[self::article or self::li or self::div][.//button][1]");
      const remove = card.getByRole("button", { name: /видалити|прибрати/i }).first();
      if (await remove.count()) await remove.click();
      else await clickFirst(page, ['button[aria-label*="видал" i]', '[data-qaid*="remove" i]'], [/видалити/i]);
      await page.waitForTimeout(400);
      return { removed: true, product_id: id };
    });
  }

  async cartSetQuantity(url: string, quantity: number): Promise<Record<string, unknown>> {
    this.assertMutations();
    const id = productId(url);
    const normalized = clamp(quantity, 1, 1, 999);
    return this.browser.run(async (page) => {
      await page.goto(PROM_URLS.cart, { waitUntil: "domcontentloaded" });
      const link = page.locator(`a[href*="/p${id}"]`).first();
      if (!await link.count()) throw new Error("Product is not present in the cart");
      const card = link.locator("xpath=ancestor::*[self::article or self::li or self::div][.//input][1]");
      const input = card.locator('input[type="number"], input[inputmode="numeric"]').first();
      if (!await input.count()) throw new Error("Could not find quantity input for this cart item");
      await input.fill(String(normalized));
      await input.blur();
      await page.waitForTimeout(500);
      return { product_id: id, quantity: normalized };
    });
  }

  async orders(limit = 30): Promise<Record<string, unknown>> {
    const max = clamp(limit, 30, 1, 100);
    return this.browser.run(async (page) => {
      await page.goto(PROM_URLS.orders, { waitUntil: "domcontentloaded" });
      if (/\/sign-in(?:[/?#]|$)/i.test(page.url())) throw new Error("Prom.ua buyer login required. Run prom_buyer_open_login first.");
      await page.waitForTimeout(this.config.buyerPageDelayMs);
      const rows = await page.locator('a[href*="/cabinet/user/orders"], a[href*="/orders/"]').evaluateAll((anchors) => {
        const seen = new Set<string>();
        const out: Array<{ url: string; text: string }> = [];
        for (const node of anchors) {
          const anchor = node as HTMLAnchorElement;
          const href = anchor.href;
          if (!href || seen.has(href)) continue;
          const container = anchor.closest("tr, article, li, [data-qaid]") as HTMLElement | null;
          const text = (container?.innerText || anchor.parentElement?.innerText || anchor.textContent || "").trim();
          if (text.length < 8) continue;
          seen.add(href);
          out.push({ url: href, text: text.slice(0, 2500) });
        }
        return out;
      });
      return { count: Math.min(rows.length, max), results: rows.slice(0, max) };
    });
  }

  async findAllFromOneSeller(
    items: string[],
    options: { max_pages_per_item?: number; limit_per_item?: number } = {},
  ): Promise<Record<string, unknown>> {
    if (!items.length) throw new Error("items must not be empty");
    if (items.length > 20) throw new Error("At most 20 item queries are supported per call");
    const offersBySeller = new Map<string, { seller: string; items: Map<string, BuyerProduct>; total: number }>();

    for (const item of items) {
      const result = await this.search({
        query: item,
        max_pages: clamp(options.max_pages_per_item, 1, 1, 3),
        limit: clamp(options.limit_per_item, 20, 5, 50),
      }) as { results: BuyerProduct[] };

      for (const product of result.results) {
        if (!product.seller) continue;
        const key = product.seller.toLowerCase();
        const entry = offersBySeller.get(key) ?? { seller: product.seller, items: new Map(), total: 0 };
        const existing = entry.items.get(item);
        if (!existing || (product.price_uah ?? Infinity) < (existing.price_uah ?? Infinity)) {
          if (existing?.price_uah) entry.total -= existing.price_uah;
          entry.items.set(item, product);
          if (product.price_uah) entry.total += product.price_uah;
        }
        offersBySeller.set(key, entry);
      }
    }

    const ranked = [...offersBySeller.values()]
      .map((entry) => ({
        seller: entry.seller,
        coverage: entry.items.size,
        requested: items.length,
        complete: entry.items.size === items.length,
        known_goods_total_uah: entry.total || undefined,
        items: Object.fromEntries(entry.items),
      }))
      .sort((a, b) => b.coverage - a.coverage || (a.known_goods_total_uah ?? Infinity) - (b.known_goods_total_uah ?? Infinity));

    return { requested_items: items, sellers: ranked.slice(0, 20) };
  }
}
