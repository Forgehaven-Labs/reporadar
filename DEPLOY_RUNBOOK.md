# Deploy Runbook - RepoRadar landing (5 owner-minutes)

_Status 2026-07-01: `npx wrangler whoami` → **not authenticated** on this machine, and no
Cloudflare Pages project exists yet, so Claude could not deploy. Either path below takes
about 5 minutes. The landing is fully static (`landing/index.html` + `styles.css` +
`favicon.svg`), no build step._

## Before you deploy (once)

1. Replace the two Stripe placeholders with live Payment Links (see `GO_TO_MARKET.md` §1):
   ```bash
   cd ~/Documents/mvp-money-build/reporadar
   sed -i '' 's|STRIPE_LINK_REPORADAR_PRO|https://buy.stripe.com/YOUR_PRO_ID|g'  landing/index.html
   sed -i '' 's|STRIPE_LINK_REPORADAR_TEAM|https://buy.stripe.com/YOUR_TEAM_ID|g' landing/index.html
   grep -c STRIPE_LINK landing/index.html   # must print 0
   ```
2. Swap the placeholder domain once you know the real URL (works fine without this on day 1):
   ```bash
   sed -i '' 's|https://reporadar.example|https://YOUR-PROJECT.pages.dev|g' landing/index.html
   ```

## Path A - Cloudflare Pages drag-and-drop (no CLI, ~3 min)

1. <https://dash.cloudflare.com> → **Workers & Pages** → **Create** → **Pages** →
   **Upload assets** (direct upload).
2. Project name: `reporadar` (gives you `reporadar.pages.dev`).
3. Drag the `landing/` folder into the upload box → **Deploy**.
4. Open the URL, click every button: 5 Pro links, 1 Team link, and "Clone & scan" →
   <https://github.com/Forgehaven-Labs/reporadar>.

## Path B - wrangler CLI (~5 min, repeatable)

```bash
npx wrangler login                                   # one-time browser auth
npx wrangler pages project create reporadar --production-branch main
npx wrangler pages deploy landing --project-name reporadar
```

Redeploys after any landing edit: just re-run the last command.

## After deploy

- [ ] Tell Claude the live URL for a screenshot + click-through validation pass.
- [ ] Custom domain (optional): Pages project → Custom domains → add `reporadar.dev`.
- [ ] Set the Stripe Payment Link post-payment redirect to the download URL on this host
      (see `GO_TO_MARKET.md` §1 step 3).
