import assert from "node:assert/strict";
import test from "node:test";
import {
  compareVersions,
  nextReleaseVersion,
  parseStableVersion,
} from "../scripts/next-release-version.mjs";

test("parseStableVersion accepts only stable x.y.z versions", () => {
  assert.deepEqual(parseStableVersion("1.2.3"), [1, 2, 3]);
  assert.throws(() => parseStableVersion("1.2.3-beta.1"), /stable semantic version/);
  assert.throws(() => parseStableVersion("v1.2.3"), /stable semantic version/);
});

test("compareVersions compares semantic version components", () => {
  assert.equal(compareVersions("1.2.3", "1.2.3"), 0);
  assert.equal(compareVersions("1.3.0", "1.2.99"), 1);
  assert.equal(compareVersions("0.9.9", "1.0.0"), -1);
});

test("first release uses repository version", () => {
  assert.equal(nextReleaseVersion("0.3.1", ""), "0.3.1");
});

test("normal merge increments published patch", () => {
  assert.equal(nextReleaseVersion("0.3.1", "0.3.1"), "0.3.2");
  assert.equal(nextReleaseVersion("0.3.1", "0.3.9"), "0.3.10");
});

test("explicit higher version in devel wins for minor or major release", () => {
  assert.equal(nextReleaseVersion("0.4.0", "0.3.9"), "0.4.0");
  assert.equal(nextReleaseVersion("1.0.0", "0.9.12"), "1.0.0");
});
