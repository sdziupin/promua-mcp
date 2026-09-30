import type { Config } from "./config.js";
import { searchDuckDuckGoProm } from "./duckduckgo.js";
import { searchPromMarketplace } from "./prom-marketplace.js";

export interface MarketplaceSearchResult {
  title: string;
  url: string;
  description?: string;
  price_uah_guess?: number;
}

export interface MarketplaceSearchSpec {
  query: string;
  limit?: number;
  offset?: number;
  min_price?: number;
  max_price?: number;
  sort?: "relevance" | "price_asc" | "price_desc";
  max_pages?: number;
  source?: "auto" | "prom" | "duckduckgo";
}

function clampInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  const normalized = Number.isFinite(value) ? Math.trunc(value!) : fallback;
  return Math.min(max, Math.max(min, normalized));
}

export function buildPromSearchUrl(query: string): string {
  const normalized = query.trim();
  if (!normalized) throw new Error("query must not be empty");
  return `https://prom.ua/ua/search?search_term=${encodeURIComponent(normalized)}`;
}

export function parsePriceUahGuess(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const match = text.match(/(?:₴|грн\.?)(?:\s*)(\d[\d\s.,]*)|(\d[\d\s.,]*)\s*(?:₴|грн\.?)/i);
  const raw = match?.[1] ?? match?.[2];
  if (!raw) return undefined;
  const normalized = raw.replace(/\s/g, "").replace(/,(\d{1,2})$/, ".$1");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function applyDuckDuckGoFilters(
  results: MarketplaceSearchResult[],
  spec: MarketplaceSearchSpec,
): MarketplaceSearchResult[] {
  let filtered = results.filter((result) => {
    if (spec.min_price !== undefined && (result.price_uah_guess === undefined || result.price_uah_guess < spec.min_price)) return false;
    if (spec.max_price !== undefined && (result.price_uah_guess === undefined || result.price_uah_guess > spec.max_price)) return false;
    return true;
  });

  if (spec.sort === "price_asc") {
    filtered = [...filtered].sort((a, b) => (a.price_uah_guess ?? Infinity) - (b.price_uah_guess ?? Infinity));
  } else if (spec.sort === "price_desc") {
    filtered = [...filtered].sort((a, b) => (b.price_uah_guess ?? -1) - (a.price_uah_guess ?? -1));
  }

  return filtered;
}

export async function searchPromProductsDuckDuckGo(
  config: Config,
  spec: MarketplaceSearchSpec,
): Promise<{
  source: "duckduckgo";
  query: string;
  source_total: null;
  returned: number;
  offset: number;
  next_offset: null;
  scanned_pages: [];
  exhaustive: false;
  sort_scope: "source_order" | "scanned_window";
  filters: Omit<MarketplaceSearchSpec, "query">;
  results: MarketplaceSearchResult[];
  warning: string;
}> {
  const query = spec.query.trim();
  if (!query) throw new Error("query must not be empty");

  const limit = clampInteger(spec.limit, 10, 1, 20);
  const offset = clampInteger(spec.offset, 0, 0, 20);
  const raw = await searchDuckDuckGoProm(config, query);

  const normalized: MarketplaceSearchResult[] = raw.map((item) => ({
    title: item.title,
    url: item.url,
    description: item.description,
    price_uah_guess: parsePriceUahGuess(`${item.title} ${item.description ?? ""}`),
  }));

  const filtered = applyDuckDuckGoFilters(normalized, spec);
  const results = filtered.slice(offset, offset + limit);
  const { query: _query, ...filters } = spec;

  return {
    source: "duckduckgo",
    query,
    source_total: null,
    returned: results.length,
    offset,
    next_offset: null,
    scanned_pages: [],
    exhaustive: false,
    sort_scope: spec.sort === "price_asc" || spec.sort === "price_desc"
      ? "scanned_window"
      : "source_order",
    filters,
    results,
    warning:
      "DuckDuckGo is a no-auth fallback, not an exhaustive Prom.ua catalog query; it can also throttle automated requests.",
  };
}

export async function searchPromProducts(
  config: Config,
  queryOrSpec: string | MarketplaceSearchSpec,
  legacyLimit = 10,
): Promise<unknown> {
  const spec: MarketplaceSearchSpec = typeof queryOrSpec === "string"
    ? { query: queryOrSpec, limit: legacyLimit }
    : queryOrSpec;

  if (
    spec.min_price !== undefined &&
    spec.max_price !== undefined &&
    spec.min_price > spec.max_price
  ) {
    throw new Error("min_price must be less than or equal to max_price");
  }

  const source = spec.source ?? "auto";
  if (source === "duckduckgo") {
    return searchPromProductsDuckDuckGo(config, spec);
  }
  if (source === "prom") {
    return searchPromMarketplace(config, spec);
  }

  try {
    return await searchPromMarketplace(config, spec);
  } catch (promError) {
    try {
      const fallback = await searchPromProductsDuckDuckGo(config, spec);
      return {
        ...fallback,
        fallback_reason: promError instanceof Error ? promError.message : String(promError),
      };
    } catch (duckDuckGoError) {
      const promMessage = promError instanceof Error ? promError.message : String(promError);
      const ddgMessage = duckDuckGoError instanceof Error ? duckDuckGoError.message : String(duckDuckGoError);
      throw new Error(
        `Direct Prom.ua search failed (${promMessage}); DuckDuckGo fallback also failed (${ddgMessage})`,
      );
    }
  }
}
