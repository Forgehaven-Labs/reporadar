# RepoRadar - Launch Posts (draft)

> Draft copy for launch day. No em-dashes in public-facing copy.
> [YOU] Replace `PLACEHOLDER_LANDING_URL` and the checkout URL before posting; swap the real
> domain for `reporadar.example`.

---

## Show HN

**Title (<=80 chars):**

> Show HN: RepoRadar, grade any repo A to F and get a Claude-ready fix plan

**Body:**

RepoRadar is a zero-dependency CLI that reads a git repo and scores its health A to F across 7
dimensions (tests, secrets, docs, dependencies, CI, git hygiene, build/lint config), then writes
a prioritized fix plan you paste straight into Claude Code.

The point is the second half. Plenty of tools tell you a repo is unhealthy. RepoRadar hands you
an ordered punch list with the P0 items (leaked secrets, no tests) at the top, formatted so you
can say to Claude Code "work through this top to bottom, commit at each clean checkpoint" and it
just goes.

Design choices worth calling out:
- Static analysis only. It never runs your build or your tests, so it is fast and safe to point
  at code you do not trust (a repo you are about to buy, a dependency, a take-home submission).
- Zero dependencies. No node_modules. It runs straight from source on Node 18+. The whole thing
  is a few files of plain ESM using only Node built-ins.
- Four outputs from one scan: a colored terminal report, a self-contained HTML dashboard, a JSON
  result for CI gates (exit code 2 on red), and the Claude fix plan.
- Portfolio mode ranks every repo in a folder worst-first, which is the view an engineering
  manager actually wants.

It is intentionally not a replacement for gitleaks or a full SAST suite. The secret detection is
high-signal pattern matching, meant to catch the obvious leaked key, not to be a security audit.

Free to scan and grade. The paid tier ($39 one-time) is the downloadable toolkit: HTML
dashboard, JSON export, portfolio mode, and the fix-plan generator. There is a Team tier ($149)
with a commercial license and white-label reports for people who audit client repos.

PLACEHOLDER_LANDING_URL

Feedback on the scoring weights and the dimension set especially welcome.

---

## X / Twitter thread

**1/**
Most tools tell you a repo is a mess.

RepoRadar tells you a repo is a mess AND hands Claude Code an ordered fix list it can work
through top to bottom.

Scan any git repo. Get a grade A to F + a Claude-ready fix plan. 🧵

**2/**
It scores 7 dimensions:
tests · secrets · docs · dependencies · CI · git hygiene · build/lint

P0 items (leaked keys, zero tests) float to the top of the fix plan automatically.

**3/**
It never runs your build or tests. Static analysis only.

So it is fast, and safe to point at code you do NOT trust: a repo you might buy, a dependency, a
take-home you are grading.

**4/**
One scan, four outputs:
- colored terminal report
- self-contained HTML dashboard
- JSON (exit 2 on red, for CI gates)
- a Claude Code fix plan

Paste the last one into Claude and say "work through this, commit at each checkpoint."

**5/**
Portfolio mode ranks every repo in a folder worst-first. The view a manager actually wants:
which projects leak secrets, ship no tests, or have no CI, without opening a file.

**6/**
Zero dependencies. Node 18+. Runs straight from source. MIT.

Free to scan. Toolkit $39 one-time. Team license $149.

PLACEHOLDER_LANDING_URL

What scoring weights would you change? 👇

---

## Posting checklist (owner)

- [ ] Real domain swapped for `reporadar.example` across landing + meta tags.
- [ ] Checkout URL placeholder replaced with the live Lemon Squeezy product URL.
- [ ] OG image deployed at `/assets/og-image.png`; preview in the card validators.
- [ ] Demo GIF or the HTML dashboard screenshot attached to the X thread (shot 4 lands best).
- [ ] Post at a US-morning weekday slot; stay at the keyboard for the first 2 hours.
