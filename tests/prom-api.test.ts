import assert from "node:assert/strict";
import test from "node:test";
import type { Config } from "../src/config.js";
import { PromApiClient } from "../src/prom-api.js";

const config: Config = {
  promApiToken: "test-token",
  promApiBaseUrl: "https://my.prom.ua/api/v1",
  allowWrites: false,
  httpTimeoutMs: 1000,
};

test("write operations are blocked by default before any HTTP request", async () => {
  const api = new PromApiClient(config);
  await assert.rejects(
    () => api.setOrderStatus({ ids: [1], status: "received" }),
    /PROM_ALLOW_WRITES=true/,
  );
});
