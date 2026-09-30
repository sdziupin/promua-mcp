import type { Config } from "./config.js";
import { requestText } from "./http.js";
import type { MarketplaceSearchSpec } from "./search.js";

const PROM_SEARCH_URL = "https://prom.ua/ua/search";
const ITEMS_PER_PAGE = 10;

const PROM_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Accept-Language": "uk,ru;q=0.9,en;q=0.7",
  Accept: "text/html,application/xhtml+xml",
};

export interface PromMarketplaceOffer {
  id: string;
  title: string;
  url: string;
  price?: number;
  price_min?: number;
  price_max?: number;
  currency?: string;
  availability?: string;
  seller?: string;
  sellers?: string[];
  image?: string;
  sku?: string;
  brand?: string;
  description?: string;
}

export interface PromMarketplaceSearchResult {
  source: "prom_ssr";
  query: string;
  source_total: number | null;
  returned: number;
  offset: number;
  next_offset: number | null;
  scanned_pages: number[];
  exhaustive: boolean;
  sort_scope: "source_order" | "scanned_window";
  filters: Omit<MarketplaceSearchSpec, "query">;
  results: PromMarketplaceOffer[];
  warning?: string;
}

function clampInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  const normalized = Number.isFinite(value) ? Math.trunc(value!) : fallback;
  return Math.min(max, Math.max(min, normalized));
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    quot: '"',
    amp: "&",
    apos: "'",
    lt: "<",
    gt: ">",
    nbsp: " ",
  };

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (entity.startsWith("#")) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return named[entity.toLowerCase()] ?? match;
  });
}

function isProductType(type: unknown): boolean {
  if (type === "Product") return true;
  return Array.isArray(type) && type.includes("Product");
}

function collectProducts(value: unknown, output: Record<string, unknown>[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectProducts(item, output);
    return;
  }
  if (!value || typeof value !== "object") return;

  const obj = value as Record<string, unknown>;
  if (isProductType(obj["@type"])) output.push(obj);

  if (Array.isArray(obj["@graph"])) {
    for (const item of obj["@graph"]) collectProducts(item, output);
  }
}

function extractScriptBodies(html: string, mime: string): string[] {
  const out: string[] = [];
  const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

  for (const match of html.matchAll(scriptRe)) {
    const attrs = match[1] ?? "";
    const body = match[2] ?? "";
    const typeMatch = attrs.match(/\btype\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
    const type = typeMatch?.[1] ?? typeMatch?.[2] ?? typeMatch?.[3] ?? "";
    if (type.toLowerCase() === mime.toLowerCase()) out.push(body.trim());
  }
  return out;
}

export function parsePromProducts(html: string): PromMarketplaceOffer[] {
  const products: Record<string, unknown>[] = [];

  for (const body of extractScriptBodies(html, "application/ld+json")) {
    try {
      collectProducts(JSON.parse(body) as unknown, products);
    } catch {
      continue;
    }
  }

  const parsed = products
    .map(parsePromProduct)
    .filter((offer): offer is PromMarketplaceOffer => offer !== null);

  const seen = new Set<string>();
  return parsed.filter((offer) => {
    if (seen.has(offer.url)) return false;
    seen.add(offer.url);
    return true;
  });
}

function parseOfferRecord(value: unknown): {
  price?: number;
  currency?: string;
  availability?: string;
  seller?: string;
} | null {
  if (!value || typeof value !== "object") return null;
  const offer = value as Record<string, unknown>;

  const rawPrice = offer.price;
  const price = rawPrice === undefined || rawPrice === null
    ? undefined
    : Number.parseFloat(String(rawPrice).replace(/\u00a0/g, "").replace(/\s/g, ""));

  const sellerObj = offer.seller;
  let seller: string | undefined;
  if (sellerObj && typeof sellerObj === "object") {
    const name = (sellerObj as Record<string, unknown>).name;
    if (typeof name === "string" && name.trim()) seller = decodeHtmlEntities(name.trim());
  }

  const rawAvailability = typeof offer.availability === "string" ? offer.availability : undefined;
  const availability = rawAvailability?.split("/").pop();

  return {
    price: Number.isFinite(price) ? price : undefined,
    currency: typeof offer.priceCurrency === "string" ? offer.priceCurrency : undefined,
    availability,
    seller,
  };
}

function parsePromProduct(product: Record<string, unknown>): PromMarketplaceOffer | null {
  const rawUrl = typeof product.url === "string" ? product.url : "";
  if (!rawUrl) return null;

  let url: string;
  try {
    url = new URL(rawUrl, "https://prom.ua").toString();
  } catch {
    return null;
  }

  const rawOffers = Array.isArray(product.offers) ? product.offers : [product.offers];
  const offers = rawOffers
    .map(parseOfferRecord)
    .filter((offer): offer is NonNullable<ReturnType<typeof parseOfferRecord>> => offer !== null);

  const prices = offers
    .map((offer) => offer.price)
    .filter((price): price is number => typeof price === "number" && Number.isFinite(price));

  const sellers = [...new Set(
    offers
      .map((offer) => offer.seller)
      .filter((seller): seller is string => Boolean(seller)),
  )];

  const currencies = offers
    .map((offer) => offer.currency)
    .filter((currency): currency is string => Boolean(currency));

  const availabilities = offers
    .map((offer) => offer.availability)
    .filter((availability): availability is string => Boolean(availability));

  const idMatch = new URL(url).pathname.match(/\/(?:ua\/)?[mp]-?(\d+)/i);
  const id = idMatch?.[1] ?? url;

  const rawImage = product.image;
  const image = Array.isArray(rawImage)
    ? rawImage.find((item): item is string => typeof item === "string")
    : typeof rawImage === "string"
      ? rawImage
      : undefined;

  const brandObj = product.brand;
  const brand = typeof brandObj === "string"
    ? brandObj
    : brandObj && typeof brandObj === "object" && typeof (brandObj as Record<string, unknown>).name === "string"
      ? String((brandObj as Record<string, unknown>).name)
      : undefined;

  const minPrice = prices.length ? Math.min(...prices) : undefined;
  const maxPrice = prices.length ? Math.max(...prices) : undefined;

  return {
    id,
    title: decodeHtmlEntities(typeof product.name === "string" ? product.name : ""),
    url,
    price: minPrice,
    price_min: minPrice,
    price_max: maxPrice,
    currency: currencies[0],
    availability: availabilities.includes("InStock")
      ? "InStock"
      : availabilities[0],
    seller: sellers.length === 1 ? sellers[0] : undefined,
    sellers: sellers.length ? sellers : undefined,
    image,
    sku: typeof product.sku === "string" ? decodeHtmlEntities(product.sku) : undefined,
    brand: brand ? decodeHtmlEntities(brand) : undefined,
    description: typeof product.description === "string"
      ? decodeHtmlEntities(product.description)
      : undefined,
  };
}

export function parsePromTotal(html: string): number | null {
  for (const body of extractScriptBodies(html, "application/json")) {
    try {
      const parsed = JSON.parse(body) as unknown;
      if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed) &&
        typeof (parsed as Record<string, unknown>).total === "number"
      ) {
        return (parsed as Record<string, number>).total;
      }
    } catch {
      continue;
    }
  }

  const match = html.match(/"total"\s*:\s*(\d+)/);
  return match ? Number.parseInt(match[1]!, 10) : null;
}

function applyPriceFilter(
  offers: PromMarketplaceOffer[],
  spec: MarketplaceSearchSpec,
): PromMarketplaceOffer[] {
  return offers.filter((offer) => {
    if (spec.min_price !== undefined && (offer.price === undefined || offer.price < spec.min_price)) return false;
    if (spec.max_price !== undefined && (offer.price === undefined || offer.price > spec.max_price)) return false;
    return true;
  });
}

function sortOffers(
  offers: PromMarketplaceOffer[],
  sort: MarketplaceSearchSpec["sort"],
): PromMarketplaceOffer[] {
  if (sort === "price_asc") {
    return [...offers].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
  }
  if (sort === "price_desc") {
    return [...offers].sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
  }
  return offers;
}

async function fetchPromPage(
  config: Config,
  query: string,
  page: number,
  fetchImpl: typeof fetch,
): Promise<{ html: string; offers: PromMarketplaceOffer[]; total: number | null }> {
  const url = new URL(PROM_SEARCH_URL);
  url.searchParams.set("search_term", query);
  if (page > 1) url.searchParams.set("page", String(page));

  const html = await requestText(url.toString(), {
    timeoutMs: config.httpTimeoutMs,
    fetchImpl,
    headers: PROM_HEADERS,
    redirect: "follow",
  });

  const offers = parsePromProducts(html);
  if (!offers.length) {
    throw new Error(`Prom search page ${page} has no Product JSON-LD blocks`);
  }

  return {
    html,
    offers,
    total: parsePromTotal(html),
  };
}

export async function searchPromMarketplace(
  config: Config,
  spec: MarketplaceSearchSpec,
  fetchImpl: typeof fetch = fetch,
): Promise<PromMarketplaceSearchResult> {
  const query = spec.query.trim();
  if (!query) throw new Error("query must not be empty");

  const limit = clampInteger(spec.limit, 20, 1, 50);
  const offset = clampInteger(spec.offset, 0, 0, 10_000);
  const maxPages = clampInteger(spec.max_pages, 5, 1, 10);
  const hasPriceFilter = spec.min_price !== undefined || spec.max_price !== undefined;
  const needsWindowSort = spec.sort === "price_asc" || spec.sort === "price_desc";

  const startPage = !hasPriceFilter && !needsWindowSort
    ? Math.floor(offset / ITEMS_PER_PAGE) + 1
    : 1;
  const localOffset = startPage > 1 ? offset % ITEMS_PER_PAGE : offset;

  const scannedPages: number[] = [];
  const byUrl = new Map<string, PromMarketplaceOffer>();
  let sourceTotal: number | null = null;
  let finalSourcePage: number | null = null;

  for (let page = startPage; scannedPages.length < maxPages; page += 1) {
    if (finalSourcePage !== null && page > finalSourcePage) break;

    const current = await fetchPromPage(config, query, page, fetchImpl);
    scannedPages.push(page);
    if (sourceTotal === null && current.total !== null) {
      sourceTotal = current.total;
      finalSourcePage = Math.max(1, Math.ceil(sourceTotal / ITEMS_PER_PAGE));
    }

    for (const offer of applyPriceFilter(current.offers, spec)) {
      byUrl.set(offer.url, offer);
    }

    const enoughForWindow = byUrl.size >= localOffset + limit;
    if (!needsWindowSort && enoughForWindow) break;
    if (current.offers.length < ITEMS_PER_PAGE) break;
  }

  const filtered = sortOffers([...byUrl.values()], spec.sort);
  const results = filtered.slice(localOffset, localOffset + limit);

  const lastScanned = scannedPages.at(-1) ?? 0;
  const exhaustive = startPage === 1 &&
    finalSourcePage !== null &&
    lastScanned >= finalSourcePage;

  let warning: string | undefined;
  if (needsWindowSort && !exhaustive) {
    warning = "Price sorting applies only to the scanned Prom.ua result window, not necessarily the full catalog.";
  } else if ((hasPriceFilter || offset > 0) && !exhaustive) {
    warning = "Client-side filtering/pagination is based on scanned Prom.ua result pages; use next_offset or increase max_pages for broader coverage.";
  }

  const nextOffset = results.length === limit &&
    (sourceTotal === null || offset + results.length < sourceTotal)
    ? offset + results.length
    : null;

  const { query: _query, ...filters } = spec;

  return {
    source: "prom_ssr",
    query,
    source_total: sourceTotal,
    returned: results.length,
    offset,
    next_offset: nextOffset,
    scanned_pages: scannedPages,
    exhaustive,
    sort_scope: needsWindowSort ? "scanned_window" : "source_order",
    filters,
    results,
    warning,
  };
}
