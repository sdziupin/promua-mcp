import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Config } from "./config.js";
import { PromApiClient, type JsonObject } from "./prom-api.js";
import { SavedSearchStore } from "./saved-searches.js";
import { buildPromSearchUrl, searchPromProducts, type MarketplaceSearchSpec } from "./search.js";

const savedSearchStores = new WeakMap<Config, SavedSearchStore>();

function savedSearchesFor(config: Config): SavedSearchStore {
  let store = savedSearchStores.get(config);
  if (!store) {
    store = new SavedSearchStore(config.savedSearchesFile);
    savedSearchStores.set(config, store);
  }
  return store;
}

function ok(value: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
  };
}

function fail(error: unknown): CallToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

function argsObject(args: unknown): JsonObject {
  if (args == null) return {};
  if (typeof args !== "object" || Array.isArray(args)) throw new Error("Tool arguments must be an object");
  return args as JsonObject;
}

function required<T>(args: JsonObject, key: string): T {
  const value = args[key];
  if (value === undefined || value === null || value === "") throw new Error(`Missing required argument: ${key}`);
  return value as T;
}

function searchSpec(value: unknown): MarketplaceSearchSpec {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("search must be an object");
  const search = value as Record<string, unknown>;
  if (typeof search.query !== "string" || !search.query.trim()) throw new Error("search.query is required");
  return search as unknown as MarketplaceSearchSpec;
}

export async function handleTool(config: Config, name: string, rawArgs: unknown): Promise<CallToolResult> {
  try {
    const args = argsObject(rawArgs);
    const api = new PromApiClient(config);
    const savedSearches = savedSearchesFor(config);

    switch (name) {
      case "prom_search_products":
        return ok(await searchPromProducts(config, searchSpec(args)));
      case "prom_search_url":
        return ok({ query: required<string>(args, "query"), url: buildPromSearchUrl(required<string>(args, "query")) });

      case "prom_saved_search_list":
        return ok(await savedSearches.list());
      case "prom_saved_search_create":
        return ok(await savedSearches.create(
          required<string>(args, "name"),
          searchSpec(required(args, "search")),
        ));
      case "prom_saved_search_delete":
        return ok(await savedSearches.remove(required<string>(args, "id")));
      case "prom_saved_search_run": {
        const saved = await savedSearches.get(required<string>(args, "id"));
        return ok({ saved_search: saved, result: await searchPromProducts(config, saved.search) });
      }

      case "prom_seller_list_products":
        return ok(await api.listProducts(args));
      case "prom_seller_get_product":
        return ok(await api.getProduct(required<string | number>(args, "id")));
      case "prom_seller_get_product_by_external_id":
        return ok(await api.getProductByExternalId(required<string>(args, "id")));
      case "prom_seller_edit_products":
        return ok(await api.editProducts(required<unknown>(args, "payload")));
      case "prom_seller_edit_products_by_external_id":
        return ok(await api.editProductsByExternalId(required<unknown>(args, "payload")));
      case "prom_seller_list_orders":
        return ok(await api.listOrders(args));
      case "prom_seller_get_order":
        return ok(await api.getOrder(required<string | number>(args, "id")));
      case "prom_seller_set_order_status":
        return ok(await api.setOrderStatus(args));
      case "prom_seller_list_clients":
        return ok(await api.listClients(args));
      case "prom_seller_get_client":
        return ok(await api.getClient(required<string | number>(args, "id")));
      case "prom_seller_list_messages":
        return ok(await api.listMessages(args));
      case "prom_seller_get_message":
        return ok(await api.getMessage(required<string | number>(args, "id")));
      case "prom_seller_set_message_status":
        return ok(await api.setMessageStatus(args));
      case "prom_seller_reply_message":
        return ok(await api.replyToMessage(args));
      case "prom_seller_list_groups":
        return ok(await api.listGroups(args));
      case "prom_seller_list_payment_options":
        return ok(await api.listPaymentOptions());
      case "prom_seller_list_delivery_options":
        return ok(await api.listDeliveryOptions());
      case "prom_seller_list_order_status_options":
        return ok(await api.listOrderStatusOptions());
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return fail(error);
  }
}
