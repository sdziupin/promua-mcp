import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { MarketplaceSearchSpec } from "./search.js";

export interface SavedSearch {
  id: string;
  name: string;
  search: MarketplaceSearchSpec;
  created_at: string;
  updated_at: string;
}

export class SavedSearchStore {
  constructor(private readonly path: string) {}

  private async read(): Promise<SavedSearch[]> {
    try {
      const raw = await readFile(this.path, "utf8");
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed as SavedSearch[] : [];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  private async write(items: SavedSearch[]): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, JSON.stringify(items, null, 2) + "\n", "utf8");
  }

  async list(): Promise<SavedSearch[]> {
    return this.read();
  }

  async get(id: string): Promise<SavedSearch> {
    const item = (await this.read()).find((entry) => entry.id === id);
    if (!item) throw new Error(`Saved search not found: ${id}`);
    return item;
  }

  async create(name: string, search: MarketplaceSearchSpec): Promise<SavedSearch> {
    const normalizedName = name.trim();
    if (!normalizedName) throw new Error("name must not be empty");
    if (!search.query?.trim()) throw new Error("search.query must not be empty");

    const items = await this.read();
    const now = new Date().toISOString();
    const item: SavedSearch = {
      id: randomUUID(),
      name: normalizedName,
      search,
      created_at: now,
      updated_at: now,
    };
    items.push(item);
    await this.write(items);
    return item;
  }

  async remove(id: string): Promise<{ deleted: string }> {
    const items = await this.read();
    const next = items.filter((entry) => entry.id !== id);
    if (next.length === items.length) throw new Error(`Saved search not found: ${id}`);
    await this.write(next);
    return { deleted: id };
  }
}
