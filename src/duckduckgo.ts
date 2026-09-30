import type { Config } from "./config.js";
import { requestText } from "./http.js";

export interface DuckDuckGoResult {
  title: string;
  url: string;
  description?: string;
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

  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
      if (entity.startsWith("#x") || entity.startsWith("#X")) {
        const code = Number.parseInt(entity.slice(2), 16);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      if (entity.startsWith("#")) {
        const code = Number.parseInt(entity.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      return named[entity.toLowerCase()] ?? match;
    })
    .replace(/\s+/g, " ")
    .trim();
}

function unwrapDuckDuckGoUrl(raw: string): string | null {
  const href = decodeHtmlEntities(raw);
  try {
    const url = href.startsWith("//")
      ? new URL(`https:${href}`)
      : new URL(href, "https://html.duckduckgo.com/");

    if (
      (url.hostname === "duckduckgo.com" || url.hostname.endsWith(".duckduckgo.com")) &&
      url.pathname.startsWith("/l/")
    ) {
      const target = url.searchParams.get("uddg");
      return target ? decodeURIComponent(target) : null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function isPromUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "prom.ua" || hostname.endsWith(".prom.ua");
  } catch {
    return false;
  }
}

export function parseDuckDuckGoHtml(html: string): DuckDuckGoResult[] {
  if (/anomaly-modal|challenge-form|bots use DuckDuckGo/i.test(html)) {
    throw new Error("DuckDuckGo returned a bot-detection challenge");
  }

  const anchorRe = /<a\b(?=[^>]*\bclass=["'][^"']*\bresult__a\b[^"']*["'])(?=[^>]*\bhref=["']([^"']+)["'])[^>]*>([\s\S]*?)<\/a>/gi;
  const matches = [...html.matchAll(anchorRe)];
  const results: DuckDuckGoResult[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index]!;
    const rawHref = match[1] ?? "";
    const url = unwrapDuckDuckGoUrl(rawHref);
    if (!url || !isPromUrl(url) || seen.has(url)) continue;

    const title = decodeHtmlEntities(match[2] ?? "");
    if (!title) continue;

    const nextStart = matches[index + 1]?.index ?? html.length;
    const segment = html.slice((match.index ?? 0) + match[0].length, nextStart);
    const snippetMatch = segment.match(
      /<(?:a|div)\b[^>]*class=["'][^"']*\bresult__snippet\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|div)>/i,
    );
    const description = snippetMatch ? decodeHtmlEntities(snippetMatch[1] ?? "") : undefined;

    seen.add(url);
    results.push({ title, url, description });
  }

  if (!results.length) {
    throw new Error("DuckDuckGo returned no Prom.ua results or its HTML format changed");
  }

  return results;
}

export async function searchDuckDuckGoProm(
  config: Config,
  query: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DuckDuckGoResult[]> {
  const normalized = query.trim();
  if (!normalized) throw new Error("query must not be empty");

  const body = new URLSearchParams({
    q: `site:prom.ua ${normalized}`,
    kl: "ua-uk",
    kp: "-1",
  });

  const html = await requestText("https://html.duckduckgo.com/html/", {
    method: "POST",
    timeoutMs: config.httpTimeoutMs,
    fetchImpl,
    redirect: "follow",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      Referer: "https://html.duckduckgo.com/",
      "Accept-Language": "uk-UA,uk;q=0.9,en;q=0.7",
    },
    body: body.toString(),
  });

  return parseDuckDuckGoHtml(html);
}
