import { buyerTools } from "./buyer/tools.js";

const idSchema = {
  anyOf: [
    { type: "string", minLength: 1 },
    { type: "integer" },
  ],
} as const;

const paginationProperties = {
  limit: { type: "integer", minimum: 1, description: "Maximum number of records requested from Prom.ua." },
  last_id: { type: "integer", minimum: 0, description: "Prom.ua cursor/id for pagination where supported." },
} as const;

const sellerAndSearchTools = [
  {
    name: "prom_search_products",
    description: "Search the public Prom.ua marketplace through Brave Search or SearXNG. Does not scrape Prom.ua pages directly.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", minLength: 1, description: "Product search query, in Ukrainian or any other language." },
        limit: { type: "integer", minimum: 1, maximum: 20, default: 10 },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "prom_search_url",
    description: "Build a Prom.ua marketplace search URL for a query. Requires no API credentials and performs no automated page access.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", minLength: 1 } },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "prom_seller_list_products",
    description: "List products from the authenticated seller's Prom.ua company via Public API.",
    inputSchema: {
      type: "object",
      properties: {
        ...paginationProperties,
        group_id: { type: "integer" },
        last_modified_from: { type: "string", description: "Only products modified after this UTC date/time." },
        last_modified_to: { type: "string", description: "Only products modified before this UTC date/time." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "prom_seller_get_product",
    description: "Get one seller product by Prom.ua product id.",
    inputSchema: {
      type: "object",
      properties: { id: idSchema },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "prom_seller_get_product_by_external_id",
    description: "Get one seller product by external id.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", minLength: 1 } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "prom_seller_edit_products",
    description: "Edit seller products by Prom.ua ids. Disabled unless PROM_ALLOW_WRITES=true.",
    inputSchema: {
      type: "object",
      properties: {
        payload: { anyOf: [{ type: "object", additionalProperties: true }, { type: "array", minItems: 1, items: { type: "object", additionalProperties: true } }] },
      },
      required: ["payload"],
      additionalProperties: false,
    },
  },
  {
    name: "prom_seller_edit_products_by_external_id",
    description: "Edit seller products by external ids. Disabled unless PROM_ALLOW_WRITES=true.",
    inputSchema: {
      type: "object",
      properties: {
        payload: { anyOf: [{ type: "object", additionalProperties: true }, { type: "array", minItems: 1, items: { type: "object", additionalProperties: true } }] },
      },
      required: ["payload"],
      additionalProperties: false,
    },
  },
  {
    name: "prom_seller_list_orders",
    description: "List orders from the authenticated Prom.ua seller company.",
    inputSchema: {
      type: "object",
      properties: {
        ...paginationProperties,
        status: { type: "string" },
        date_from: { type: "string", description: "UTC date/time filter in Prom.ua-supported format." },
        date_to: { type: "string", description: "UTC date/time filter in Prom.ua-supported format." },
        last_modified_from: { type: "string", description: "Only orders modified after this UTC date/time." },
        last_modified_to: { type: "string", description: "Only orders modified before this UTC date/time." },
        sort_dir: { type: "string", enum: ["asc", "desc"] },
      },
      additionalProperties: false,
    },
  },
  {
    name: "prom_seller_get_order",
    description: "Get one seller order by id.",
    inputSchema: {
      type: "object",
      properties: { id: idSchema },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "prom_seller_set_order_status",
    description: "Change status for one or more seller orders. Disabled unless PROM_ALLOW_WRITES=true.",
    inputSchema: {
      type: "object",
      properties: {
        ids: { type: "array", minItems: 1, items: { type: "integer" } },
        status: { anyOf: [{ type: "string", minLength: 1 }, { type: "integer" }] },
        cancellation_reason: { type: "string" },
        cancellation_text: { type: "string" },
      },
      required: ["ids", "status"],
      additionalProperties: false,
    },
  },
  {
    name: "prom_seller_list_clients",
    description: "List clients of the authenticated Prom.ua seller company.",
    inputSchema: { type: "object", properties: { ...paginationProperties }, additionalProperties: false },
  },
  {
    name: "prom_seller_get_client",
    description: "Get one seller client by id.",
    inputSchema: {
      type: "object",
      properties: { id: idSchema },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "prom_seller_list_messages",
    description: "List messages for the authenticated Prom.ua seller company.",
    inputSchema: { type: "object", properties: { ...paginationProperties, status: { type: "string" }, date_from: { type: "string" }, date_to: { type: "string" } }, additionalProperties: false },
  },
  {
    name: "prom_seller_get_message",
    description: "Get one seller message by id.",
    inputSchema: {
      type: "object",
      properties: { id: idSchema },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "prom_seller_set_message_status",
    description: "Change status for one or more seller messages. Disabled unless PROM_ALLOW_WRITES=true.",
    inputSchema: {
      type: "object",
      properties: {
        ids: { type: "array", minItems: 1, items: { type: "integer" } },
        status: { type: "string", minLength: 1 },
      },
      required: ["ids", "status"],
      additionalProperties: false,
    },
  },
  {
    name: "prom_seller_reply_message",
    description: "Reply to a seller message through Prom.ua. Disabled unless PROM_ALLOW_WRITES=true.",
    inputSchema: {
      type: "object",
      properties: {
        id: idSchema,
        message: { type: "string", minLength: 1 },
      },
      required: ["id", "message"],
      additionalProperties: false,
    },
  },
  {
    name: "prom_seller_list_groups",
    description: "List seller product groups.",
    inputSchema: { type: "object", properties: { ...paginationProperties }, additionalProperties: false },
  },
  {
    name: "prom_seller_list_payment_options",
    description: "List seller payment options.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "prom_seller_list_delivery_options",
    description: "List seller delivery options.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "prom_seller_list_order_status_options",
    description: "List seller order status options.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
];

export const tools = [...buyerTools, ...sellerAndSearchTools];
