import assert from "node:assert/strict";
import test from "node:test";
import type { Config } from "../src/config.js";
import {
  parsePromProducts,
  parsePromTotal,
  searchPromMarketplace,
} from "../src/prom-marketplace.js";

const config: Config = {
  promApiBaseUrl: "https://my.prom.ua/api/v1",
  allowWrites: false,
  httpTimeoutMs: 1000,
  savedSearchesFile: "/tmp/promua-mcp-searches.json",
};

function productJson(id: number, price: number, seller = "Seller"): string {
  return JSON.stringify({
    "@context": "https://schema.org/",
    "@type": "Product",
    name: `SSD &quot;Model ${id}&quot;`,
    url: `https://prom.ua/ua/m${id}-ssd.html`,
    description: `Description &amp; details ${id}`,
    image: [`https://images.prom.ua/${id}.jpg`],
    sku: `SKU-${id}`,
    brand: { "@type": "Brand", name: "Brand &amp; Co" },
    offers: {
      "@type": "Offer",
      availability: "http://schema.org/InStock",
      price: String(price),
      priceCurrency: "UAH",
      seller: { "@type": "Organization", name: seller },
    },
  });
}

function pageHtml(page: number, total = 30): string {
  const scripts = Array.from({ length: 10 }, (_, index) => {
    const id = page * 100 + index;
    return `<script type="application/ld+json">${productJson(id, id)}</script>`;
  }).join("");
  return `<html><body>${scripts}<script type="application/json">{"total":${total}}</script></body></html>`;
}

test("parses Prom Product JSON-LD including entities and structured metadata", () => {
  const html = `
    <script type="application/ld+json">
      {
        "@context":"https://schema.org/",
        "@type":"Product",
        "name":"SSD 2.5&quot; 256GB",
        "url":"https://prom.ua/ua/m8634975113066207435-ssd.html",
        "description":"A &amp; B",
        "image":["https://images.prom.ua/a.jpg"],
        "sku":"RE100",
        "brand":{"@type":"Brand","name":"Acer"},
        "offers":{
          "@type":"Offer",
          "availability":"http://schema.org/InStock",
          "price":"1500",
          "priceCurrency":"UAH",
          "seller":{"@type":"Organization","name":"IT Teh&quot;Nika&quot;"}
        }
      }
    </script>
    <script type="application/json">{"total":6513}</script>
  `;

  const offers = parsePromProducts(html);
  assert.equal(offers.length, 1);
  assert.equal(offers[0]?.id, "8634975113066207435");
  assert.equal(offers[0]?.title, 'SSD 2.5" 256GB');
  assert.equal(offers[0]?.price, 1500);
  assert.equal(offers[0]?.currency, "UAH");
  assert.equal(offers[0]?.availability, "InStock");
  assert.equal(offers[0]?.seller, 'IT Teh"Nika"');
  assert.equal(offers[0]?.brand, "Acer");
  assert.equal(parsePromTotal(html), 6513);
});

test("handles products with multiple offers and chooses the minimum price", () => {
  const html = `
    <script type="application/ld+json">
      {
        "@type":"Product",
        "name":"Adapter",
        "url":"https://prom.ua/ua/p2033038976-adapter.html",
        "offers":[
          {"@type":"Offer","price":"165","priceCurrency":"UAH","seller":{"name":"Shop A"}},
          {"@type":"Offer","price":"158","priceCurrency":"UAH","seller":{"name":"Shop B"}},
          {"@type":"Offer","price":"169","priceCurrency":"UAH","seller":{"name":"Shop A"}}
        ]
      }
    </script>
  `;

  const [offer] = parsePromProducts(html);
  assert.equal(offer?.price, 158);
  assert.equal(offer?.price_min, 158);
  assert.equal(offer?.price_max, 169);
  assert.deepEqual(offer?.sellers, ["Shop A", "Shop B"]);
});

test("uses Prom page pagination for offset without scanning from page one", async () => {
  const requestedPages: number[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(String(input));
    const page = Number(url.searchParams.get("page") ?? "1");
    requestedPages.push(page);
    return new Response(pageHtml(page), { status: 200 });
  };

  const result = await searchPromMarketplace(
    config,
    { query: "ssd", offset: 12, limit: 5 },
    fetchImpl,
  );

  assert.deepEqual(requestedPages, [2]);
  assert.deepEqual(result.scanned_pages, [2]);
  assert.equal(result.source_total, 30);
  assert.equal(result.returned, 5);
  assert.equal(result.results[0]?.id, "202");
  assert.equal(result.next_offset, 17);
});

test("price sorting scans the requested window and reports non-exhaustive scope", async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(String(input));
    const page = Number(url.searchParams.get("page") ?? "1");
    return new Response(pageHtml(page, 100), { status: 200 });
  };

  const result = await searchPromMarketplace(
    config,
    { query: "ssd", limit: 3, max_pages: 2, sort: "price_desc" },
    fetchImpl,
  );

  assert.deepEqual(result.scanned_pages, [1, 2]);
  assert.equal(result.exhaustive, false);
  assert.equal(result.sort_scope, "scanned_window");
  assert.match(result.warning ?? "", /scanned Prom\.ua result window/);
  assert.deepEqual(result.results.map((item) => item.price), [209, 208, 207]);
});


test("treats total=0 as a valid empty search instead of a parser failure", async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response('<html><script type="application/json">{"total":0}</script></html>', { status: 200 });

  const result = await searchPromMarketplace(
    config,
    { query: "definitely-no-such-product", limit: 10 },
    fetchImpl,
  );

  assert.equal(result.source_total, 0);
  assert.equal(result.returned, 0);
  assert.deepEqual(result.results, []);
  assert.equal(result.exhaustive, true);
});

test("rejects inverted price ranges", async () => {
  await assert.rejects(
    () => searchPromMarketplace(config, { query: "ssd", min_price: 2000, max_price: 1000 }),
    /min_price must be less than or equal to max_price/,
  );
});
