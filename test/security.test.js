import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { scanRepo } from '../src/scan.js';

function tmp() { return mkdtempSync(join(tmpdir(), 'reporadar-sec-')); }
function gitRepo() {
  const dir = tmp();
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 't@t.t'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: dir });
  writeFileSync(join(dir, 'README.md'), '# x\n');
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync('git', ['commit', '-q', '-m', 'init'], { cwd: dir });
  return dir;
}

test('scanning a repo with a hostile core.fsmonitor does NOT execute it (P0 RCE)', () => {
  const dir = gitRepo();
  const marker = join(dir, 'PWNED');
  // Plant an exec-capable git config the way an attacker would in a repo you scan.
  execFileSync('git', ['config', 'core.fsmonitor', `touch ${marker}`], { cwd: dir });
  // A raw `git status` here WOULD run the command; RepoRadar's hardened git must not.
  scanRepo(dir);
  assert.ok(!existsSync(marker), 'hostile core.fsmonitor command must not run during a scan');
  rmSync(dir, { recursive: true, force: true });
});

test('a hostile .reporadarignore glob cannot wedge the scan (ReDoS bounded)', () => {
  const dir = tmp();
  writeFileSync(join(dir, 'package.json'), '{"name":"x"}');
  // Pathological pattern that made the old regex backtrack catastrophically.
  writeFileSync(join(dir, '.reporadarignore'), '*'.repeat(40) + 'Z\n');
  // Give it a long non-matching path to chew on.
  mkdirSync(join(dir, 'a'.repeat(60)), { recursive: true });
  writeFileSync(join(dir, 'a'.repeat(60), 'f.js'), 'x');
  const start = Date.now();
  scanRepo(dir);
  const ms = Date.now() - start;
  assert.ok(ms < 2000, `scan must stay bounded on a hostile ignore file, took ${ms}ms`);
  rmSync(dir, { recursive: true, force: true });
});

test('.reporadarignore still excludes matched paths after the linear-matcher rewrite', () => {
  const dir = tmp();
  writeFileSync(join(dir, 'package.json'), '{"name":"x"}');
  writeFileSync(join(dir, '.reporadarignore'), 'fixtures/\n**/__gen__\n');
  mkdirSync(join(dir, 'fixtures'), { recursive: true });
  writeFileSync(join(dir, 'fixtures', 'leak.js'), 'const k = "sk-ant-' + 'A'.repeat(30) + '";');
  mkdirSync(join(dir, 'deep', 'nested', '__gen__'), { recursive: true });
  writeFileSync(join(dir, 'deep', 'nested', '__gen__', 'leak.js'), 'const k = "sk-ant-' + 'B'.repeat(30) + '";');
  const sec = scanRepo(dir).dimensions.find((d) => d.key === 'secrets');
  assert.equal(sec.status, 'green', 'ignored fixture + **/__gen__ secrets must not count');
  rmSync(dir, { recursive: true, force: true });
});
