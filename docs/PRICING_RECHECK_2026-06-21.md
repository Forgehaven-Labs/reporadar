# Pricing-Comp Recheck - RepoRadar (2026-06-21)

> **UPDATE 2026-07-01: the Lemon Squeezy recommendation below is DEAD.** Lemon Squeezy
> denied the store application on 2026-06-30. The rail is now **Stripe Payment Links**
> (~2.9% + $0.30, NOT a Merchant of Record; enable Stripe Tax for VAT/sales tax) with
> **Gumroad** (flat 10%, MoR included) as the backup if tax handling is a burden.
> Prices and verdicts below are unchanged. See `../GO_TO_MARKET.md` Section 1.

Recheck of live comparable prices against the current model. Researched via web search.
This memo confirms or adjusts `../MONETIZATION.md`; it does not change prices on its own.

## Current model (source of truth: `landing/index.html` + `MONETIZATION.md`)

| Tier | Price | Model |
|---|---|---|
| Free scan | $0 | one-time / forever |
| Pro | $39 | one-time, lifetime updates |
| Team / Agency | $149 | one-time, commercial license + white-label, up to 10 seats |

## What the market looks like in 2026

- **Repo-health / code-quality tools are almost entirely subscription.** Concrete comps:
  Codacy ~$15/user/mo, DeepSource ~$15-25/committer/mo, Qodana ~$6/contributor/mo, Semgrep free
  under 10 contributors, SonarQube Developer ~$2,500/yr. There is **no meaningful one-time
  comparable** for a paid repo-health CLI. RepoRadar is effectively a category of one on the
  one-time axis, so price is a judgment call, not a comp-anchored number.
- **Dev-tool one-time products generally** cluster $79-$349 (boilerplates), with smaller CLIs and
  utilities lower. A $39 one-time CLI is on the low/impulse end, which is appropriate for a v0.1
  with no reviews yet.
- **Platform fees.** Lemon Squeezy 5% + $0.50 (MoR included); Gumroad flat 10% (MoR included).
  On a $39 sale: LS nets ~$36.55, Gumroad nets ~$35.10. On $149: LS ~$141.05, Gumroad ~$134.10.
  LS is the better economics at both price points.

## Verdicts

- **Pro $39 -> WELL-POSITIONED, arguably LOW.** The cheapest subscription comp (Qodana ~$6/mo)
  crosses $39 in about 7 months, so a one-time $39 is an easy yes for any developer who scans
  more than a couple of repos a year. There is room to test $49 later, but $39 is a clean
  impulse anchor for launch and the landing already shows it struck from $49. KEEP $39 launch.
- **Team / Agency $149 -> WELL-POSITIONED.** It sits far below SonarQube ($2,500/yr) and under a
  single year of one Codacy seat, while the buyer's value is billable client-audit time
  ($300-$800 per audit replaced). The ~4x-over-Pro ratio is justified by the commercial license
  and white-label, not by feature count. KEEP.
- **Free scan -> correct.** The funnel. The grade is the honest hook; the toolkit is the upsell.

## Recommendation

**Hold the model.** No change at launch. Two notes:
1. Use **Lemon Squeezy** (better net at both $39 and $149).
2. Because there is no one-time comp, the anchor that sells is **outcome math**, not competitor
   price: "one caught leaked key or one saved afternoon pays for it." The landing already leads
   with that; keep it. Consider testing Pro at $49 (the list price) only after the first batch of
   reviews exists.
