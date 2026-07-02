import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { discoverRepos } from '../src/discover.js';

function makeTree(files) {
  const dir = mkdtempSync(join(tmpdir(), 'reporadar-disc-'));
  for (const rel of files) {
    const full = join(dir, rel);
    if (rel.endsWith('/')) mkdirSync(full, { recursive: true });
    else {
      mkdirSync(join(full, '..'), { recursive: true });
      writeFileSync(full, '');
    }
  }
  return dir;
}

test('discoverRepos finds nested product/{ios,android,website} repos', () => {
  const root = makeTree([
    'driftwink/ios/.git/',
    'driftwink/android/.git/',
    'driftwink/website/.git/',
    'grantsignal/.git/',
  ]);
  const found = discoverRepos(root).map((p) => p.slice(root.length + 1));
  assert.deepEqual(found, ['driftwink/android', 'driftwink/ios', 'driftwink/website', 'grantsignal']);
  rmSync(root, { recursive: true, force: true });
});

test('discoverRepos does not descend into a found git repo', () => {
  const root = makeTree([
    'app/.git/',
    'app/vendored/inner/.git/', // belongs to app's own scan, not the portfolio
  ]);
  const found = discoverRepos(root).map((p) => p.slice(root.length + 1));
  assert.deepEqual(found, ['app']);
  rmSync(root, { recursive: true, force: true });
});

test('a container folder holding repos is not itself scanned as a repo', () => {
  const root = makeTree([
    'product/README.md', // container has a README but holds real repos
    'product/ios/.git/',
  ]);
  const found = discoverRepos(root).map((p) => p.slice(root.length + 1));
  assert.deepEqual(found, ['product/ios']);
  rmSync(root, { recursive: true, force: true });
});

test('manifest-only direct children still count (pre-nesting behavior kept)', () => {
  const root = makeTree(['plain-project/package.json']);
  const found = discoverRepos(root).map((p) => p.slice(root.length + 1));
  assert.deepEqual(found, ['plain-project']);
  rmSync(root, { recursive: true, force: true });
});

test('noise dirs and dot-dirs are skipped during discovery', () => {
  const root = makeTree([
    'node_modules/dep/.git/',
    '.cache/thing/.git/',
    'real/.git/',
  ]);
  const found = discoverRepos(root).map((p) => p.slice(root.length + 1));
  assert.deepEqual(found, ['real']);
  rmSync(root, { recursive: true, force: true });
});
