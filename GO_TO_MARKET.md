# Go to market — RepoRadar

Everything needed to list and sell RepoRadar as a downloadable digital product,
short of creating the payment account itself. Pair this with `MONETIZATION.md`
(the model) and `scripts/package.sh` (the artifact builder).

**Recommended price: Pro $39 one-time (launch $29 for the first ~50 buyers) + a Team/Agency tier at $149 (commercial license, white-label reports, 10 seats).**
See the reasoning at the end.

---

## 0. What you are selling

A single zip — `dist/reporadar-<version>.zip` — built by `./scripts/package.sh`.
It contains the full toolkit (CLI, scan engine, all renderers including the
Claude fix-plan generator, demo fixture, README, CHANGELOG, LICENSE,
MONETIZATION.md). Buyers unzip and run `node bin/reporadar.js scan .` with no
install step. The free tier is the live scan + grade; the paid download adds the
dashboard, JSON, portfolio mode, and the fix-plan generator.

Before every listing update, rebuild the artifact so the version is current:

```bash
./scripts/package.sh          # writes dist/reporadar-<version>.zip, runs the leak guard
```

---

## 1. Stripe Payment Links listing — exact steps

> **Rail change (2026-07-01):** Lemon Squeezy denied the store application on
> 2026-06-30, so the payment rail is now **Stripe Payment Links** (the owner has a
> Stripe account). Note the trade-off: Stripe is a payment processor, **not a
> Merchant of Record** — enable **Stripe Tax** on the links to collect sales
> tax/VAT, or fall back to **Gumroad** (flat 10%, MoR included) if tax handling
> becomes a burden. Keep the same two products and prices either way.

1. **Create the two products** in the Stripe Dashboard → *Product catalog* →
   **Add product** (one-time price, USD):
   - `RepoRadar Pro — repo health grade + Claude fix plan` at `$29` launch
     (planned `$39` list).
   - `RepoRadar Team / Agency` at `$149`.

2. **Create a Payment Link for each** (*Payment links* → New): select the product,
   turn ON "Collect customers' addresses" and **Stripe Tax** if enabled, and set the
   **confirmation page** message to: "Thanks! Your download link is below. Unzip and
   run `node bin/reporadar.js scan .` — Node 18+, nothing to install. Reply to your
   receipt email for support."

3. **Deliver the file.** Payment Links do not host files. Two easy options:
   - **Post-payment redirect** (recommended): set the link's after-payment behavior
     to redirect to a private download URL on the landing host (an unguessable path,
     e.g. `/dl/<random>/reporadar-0.1.0.zip`). Rotate the path on each release.
   - Or attach the zip via a fulfillment email tool later. Do not block launch on
     automation; at launch volume, manually emailing the zip on each receipt is fine.

4. **Media / description parity**: keep the landing page as the sales surface (Stripe
   product pages are minimal). Use `docs/screenshots/demo-dashboard.png` and
   `docs/screenshots/portfolio-dashboard.png` on the landing; the Payment Link only
   needs the correct name + price.

5. **Refunds**: honor the landing's **14-day refund** promise manually from the
   Stripe dashboard (Payments → Refund). No setting needed up front.

6. **Wire the landing page**: replace the two placeholders in `landing/index.html`
   with the live Payment Link URLs (they look like `https://buy.stripe.com/<id>`):

   ```bash
   # from the repo root, once you have the real URLs:
   sed -i '' 's|STRIPE_LINK_REPORADAR_PRO|https://buy.stripe.com/PRO_ID|g'  landing/index.html
   sed -i '' 's|STRIPE_LINK_REPORADAR_TEAM|https://buy.stripe.com/TEAM_ID|g' landing/index.html
   grep -c STRIPE_LINK landing/index.html   # expect 0 after replace
   ```

   There are 5 `STRIPE_LINK_REPORADAR_PRO` placeholders (nav button, hero CTA, the
   Pro pricing button, the final CTA, and the footer "Buy" link) and 1
   `STRIPE_LINK_REPORADAR_TEAM` (the Team pricing button). Re-open the page locally
   and click each to confirm it lands on checkout.

   **The free tier needs no link work**: the "Clone & scan" button already points at
   the public repo, <https://github.com/Forgehaven-Labs/reporadar> (made public
   2026-07-01). The free funnel is `git clone` + `node bin/reporadar.js scan .`.

7. **Host the landing page**: it is fully static (`index.html` + `styles.css` +
   `favicon.svg`). See `DEPLOY_RUNBOOK.md` for the 5-minute Cloudflare Pages steps.
   Point `reporadar.dev` (the domain referenced in the copy) at it.

8. **Test the full path**: use a Stripe **test-mode** Payment Link first (toggle test
   mode, mirror the product, pay with `4242 4242 4242 4242`), confirm the redirect
   and the zip download, unzip on a clean machine, run a scan. Then create the live
   links and wire those in.

> **Gumroad backup (MoR):** if Stripe tax/compliance is more friction than wanted,
> create the same two products on Gumroad (it is the Merchant of Record, handles
> VAT, and hosts the file delivery natively). Same placeholders, same sed commands,
> Gumroad product URLs instead. Cost: flat 10% vs Stripe ~2.9% + $0.30 (+ Stripe
> Tax fee if enabled).

---

## 2. Three distribution ideas

1. **"Grade your repo" content loop (Show HN / Reddit / X).**
   The grade is the hook. Post a Show HN titled "RepoRadar — grade any repo A–F
   and get a Claude-ready fix plan (zero deps, safe on untrusted code)." Lead with
   a screenshot of a real F-grade dashboard and the generated fix plan. Cross-post
   to r/programming, r/devops, and r/ClaudeAI. The free scan is the call to
   action; the paid toolkit is the upsell in the README and on the landing page.
   Low cost, high fit because the artifact is inherently shareable.

2. **Bundle with the Claude Code / AI-coding audience.**
   RepoRadar's differentiator is the Claude fix plan, so sell where that audience
   already is: submit to AI-dev tool directories and newsletters (e.g. the Claude
   Code community, "awesome-claude" style lists, AI-coding newsletters), and
   record a 60-second loom: scan a messy repo → generate the fix plan → paste into
   Claude Code → re-scan to a better grade. That before/after demo is the whole
   pitch in one clip and is reusable as the landing-page hero video.

3. **Agency / consultant outreach (highest revenue per sale).**
   Engineering agencies and freelance "rescue this codebase" consultants get
   instant value from portfolio mode and a client-ready dashboard. DM or email a
   short list with a free audit of one of their public repos attached as the
   dashboard HTML. The ask: "$149 for the Team license and you can run this on every
   client repo and hand them a report with your own name on it." This is the least
   price-sensitive segment, and the Team/Agency tier is built for it.

---

## 3. Recommended price (and why)

**Free scan, Pro $39, Team/Agency $149. All one-time, no subscription.** Launch Pro at
$29 for the first ~50 buyers, then settle at $39.

- **One-time fits the value profile.** A repo scan is a finite job with no recurring
  server cost. A subscription would create churn for a tool people reach for
  occasionally; one-time removes friction and matches buyer expectation for a
  downloadable CLI.
- **Price against the outcome, not the build hours.** Pro replaces a 2-to-4 hour manual
  audit ($80–$160 of time) and then pays off again on every repo you own. Team replaces
  a half-day billable client audit ($300–$800), and its white-label report is a
  deliverable an agency can bill for, so a single engagement covers the $149 several
  times. The yardstick is what the buyer's outcome is worth, not "an hour of engineer
  time."
- **$29 launch price** lowers the bar for the first wave of buyers and reviews, which are
  worth more than the $10 difference early on. Move to $39 once you have a handful of
  testimonials and the demo video.
- **Don't discount to chase price-sensitive buyers.** They leave for free tools at any
  price, while the agency buyer judges on billable value and a cheap price reads as "not
  serious." Lead with proof and the free tier, not a lower number.

Free tier stays free forever (the live scan + grade) — it is the funnel, not a
line item.
