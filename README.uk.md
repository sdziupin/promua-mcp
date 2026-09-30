# promua-mcp

[English](./README.md) | **Українська**

[![CI](https://github.com/sdziupin/promua-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/sdziupin/promua-mcp/actions/workflows/ci.yml)

MCP-сервер для **Prom.ua** без браузерної автоматизації.

Він поєднує:

1. **Прямий пошук по маркетплейсу** через публічні SSR-сторінки Prom.ua.
2. **Fallback через DuckDuckGo HTML** без API-ключа та акаунта.
3. **Опційні seller-tools** через офіційний Public API v1 Prom.ua.
4. **Локальні збережені пошуки** для повторюваних сценаріїв.

У проєкті **немає Playwright, Chromium, browser automation, browser profile, cookie/session storage чи GUI control**.

## Швидкий старт

Опублікований npm-пакет не потребує жодних credentials для звичайного пошуку товарів.

Можна запустити напряму:

```bash
npx -y promua-mcp
```

Або підключити в MCP-клієнті:

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

Також можна встановити глобально:

```bash
npm install -g promua-mcp
promua-mcp
```

Для пошуку по маркетплейсу не потрібні ні Prom.ua token, ні search API key.

## Пошук по маркетплейсу

`prom_search_products` спочатку напряму звертається до Prom.ua:

```text
GET https://prom.ua/ua/search?search_term=<query>&page=<n>
```

Prom вбудовує картки товарів у SSR HTML як schema.org **Product JSON-LD**, тому MCP дістає структуровані дані напряму:

- ID товару
- назву
- канонічний URL
- ціну / валюту
- min/max ціну, якщо Product містить кілька Offers
- продавця / продавців
- наявність
- зображення
- SKU
- бренд
- опис
- вбудовану Prom загальну кількість результатів

Для цього **не потрібен API token**.

### Аргументи пошуку

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

- `source=auto` — спочатку прямий Prom SSR, при проблемі fallback через DuckDuckGo.
- `source=prom` — використовувати лише прямий Prom SSR.
- `source=duckduckgo` — примусово використати DuckDuckGo HTML.
- `offset` по можливості напряму мапиться на сторінки Prom.
- `min_price` / `max_price` для прямого пошуку використовують реальні JSON-LD ціни.
- `price_asc` / `price_desc` сортують відскановане вікно результатів.
- `source_total`, `scanned_pages`, `next_offset`, `exhaustive` та `warning` показують реальну повноту результату.

## Fallback через DuckDuckGo

Fallback використовує статичну no-JavaScript HTML-версію DuckDuckGo:

```text
https://html.duckduckgo.com/html/
```

Для неї не потрібні API key, token чи акаунт.

MCP шукає:

```text
site:prom.ua <query>
```

розгортає redirect URL DuckDuckGo і залишає лише результати Prom.ua.

Це **best-effort fallback**, а не повний каталог Prom.ua. DuckDuckGo може обмежувати автоматизовані запити або повертати bot challenge; MCP розпізнає це й повертає зрозумілу помилку, а не намагається обходити захист.

## Чи потрібен мені `PROM_API_TOKEN`?

### Для пошуку товарів: **ні**

Якщо задача MCP:

- шукати товари на Prom.ua;
- порівнювати ціни;
- фільтрувати за ціною;
- пагінувати результати;
- зберігати й повторювати пошуки;

залишайте `PROM_API_TOKEN` порожнім.

Пошук по маркетплейсу seller API не використовує.

### Для керування власним магазином на Prom.ua: **так**

Token потрібен лише якщо ви **продавець Prom.ua** і хочете, щоб MCP працював із даними вашого Кабінету компанії через офіційний Public API.

Seller-tools можуть читати або змінювати:

- ваші товари та групи;
- ваші замовлення;
- ваших клієнтів;
- повідомлення;
- способи доставки;
- способи оплати;
- статуси замовлень.

Prom.ua описує Public API саме як віддалений доступ до даних **Кабінету компанії**, а не як buyer/search API.

Token створюється в кабінеті продавця:

```text
Налаштування → Управління API-токенами
```

Для кожної групи методів можна окремо виставити:

- немає доступу;
- тільки читання;
- читання та запис.

Якщо потрібен лише перегляд, варто давати мінімальні read-only права.

Офіційна документація:

- https://public-api.docs.prom.ua/
- https://support.prom.ua/hc/uk/articles/360020350478

### Запис додатково заблокований самим MCP

Навіть якщо token має write-права, MCP не виконує mutation tools, доки явно не ввімкнути:

```bash
PROM_ALLOW_WRITES=true
```

Для безпечного read-only використання залишайте:

```bash
PROM_ALLOW_WRITES=false
```

## Seller tools

### Читання

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

### Запис

- `prom_seller_edit_products`
- `prom_seller_edit_products_by_external_id`
- `prom_seller_set_order_status`
- `prom_seller_set_message_status`
- `prom_seller_reply_message`

## Збережені пошуки

- `prom_saved_search_list`
- `prom_saved_search_create`
- `prom_saved_search_run`
- `prom_saved_search_delete`

Збережені пошуки записуються локально в JSON і повторюють ті самі структуровані аргументи пошуку.

## Buyer account actions

Дії звичайного покупця — Favorites, зміни кошика, історія покупок та authenticated buyer messages — **не реалізовані**.

Вони не доступні через документований seller Public API, і цей MCP принципово не емулює їх через браузер.

## Налаштування

Мінімальний search-only режим:

```bash
PROM_HTTP_TIMEOUT_MS=15000
PROM_DATA_DIR=
PROM_SAVED_SEARCHES_FILE=
```

Опційний seller-mode:

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

## Модель доступу та безпеки

- тільки звичайні HTTP-запити;
- без browser automation;
- без обходу access controls;
- без buyer cookies/sessions;
- без checkout чи автоматизації оплати;
- seller writes тільки через explicit opt-in;
- direct Prom search fail-closed, якщо очікувана JSON-LD структура зникне;
- DuckDuckGo challenge розпізнається, а не обходиться.

## Публікація в npm

Публікація автоматизована через GitHub Actions у `.github/workflows/publish-npm.yml`.

### Одноразове налаштування репозиторію

Створіть npm **Granular Access Token** із правами запису для пакета, придатний для неінтерактивної публікації, і додайте його в GitHub repository → Actions secrets під точною назвою:

```text
NPM
```

Workflow передає його тільки як:

```text
NODE_AUTH_TOKEN=${{ secrets.NPM }}
```

Сам token ніколи не зберігається в репозиторії.

> npm зараз вимагає 2FA для публікації або granular token із дозволом bypass 2FA для неінтерактивного direct publish. Для довгострокового CI/CD npm рекомендує Trusted Publishing; у цьому репозиторії наразі свідомо використовується запитаний GitHub secret `NPM`.

### Процес релізу

1. Одночасно оновіть версію в `package.json` і `package-lock.json`, наприклад:

```bash
npm version patch --no-git-tag-version
```

2. Перевірте локально:

```bash
npm ci
npm run check
npm test
npm run build
npm run test:runtime
npm run verify:package
```

3. Закомітьте зміну версії та дочекайтесь зеленого CI на Node 20, 22 і 24.
4. Створіть/push tag, який точно відповідає версії пакета, наприклад `v0.3.2`.
5. Створіть **GitHub Release** з цього tag і опублікуйте release.

Публікація GitHub Release запускає npm workflow. Перед `npm publish` він перевіряє:

- release tag точно дорівнює версії з `package.json`;
- tagged commit входить в історію `main`;
- locked dependencies встановлюються через `npm ci`;
- typecheck, unit tests і build проходять;
- зібраний MCP реально проходить stdio handshake і повертає tools;
- npm tarball містить потрібні файли й не містить source/tests/workflows;
- така версія пакета ще не існує в npm.

Фінальна команда:

```bash
npm publish --access public --provenance
```

### Перевірка npm-пакета

```bash
npm run verify:package
```

виконує `npm pack --json --dry-run` і перевіряє фактичний вміст npm tarball, включно з CLI shebang та `dist/index.js`.

## Розробка

```bash
npm ci
npm run check
npm test
npm run build
npm run test:runtime
npm run verify:package
```

## Подяка

Підхід із прямим Prom SSR / JSON-LD був перевірений на MIT-ліцензованій реалізації
[cuzin85/marketua](https://github.com/cuzin85/marketua), після чого був окремо реалізований на TypeScript із ширшим парсингом Product/Offer, multi-page scanning, явними метаданими повноти та no-auth fallback через DuckDuckGo.

## Ліцензія

MIT
