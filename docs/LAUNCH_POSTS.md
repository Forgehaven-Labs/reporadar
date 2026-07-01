# RepoRadar - Launch Posts (draft, DO NOT POST without owner)

> Draft copy for launch day. Prepared 2026-07-01. No em-dashes in public-facing copy.
> The repo is PUBLIC as of 2026-07-01: <https://github.com/Forgehaven-Labs/reporadar>.
> [YOU] Before posting: replace `PLACEHOLDER_LANDING_URL` with the live landing URL and
> confirm the two Stripe Payment Links are wired in (see `../GO_TO_MARKET.md` Section 1).
> The launch leads with the FREE public repo. The paid toolkit is the soft upsell.

---

## Show HN (lead post)

**Title (<=80 chars):**

> Show HN: RepoRadar, a free CLI that grades any repo A to F, with a Claude fix plan

**Body:**

RepoRadar is a free, open (MIT), zero-dependency CLI that reads a git repo and scores its
health A to F across 7 dimensions (tests, secrets, docs, dependencies, CI, git hygiene,
build/lint config), then writes a prioritized fix plan you paste straight into Claude Code.

Try it in under a minute, no install:

    git clone https://github.com/Forgehaven-Labs/reporadar
    node reporadar/bin/reporadar.js scan /path/to/any/repo

The point is the second half. Plenty of tools tell you a repo is unhealthy. RepoRadar hands
you an ordered punch list with the P0 items (leaked secrets, no tests) at the top, formatted
so you can say to Claude Code "work through this top to bottom, commit at each clean
checkpoint" and it just goes.

Design choices worth calling out:
- Static analysis only. It never runs your build or your tests, so it is fast and safe to
  point at code you do not trust (a repo you are about to buy, a dependency, a take-home).
- Zero dependencies. No node_modules. It runs straight from source on Node 18+. The whole
  thing is a few files of plain ESM using only Node built-ins.
- Exit code 2 on red findings, so it drops straight into a CI gate.
- Portfolio mode ranks every repo in a folder worst-first, which is the view an engineering
  manager actually wants.

It is intentionally not a replacement for gitleaks or a full SAST suite. The secret detection
is high-signal pattern matching, meant to catch the obvious leaked key, not to be a security
audit.

The clone-and-scan grade is free forever. If you want the packaged toolkit (self-contained
HTML dashboard, JSON export, portfolio mode, the fix-plan generator, updates), that is a $39
one-time download, and there is a $149 team license with white-label reports for people who
audit client repos: PLACEHOLDER_LANDING_URL

Feedback on the scoring weights and the dimension set especially welcome.

---

## r/ClaudeAI post

**Title:**

> I built a CLI that turns any repo into a prioritized fix plan Claude Code can just execute

**Body:**

Something I kept doing by hand: inherit a messy repo, poke around for an hour, then write
Claude Code a long prompt describing everything wrong with it. So I automated the first hour.

RepoRadar (free, MIT, zero npm dependencies) scans a git repo statically and grades it A to F
across 7 dimensions: tests, secrets, docs, dependencies, CI, git hygiene, build/lint config.
Then the part built specifically for this crowd: `--claude FIXES.md` writes the findings as a
prioritized, agent-ready remediation plan. P0 secrets first, then reds, then yellows, with
guardrails baked in ("never commit secret values", "commit at each clean checkpoint").

The loop that actually works for me:

1. `node bin/reporadar.js scan ./legacy-project --claude FIXES.md`
2. Open Claude Code, paste: "Work through FIXES.md top to bottom."
3. Re-scan. Watch the grade climb.

It never executes the target repo's code (static-only), so it is safe on code you do not
trust yet. Node 18+, nothing to install, runs straight from a clone:

https://github.com/Forgehaven-Labs/reporadar

The terminal scan and grade are free forever. There is a paid packaged tier (dashboard, JSON
for CI, portfolio mode) if you want it, but the free clone covers the scan-and-grade loop
above. Would genuinely like feedback on what dimensions or Claude-plan guardrails are missing.

---

## X / Twitter thread

**1/**
Most tools tell you a repo is a mess.

RepoRadar tells you a repo is a mess AND hands Claude Code an ordered fix list it can work
through top to bottom.

Free, MIT, zero dependencies. Clone and scan in under a minute. 🧵

**2/**
It scores 7 dimensions:
tests · secrets · docs · dependencies · CI · git hygiene · build/lint

P0 items (leaked keys, zero tests) float to the top of the fix plan automatically.

**3/**
It never runs your build or tests. Static analysis only.

So it is fast, and safe to point at code you do NOT trust: a repo you might buy, a
dependency, a take-home you are grading.

**4/**
The Claude Code loop:

scan → FIXES.md → "work through this, commit at each checkpoint" → re-scan

Diagnosis to remediation, one move.

**5/**
Portfolio mode ranks every repo in a folder worst-first. The view a manager actually wants:
which projects leak secrets, ship no tests, or have no CI, without opening a file.

**6/**
Free forever: clone the repo, scan, get the grade.
https://github.com/Forgehaven-Labs/reporadar

Packaged toolkit (HTML dashboard, JSON for CI, portfolio mode, fix-plan generator): $39
one-time. Team license $149.

PLACEHOLDER_LANDING_URL

What scoring weights would you change? 👇

---

## Posting checklist (owner)

- [x] Repo public: <https://github.com/Forgehaven-Labs/reporadar> (flipped 2026-07-01 after
      gitleaks + history scan came back clean).
- [ ] Real domain swapped for `reporadar.example` across landing + meta tags.
- [ ] `STRIPE_LINK_REPORADAR_PRO` and `STRIPE_LINK_REPORADAR_TEAM` replaced with live Stripe
      Payment Links (test-mode purchase done first). Gumroad backup: same placeholders, Gumroad URLs.
- [ ] Landing deployed (see `../DEPLOY_RUNBOOK.md`); OG image live at `/assets/og-image.png`.
- [ ] Demo GIF or the HTML dashboard screenshot attached to the X thread (shot 4 lands best).
- [ ] Post at a US-morning weekday slot; stay at the keyboard for the first 2 hours.
- [ ] Sequence: Show HN first, r/ClaudeAI ~1 day later, X thread same day as HN.
