import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client(
  { name: "promua-mcp-runtime-smoke", version: "1.0.0" },
  { capabilities: {} },
);

const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["dist/index.js"],
  stderr: "pipe",
});

try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  const names = new Set(tools.map((tool) => tool.name));

  for (const required of [
    "prom_search_products",
    "prom_search_url",
    "prom_saved_search_list",
    "prom_seller_list_products",
  ]) {
    assert.ok(names.has(required), `missing MCP tool: ${required}`);
  }

  assert.ok(tools.length >= 10, `expected a non-trivial tool set, got ${tools.length}`);
  console.log(`Runtime smoke test passed: ${tools.length} tools available`);
} finally {
  await client.close();
}
