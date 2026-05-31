# CLAUDE.md — RepoRadar

Zero-dependency Node.js CLI that scans git repos for health, scores them A-F across
7 dimensions, and emits a colored terminal report, HTML dashboard, JSON result, and
a Claude Code fix plan.

## Stack

- Node.js 18+ (ESM modules, zero npm dependencies)
- Entry: `bin/reporadar.js`
- Tests: `test/scan.test.js` (Node built-in test runner `--test`)
- No `node_modules` — runs straight from source

## Run

```bash
# Scan one repo (terminal report)
node bin/reporadar.js scan .

# Scan with all outputs
node bin/reporadar.js scan ./my-app --html report.html --json report.json --claude FIXES.md

# Portfolio scan (all git repos in a folder, worst-first)
node bin/reporadar.js portfolio ~/Documents/repos --html portfolio.html

# Verbose (show every finding)
node bin/reporadar.js scan . --verbose
```

## Test

```bash
node --test          # runs test/scan.test.js via Node's built-in runner
# or
npm test
```

## Demo (bundled imperfect sample repo)

```bash
npm run demo         # writes out/demo.html + out/demo.json + out/demo-fixes.md
```

## Key dirs/files

```
bin/
  reporadar.js       — CLI entry point (arg parsing, orchestration)
src/
  scan.js            — core health scanner (7 dimensions, 0-100 scoring)
  render-terminal.js — ANSI colored terminal output
  render-html.js     — self-contained HTML dashboard
  render-claude.js   — Claude Code fix plan generator
test/
  scan.test.js       — unit tests for scanner
demo/
  sample-repo/       — intentionally imperfect repo for demo/test runs
out/                 — generated output (gitignored except screenshots)
docs/screenshots/    — demo screenshots for README
```

## The 7 scoring dimensions

Tests (20), Security/Secrets (18), Documentation (15), Dependencies (15),
CI/Automation (12), Git Hygiene (10), Build/Lint Config (10).

## Exit codes

- `0` — healthy or warnings only
- `2` — red/critical findings (use for CI gates)

## Gotchas

- Static analysis only — does not execute builds or tests.
- Secret detection is pattern-based (high-signal); not a replacement for gitleaks.
- `demo/sample-repo/.env` contains intentionally FAKE keys for scanner testing.
- `npm link` makes `reporadar` available as a global command.
- No `node_modules` needed — all deps are Node built-ins (`node:fs`, `node:path`).

## P0 note on demo/.env

`demo/sample-repo/.env` contains synthetic/fake credentials inserted deliberately
to test the secret scanner. The values are not real. Do NOT replace them with real keys.
