export type SearchProvider = "brave" | "searxng" | null;

export interface Config {
  promApiToken?: string;
  promApiBaseUrl: string;
  allowWrites: boolean;
  braveApiKey?: string;
  searxngUrl?: string;
  httpTimeoutMs: number;
}

function envBoolean(value: string | undefined, fallback = false): boolean {
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function envInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    promApiToken: env.PROM_API_TOKEN?.trim() || undefined,
    promApiBaseUrl: trimTrailingSlash(env.PROM_API_BASE_URL?.trim() || "https://my.prom.ua/api/v1"),
    allowWrites: envBoolean(env.PROM_ALLOW_WRITES, false),
    braveApiKey: env.BRAVE_API_KEY?.trim() || undefined,
    searxngUrl: env.SEARXNG_URL ? trimTrailingSlash(env.SEARXNG_URL.trim()) : undefined,
    httpTimeoutMs: envInteger(env.PROM_HTTP_TIMEOUT_MS, 15_000),
  };
}

export function configuredSearchProvider(config: Config): SearchProvider {
  if (config.braveApiKey) return "brave";
  if (config.searxngUrl) return "searxng";
  return null;
}
