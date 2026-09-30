import type { Config } from "./config.js";
import { configuredSearchProvider } from "./config.js";
import { requestJson } from "./http.js";

export interface MarketplaceSearchResult {
  title: string;
  url: string;
  description?: string;
  price_uah_guess?: number;
}

export interface MarketplaceSearchSpec {
  query: string;
  limit?: number;
  min_price?: number;
  max_price?: number;
  sort?: "relevance" | "price_asc" | "price_desc";
}

function isPromUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "prom.ua" || hostname.endsWith(".prom.ua");
  } catch {
    return false;
  }
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

function uniquePromResults(results: MarketplaceSearchResult[]): MarketplaceSearchResult[] {
  const seen = new Set<string>();
  const output: MarketplaceSearchResult[] = [];

  for (const result of results) {
    if (!isPromUrl(result.url) || seen.has(result.url)) continue;
    seen.add(result.url);
    output.push(result);
  }
  return output;
}

interface BraveResponse {
  web?: {
    results?: Array<{
      title?: string;
      url?: string;
      description?: string;
    }>;
  };
}

async function searchBrave(config: Config, query: string, requested: number): Promise<MarketplaceSearchResult[]> {
  const params = new URLSearchParams({
    q: `site:prom.ua ${query}`,
    count: String(Math.min(Math.max(requested, 10), 20)),
    country: "UA",
    search_lang: "uk",
    safesearch: "moderate",
  });

  const data = await requestJson<BraveResponse>(
    `https://api.search.brave.com/res/v1/web/search?${params.toString()}`,
    {
      timeoutMs: config.httpTimeoutMs,
      headers: {
        "X-Subscription-Token": config.braveApiKey!,
      },
    },
  );

  return uniquePromResults(
    (data.web?.results ?? [])
      .filter((item): item is { title: string; url: string; description?: string } => Boolean(item.title && item.url))
      .map((item) => ({
        title: item.title,
        url: item.url,
        description: item.description,
        price_uah_guess: parsePriceUahGuess(`${item.title} ${item.description ?? ""}`),
      })),
  );
}

interface SearxResponse {
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
  }>;
}

async function searchSearxng(config: Config, query: string): Promise<MarketplaceSearchResult[]> {
  const params = new URLSearchParams({
    q: `site:prom.ua ${query}`,
    format: "json",
    language: "uk-UA",
    safesearch: "1",
  });
  const data = await requestJson<SearxResponse>(
    `${config.searxngUrl}/search?${params.toString()}`,
    { timeoutMs: config.httpTimeoutMs },
  );

  return uniquePromResults(
    (data.results ?? [])
      .filter((item): item is { title: string; url: string; content?: string } => Boolean(item.title && item.url))
      .map((item) => ({
        title: item.title,
        url: item.url,
        description: item.content,
        price_uah_guess: parsePriceUahGuess(`${item.title} ${item.content ?? ""}`),
      })),
  );
}

function applyFilters(results: MarketplaceSearchResult[], spec: MarketplaceSearchSpec): MarketplaceSearchResult[] {
  let filtered = results.filter((result) => {
    if (spec.min_price !== undefined && (result.price_uah_guess === undefined || result.price_uah_guess < spec.min_price)) return false;
    if (spec.max_price !== undefined && (result.price_uah_guess === undefined || result.price_uah_guess > spec.max_price)) return false;
    return true;
  });

  if (spec.sort === "price_asc") {
    filtered = filtered.sort((a, b) => (a.price_uah_guess ?? Infinity) - (b.price_uah_guess ?? Infinity));
  } else if (spec.sort === "price_desc") {
    filtered = filtered.sort((a, b) => (b.price_uah_guess ?? -1) - (a.price_uah_guess ?? -1));
  }

  return filtered;
}

export async function searchPromProducts(
  config: Config,
  queryOrSpec: string | MarketplaceSearchSpec,
  legacyLimit = 10,
): Promise<{
  provider: "brave" | "searxng";
  query: string;
  filters: Omit<MarketplaceSearchSpec, "query">;
  results: MarketplaceSearchResult[];
  exhaustive: false;
}> {
  const spec: MarketplaceSearchSpec = typeof queryOrSpec === "string"
    ? { query: queryOrSpec, limit: legacyLimit }
    : queryOrSpec;

  const normalizedQuery = spec.query.trim();
  if (!normalizedQuery) throw new Error("query must not be empty");

  const normalizedLimit = Math.min(Math.max(Math.trunc(spec.limit || 10), 1), 20);
  const provider = configuredSearchProvider(config);
  if (!provider) {
    throw new Error("Marketplace search requires BRAVE_API_KEY or SEARXNG_URL");
  }

  const raw = provider === "brave"
    ? await searchBrave(config, normalizedQuery, 20)
    : await searchSearxng(config, normalizedQuery);

  const results = applyFilters(raw, spec).slice(0, normalizedLimit);
  const { query: _query, ...filters } = spec;

  return {
    provider,
    query: normalizedQuery,
    filters,
    results,
    exhaustive: false,
  };
}
