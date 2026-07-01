# Decisions - RepoRadar

Running log of product decisions. Newest first.

## 2026-07-01 — Kill line (pre-committed, before launch)

**If the RepoRadar + Ship-It Kit launch earns less than $200 total OR fewer than 5 paid
units by day 30 after the posts go live, we open-source the Ship-It Kit bundle, leave
RepoRadar public as a free tool, and stop investing in this product line.** No third
polish pass, no "one more channel." This line is written before launch precisely so the
day-30 decision is mechanical, not emotional.

## 2026-07-01 — Payment rail: Stripe Payment Links (Lemon Squeezy denied)

Lemon Squeezy denied the store application on 2026-06-30. Rail is now **Stripe Payment
Links** (owner has Stripe; ~2.9% + $0.30; NOT a Merchant of Record, so enable Stripe Tax)
with **Gumroad** (flat 10%, MoR included, native file delivery) as the fallback if tax or
fulfillment friction bites. Landing placeholders renamed `LEMONSQUEEZY_*` →
`STRIPE_LINK_REPORADAR_PRO` / `STRIPE_LINK_REPORADAR_TEAM`.

## 2026-07-01 — Repo made public (free-funnel fix)

`Forgehaven-Labs/reporadar` flipped private → public (owner-authorized) after a clean
sweep: gitleaks 8.30.1 over all 14 commits of history and the working tree (no leaks),
plus a manual history grep for personal paths/emails/hosts/key patterns (only synthetic
test fixtures found; the historical demo `.env` was verified structurally fake). The
landing "Clone & scan" button now points at the real repo. The free tier is
clone-and-scan; the paid tier is the packaged download.

## 2026-07-01 — Free tier delivery

No $0 checkout anywhere. Free = the public GitHub repo. This removes the dead-link
free-funnel problem and gives launch posts a real, inspectable artifact.
