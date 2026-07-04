import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
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

// --- Secret detector precision: config-key NAME constants must not false-positive ---
// The `keyword = "value"` credential pattern used to fire on production config-key
// constants whose VALUE is itself an identifier or env-var name. These real shapes
// surfaced in the 2026-07-02 dogfooding pass (cairo/cli, title-sentinel, trading-desk)
// and dragged those repos to Security = red on non-secrets. They must clear WITHOUT
// weakening real-secret detection (positive tests below prove sensitivity is intact).
function secretsOf(files) {
  const dir = makeRepo({ 'package.json': '{"name":"x"}', ...files });
  const sec = scanRepo(dir).dimensions.find((d) => d.key === 'secrets');
  rmSync(dir, { recursive: true, force: true });
  return sec;
}

test('config-key NAME constants (identifier-valued) do not false-positive as secrets', () => {
  const sec = secretsOf({
    // Go — KeyLLMAPIKey = "llm_api_key" (cairo/cli/internal/db/config_keys.go)
    'internal/db/config_keys.go': 'const (\n\tKeyLLMAPIKey = "llm_api_key"\n\tKeyServerToken = "server_token"\n)\n',
    // Python — ENV_TOKEN = "TRADIER_TOKEN" (trading-desk adapters)
    'adapters/tradier_sandbox.py': 'ENV_TOKEN = "TRADIER_TOKEN"\nLIVE_TOKEN = "live_token"\n',
    // C# — Password = "password" (title-sentinel AuthProvider enum-name constant)
    'src/AuthProvider.cs': 'public const string Password = "password";\n',
    // header-name constant whose value is the X-App-Token header name
    'config/headers.yaml': 'token: "X-App-Token"\n',
  });
  assert.equal(sec.status, 'green', `NAME constants must not flag; findings: ${JSON.stringify(sec.findings)}`);
  assert.ok(!sec.findings.some((f) => /Hardcoded credential/.test(f.msg)), 'no hardcoded-credential finding for NAME constants');
});

test('SCREAMING_SNAKE env-var name value (ALPACA_API_SECRET_KEY) is not a secret', () => {
  const sec = secretsOf({ 'adapters/alpaca.py': 'SECRET = "ALPACA_API_SECRET_KEY"\n' });
  assert.equal(sec.status, 'green');
});

test('env-var references and placeholders in config are not treated as secrets', () => {
  const sec = secretsOf({
    'config.example.yaml': 'api_key: "env:CAIRO_MODEL_API_KEY"\n',            // cairo-kb
    'deploy/roles.sh': 'password="${OWNER_PW}"\napp_password="${APP_PW}"\n',   // cairo-kb bootstrap
    'docs/PACKAGING.md': 'PASSWORD="<password>"\n',                            // trading-desk placeholder
    'scripts/win.bat': 'token = "%API_TOKEN%"\n',                             // Windows env ref
  });
  assert.equal(sec.status, 'green', `refs/placeholders must not flag; findings: ${JSON.stringify(sec.findings)}`);
});

// --- Sensitivity guard: real keys and weak literal passwords must STILL flag red ---
test('real secrets and weak literal passwords are still flagged red', () => {
  for (const [name, file, content] of [
    ['OpenAI-style key', 'a.js', 'const k = "sk-a1B2c3D4e5F6g7H8i9J0k";'],
    ['AWS access key', 'b.js', 'const k = "AKIAABCDEFGHIJKLMNOP";'],
    ['high-entropy api_key value', 'c.js', 'const api_key = "xQ92mVnp0Zktr8LmWs4Ej7";'],
    ['weak literal password (has digits)', 'd.py', 'password = "password123"'],
    ['mixed-class literal credential', 'e.cs', 'const string Password = "TestPass1!";'],
  ]) {
    const sec = secretsOf({ [file]: content });
    assert.equal(sec.status, 'red', `${name} must still be flagged red`);
    assert.ok(sec.fixes.some((f) => /P0/.test(f)), `${name} should yield a P0 remediation fix`);
  }
});

test('shell default-password expansion ${VAR:-default} still flags (cairo-kb demo-up.sh)', () => {
  // The embedded literal default (cairo-demo) IS a hardcoded password; the sibling
  // bare reference $PG_PASSWORD is inert. The file must still flag on the former.
  const sec = secretsOf({
    'scripts/demo-up.sh': 'PG_PASSWORD="${CAIRO_DEMO_PG_PASSWORD:-cairo-demo}"\nDB="$PG_PASSWORD"\n',
  });
  assert.equal(sec.status, 'red', 'a hardcoded default password inside ${VAR:-default} must still flag');
  assert.ok(sec.findings.some((f) => /Hardcoded credential/.test(f.msg)));
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
