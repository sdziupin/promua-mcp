export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

function asJsonOrText(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function requestText(
  url: string,
  options: RequestInit & { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<string> {
  const {
    timeoutMs = 15_000,
    fetchImpl = fetch,
    ...requestInit
  } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      ...requestInit,
      signal: controller.signal,
    });

    const text = await response.text();
    if (!response.ok) {
      throw new HttpError(
        `HTTP ${response.status} ${response.statusText} for ${url}`,
        response.status,
        asJsonOrText(text),
      );
    }
    return text;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs} ms: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function requestJson<T>(
  url: string,
  options: RequestInit & { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<T> {
  const text = await requestText(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...options.headers,
    },
  });
  return asJsonOrText(text) as T;
}
