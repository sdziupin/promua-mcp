# promua-mcp

**English** | [Українська](./README.uk.md)

[![CI](https://github.com/sdziupin/promua-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/sdziupin/promua-mcp/actions/workflows/ci.yml)

Browser-free MCP server for **Prom.ua**.

It combines:

1. **Direct marketplace search** against Prom.ua's public SSR search pages.
2. **DuckDuckGo HTML fallback** with no API key or account.
3. **Optional seller tools** through Prom.ua's official Public API v1.
4. **Local saved searches** for repeatable workflows.

There is **no Playwright, Chromium, browser automation, browser profile, cookie/session storage, or GUI control**.

## Quick start

The published npm package needs no credentials for normal product search.

Run it directly:

```bash
npx -y promua-mcp
```

Or configure an MCP client to spawn it:

```json
{
  "mcpServers": {
    "promua": {
      "command": "npx",
      "args": ["-y", "promua-mcp"]
    }
  }
}
```

A global install also works:

```bash
npm install -g promua-mcp
promua-mcp
```

No Prom.ua token or search API key is required for marketplace search.

## Marketplace search

`prom_search_products` first queries Prom.ua directly:

```text
GET https://prom.ua/ua/search?search_term=<query>&page=<n>
```

Prom embeds product cards as schema.org **Product JSON-LD**, so the MCP can extract structured data from the server-rendered HTML:

- product id
- title
- canonical URL
- price / currency
- min/max price when a product contains multiple offers
- seller / sellers
- availability
- image
- SKU
- brand
- description
- Prom's embedded total result count

No API token is required.

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

- `source=auto` — direct Prom SSR first, DuckDuckGo fallback if direct parsing fails.
- `source=prom` — require direct Prom SSR.
- `source=duckduckgo` — force the DuckDuckGo HTML fallback.
- `offset` maps to Prom pages when possible.
- `min_price` / `max_price` use Prom's JSON-LD prices for direct search.
- `price_asc` / `price_desc` sort the scanned result window.
- `source_total`, `scanned_pages`, `next_offset`, `exhaustive` and `warning` make coverage explicit.

## DuckDuckGo fallback

The fallback uses DuckDuckGo's static no-JavaScript HTML search:

```text
https://html.duckduckgo.com/html/
```

No API key, account or token is required.

The fallback searches for `site:prom.ua <query>`, unwraps DuckDuckGo redirect URLs and returns only Prom.ua results.

It is intentionally treated as **best-effort and non-exhaustive**. DuckDuckGo may throttle automated requests or return a bot-detection challenge; the MCP detects that and fails clearly instead of trying to bypass it.

## Do I need `PROM_API_TOKEN`?

### For product search: **No**

If your use case is:

- find products on Prom.ua;
- compare prices;
- filter by price;
- paginate search results;
- save and rerun searches;

leave `PROM_API_TOKEN` empty.

Marketplace search does not use the seller API.

### For managing your own Prom.ua store: **Yes**

The token is useful only if you are a **Prom.ua seller** and want the MCP to work with your company's own cabinet data through the official Public API.

Seller tools can read or manage:

- your products and groups;
- your orders;
- your clients;
- your messages;
- delivery options;
- payment options;
- order statuses.

Prom.ua describes its Public API as remote access to data in the **company cabinet**, not as a buyer/search API.

You can create a token in the seller cabinet:

```text
Settings → API token management
```

Prom lets you choose permissions per API group: no access, read-only, or read/write.

For read-only use, grant only the permissions you need.

Official seller documentation:

- https://public-api.docs.prom.ua/
- https://support.prom.ua/hc/uk/articles/360020350478

### Seller writes are separately disabled

Even if a token has write permissions, this MCP blocks mutations unless you explicitly enable:

```bash
PROM_ALLOW_WRITES=true
```

So a read-only setup can simply keep:

```bash
PROM_ALLOW_WRITES=false
```

## Seller tools

### Read

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

### Write

- `prom_seller_edit_products`
- `prom_seller_edit_products_by_external_id`
- `prom_seller_set_order_status`
- `prom_seller_set_message_status`
- `prom_seller_reply_message`

## Saved searches

- `prom_saved_search_list`
- `prom_saved_search_create`
- `prom_saved_search_run`
- `prom_saved_search_delete`

Saved searches are stored locally as JSON and replay the same structured search arguments.

## Buyer account actions

Buyer-account actions such as Favorites, cart mutation, buyer order history and authenticated buyer messages are **not implemented**.

They are not exposed by the documented Prom seller Public API, and this project intentionally does not emulate them with a browser.

## Configuration

Minimal search-only setup:

```bash
PROM_HTTP_TIMEOUT_MS=15000
PROM_DATA_DIR=
PROM_SAVED_SEARCHES_FILE=
```

Optional seller mode:

```bash
PROM_API_TOKEN=
PROM_API_BASE_URL=https://my.prom.ua/api/v1
PROM_ALLOW_WRITES=false
```

## Docker

```bash
docker build -t promua-mcp .
docker run --rm -i --env-file .env promua-mcp
```

## Safety / access model

- ordinary HTTP requests only;
- no browser automation;
- no access-control bypass;
- no buyer cookies/sessions;
- no checkout or payment automation;
- seller writes are opt-in;
- direct Prom search fails closed if the expected JSON-LD structure disappears;
- DuckDuckGo challenges are detected, not bypassed.

## Branching and releases

Development happens on **`devel`**. The **`main`** branch is release-only.

Normal flow:

1. work on `devel` (or a short-lived branch targeting `devel`);
2. keep CI green;
3. open a pull request from `devel` to `main`;
4. merge the PR;
5. the successful `main` merge automatically creates a GitHub Release and publishes npm.

Direct pushes to `main` are rejected by the repository policy workflow after bootstrap. Server-side GitHub branch protection should also require PRs and the CI/Main Branch Policy checks.

### Automatic versioning

Every successful merge into `main` releases a version.

- If the repository version is already published, the workflow increments the **patch** version automatically.
- To intentionally release a new minor or major line, raise the version in `devel` first (for example `0.4.0` or `1.0.0`). If it is higher than the current npm version, that explicit version wins.
- The release workflow creates a release-only commit under the version tag, so it does **not** need to push a version-bump commit back into protected `main`.

The first automatic release uses the current repository version when the package is not yet published.

### npm authentication

Create an npm **Granular Access Token** with package publish permissions and add it to this GitHub repository as an Actions secret named exactly:

```text
NPM
```

The workflow uses it only as:

```text
NODE_AUTH_TOKEN=${{ secrets.NPM }}
```

Before publishing, it runs `npm whoami` and fails clearly if the secret is missing, expired or invalid.

### Release validation

Before a release is published, GitHub Actions validates:

- the `main` update came from a merged PR (except the one-time bootstrap release);
- the package name, existing npm metadata and repository URL match this project;
- locked dependencies install with `npm ci`;
- typecheck and unit tests pass;
- the project builds;
- the built MCP server completes a real stdio handshake and exposes its tools;
- the npm tarball contains the expected files and no source/tests/workflows;
- the version has not already been published.

The final publish command is:

```bash
npm publish --access public --provenance
```

The same workflow creates the matching Git tag and GitHub Release.

## Development## Development

```bash
npm ci
npm run check
npm test
npm run build
npm run test:runtime
npm run verify:package
```

## Acknowledgment

The direct Prom SSR / JSON-LD approach was validated against the MIT-licensed
[cuzin85/marketua](https://github.com/cuzin85/marketua) Prom provider, then reimplemented in TypeScript with broader Product/Offer parsing, multi-page scanning, explicit coverage metadata and a no-auth DuckDuckGo fallback.

## License

MIT
