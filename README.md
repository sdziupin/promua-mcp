# promua-mcp

[![CI](https://github.com/sdziupin/promua-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/sdziupin/promua-mcp/actions/workflows/ci.yml)

MCP server for **Prom.ua** with three independent layers:

1. **Public marketplace discovery** through Brave Search or SearXNG.
2. **Buyer mode** through a persistent local Chromium session.
3. **Seller mode** through Prom.ua's official Public API v1.

## Buyer mode

Buyer mode is intended for personal Prom.ua workflows that the seller API does not expose.

It can:

- search Prom.ua directly and scan multiple result pages;
- filter by price, availability, Prom payment, seller name and observed ratings;
- sort collected results;
- read a current product page;
- list/add/remove Favorites;
- list/add/remove cart items and change quantity;
- read buyer order history;
- find a seller covering the largest number of requested products;
- save structured searches locally and run them again later.

Buyer browser state is persistent, so you log in manually once and the session is reused.

**Checkout, order placement and payment are deliberately not automated.**

### Buyer tools

- `prom_buyer_status`
- `prom_buyer_open_login`
- `prom_buyer_search`
- `prom_buyer_product`
- `prom_buyer_favorites`
- `prom_buyer_favorite_add`
- `prom_buyer_favorite_remove`
- `prom_buyer_cart`
- `prom_buyer_cart_add`
- `prom_buyer_cart_remove`
- `prom_buyer_cart_set_quantity`
- `prom_buyer_orders`
- `prom_buyer_find_all_from_one_seller`
- `prom_saved_search_list`
- `prom_saved_search_create`
- `prom_saved_search_delete`
- `prom_saved_search_run`

### Search example

A buyer search can request:

```json
{
  "query": "DT-25-10",
  "min_price": 20,
  "max_price": 80,
  "min_seller_rating": 95,
  "available_only": true,
  "prom_payment": true,
  "sort": "price_asc",
  "max_pages": 5,
  "limit": 50
}
```

Filters are applied to data visible in scanned Prom.ua result cards. Some cards may not expose every rating or payment field, so rating/payment filters intentionally exclude results where the requested field cannot be confirmed.

### Buyer setup

Install Chromium once:

```bash
npm run buyer:install-browser
```

Run the MCP with a visible browser for the first login:

```bash
PROM_BUYER_HEADLESS=false
```

Call `prom_buyer_open_login`, complete Prom.ua login manually in the opened Chromium window, then use `prom_buyer_status` to verify the persisted session.

Default persistent data location:

```text
~/.promua-mcp/
  browser-profile/
  saved-searches.json
```

Override it with `PROM_BUYER_DATA_DIR`, `PROM_BUYER_PROFILE_DIR`, or `PROM_BUYER_SAVED_SEARCHES_FILE`.

Favorites and cart **changes are disabled by default**:

```bash
PROM_BUYER_ALLOW_MUTATIONS=true
```

Read-only buyer tools do not need that flag.

## Public marketplace search

- `prom_search_products` — search Prom.ua product pages through Brave Search or SearXNG without using a logged-in browser.
- `prom_search_url` — build a direct Prom.ua marketplace search URL.

Configure one provider:

```bash
BRAVE_API_KEY=
# or
SEARXNG_URL=
```

## Seller API

Prom.ua Public API is intended for a seller's own company data.

### Read tools

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

### Write tools

Seller writes are disabled until `PROM_ALLOW_WRITES=true`:

- `prom_seller_edit_products`
- `prom_seller_edit_products_by_external_id`
- `prom_seller_set_order_status`
- `prom_seller_set_message_status`
- `prom_seller_reply_message`

## Requirements

- Node.js 20+
- Chromium installed by `npm run buyer:install-browser` for buyer mode
- Prom.ua API token only for seller tools
- Brave Search API key or SearXNG only for public search-provider mode

## Install

```bash
npm install
npm run build
npm run buyer:install-browser
```

## Configuration

Copy `.env.example` or configure the MCP client environment:

```bash
PROM_API_TOKEN=
PROM_API_BASE_URL=https://my.prom.ua/api/v1
PROM_ALLOW_WRITES=false

BRAVE_API_KEY=
SEARXNG_URL=

PROM_BUYER_DATA_DIR=
PROM_BUYER_HEADLESS=false
PROM_BUYER_ALLOW_MUTATIONS=false
PROM_BUYER_ACTION_TIMEOUT_MS=15000
PROM_BUYER_PAGE_DELAY_MS=350

PROM_HTTP_TIMEOUT_MS=15000
```

## MCP client configuration

```json
{
  "mcpServers": {
    "promua": {
      "command": "node",
      "args": ["/absolute/path/to/promua-mcp/dist/index.js"],
      "env": {
        "PROM_BUYER_HEADLESS": "false",
        "PROM_BUYER_ALLOW_MUTATIONS": "false",
        "PROM_API_TOKEN": "optional",
        "BRAVE_API_KEY": "optional"
      }
    }
  }
}
```

## Docker

The image includes Chromium and defaults buyer mode to headless:

```bash
docker build -t promua-mcp .
docker run --rm -i \
  -v promua-mcp-data:/home/pwuser/.promua-mcp \
  --env-file .env \
  promua-mcp
```

For the first interactive buyer login, running locally with `PROM_BUYER_HEADLESS=false` is simpler. Afterwards the persisted profile can be reused headlessly.

## Safety model

- Seller API writes: `PROM_ALLOW_WRITES=false` by default.
- Buyer Favorites/cart mutations: `PROM_BUYER_ALLOW_MUTATIONS=false` by default.
- Buyer checkout, order placement and payment are not implemented.
- Login is manual; the MCP does not request or store your password/OTP itself.
- Buyer session data stays in the configured local profile directory.
- Search crawling is capped at 10 result pages per call and includes a configurable delay.
- The browser adapter does not attempt to bypass CAPTCHAs or anti-bot controls.
- Prom.ua UI changes can require selector updates; mutation tools fail closed if the expected control cannot be identified.

## Prom.ua Public API coverage

Seller tools currently cover:

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
