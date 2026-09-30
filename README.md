# promua-mcp

[![CI](https://github.com/sdziupin/promua-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/sdziupin/promua-mcp/actions/workflows/ci.yml)

Browser-free MCP server for **Prom.ua**.

It combines:

1. **Direct marketplace search** against Prom.ua's public SSR search pages.
2. **Optional Brave/SearXNG fallback** if direct Prom parsing fails.
3. **Seller operations** through Prom.ua's official Public API v1.
4. **Local saved searches** for repeatable MCP workflows.

There is **no Playwright, Chromium, browser automation, browser profile, cookie/session storage, or GUI control**.

## Direct marketplace search

`prom_search_products` now queries:

```text
GET https://prom.ua/ua/search?search_term=<query>&page=<n>
```

Prom embeds product cards as schema.org **Product JSON-LD**, so the MCP extracts structured data directly from the server-rendered HTML:

- product id
- title
- canonical URL
- exact JSON-LD price / currency
- min/max price when a Product contains several Offers
- seller / sellers
- availability
- image
- SKU
- brand
- description
- Prom's embedded total result count

No API key is needed for direct marketplace search.

### Search arguments

```json
{
  "query": "DT-25-10 наконечник",
  "min_price": 20,
  "max_price": 80,
  "sort": "price_asc",
  "limit": 20,
  "offset": 0,
  "max_pages": 5,
  "source": "auto"
}
```

- `source=auto` — direct Prom SSR first; Brave/SearXNG fallback only when configured and direct parsing fails.
- `source=prom` — require direct Prom SSR.
- `source=external` — force Brave/SearXNG.
- `offset` maps efficiently to Prom pages when no client-side price filtering/sorting is needed.
- `min_price` / `max_price` use real JSON-LD prices.
- price sorting is performed over the scanned result window; the response tells you when the result is not exhaustive.
- `source_total`, `scanned_pages`, `next_offset`, `exhaustive` and `warning` make pagination/coverage explicit.

Prom currently exposes about 10 JSON-LD Product records per SSR search page, so deeper filtered searches may scan multiple pages up to `max_pages`.

### External fallback

Optional:

```bash
BRAVE_API_KEY=
# or
SEARXNG_URL=
```

The fallback is deliberately marked non-exhaustive and should not be confused with direct Prom catalog results.

## Saved searches

- `prom_saved_search_list`
- `prom_saved_search_create`
- `prom_saved_search_run`
- `prom_saved_search_delete`

Saved searches persist the same structured search arguments locally as JSON and replay them through the current search implementation.

## Search tools

- `prom_search_products`
- `prom_search_url`
- `prom_saved_search_list`
- `prom_saved_search_create`
- `prom_saved_search_run`
- `prom_saved_search_delete`

## Buyer account actions

Buyer-account actions such as Favorites, cart changes, buyer order history and authenticated buyer messages are **not implemented**.

They are not part of the documented Prom seller Public API, and this project will not emulate them using a browser. They should only be added when a stable HTTP/API contract is available.

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

Writes are disabled by default:

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
- no credentials for direct marketplace search
- optional Brave/SearXNG only for fallback
- Prom.ua API token only for seller tools

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

# Optional fallback:
BRAVE_API_KEY=
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
        "PROM_API_TOKEN": "optional",
        "BRAVE_API_KEY": "optional"
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

## Safety / access model

- public marketplace search uses ordinary HTTP GET requests only;
- no browser automation and no access-control bypass;
- no buyer-account cookies/sessions;
- no checkout or payment automation;
- seller writes are opt-in via `PROM_ALLOW_WRITES=true`;
- search requests are capped by `max_pages`;
- direct Prom parsing fails closed when Product JSON-LD disappears or changes unexpectedly.

## Prom.ua seller Public API coverage

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

Official seller API docs: https://public-api.docs.prom.ua/

## Development

```bash
npm run check
npm test
npm run build
```

## Acknowledgment

The direct Prom SSR / JSON-LD approach was validated against the MIT-licensed
[cuzin85/marketua](https://github.com/cuzin85/marketua) Prom provider, then reimplemented in TypeScript with broader Product/Offer parsing, multi-page scanning, explicit coverage metadata and fallback support.

## License

MIT
