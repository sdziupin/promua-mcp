import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const output = execFileSync(
  "npm",
  ["pack", "--json", "--dry-run", "--silent"],
  { encoding: "utf8" },
);

const [pack] = JSON.parse(output);
assert.ok(pack, "npm pack returned no package metadata");

const paths = new Set(pack.files.map((file) => file.path));
for (const required of [
  "package.json",
  "README.md",
  "README.uk.md",
  "LICENSE",
  "dist/index.js",
]) {
  assert.ok(paths.has(required), `npm package is missing ${required}`);
}

for (const file of paths) {
  assert.ok(!file.startsWith("src/"), `source file leaked into npm package: ${file}`);
  assert.ok(!file.startsWith("tests/"), `test file leaked into npm package: ${file}`);
  assert.ok(!file.startsWith(".github/"), `GitHub workflow leaked into npm package: ${file}`);
}

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
assert.equal(packageJson.bin?.["promua-mcp"], "dist/index.js");
assert.equal(packageJson.publishConfig?.registry, "https://registry.npmjs.org/");
assert.equal(packageJson.publishConfig?.access, "public");

const firstLine = readFileSync("dist/index.js", "utf8").split(/\r?\n/, 1)[0];
assert.equal(firstLine, "#!/usr/bin/env node", "dist/index.js must keep its shebang");

console.log(
  `Package verification passed: ${pack.name}@${pack.version}, ${pack.files.length} files, ${pack.size} bytes`,
);
