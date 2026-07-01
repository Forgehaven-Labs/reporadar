# Changelog

All notable changes to RepoRadar are documented here.
This project follows [Semantic Versioning](https://semver.org/) and the
[Keep a Changelog](https://keepachangelog.com/) format.

## [Unreleased]

### Changed
- **Payment rail pivot (2026-07-01):** Lemon Squeezy denied the store application, so all
  checkout placeholders and go-to-market docs moved to **Stripe Payment Links**
  (`STRIPE_LINK_REPORADAR_PRO`, `STRIPE_LINK_REPORADAR_TEAM`), with Gumroad noted as the
  merchant-of-record backup.
- **Repo is now public** (2026-07-01, after a clean gitleaks + history scan): the landing
  free-tier "Clone & scan" button points at
  <https://github.com/Forgehaven-Labs/reporadar>. Free tier = clone + scan; no $0 checkout.
- Added `docs/DECISIONS.md` (pre-committed day-30 kill line), `DEPLOY_RUNBOOK.md`
  (Cloudflare Pages steps), and `RELEASE_MANIFEST.md` (artifact + sha256).

### Added
- **`.reporadarignore`** (gitignore-style) so a repo can exclude vendored code or
  fixtures from the scan. Opt-in per repo, so default secret detection is unchanged.
  RepoRadar uses it to exclude its own `demo/` fixtures (self-grade D to B+).
- **White-label HTML reports** via `--brand "Your Agency"`: the report header, title,
  and footer carry the agency's name, not RepoRadar's. XSS-safe (brand is escaped).
- **Team / Agency tier ($149)**: commercial license to scan client repos, white-label
  reports, up to 10 seats, priority support.
- A lockfile, `eslint.config.js`, and `.editorconfig` for the project's own hygiene.

## [0.1.0] - 2026-06-18

First public release. RepoRadar scans a git repository (or a folder of them),
scores its health A-F across 7 weighted dimensions, and emits a Claude-ready
fix plan.

### Added
- **Scan engine** (`src/scan.js`) - static-only health scan across 7 dimensions:
  Tests (20), Security/Secrets (18), Documentation (15), Dependencies (15),
  CI/Automation (12), Git Hygiene (10), Build/Lint Config (10).
- **Grade model** - weighted 0-100 score mapped to an A-F letter grade with
  green/yellow/red status per dimension.
- **Terminal report** (`src/render-terminal.js`) - colored ANSI summary with
  per-dimension bars and the top fixes.
- **HTML dashboard** (`src/render-html.js`) - self-contained dark dashboard
  (inline CSS, no external assets) with an SVG health gauge and a prioritized
  fix list. Portfolio view included.
- **JSON export** (`--json`) - machine-readable result for CI integration.
- **Claude Code fix plan** (`src/render-claude.js`) - the differentiator: a
  prioritized, agent-ready remediation plan (P0 secrets first, then reds, then
  yellows) with guardrails, ready to paste into Claude Code.
- **Portfolio mode** - scan every repo in a folder, ranked worst-first.
- **Exit codes** - `0` healthy/warning, `2` red, for wiring into CI gates.
- **Stack detection** - Node/JS, TypeScript, Python, Go, Rust, Ruby, JVM, .NET,
  Swift/iOS, static sites.
- Zero runtime dependencies (Node built-ins only); test suite via `node --test`.
- Packaging: `scripts/package.sh` builds a clean, versioned distributable zip.

### Security
- Pattern-based secret detection for AWS keys, private key blocks, OpenAI /
  Anthropic / GitHub / Google / Slack tokens, and hardcoded credential
  assignments, plus a committed-`.env` check.
- The bundled demo fixture ships `.env.sample` (never a literal `.env`); its
  credential strings are synthetic and exist only to exercise the scanner.

### Known limits
- Static analysis only - does not run your build or tests, so "Tests" measures
  *presence*, not *passing*.
- Secret detection is high-signal pattern matching, not a replacement for a
  dedicated scanner such as gitleaks.
- Deep stack-specific checks (e.g. real `npm audit` CVEs) are on the roadmap.

[0.1.0]: https://reporadar.dev/releases/0.1.0
