# Wezzet Pro setup

Everything ships switched off. Nothing is counted or blocked, and nobody can pay, until you do the steps below.

## 1. Stripe product
1. Sign in at https://dashboard.stripe.com (start in **Test mode**).
2. Product catalog → **Add product**: name "Wezzet Pro", recurring, **$5.00 USD monthly**. Save.
3. Copy the price ID (starts with `price_`).
4. Settings → Billing → **Customer portal**: turn on "Cancel subscriptions" and "Update payment methods". Save.

## 2. Webhook
1. Developers → Webhooks → **Add endpoint**.
2. URL: `https://wezzet.com/api/pro/webhook`
3. Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
4. Copy the signing secret (starts with `whsec_`).

## 3. Keys in Cloudflare
Cloudflare dashboard → Workers & Pages → **wezzet** → Settings → Variables and secrets → Production. Add as **Secret** (encrypted):

| Name | Value |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe secret key (`sk_test_…` while testing, `sk_live_…` for real) |
| `STRIPE_PRICE_ID` | the `price_…` from step 1 |
| `STRIPE_WEBHOOK_SECRET` | the `whsec_…` from step 2 |

Optional: `STRIPE_AUTOMATIC_TAX` = `on` if you turn on Stripe Tax (extra fee per transaction).

Then Deployments → latest → **Retry deployment** so the new values load. The /pro button changes from "Coming soon" to "Get Pro".

Never put these keys in the repo (it's public).

## 4. Test it (test mode)
1. Sign in on wezzet.com, open /pro, press **Get Pro**, pay with card `4242 4242 4242 4242`, any future date, any CVC.
2. /signin should show **Plan: Wezzet Pro** and a **Manage billing** link.
3. Cancel from Manage billing (cancel immediately). Plan goes back to Free.
4. When it works, repeat steps 1 to 3 in **Live mode** (new price, new webhook, live keys).

## 5. Turn the limits on
Add Pages variable `PRO_LIMITS` = `on` and redeploy. Remove it (or set `off`) and redeploy to turn limits off again.

Free daily caps (edit `WZ_FREE` in `_worker.js`): transcriber 15, remove background 20, noise remover 20, video clipper 30, AI chat 60 messages, AI image questions 20. AI Comms: 7 agents linked to one free account online at once (`WZ_FREE_AGENTS`). Converters and small tools are never metered.

Notes:
- Transcriber, remove background, noise remover and video clipper run in the browser, so their caps are soft (the page asks before each run).
- AI chat and image questions are enforced on the server. Called directly at /api/ai they're counted per IP.
- AI Comms agents not linked to an account aren't capped.
- To give someone Pro by hand: D1 console, `INSERT INTO wz_pro (uid, status, updated) VALUES (<user id>, 'active', strftime('%s','now'))`.

## Costs
Stripe: about 2.9% + 30¢ per charge (≈45¢ of each $5). Stripe does not handle sales tax/VAT for you unless you add Stripe Tax. Paddle or Lemon Squeezy act as merchant of record (they handle tax) for roughly 5% + 50¢ or more. Check current rates before launch.
