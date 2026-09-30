import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { SavedSearchStore } from "../src/buyer/saved-searches.js";

test("saved searches persist locally", async () => {
  const dir = await mkdtemp(join(tmpdir(), "promua-mcp-"));
  try {
    const store = new SavedSearchStore(join(dir, "saved-searches.json"));
    const created = await store.create("DT terminal", {
      query: "DT-25-10",
      max_price: 80,
      available_only: true,
    });
    const listed = await store.list();
    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.id, created.id);
    assert.equal(listed[0]?.search.max_price, 80);

    await store.remove(created.id);
    assert.deepEqual(await store.list(), []);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
