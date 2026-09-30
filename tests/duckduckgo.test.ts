import assert from "node:assert/strict";
import test from "node:test";
import { parseDuckDuckGoHtml } from "../src/duckduckgo.js";

test("parses DuckDuckGo HTML results and unwraps redirect URLs", () => {
  const target = encodeURIComponent("https://prom.ua/ua/p123-test.html");
  const html = `
    <div class="result">
      <h2 class="result__title">
        <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=${target}&rut=abc">
          Test &amp; Product
        </a>
      </h2>
      <a class="result__snippet">Ціна 1 249 грн. &mdash; опис</a>
    </div>
    <div class="result">
      <a class="result__a" href="https://example.com/not-prom">Ignore me</a>
    </div>
  `;

  const results = parseDuckDuckGoHtml(html);
  assert.equal(results.length, 1);
  assert.equal(results[0]?.title, "Test & Product");
  assert.equal(results[0]?.url, "https://prom.ua/ua/p123-test.html");
  assert.match(results[0]?.description ?? "", /1 249 грн/);
});

test("detects DuckDuckGo bot challenge instead of returning garbage", () => {
  assert.throws(
    () => parseDuckDuckGoHtml('<div id="anomaly-modal">challenge</div>'),
    /bot-detection challenge/,
  );
});
