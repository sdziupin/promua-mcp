# promua-mcp

[![CI](https://github.com/sdziupin/promua-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/sdziupin/promua-mcp/actions/workflows/ci.yml)

Browser-free MCP server for **Prom.ua**.

It has two supported layers:

1. **Marketplace discovery** through Brave Search or SearXNG, restricted to Prom.ua results.
2. **Seller operations** through Prom.ua's official Public API v1.

There is **no Playwright, Chromium, browser automation, browser profile, cookie/session storage, or GUI control** in this project.

## Marketplace tools

- `prom_search_products`
- `prom_search_url`
- `prom_saved_search_list`
- `prom_saved_search_create`
- `prom_saved_search_run`
- `prom_saved_search_delete`

`prom_search_products` supports:

- query
- result limit
- minimum/maximum price when the search result exposes a recognizable UAH price
- `price_asc` / `price_desc` sorting

Example:

```json
{
  "query": "DT-25-10 наконечник",
  "min_price": 20,
  "max_price": 80,
  "sort": "price_asc",
  "limit": 20
}
```

Marketplace discovery is **best-effort, not exhaustive**. Brave/SearXNG results do not expose the complete Prom.ua catalog and may omit seller rating, availability, Prom-payment state or other marketplace filters.

Saved searches are stored locally as JSON and simply replay the configured search-provider query.

## Buyer account actions

Buyer-account actions such as:

- Favorites
- cart mutation
- buyer order history
- authenticated buyer messages

are **not implemented** because Prom.ua does not currently expose them through the documented seller Public API.

This project will not emulate those actions through Playwright/Chromium. They should only be added when a stable HTTP/API integration is available and can be implemented without browser automation.

## Seller API — read

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

## Seller API — write

Write operations are disabled by default and require:

```bash
PROM_ALLOW_WRITES=true
```

Tools:

- `prom_seller_edit_products`
- `prom_seller_edit_products_by_external_id`
- `prom_seller_set_order_status`
- `prom_seller_set_message_status`
- `prom_seller_reply_message`

## Requirements

- Node.js 20+
- Brave Search API key or SearXNG for marketplace discovery
- Prom.ua API token for seller tools

## Install

```bash
npm install
npm run build
```

## Configuration

```bash
PROM_API_TOKEN=
PROM_API_BASE_URL=https://my.prom.ua/api/v1
PROM_ALLOW_WRITES=false

BRAVE_API_KEY=
# or
SEARXNG_URL=

PROM_DATA_DIR=
PROM_SAVED_SEARCHES_FILE=

PROM_HTTP_TIMEOUT_MS=15000
```

## MCP configuration

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

## Docker

```bash
docker build -t promua-mcp .
docker run --rm -i --env-file .env promua-mcp
```

## Safety model

- no browser automation;
- no buyer-account session/cookie handling;
- no checkout or payment automation;
- seller writes are opt-in via `PROM_ALLOW_WRITES=true`;
- API tokens are never intentionally logged;
- search-provider results can be stale or incomplete;
- `price_uah_guess` is parsed from search metadata and is not guaranteed to be the current live price.

## Prom.ua Public API coverage

Implemented seller endpoints include:

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

Official docs: https://public-api.docs.prom.ua/

## Development

```bash
npm run check
npm test
npm run build
```

## License

MIT
