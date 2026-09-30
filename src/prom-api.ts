import type { Config } from "./config.js";
import { requestJson } from "./http.js";

export type JsonObject = Record<string, unknown>;

function requireToken(config: Config): string {
  if (!config.promApiToken) {
    throw new Error("Prom.ua seller API requires PROM_API_TOKEN");
  }
  return config.promApiToken;
}

function requireWrites(config: Config): void {
  if (!config.allowWrites) {
    throw new Error("Prom.ua write operations are disabled. Set PROM_ALLOW_WRITES=true to enable them.");
  }
}

function compactQuery(params: Record<string, unknown>): URLSearchParams {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      for (const item of value) query.append(key, String(item));
    } else {
      query.set(key, String(value));
    }
  }
  return query;
}

export class PromApiClient {
  constructor(private readonly config: Config) {}

  private async request<T>(
    method: "GET" | "POST" | "PUT",
    path: string,
    options: { query?: Record<string, unknown>; body?: unknown; write?: boolean } = {},
  ): Promise<T> {
    if (options.write) requireWrites(this.config);
    const token = requireToken(this.config);
    const query = compactQuery(options.query ?? {});
    const url = `${this.config.promApiBaseUrl}${path}${query.size ? `?${query.toString()}` : ""}`;

    return requestJson<T>(url, {
      method,
      timeoutMs: this.config.httpTimeoutMs,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  }

  listProducts(params: JsonObject = {}): Promise<unknown> {
    return this.request("GET", "/products/list", { query: params });
  }

  getProduct(id: string | number): Promise<unknown> {
    return this.request("GET", `/products/${encodeURIComponent(String(id))}`);
  }

  getProductByExternalId(id: string): Promise<unknown> {
    return this.request("GET", `/products/by_external_id/${encodeURIComponent(id)}`);
  }

  editProducts(payload: unknown): Promise<unknown> {
    return this.request("POST", "/products/edit", { body: payload, write: true });
  }

  editProductsByExternalId(payload: unknown): Promise<unknown> {
    return this.request("POST", "/products/edit_by_external_id", { body: payload, write: true });
  }

  listOrders(params: JsonObject = {}): Promise<unknown> {
    return this.request("GET", "/orders/list", { query: params });
  }

  getOrder(id: string | number): Promise<unknown> {
    return this.request("GET", `/orders/${encodeURIComponent(String(id))}`);
  }

  setOrderStatus(body: JsonObject): Promise<unknown> {
    return this.request("POST", "/orders/set_status", { body, write: true });
  }

  listClients(params: JsonObject = {}): Promise<unknown> {
    return this.request("GET", "/clients/list", { query: params });
  }

  getClient(id: string | number): Promise<unknown> {
    return this.request("GET", `/clients/${encodeURIComponent(String(id))}`);
  }

  listMessages(params: JsonObject = {}): Promise<unknown> {
    return this.request("GET", "/messages/list", { query: params });
  }

  getMessage(id: string | number): Promise<unknown> {
    return this.request("GET", `/messages/${encodeURIComponent(String(id))}`);
  }

  setMessageStatus(body: JsonObject): Promise<unknown> {
    return this.request("POST", "/messages/set_status", { body, write: true });
  }

  replyToMessage(body: JsonObject): Promise<unknown> {
    return this.request("POST", "/messages/reply", { body, write: true });
  }

  listGroups(params: JsonObject = {}): Promise<unknown> {
    return this.request("GET", "/groups/list", { query: params });
  }

  listPaymentOptions(): Promise<unknown> {
    return this.request("GET", "/payment_options/list");
  }

  listDeliveryOptions(): Promise<unknown> {
    return this.request("GET", "/delivery_options/list");
  }

  listOrderStatusOptions(): Promise<unknown> {
    return this.request("GET", "/order_status_options/list");
  }
}
