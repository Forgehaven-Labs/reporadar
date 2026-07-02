import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scanRepo } from '../src/scan.js';

function makeRepo(files) {
  const dir = mkdtempSync(join(tmpdir(), 'reporadar-det-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = join(dir, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content);
  }
  return dir;
}
const tests = (r) => r.dimensions.find((d) => d.key === 'tests');

test('Swift XCTest files (FooTests.swift) count as tests', () => {
  const dir = makeRepo({
    'Package.swift': '// swift-tools-version:5.9',
    'Tests/AppTests/LoginTests.swift': 'import XCTest\nfinal class LoginTests: XCTestCase {}',
    'Tests/AppTests/StoreTests.swift': 'import XCTest\nfinal class StoreTests: XCTestCase {}',
  });
  const t = tests(scanRepo(dir));
  assert.ok(t.findings.some((f) => /test file\(s\) found/.test(f.msg)), 'Swift tests must be detected');
  assert.ok(t.score >= 55, `Swift suite should not score red, got ${t.score}`);
  rmSync(dir, { recursive: true, force: true });
});

test('Kotlin/JVM tests (FooTest.kt under src/test) count as tests', () => {
  const dir = makeRepo({
    'build.gradle.kts': 'plugins { kotlin("jvm") }',
    'src/test/kotlin/EngineTest.kt': 'class EngineTest {}',
    'src/test/kotlin/ViewModelTest.kt': 'class ViewModelTest {}',
  });
  const t = tests(scanRepo(dir));
  assert.ok(t.score >= 55, `JVM test suite should not score red, got ${t.score}`);
  rmSync(dir, { recursive: true, force: true });
});

test('.NET tests (FooTests.cs) count as tests', () => {
  const dir = makeRepo({
    'App.sln': '',
    'tests/App.Tests/AuthTests.cs': 'public class AuthTests {}',
  });
  const t = tests(scanRepo(dir));
  assert.ok(t.findings.some((f) => /test file\(s\) found/.test(f.msg)), '.NET tests must be detected');
  rmSync(dir, { recursive: true, force: true });
});

test('a spec DOC (PRODUCT_SPEC.md) is not miscounted as a test file', () => {
  const dir = makeRepo({
    'package.json': '{"name":"x"}',
    'docs/PRODUCT_SPEC.md': '# spec',
  });
  const t = tests(scanRepo(dir));
  assert.ok(!t.findings.some((f) => /test file\(s\) found/.test(f.msg)), 'a .md spec must not count as a test');
  rmSync(dir, { recursive: true, force: true });
});

test('.swiftformat is recognized as a linter/formatter config', () => {
  const dir = makeRepo({ 'Package.swift': '//', '.swiftformat': '--indent 4' });
  const build = scanRepo(dir).dimensions.find((d) => d.key === 'build');
  assert.ok(build.findings.some((f) => /Linter configured/.test(f.msg)), '.swiftformat should count');
  rmSync(dir, { recursive: true, force: true });
});

test('a Jenkinsfile delegating to a shared-library pipeline is credited with running tests', () => {
  const dir = makeRepo({ 'Jenkinsfile': '@Library("sgreen-ci") _\niosPipeline(appName: "Driftwink")' });
  const ci = scanRepo(dir).dimensions.find((d) => d.key === 'ci');
  assert.equal(ci.score, 100, 'shared-library pipeline should be credited like an inline test stage');
  rmSync(dir, { recursive: true, force: true });
});
