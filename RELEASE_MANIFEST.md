# Release Manifest - RepoRadar

Freshly rebuilt sellable artifact. Upload/deliver exactly this file.

**Built:** 2026-07-01 by `scripts/package.sh` (leak guard PASSED; packaged-CLI smoke scan
PASSED, demo exit=2 as expected; test suite 9/9 green the same day).

| Artifact | Path | Size (bytes) | SHA-256 |
|---|---|---|---|
| RepoRadar 0.1.0 (Pro + Team deliverable) | `dist/reporadar-0.1.0.zip` | 2,036,232 | `28ee0a24a06d59547a396d4f9f743b6607fbf7477a14ef4da11b1b186d2e79d9` |

Verification performed on the built zip (2026-07-01):
- `scripts/package.sh` built-in secret-leak guard: PASS (no `.env`, no key patterns, no
  personal paths outside the intentional synthetic `demo/` fixtures).
- Independent extract-and-grep scan of the zip contents for owner paths/email/hosts and
  stale `LEMONSQUEEZY` tokens: 0 hits.
- gitleaks 8.30.1 over the full repo git history (14 commits) and working tree: no leaks.

Notes:
- `dist/` is gitignored; rebuild with `bash scripts/package.sh` and re-check the hash here
  after any source change.
- Pro ($39) and Team/Agency ($149) both deliver this same zip; the difference is the
  license terms (see `MONETIZATION.md`).
- Verify a download with: `shasum -a 256 reporadar-0.1.0.zip`.
