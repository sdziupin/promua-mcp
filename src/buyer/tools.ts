const productUrl = { type: "string", minLength: 1, description: "Prom.ua product URL." } as const;

const searchProperties = {
  query: { type: "string", minLength: 1 },
  category: { type: "string", description: "Optional category words appended to the search query." },
  category_url: { type: "string", description: "Optional Prom.ua category URL used as the search base." },
  min_price: { type: "number", minimum: 0 },
  max_price: { type: "number", minimum: 0 },
  min_seller_rating: { type: "number", minimum: 0, maximum: 100 },
  min_product_rating: { type: "number", minimum: 0, maximum: 5 },
  available_only: { type: "boolean", default: false },
  prom_payment: { type: "boolean", default: false },
  seller: { type: "string", description: "Seller name substring." },
  sort: {
    type: "string",
    enum: ["relevance", "price_asc", "price_desc", "seller_rating", "product_rating"],
    default: "relevance",
  },
  max_pages: { type: "integer", minimum: 1, maximum: 10, default: 3 },
  limit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
} as const;

export const buyerTools = [
  {
    name: "prom_buyer_status",
    description: "Check Prom.ua buyer browser-session status, authentication state and mutation gate.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "prom_buyer_open_login",
    description: "Open the Prom.ua sign-in page in the persistent buyer Chromium profile for manual login. Requires PROM_BUYER_HEADLESS=false.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "prom_buyer_search",
    description: "Search Prom.ua directly in the buyer browser, scan multiple result pages and apply structured filters/sorting. Never performs checkout.",
    inputSchema: {
      type: "object",
      properties: searchProperties,
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "prom_buyer_product",
    description: "Read current product details from a Prom.ua product page using the buyer browser.",
    inputSchema: {
      type: "object",
      properties: { url: productUrl },
      required: ["url"],
      additionalProperties: false,
    },
  },
  {
    name: "prom_buyer_favorites",
    description: "List products visible in the authenticated buyer Favorites page.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "prom_buyer_favorite_add",
    description: "Add a product to buyer Favorites. Requires PROM_BUYER_ALLOW_MUTATIONS=true and an authenticated buyer session.",
    inputSchema: {
      type: "object",
      properties: { url: productUrl },
      required: ["url"],
      additionalProperties: false,
    },
  },
  {
    name: "prom_buyer_favorite_remove",
    description: "Remove a product from buyer Favorites. Requires PROM_BUYER_ALLOW_MUTATIONS=true and an authenticated buyer session.",
    inputSchema: {
      type: "object",
      properties: { url: productUrl },
      required: ["url"],
      additionalProperties: false,
    },
  },
  {
    name: "prom_buyer_cart",
    description: "List products currently visible in the Prom.ua buyer cart.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "prom_buyer_cart_add",
    description: "Add a product to the Prom.ua cart. Requires PROM_BUYER_ALLOW_MUTATIONS=true. Does not place an order.",
    inputSchema: {
      type: "object",
      properties: { url: productUrl },
      required: ["url"],
      additionalProperties: false,
    },
  },
  {
    name: "prom_buyer_cart_remove",
    description: "Remove a product from the Prom.ua cart. Requires PROM_BUYER_ALLOW_MUTATIONS=true.",
    inputSchema: {
      type: "object",
      properties: { url: productUrl },
      required: ["url"],
      additionalProperties: false,
    },
  },
  {
    name: "prom_buyer_cart_set_quantity",
    description: "Change quantity of a product already in the Prom.ua cart. Requires PROM_BUYER_ALLOW_MUTATIONS=true.",
    inputSchema: {
      type: "object",
      properties: {
        url: productUrl,
        quantity: { type: "integer", minimum: 1, maximum: 999 },
      },
      required: ["url", "quantity"],
      additionalProperties: false,
    },
  },
  {
    name: "prom_buyer_orders",
    description: "List orders visible in the authenticated Prom.ua buyer cabinet.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", minimum: 1, maximum: 100, default: 30 } },
      additionalProperties: false,
    },
  },
  {
    name: "prom_buyer_find_all_from_one_seller",
    description: "Search several requested items and rank sellers by how many requested items they can cover, using the cheapest observed offer per item.",
    inputSchema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          minItems: 1,
          maxItems: 20,
          items: { type: "string", minLength: 1 },
        },
        max_pages_per_item: { type: "integer", minimum: 1, maximum: 3, default: 1 },
        limit_per_item: { type: "integer", minimum: 5, maximum: 50, default: 20 },
      },
      required: ["items"],
      additionalProperties: false,
    },
  },
  {
    name: "prom_saved_search_list",
    description: "List locally saved Prom.ua buyer searches.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "prom_saved_search_create",
    description: "Save a structured Prom.ua buyer search locally for repeat execution.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", minLength: 1 },
        search: {
          type: "object",
          properties: searchProperties,
          required: ["query"],
          additionalProperties: false,
        },
      },
      required: ["name", "search"],
      additionalProperties: false,
    },
  },
  {
    name: "prom_saved_search_delete",
    description: "Delete a locally saved Prom.ua buyer search.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", minLength: 1 } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "prom_saved_search_run",
    description: "Run a locally saved Prom.ua buyer search using the current marketplace state.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", minLength: 1 } },
      required: ["id"],
      additionalProperties: false,
    },
  },
] as const;
