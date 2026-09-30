import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Config } from "./config.js";
import { BuyerService } from "./buyer/service.js";
import type { BuyerSearchArgs } from "./buyer/types.js";
import { PromApiClient, type JsonObject } from "./prom-api.js";
import { buildPromSearchUrl, searchPromProducts } from "./search.js";

const buyerServices = new WeakMap<Config, BuyerService>();

function buyerFor(config: Config): BuyerService {
  let buyer = buyerServices.get(config);
  if (!buyer) {
    buyer = new BuyerService(config);
    buyerServices.set(config, buyer);
  }
  return buyer;
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

function searchArgs(value: unknown): BuyerSearchArgs {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("search must be an object");
  return value as BuyerSearchArgs;
}

export async function handleTool(config: Config, name: string, rawArgs: unknown): Promise<CallToolResult> {
  try {
    const args = argsObject(rawArgs);
    const api = new PromApiClient(config);
    const buyer = buyerFor(config);

    switch (name) {
      case "prom_search_products":
        return ok(await searchPromProducts(config, required<string>(args, "query"), Number(args.limit ?? 10)));
      case "prom_search_url":
        return ok({ query: required<string>(args, "query"), url: buildPromSearchUrl(required<string>(args, "query")) });

      case "prom_buyer_status":
        return ok(await buyer.status());
      case "prom_buyer_open_login":
        return ok(await buyer.openLogin());
      case "prom_buyer_search":
        return ok(await buyer.search(args as BuyerSearchArgs));
      case "prom_buyer_product":
        return ok(await buyer.product(required<string>(args, "url")));
      case "prom_buyer_favorites":
        return ok(await buyer.favorites());
      case "prom_buyer_favorite_add":
        return ok(await buyer.favorite(required<string>(args, "url"), true));
      case "prom_buyer_favorite_remove":
        return ok(await buyer.favorite(required<string>(args, "url"), false));
      case "prom_buyer_cart":
        return ok(await buyer.cart());
      case "prom_buyer_cart_add":
        return ok(await buyer.cartAdd(required<string>(args, "url")));
      case "prom_buyer_cart_remove":
        return ok(await buyer.cartRemove(required<string>(args, "url")));
      case "prom_buyer_cart_set_quantity":
        return ok(await buyer.cartSetQuantity(required<string>(args, "url"), Number(required(args, "quantity"))));
      case "prom_buyer_orders":
        return ok(await buyer.orders(Number(args.limit ?? 30)));
      case "prom_buyer_find_all_from_one_seller":
        return ok(await buyer.findAllFromOneSeller(
          required<string[]>(args, "items"),
          {
            max_pages_per_item: args.max_pages_per_item as number | undefined,
            limit_per_item: args.limit_per_item as number | undefined,
          },
        ));

      case "prom_saved_search_list":
        return ok(await buyer.savedSearches.list());
      case "prom_saved_search_create":
        return ok(await buyer.savedSearches.create(
          required<string>(args, "name"),
          searchArgs(required(args, "search")),
        ));
      case "prom_saved_search_delete":
        return ok(await buyer.savedSearches.remove(required<string>(args, "id")));
      case "prom_saved_search_run": {
        const saved = await buyer.savedSearches.get(required<string>(args, "id"));
        return ok({ saved_search: saved, result: await buyer.search(saved.search) });
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
