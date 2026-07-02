// Portfolio repo discovery — finds every scannable repo under a root folder.
// Recurses so nested layouts like product/{ios,android,website} are found,
// but never descends INTO a discovered git repo (submodules/vendored repos
// inside it belong to that repo's own scan).
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'build', 'out', '.next', 'vendor', 'Pods',
  '.venv', 'venv', '__pycache__', 'DerivedData', 'coverage', '.gradle', 'target',
]);

export function isGitRepo(p) {
  return existsSync(join(p, '.git'));
}

export function looksLikeProject(p) {
  // A scannable project even without .git: has a recognizable manifest.
  return ['package.json', 'pyproject.toml', 'go.mod', 'Cargo.toml', 'README.md']
    .some((m) => existsSync(join(p, m)));
}

// Returns absolute paths of repos under root, sorted. Git repos are found up
// to maxDepth levels down; manifest-only projects are only accepted as direct
// children (the pre-nesting behavior) and only when no git repo was found
// beneath them — a product folder that CONTAINS repos is a container, not a repo.
export function discoverRepos(root, { maxDepth = 3 } = {}) {
  const gitRepos = [];
  const walk = (dir, depth) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
      const full = join(dir, e.name);
      if (isGitRepo(full)) { gitRepos.push(full); continue; }
      if (depth < maxDepth) walk(full, depth + 1);
    }
  };
  walk(root, 1);

  const found = new Set(gitRepos);
  let children = [];
  try { children = readdirSync(root, { withFileTypes: true }); } catch {}
  for (const e of children) {
    if (!e.isDirectory() || e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
    const full = join(root, e.name);
    if (found.has(full)) continue;
    const holdsRepos = gitRepos.some((r) => r.startsWith(full + '/'));
    if (!holdsRepos && looksLikeProject(full)) found.add(full);
  }
  return [...found].sort();
}
