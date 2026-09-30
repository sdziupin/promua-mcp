export function parseStableVersion(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(value ?? "").trim());
  if (!match) {
    throw new Error(`Expected a stable semantic version (x.y.z), got: ${value}`);
  }
  return match.slice(1).map((part) => Number.parseInt(part, 10));
}

export function compareVersions(a, b) {
  const av = parseStableVersion(a);
  const bv = parseStableVersion(b);
  for (let index = 0; index < 3; index += 1) {
    if (av[index] > bv[index]) return 1;
    if (av[index] < bv[index]) return -1;
  }
  return 0;
}

export function nextReleaseVersion(repoVersion, publishedVersion) {
  parseStableVersion(repoVersion);
  if (!publishedVersion) return repoVersion;

  parseStableVersion(publishedVersion);
  if (compareVersions(repoVersion, publishedVersion) > 0) {
    return repoVersion;
  }

  const [major, minor, patch] = parseStableVersion(publishedVersion);
  return `${major}.${minor}.${patch + 1}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , repoVersion, publishedVersion = ""] = process.argv;
  process.stdout.write(nextReleaseVersion(repoVersion, publishedVersion));
}
