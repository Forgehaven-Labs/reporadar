# Go to market — RepoRadar

Everything needed to list and sell RepoRadar as a downloadable digital product,
short of creating the payment account itself. Pair this with `MONETIZATION.md`
(the model) and `scripts/package.sh` (the artifact builder).

**Recommended price: $39 one-time (launch price $29 for the first ~50 buyers).**
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

## 1. Lemon Squeezy listing — exact steps

> Prerequisite (the one gated thing, do this yourself): create the Lemon Squeezy
> account and a Store at <https://app.lemonsqueezy.com>. Everything below is the
> per-product setup once a store exists.

1. **Create the store** (if not done): Lemon Squeezy dashboard → *Stores* → set
   store name (e.g. "Forgehaven Labs"), currency **USD**, and your support email.
   Lemon Squeezy is the Merchant of Record, so it handles sales tax/VAT for you.

2. **New product**: Dashboard → *Products* → **New Product**.
   - **Name:** `RepoRadar — repo health grade + Claude fix plan`
   - **Type:** *Single payment* (one-time), **not** subscription.
   - **Price:** `2900` cents at launch (`$29`), planned to move to `$39`. Leave
     "Pay what you want" off.

3. **Deliver the files**: in the product editor, set **Fulfillment → Deliver a
   file** and upload `dist/reporadar-<version>.zip`. (Re-upload on each release;
   buyers can be emailed an updated download link from the *Orders* view.)
   - Optionally add a license-key generator (Settings → License keys) if you want
     keys for support/upgrade tracking. Not required for delivery.

4. **Description**: paste a tightened version of the landing copy — the hero line,
   the 7 dimensions, the Claude fix-plan differentiator, and the "static-only,
   safe on untrusted code" line. Add the system requirement: **Node 18+**.

5. **Media**: upload `docs/screenshots/demo-dashboard.png` and
   `docs/screenshots/portfolio-dashboard.png` as product images, plus a crop of
   the terminal output. These are the proof shots.

6. **Checkout settings**:
   - Enable **discount codes** and create `LAUNCH` for the intro price if you
     prefer a code over a base-price change.
   - Set the **receipt / confirmation message** to: "Thanks! Unzip and run
     `node bin/reporadar.js scan .` — Node 18+, nothing to install. Reply to this
     email for support." 
   - Turn on the **14-day refund** policy (matches the landing-page promise).

7. **Publish** → copy the product's **Checkout URL** (or a Buy Button / hosted
   checkout link). It looks like `https://<store>.lemonsqueezy.com/checkout/buy/<uuid>`.

8. **Wire the landing page**: replace every `LEMONSQUEEZY_CHECKOUT_URL`
   placeholder in `landing/index.html` with that checkout URL:

   ```bash
   # from the repo root, once you have the real URL:
   sed -i '' 's|LEMONSQUEEZY_CHECKOUT_URL|https://YOURSTORE.lemonsqueezy.com/checkout/buy/UUID|g' landing/index.html
   ```

   There are 5 placeholders (nav button, hero CTA, the Pro pricing button, the
   final CTA, and the footer "Buy" link). Re-open the page locally and click each
   to confirm it lands on checkout.

9. **Host the landing page**: it is fully static (`index.html` + `styles.css` +
   `favicon.svg`). Drop the `landing/` folder on Netlify, Cloudflare Pages, GitHub
   Pages, or any static host. Point `reporadar.dev` (the domain referenced in the
   copy and the free-edition banner) at it.

10. **Test the full path**: use Lemon Squeezy **Test mode** to run a $0 test
    order, confirm the zip downloads, unzip it on a clean machine, and run a scan.
    Then flip to live.

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
   dashboard HTML. The ask: "$39 once and you can run this on every client repo
   and hand them the report." This segment is least price-sensitive and seeds the
   future "team" tier.

---

## 3. Recommended price (and why)

**Launch at $29, settle at $39, one-time. No subscription.**

- **One-time fits the value profile.** A repo scan is a finite job with no
  recurring server cost. A subscription would create churn for a tool people
  reach for occasionally; one-time removes friction and matches buyer expectation
  for a downloadable CLI.
- **$39 anchors against the alternative.** The comparison is not other $5 CLIs;
  it is the hour a developer or agency spends manually auditing a repo and writing
  a remediation list. RepoRadar does that in seconds and writes the fix plan for
  an AI agent. $39 is an easy yes against an hour of engineer time.
- **$29 launch price** lowers the bar for the first wave of buyers and reviews,
  which are worth more than the $10 difference early on. Move to $39 once you have
  a handful of testimonials and the demo video.
- **Headroom above this:** a future **"Team / Agency" tier (~$149)** for orgs that
  want to standardize on portfolio mode is a natural fast-follow once the single
  price is validated. Do not launch it day one; validate the $39 first.

Free tier stays free forever (the live scan + grade) — it is the funnel, not a
line item.
