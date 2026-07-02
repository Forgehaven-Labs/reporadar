import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scanRepo } from '../src/scan.js';

function makeRepo(files) {
  const dir = mkdtempSync(join(tmpdir(), 'reporadar-score-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = join(dir, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content);
  }
  return dir;
}

function dim(result, key) {
  return result.dimensions.find((d) => d.key === key);
}

test('a Jenkinsfile that runs tests earns the tests-in-CI credit (parity with GHA)', () => {
  const dir = makeRepo({
    'Jenkinsfile': "pipeline { stages { stage('Test') { steps { sh 'node --test' } } } }",
  });
  const ci = dim(scanRepo(dir), 'ci');
  assert.equal(ci.score, 100, 'Jenkins CI running tests must score like GHA running tests');
  assert.ok(ci.findings.some((f) => f.msg === 'CI runs tests'));
  rmSync(dir, { recursive: true, force: true });
});

test('a Jenkinsfile with no test stage gets the add-a-test-stage fix, not full marks', () => {
  const dir = makeRepo({ 'Jenkinsfile': "pipeline { stages { stage('Build') { steps { sh 'make' } } } }" });
  const ci = dim(scanRepo(dir), 'ci');
  assert.equal(ci.score, 70);
  assert.ok(ci.fixes.some((f) => /test stage/i.test(f)));
  rmSync(dir, { recursive: true, force: true });
});

test('the no-CI fix suggests Jenkins or GHA, not GHA only', () => {
  const dir = makeRepo({ 'README.md': '# x' });
  const ci = dim(scanRepo(dir), 'ci');
  assert.ok(ci.fixes.some((f) => /Jenkinsfile/.test(f)), 'fix advice must include Jenkins');
  rmSync(dir, { recursive: true, force: true });
});

test('a zero-dependency Node repo is not penalized for having nothing to lock', () => {
  const dir = makeRepo({ 'package.json': '{"name":"zero-dep","scripts":{"test":"node --test"}}' });
  const deps = dim(scanRepo(dir), 'dependencies');
  assert.ok(deps.score >= 80, `zero-dep should score high, got ${deps.score}`);
  assert.ok(deps.findings.some((f) => /Zero declared dependencies/.test(f.msg)));
  assert.ok(!deps.fixes.some((f) => /lockfile/i.test(f)), 'must not demand a lockfile with no deps');
  rmSync(dir, { recursive: true, force: true });
});
