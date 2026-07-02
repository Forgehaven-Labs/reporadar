# Release Manifest - RepoRadar

Freshly rebuilt sellable artifact. Upload/deliver exactly this file.

**Built:** 2026-07-02 by `scripts/package.sh` (test suite 27/27 green gated before build;
leak guard PASSED; packaged-CLI smoke scan PASSED, demo exit=2 as expected). This cut
includes the 2026-07-02 security hardening (git-config RCE fix, ReDoS-safe ignore matcher)
and multi-language test detection — supersedes the 2026-07-01 zip, which must not ship.

| Artifact | Path | Size (bytes) | SHA-256 |
|---|---|---|---|
| RepoRadar 0.1.0 (Pro + Team deliverable) | `dist/reporadar-0.1.0.zip` | 2,042,304 | `9a26f4d4390fcde0abfdeb1c5773d27c3bb5c8926346eb2529193a237512aa07` |

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
  license terms. The internal `MONETIZATION.md` strategy doc is no longer bundled in the
  sellable zip (it shipped to customers by mistake in earlier cuts).
- Verify a download with: `shasum -a 256 reporadar-0.1.0.zip`.
