import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scanRepo, detectStack, gradeOf } from '../src/scan.js';
import { renderHTML, renderPortfolioHTML } from '../src/render-html.js';
import { renderClaude } from '../src/render-claude.js';
import { renderTerminal } from '../src/render-terminal.js';

function makeRepo(files) {
  const dir = mkdtempSync(join(tmpdir(), 'reporadar-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = join(dir, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content);
  }
  return dir;
}

test('detectStack recognizes Node + TypeScript', () => {
  const dir = makeRepo({ 'package.json': '{}', 'tsconfig.json': '{}' });
  const stack = detectStack(dir);
  assert.ok(stack.includes('Node/JS'));
  assert.ok(stack.includes('TypeScript'));
  rmSync(dir, { recursive: true, force: true });
});

test('gradeOf maps scores to letter grades', () => {
  assert.equal(gradeOf(95), 'A');
  assert.equal(gradeOf(72), 'B');
  assert.equal(gradeOf(30), 'F');
});

test('scanRepo flags a hardcoded secret as red security', () => {
  const dir = makeRepo({
    'package.json': '{"name":"x","scripts":{"start":"node i.js"}}',
    'src/app.js': 'const k = "sk-ant-' + 'A'.repeat(30) + '";',
  });
  const result = scanRepo(dir);
  const sec = result.dimensions.find((d) => d.key === 'secrets');
  assert.equal(sec.status, 'red');
  assert.ok(sec.fixes.some((f) => /P0/.test(f)), 'should produce a P0 fix');
  rmSync(dir, { recursive: true, force: true });
});

test('.reporadarignore excludes a fixture path from the secret scan', () => {
  const dir = makeRepo({
    'package.json': '{"name":"x"}',
    'fixtures/leak.js': 'const k = "sk-ant-' + 'A'.repeat(30) + '";',
    '.reporadarignore': '# fixtures carry synthetic secrets\nfixtures/\n',
  });
  const result = scanRepo(dir);
  const sec = result.dimensions.find((d) => d.key === 'secrets');
  assert.equal(sec.status, 'green', 'an ignored fixture secret must not count against the grade');
  rmSync(dir, { recursive: true, force: true });
});

test('without .reporadarignore the same fixture secret is still flagged (detection intact)', () => {
  const dir = makeRepo({
    'package.json': '{"name":"x"}',
    'fixtures/leak.js': 'const k = "sk-ant-' + 'A'.repeat(30) + '";',
  });
  const result = scanRepo(dir);
  const sec = result.dimensions.find((d) => d.key === 'secrets');
  assert.equal(sec.status, 'red', 'a secret in a non-ignored path must still be caught');
  rmSync(dir, { recursive: true, force: true });
});

test('scanRepo rewards a well-formed repo', () => {
  const longReadme = '# Project\n\n' + '## Install\nrun it.\n## Usage\n' + 'x'.repeat(1600);
  const dir = makeRepo({
    'package.json': '{"name":"good","scripts":{"test":"node --test","build":"tsc"},"dependencies":{"express":"^4.0.0"}}',
    'package-lock.json': '{}',
    'README.md': longReadme,
    'LICENSE': 'MIT',
    '.gitignore': 'node_modules\n.env\n',
    '.eslintrc.json': '{}',
    'test/app.test.js': 'import {test} from "node:test"; test("x",()=>{});',
    '.github/workflows/ci.yml': 'jobs:\n  test:\n    steps:\n      - run: node --test\n',
  });
  const result = scanRepo(dir);
  assert.ok(result.overall >= 70, `expected healthy score, got ${result.overall}`);
  const sec = result.dimensions.find((d) => d.key === 'secrets');
  assert.equal(sec.status, 'green');
  rmSync(dir, { recursive: true, force: true });
});

// --- JVM / Android (Gradle multi-module) regression coverage ---
// Mirrors the driftwink/android layout: a root build file plus an app/ module whose
// suites live under app/src/test/kotlin (FooTest.kt) with JaCoCo wired via AGP's
// enableUnitTestCoverage. Before the fix this whole shape scored Tests 0.
function androidRepo(extra = {}) {
  return makeRepo({
    'settings.gradle.kts': 'include(":app")',
    'build.gradle.kts': 'plugins {\n  alias(libs.plugins.android.application) apply false\n}',
    'app/build.gradle.kts':
      'plugins {\n  alias(libs.plugins.android.application)\n  alias(libs.plugins.kotlin.android)\n}\n' +
      'android {\n  namespace = "com.forgehavenlabs.demo"\n  compileSdk = 34\n' +
      '  buildTypes {\n    debug {\n' + (extra.coverage ?? '      enableUnitTestCoverage = true\n') + '    }\n  }\n}\n' +
      'dependencies {\n  testImplementation(libs.junit)\n}',
    'app/src/main/kotlin/com/forgehavenlabs/demo/StoryEngine.kt': 'class StoryEngine',
    'app/src/test/kotlin/com/forgehavenlabs/demo/StoryEngineTest.kt': 'class StoryEngineTest {}',
    'app/src/test/kotlin/com/forgehavenlabs/demo/PlayerViewModelTest.kt': 'class PlayerViewModelTest {}',
    'app/src/androidTest/kotlin/com/forgehavenlabs/demo/UiTests.kt': 'class UiTests {}',
    ...(extra.files || {}),
  });
}

test('Gradle/Android module: nested app/src/test suites + JaCoCo coverage score Tests nonzero', () => {
  const dir = androidRepo();
  const result = scanRepo(dir);
  assert.ok(result.stack.includes('JVM'), `expected JVM stack, got ${result.stack.join(',')}`);
  const t = result.dimensions.find((d) => d.key === 'tests');
  assert.ok(t.score > 0, 'a Gradle/Kotlin suite must not score Tests 0');
  assert.ok(t.findings.some((f) => /test file\(s\) found/.test(f.msg)), 'FooTest.kt under app/src/test must be counted');
  assert.ok(t.findings.some((f) => /Coverage tooling present/.test(f.msg)), 'enableUnitTestCoverage in app/build.gradle.kts must be credited');
  assert.ok(t.score >= 55, `JVM suite with coverage should score green-ish, got ${t.score}`);
  rmSync(dir, { recursive: true, force: true });
});

test('coverage credit comes specifically from the module build file (not the root)', () => {
  const withCov = androidRepo();
  const withoutCov = androidRepo({ coverage: '' }); // debug {} block, no enableUnitTestCoverage
  const a = scanRepo(withCov).dimensions.find((d) => d.key === 'tests');
  const b = scanRepo(withoutCov).dimensions.find((d) => d.key === 'tests');
  assert.ok(a.score > b.score, `coverage detection must add score (with ${a.score} > without ${b.score})`);
  assert.ok(!b.findings.some((f) => /Coverage tooling present/.test(f.msg)), 'no coverage wiring → no coverage credit');
  rmSync(withCov, { recursive: true, force: true });
  rmSync(withoutCov, { recursive: true, force: true });
});

test('AGP project gets Android Lint credit with no separate detekt/ktlint config', () => {
  const dir = androidRepo();
  const build = scanRepo(dir).dimensions.find((d) => d.key === 'build');
  assert.ok(build.findings.some((f) => /Android Lint \(AGP built-in\)/.test(f.msg)), 'AGP module should be credited with built-in Android Lint');
  assert.ok(!build.findings.some((f) => /No linter configuration/.test(f.msg)), 'AGP module must not be flagged "no linter"');
  rmSync(dir, { recursive: true, force: true });
});

test('config/detekt is recognized as a JVM linter config', () => {
  const dir = makeRepo({
    'build.gradle.kts': 'plugins { kotlin("jvm") }',
    'config/detekt/detekt.yml': 'build:\n  maxIssues: 0\n',
  });
  const build = scanRepo(dir).dimensions.find((d) => d.key === 'build');
  assert.ok(build.findings.some((f) => /Linter configured/.test(f.msg)), 'config/detekt/detekt.yml should count as an explicit linter');
  rmSync(dir, { recursive: true, force: true });
});

test('a Gradle module whose test files are unrecognized still gets test-dir credit via src/test', () => {
  // No *Test.kt basename here — only src/test/ path presence should keep it off zero.
  const dir = makeRepo({
    'build.gradle.kts': 'plugins { kotlin("jvm") }',
    'app/src/test/kotlin/com/x/Fakes.kt': 'object Fakes',
  });
  const t = scanRepo(dir).dimensions.find((d) => d.key === 'tests');
  assert.ok(t.score > 0, 'a nested src/test dir must lift Tests off zero even without recognized filenames');
  assert.ok(t.findings.some((f) => /Test directory exists but no recognizable test files/.test(f.msg)), 'should credit the test directory');
  rmSync(dir, { recursive: true, force: true });
});

// Dogfood: the real repo that surfaced the false negative. Skipped when the path is
// absent (other CI agents / fresh checkouts) so the suite stays portable.
const DRIFTWINK_ANDROID = '/Users/sgreen/Documents/repos/driftwink/android';
test('driftwink/android scores nonzero on Tests (dogfood)', { skip: !existsSync(DRIFTWINK_ANDROID) }, () => {
  const t = scanRepo(DRIFTWINK_ANDROID).dimensions.find((d) => d.key === 'tests');
  assert.ok(t.score > 0, `driftwink/android must not score Tests 0, got ${t.score}`);
});

test('renderers produce non-empty output without throwing', () => {
  const dir = makeRepo({ 'package.json': '{"name":"r"}', 'README.md': '# hi' });
  const result = scanRepo(dir);
  const html = renderHTML(result);
  assert.ok(html.includes('<!doctype html>'));
  assert.ok(html.includes('RepoRadar'));
  assert.ok(renderClaude(result).includes('Fix Plan'));
  assert.ok(renderTerminal(result).includes('Overall'));
  assert.ok(renderPortfolioHTML([result, result]).includes('portfolio'));
  rmSync(dir, { recursive: true, force: true });
});

test('renderHTML white-labels the report with a brand (Team tier)', () => {
  const dir = makeRepo({ 'package.json': '{"name":"acme"}', 'README.md': '# acme' });
  const result = scanRepo(dir);
  const branded = renderHTML(result, { brand: 'Northwind Audits' });
  assert.ok(branded.includes('Northwind Audits'), 'brand name appears in the report');
  assert.ok(branded.includes('Generated by Northwind Audits'), 'footer is white-labeled');
  assert.ok(!/>RepoRadar<\/h1>/.test(branded), 'default RepoRadar header is replaced when branded');
  assert.ok(renderHTML(result).includes('RepoRadar'), 'unbranded report still shows RepoRadar');
  rmSync(dir, { recursive: true, force: true });
});

test('overall score is a weighted 0-100 integer', () => {
  const dir = makeRepo({ 'package.json': '{"name":"z"}' });
  const result = scanRepo(dir);
  assert.ok(Number.isInteger(result.overall));
  assert.ok(result.overall >= 0 && result.overall <= 100);
  assert.ok(['green', 'yellow', 'red'].includes(result.status));
  rmSync(dir, { recursive: true, force: true });
});
