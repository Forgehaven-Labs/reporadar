# Changelog

All notable changes to RepoRadar are documented here.
This project follows [Semantic Versioning](https://semver.org/) and the
[Keep a Changelog](https://keepachangelog.com/) format.

## [Unreleased]

### Security
- **Arbitrary command execution when scanning an untrusted repo (P0, fixed 2026-07-02).**
  RepoRadar shells out to `git` for the Git Hygiene signals, and `git` honored the
  *scanned* repo's own `.git/config` — a planted `core.fsmonitor` / `core.hooksPath`
  ran an attacker's command during `git status`, exactly the untrusted-code case the
  tool is for. All git invocations now neutralize config-driven exec vectors on the
  command line and refuse system/global config, with a bounded timeout/output. Added a
  regression test that scans a repo with a hostile `core.fsmonitor` and asserts no
  side effect. Found by running our own Overnight Audit service against RepoRadar.
- **ReDoS via a hostile `.reporadarignore` (P2, fixed 2026-07-02).** Ignore globs from
  the scanned repo were compiled straight into a backtracking `RegExp`; a crafted
  pattern could pin the CPU and hang a scan (or a CI gate). Replaced with a linear,
  non-backtracking matcher, plus pattern/path length and count caps.
- **Terminal control-character injection (P3, fixed 2026-07-02).** Scanned-repo file
  paths and `package.json` scripts flow into terminal output; a hostile repo could
  embed ANSI/OSC escapes. Control bytes are now stripped from scanned-repo-derived
  strings before printing.

### Added
- **Multi-language test detection** (2026-07-02): Swift (`FooTests.swift`), Kotlin/Java
  (`FooTest.kt`), .NET (`FooTests.cs`) and Go (`foo_test.go`) suites are now recognized,
  and non-Node stacks get test-runner credit for their implicit runner (go test,
  xcodebuild test, dotnet test, gradle/maven). Previously only JS/Python conventions
  counted, so real suites across a mixed portfolio scored as zero tests. A `.md` spec
  doc no longer miscounts as a test file. `.swiftformat`/detekt/ktlint/rubocop are now
  recognized linter configs, and a Jenkinsfile delegating to a shared-library pipeline
  (`iosPipeline()` etc.) is credited with running tests.
- **Nested portfolio discovery** (2026-07-02): `portfolio` now finds git repos up to
  3 levels deep, so `product/{ios,android,website}` layouts are scanned. A container
  folder holding repos is no longer mis-scanned as one blob, and repo names in
  portfolio output are root-relative (`driftwink/ios` vs `drivelog/ios`). Found by
  dogfooding: the old direct-children scan saw 12 of our own portfolio's 42 repos.
- **`--claude-dir <dir>`** in portfolio mode: writes one Claude Code fix plan per
  discovered repo (`driftwink__ios.md`), so an agent fleet can fan out fixes.

### Fixed
- **Secret-scanner false positives on config-key NAME constants** (2026-07-04): the
  `keyword = "value"` "Hardcoded credential assignment" pattern fired on production
  constants whose VALUE is itself an identifier or env-var name — `KeyLLMAPIKey =
  "llm_api_key"` (Go), `ENV_TOKEN = "TRADIER_TOKEN"` (Python), `Password = "password"`
  (a C# auth-provider enum name), `token: "X-App-Token"` header names, `env:VAR` refs and
  `${VAR}` placeholders. These are not secrets, so cairo/cli, title-sentinel/platform and
  trading-desk all scored Security = 0 (red) on non-secrets during the 2026-07-02
  dogfooding pass (they live in production code, not fixtures, so `.reporadarignore` was
  correctly not used). The detector now inspects the captured value and skips inert
  identifier/env-var/reference/placeholder shapes, while still flagging weak literal
  passwords (`password123`, `TestPass1!`), high-entropy values, provider-prefixed keys
  (`sk-…`, `AKIA…`), and shell default-password expansions (`${VAR:-cairo-demo}`). A
  digit, mixed-case punctuation, or embedded literal default keeps a value flagged, so
  sensitivity is never lowered — verified across all 42 portfolio repos: every cleared
  match was an identifier/reference, and the real cairo-kb `demo-up.sh` default password
  still flags. Found by dogfooding the Overnight Audit secret-sweep.
- **Committed-`.env` false negative** (2026-07-02): a `.env` that was both git-tracked
  AND listed in `.gitignore` slipped past the check (the old logic trusted `.gitignore`
  and missed the already-committed file). Now flags any git-tracked `.env` as a P0.
- **`portfolio` exit code** (2026-07-02): honored the documented `2 = red` contract in
  portfolio mode too, so `reporadar portfolio` can gate CI like `scan` does (was always 0).
- **Terminal "Top fixes" ordering** (2026-07-02): P0/secret fixes now sort above yellows,
  matching the fix plan — a coverage nice-to-have no longer outranks a secret rotation.
- **CLI argument validation** (2026-07-02): a value flag with a missing value (`--html`
  with nothing after it) now errors instead of silently swallowing the next flag or
  writing a file literally named `--verbose`. Unknown flags are rejected.
- **Packaging integrity** (2026-07-02): `package.sh` now gates on a green test suite before
  building, asserts the packaged CLI exits exactly `2` on the red demo (exit 0 would mean
  secret detection regressed), and no longer ships the internal `MONETIZATION.md` strategy
  doc to customers. The Jenkins smoke stage no longer masks crashes with `|| true`.
- **CI scoring parity** (2026-07-02): Jenkinsfile / GitLab / Circle configs now earn
  the same tests-in-CI credit as GitHub Actions — a Jenkinsfile running `node --test`
  scores 100, not a flat 70. The no-CI fix advice no longer prescribes GHA only.
- **Zero-dependency fairness**: a Node repo with no declared dependencies is no longer
  told to commit a lockfile for packages it doesn't have; zero deps now scores as the
  supply-chain win it is. (RepoRadar's own pitch is "zero dependencies" — its scanner
  was docking itself for it.)

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
