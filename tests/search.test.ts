import assert from "node:assert/strict";
import test from "node:test";
import { buildPromSearchUrl, parsePriceUahGuess } from "../src/search.js";

test("buildPromSearchUrl encodes the query", () => {
  assert.equal(
    buildPromSearchUrl("DT-25-10 наконечник"),
    "https://prom.ua/ua/search?search_term=DT-25-10%20%D0%BD%D0%B0%D0%BA%D0%BE%D0%BD%D0%B5%D1%87%D0%BD%D0%B8%D0%BA",
  );
});

test("parsePriceUahGuess handles common Ukrainian price formats", () => {
  assert.equal(parsePriceUahGuess("Ціна 1 249 грн."), 1249);
  assert.equal(parsePriceUahGuess("₴ 99,50"), 99.5);
  assert.equal(parsePriceUahGuess("price unavailable"), undefined);
});
