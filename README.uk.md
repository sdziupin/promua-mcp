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

## Гілки та автоматичні релізи

Основна розробка ведеться в **`devel`**. Гілка **`main`** використовується тільки для релізів.

Звичайний процес:

1. робота в `devel` (або короткій feature-гілці з PR у `devel`);
2. CI має залишатися зеленим;
3. PR з `devel` у `main`;
4. merge PR;
5. успішний merge у `main` автоматично створює GitHub Release і публікує npm.

Після bootstrap прямі push у `main` відхиляються policy-workflow. На рівні GitHub також варто увімкнути server-side branch protection із обов'язковими PR та checks CI/Main Branch Policy.

### Автоматичне версіонування

Кожен успішний merge у `main` створює реліз.

- Якщо поточна repo-версія вже опублікована, workflow автоматично піднімає **patch**.
- Для свідомого minor/major релізу достатньо підняти версію в `devel` наперед, наприклад до `0.4.0` або `1.0.0`. Якщо вона вища за поточну npm-версію, використовується саме вона.
- Release workflow створює окремий release-only commit під version tag, тому йому не потрібно пушити version bump назад у захищений `main`.

Перший автоматичний реліз використовує поточну repo-версію, якщо пакет ще не опублікований.

### npm authentication

Створіть npm **Granular Access Token** із publish-доступом і додайте його в GitHub Actions secrets під точною назвою:

```text
NPM
```

Workflow використовує його тільки як:

```text
NODE_AUTH_TOKEN=${{ secrets.NPM }}
```

Перед публікацією запускається `npm whoami`; відсутній, протермінований або неправильний secret зупиняє release до publish.

### Перевірки перед релізом

Перед публікацією GitHub Actions перевіряє:

- update `main` походить від merged PR (крім одноразового bootstrap release);
- ім'я npm-пакета, наявні npm metadata та repository URL відповідають цьому проєкту;
- locked dependencies встановлюються через `npm ci`;
- typecheck та unit tests проходять;
- build проходить;
- зібраний MCP реально проходить stdio handshake і віддає tools;
- npm tarball містить очікувані файли та не містить source/tests/workflows;
- ця версія ще не опублікована.

Фінальна команда:

```bash
npm publish --access public --provenance
```

Той самий workflow створює version tag і GitHub Release.

## Розробка## Розробка

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
