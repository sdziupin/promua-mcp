import { homedir } from "node:os";
import { join } from "node:path";

export interface Config {
  promApiToken?: string;
  promApiBaseUrl: string;
  allowWrites: boolean;
  httpTimeoutMs: number;
  savedSearchesFile: string;
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
  const dataDir = env.PROM_DATA_DIR?.trim() || join(homedir(), ".promua-mcp");
  return {
    promApiToken: env.PROM_API_TOKEN?.trim() || undefined,
    promApiBaseUrl: trimTrailingSlash(env.PROM_API_BASE_URL?.trim() || "https://my.prom.ua/api/v1"),
    allowWrites: envBoolean(env.PROM_ALLOW_WRITES, false),
    httpTimeoutMs: envInteger(env.PROM_HTTP_TIMEOUT_MS, 15_000),
    savedSearchesFile: env.PROM_SAVED_SEARCHES_FILE?.trim() || join(dataDir, "saved-searches.json"),
  };
}
