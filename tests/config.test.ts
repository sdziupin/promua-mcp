import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../src/config.js";

test("loadConfig uses safe defaults without search credentials", () => {
  const config = loadConfig({ HOME: "/tmp/test-home" });
  assert.equal(config.promApiToken, undefined);
  assert.equal(config.promApiBaseUrl, "https://my.prom.ua/api/v1");
  assert.equal(config.allowWrites, false);
  assert.equal(config.httpTimeoutMs, 15_000);
  assert.match(config.savedSearchesFile, /\.promua-mcp.*saved-searches\.json/);
});

test("seller token remains optional and explicit", () => {
  const config = loadConfig({ PROM_API_TOKEN: "token", PROM_ALLOW_WRITES: "true" });
  assert.equal(config.promApiToken, "token");
  assert.equal(config.allowWrites, true);
});
