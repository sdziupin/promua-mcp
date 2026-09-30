import assert from "node:assert/strict";
import test from "node:test";
import { configuredSearchProvider, loadConfig } from "../src/config.js";

test("loadConfig uses safe defaults", () => {
  const config = loadConfig({ HOME: "/tmp/test-home" });
  assert.equal(config.promApiBaseUrl, "https://my.prom.ua/api/v1");
  assert.equal(config.allowWrites, false);
  assert.equal(config.httpTimeoutMs, 15_000);
  assert.equal(configuredSearchProvider(config), null);
  assert.match(config.savedSearchesFile, /\.promua-mcp.*saved-searches\.json/);
});

test("Brave is preferred when both search providers are configured", () => {
  const config = loadConfig({ BRAVE_API_KEY: "brave", SEARXNG_URL: "https://search.example/" });
  assert.equal(configuredSearchProvider(config), "brave");
  assert.equal(config.searxngUrl, "https://search.example");
});
