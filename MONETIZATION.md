# Monetization model — RepoRadar

**Recommendation: Freemium, tiered by distribution — free live scan + grade, paid full toolkit, agency tier for client work.**
**Price: free scan, Pro $39, Team/Agency $149. All one-time, no subscription.**

This document is the decision record for how RepoRadar makes money and how the
packaging reflects that decision. It does **not** implement payment logic; it
defines the free/paid boundary and where it lives.

---

## Price justification — the right yardstick

Price tracks **what the outcome is worth to the buyer**, not how many hours it took to
build. The correct anchor for each tier:

- **Pro ($39).** The buyer is a solo dev or small team. The outcome it delivers: it turns
  "I should really audit this repo" into a finished audit **plus a prioritized,
  Claude-ready fix plan in under a minute** — work that by hand is a 2-to-4 hour afternoon
  of checking tests, secrets, CI, and docs and then writing up a plan. At even a modest
  hourly rate that is $80–$160 of time, recovered the first time it catches a leaked key
  or a repo with no tests, and then reused across **every repo you own, forever**. Against
  one saved afternoon, $39 one-time is an easy yes.

- **Team / Agency ($149).** The buyer is a consultant or agency that audits **client**
  repos as billable work, or a lead managing many repos. Here the value is **repeatable and
  revenue-generating**, which is why it is priced at ~4x Pro even though the buyer's value
  is more like 10–50x:
  - Each client audit it replaces is a half-day of billable time ($300–$800). RepoRadar
    produces the same result in seconds, and the **marginal cost of the next audit is zero**.
  - The **white-label report** (`--brand "Your Agency"`) is a client-ready deliverable with
    the agency's name on it, not ours — a line item they can charge for, not just an
    internal tool.
  - The commercial license + 10 seats remove the licensing friction of using it on paid
    client work across a team.
  - The yardstick: **one client audit it replaces, or one branded report it lets you bill,
    covers the $149 several times over.** After that it is pure margin.

The same yardstick says **don't discount**: a price-sensitive buyer who balks at $39 leaves
for free tools regardless, while the agency buyer judges on billable value and a cheap price
reads as "not serious." The growth lever is proof and a strong free tier, not a lower number.

---

## The decision: freemium, not flat-only

RepoRadar is a downloadable, offline, zero-dependency tool with no server, no
account, and no per-use cost. That shapes everything:

- There is **no runtime to meter** and **no honest way to hard-gate** a feature
  inside a tool whose full source the buyer receives. A fake in-binary paywall
  would be trivially removable and would punish honest buyers.
- So the real monetizable unit is **the download itself** — the complete toolkit,
  updates, and the Claude fix-plan generator that no other health scanner ships.

The fair, viable model is therefore **freemium tiered by distribution**, not a
crippled-runtime freemium:

| Tier | What the user gets | Where it lives |
|---|---|---|
| **Free** | The live terminal scan + the A-F grade for any repo. The "is this repo healthy?" answer, shareable. | The public repo, <https://github.com/Forgehaven-Labs/reporadar> (clone + scan) |
| **Pro ($39)** | The full downloadable toolkit: HTML dashboard, JSON export, **portfolio mode**, and the **Claude Code fix-plan generator** — plus version updates. | The Stripe Payment Link download (Gumroad as MoR backup) |
| **Team / Agency ($149)** | Everything in Pro, plus a **commercial license** to scan client repos, **white-label HTML reports** (`--brand`), **up to 10 seats**, and priority support. | The Stripe Payment Link download (separate link) |

### Why freemium beats flat-paid here

1. **The grade is the marketing.** A free grade is viral — people screenshot an
   F and share it. That top-of-funnel is worth more than the few dollars a
   paywalled scan would earn. Flat-paid hides the hook behind a checkout.
2. **The fix plan is the product.** Anyone can be told "your repo is unhealthy."
   The prioritized, P0-first, agent-ready remediation plan is the thing worth
   paying for — it closes the loop from diagnosis to fix. That is a genuine
   power-user capability, not an artificial restriction, so it is fair to gate.
3. **Agencies and managers buy the toolkit.** Portfolio mode (rank every repo
   worst-first) and machine-readable JSON for CI are the consultant/manager
   features. They map cleanly to the paid tier.

### Why not a subscription

There is no recurring server cost and no continuous content delivery. A repo
scan is a finite job. Subscription fatigue would tank conversion for what is
fundamentally a tool. One-time purchase fits the value profile.

---

## The free/paid boundary in the package

The boundary is a clean, documented **delineation**, not enforced payment code:

- **`bin/reporadar.js`** runs every feature today — this is correct. A buyer of
  the toolkit must get the unrestricted tool. We do **not** cripple the binary.
- The boundary is expressed by **what the free funnel exposes** vs **what the
  paid download includes**, and is documented in the README "Free vs Pro" note
  and on the landing page pricing section.
- The fix-plan flag (`--claude`) is the headline paid capability. In the free
  funnel it is presented as "Pro," and the CLI prints a one-line pointer to the
  upgrade when `--claude` is used in a free build (see the gating note below).
  In the paid download it runs with no pointer. **No logic removes the feature
  in either build** — the difference is a single cosmetic banner, so honest
  buyers are never degraded and the free path always works end to end.

> Gating note (for the build, not implemented as payment logic): a future free
> build may set `REPORADAR_EDITION=free`, which only adds a one-line "Upgrade for
> the full fix plan + dashboard at <checkout>" banner. The scan, grade, and all
> outputs still run. The paid download ships without that env var. This is a
> boundary marker, not a lock.

---

## What is explicitly kept free (trust rules)

- The **scan and the grade** — the core "is this healthy?" answer.
- A user's **own output data** is never paywalled on a tool they bought. The
  paid download exports HTML/JSON/fix-plan freely; we never lock a buyer's
  results behind a second charge.
- **The MIT license stays.** RepoRadar is MIT; buyers pay for the packaged,
  supported, ready-to-run distribution and updates, the same way many MIT tools
  sell a paid distribution. The license is a feature (safe to run on client
  code), not something to revoke.

---

## Assumptions to validate with real buyers

- That developers will pay ~$39 one-time for the fix-plan + dashboard rather
  than copy the free scan output by hand. (Validate with launch conversion.)
- That agencies value the white-label report + commercial license enough to pay
  $149 (4x Pro). The Team/Agency tier now ships; validate its conversion against Pro
  and confirm 10 seats + commercial terms match what agencies actually need.
- That a free hosted scan funnel is worth building. At launch the free tier can
  simply be "clone the repo and run `scan`" + the landing-page sample; a hosted
  free scan is a fast-follow if the funnel converts.
