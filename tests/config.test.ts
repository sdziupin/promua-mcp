import assert from "node:assert/strict";
import test from "node:test";
import { configuredSearchProvider, loadConfig } from "../src/config.js";

test("loadConfig uses safe defaults", () => {
  const config = loadConfig({ HOME: "/tmp/test-home" });
  assert.equal(config.promApiBaseUrl, "https://my.prom.ua/api/v1");
  assert.equal(config.allowWrites, false);
  assert.equal(config.httpTimeoutMs, 15_000);
  assert.equal(configuredSearchProvider(config), null);
  assert.equal(config.buyerHeadless, false);
  assert.equal(config.buyerAllowMutations, false);
  assert.match(config.buyerProfileDir, /\.promua-mcp.*browser-profile/);
});

test("Brave is preferred when both search providers are configured", () => {
  const config = loadConfig({ BRAVE_API_KEY: "brave", SEARXNG_URL: "https://search.example/" });
  assert.equal(configuredSearchProvider(config), "brave");
  assert.equal(config.searxngUrl, "https://search.example");
});

test("buyer mutation gate is opt-in", () => {
  const config = loadConfig({ PROM_BUYER_ALLOW_MUTATIONS: "true", PROM_BUYER_HEADLESS: "true" });
  assert.equal(config.buyerAllowMutations, true);
  assert.equal(config.buyerHeadless, true);
});
