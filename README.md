# promua-mcp

[![CI](https://github.com/sdziupin/promua-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/sdziupin/promua-mcp/actions/workflows/ci.yml)

MCP server for **Prom.ua** with two separate capabilities:

1. **Marketplace product discovery** through Brave Search or SearXNG, restricted to Prom.ua results.
2. **Seller account operations** through Prom.ua's official Public API v1.

The server intentionally does **not** scrape Prom.ua pages directly.

## Why

Prom.ua Public API is intended for a seller's own company data: products, orders, clients, messages, groups, payment/delivery options and related operations. It is not a general marketplace-search API.

For marketplace discovery, `promua-mcp` delegates search to a configured search provider and only returns Prom.ua URLs.

## Tools

### Marketplace

- `prom_search_products` — search Prom.ua product pages through Brave Search or SearXNG.
- `prom_search_url` — build a direct Prom.ua marketplace search URL without automated page access.

### Seller API — read

- `prom_seller_list_products`
- `prom_seller_get_product`
- `prom_seller_get_product_by_external_id`
- `prom_seller_list_orders`
- `prom_seller_get_order`
- `prom_seller_list_clients`
- `prom_seller_get_client`
- `prom_seller_list_messages`
- `prom_seller_get_message`
- `prom_seller_list_groups`
- `prom_seller_list_payment_options`
- `prom_seller_list_delivery_options`
- `prom_seller_list_order_status_options`

### Seller API — write

Write tools are **disabled by default** and refuse to mutate seller data until `PROM_ALLOW_WRITES=true` is explicitly configured.

- `prom_seller_edit_products`
- `prom_seller_edit_products_by_external_id`
- `prom_seller_set_order_status`
- `prom_seller_set_message_status`
- `prom_seller_reply_message`

## Requirements

- Node.js 20+
- For seller tools: a Prom.ua API token
- For marketplace search: Brave Search API key **or** a SearXNG instance

## Install

```bash
npm install
npm run build
```

## Configuration

Copy `.env.example` or provide variables through your MCP client:

```bash
PROM_API_TOKEN=
PROM_API_BASE_URL=https://my.prom.ua/api/v1
PROM_ALLOW_WRITES=false

BRAVE_API_KEY=
# or
SEARXNG_URL=

PROM_HTTP_TIMEOUT_MS=15000
```

Marketplace search needs one of `BRAVE_API_KEY` or `SEARXNG_URL`. `prom_search_url` needs no credentials.

## MCP client configuration

After building from source:

```json
{
  "mcpServers": {
    "promua": {
      "command": "node",
      "args": ["/absolute/path/to/promua-mcp/dist/index.js"],
      "env": {
        "PROM_API_TOKEN": "...",
        "BRAVE_API_KEY": "..."
      }
    }
  }
}
```

Development mode:

```json
{
  "mcpServers": {
    "promua": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/promua-mcp/src/index.ts"],
      "env": {
        "BRAVE_API_KEY": "..."
      }
    }
  }
}
```

## Docker

```bash
docker build -t promua-mcp .
docker run --rm -i --env-file .env promua-mcp
```

## Safety model

- API tokens are never logged by the server.
- Write operations have a separate runtime gate: `PROM_ALLOW_WRITES=false` by default.
- Prefer a Prom.ua token with the smallest permission set needed for your workflow.
- Marketplace search results come from a search engine and can be stale. `price_uah_guess` is best-effort text parsing, not a guaranteed live price.
- The server does not automatically purchase products or place marketplace orders.

## Prom.ua Public API coverage

The seller tools use the documented Prom.ua Public API v1 base URL:

`https://my.prom.ua/api/v1`

Implemented endpoints include:

- `GET /products/list`
- `GET /products/{id}`
- `GET /products/by_external_id/{id}`
- `POST /products/edit`
- `POST /products/edit_by_external_id`
- `GET /orders/list`
- `GET /orders/{id}`
- `POST /orders/set_status`
- `GET /clients/list`
- `GET /clients/{id}`
- `GET /messages/list`
- `GET /messages/{id}`
- `POST /messages/set_status`
- `POST /messages/reply`
- `GET /groups/list`
- `GET /payment_options/list`
- `GET /delivery_options/list`
- `GET /order_status_options/list`

Official documentation: https://public-api.docs.prom.ua/

## Development

```bash
npm run check
npm test
npm run build
```

## License

MIT
