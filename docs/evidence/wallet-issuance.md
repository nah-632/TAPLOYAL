# Evidence — wallet pass issuance (WalletWallet)

**Date:** 2026-11-10 · **Commits:** `b91585e`, `ada1bc7`, `f2a7db6` · **Deployment:** `succeeded` (`stage: live`)
**Live origin:** https://taployal-rvoepg.cranl.net

Everything below was executed against the live deployment or the live database.
Nothing in this file is expected behaviour that was not run.

---

## 1. The migration that was reported applied and was not

`drizzle/0007_wallet_provider.sql` was described as applied in the previous
handover. A direct read of the live schema returned:

```
wallet columns on passes: []            # expected 7
app_*_wallet functions:   []            # expected 3
```

The committed wallet code would have failed at runtime while every test passed —
the rest of the suite did not touch the wallet tables. `0007` was applied, then
verified in a **separate, later** call (the rule that exists because of exactly
this failure mode). Two more migrations followed:

| Migration | Contents |
|---|---|
| `0008_apple_pass_read.sql` | `app_apple_pass_by_token(text)` — SECURITY DEFINER, token-scoped read of the signed `.pkpass` |
| `0009_wallet_pass_branding.sql` | `app_pass_wallet` additionally returns `out_primary_color` |

## 2. Defects found and fixed before release

| # | Defect | Why it mattered |
|---|---|---|
| 1 | `getApplePass()` selected from `passes` directly | The runtime role is `taployal_app` under FORCE RLS and a card visitor has no tenant context, so the query matched **zero rows**: every `.pkpass` download would have 404'd in production while looking correct in review. Now goes through `app_apple_pass_by_token`. |
| 2 | No provider field limits enforced | `logoText` ≤ 64, `description` ≤ 128, `organizationName` ≤ 64, field labels ≤ 64 and values ≤ 256 are hard 400s upstream. A long merchant name would have silently blocked issuance. All strings are now clipped. |
| 3 | Google save URL redirected to unvalidated | A stored value we redirect to is an open-redirect sink. Now restricted to `https://pay.google.com` / `https://wallet.google.com`. |
| 4 | `/c/[token]` double-encoded its token | Next returns a dynamic **path** segment still percent-encoded while a **query** parameter arrives decoded. Encoding it again turned `%2B` into `%252B`, so the hash never matched and every wallet link **and the QR code** 404'd. Most base64 tokens hit this (they end in `=` and often contain `+` or `/`). Found by reading the rendered `href` in a real browser — every server-side check was green. |
| 5 | `next.config.ts` declared every response publicly cacheable | The blanket `/:path*` rule matched `/api/**` and Next's `headers()` **overrides** a route handler's `Cache-Control`, so the wallet routes' explicit `private, no-store` went out as `public, s-maxage=60`. Not theoretical: the platform edge answered `x-ggp-cache: HIT` while serving a signed `.pkpass` and the pass-status JSON. `/api`, `/dashboard`, `/onboarding`, `/c` are now `private, no-store` (bare route **and** children, plus `CDN-Cache-Control`). |

## 3. Live wallet flow — observed results

Token from a real browser join of `/j/tenant-a` (`tenant-a` / "A card" / 8 stamps):

```
GET  /api/wallet/<token>        200  configured:true issued:true hasApple:true
                                     provider:"walletwallet" googleUrl:…, shareUrl:…
POST /api/wallet/<token>        200  identical body — idempotent, no second provider call
GET  /api/wallet/<token>/apple  200  content-type: application/vnd.apple.pkpass
                                     cache-control: private, no-store, max-age=0
                                     5358 bytes, first two bytes "PK" (a real signed bundle)
GET  /api/wallet/<token>/google 302  location: https://pay.google.com/gp/v/save/eyJhbGciOi…
```

**Independent quota check** (`GET https://api.walletwallet.dev/api/auth/usage`):

```json
{"count":2,"limit":1000,"remaining":998,"plan":"trial","resetDate":"2026-12-01"}
```

Count 2 = one shell smoke test + one customer. The customer's pass was requested
by several page loads, a GET and a POST and still consumed **one** unit, which is
the idempotency claim proven by an external counter rather than by our own cache.

**Privacy in the issued pass** — decoded from the Google save JWT:

```
hexBackgroundColor: #18181b   (the "dark" preset, derived from the merchant's colour)
barcode value:      TPBBB8B356F21268F82E   (our card serial — no personal data)
الاسم / Huda                                  ← first name only, never "Huda Wallet"
```

## 4. Desktop branch and the QR

Rendering the card page with a desktop user agent produced both wallet links and
a QR, with links single-encoded (`%2B`, no `%252` anywhere in the DOM). The QR
image was extracted and decoded with the Vision framework:

```
payload: https://taployal-rvoepg.cranl.net/c/<card-token>
symbology: VNBarcodeSymbologyQR
```

The token itself is redacted here on purpose: it is a live capability URL, and this
repository is public. The value that mattered in the check was the **shape** —
that the token inside the QR is single-encoded (`%2B`, never `%252B`) and that the
origin matches `APP_URL`.

Layout QA on the same page: `dir=rtl`, `lang=ar`, horizontal overflow `0`,
broken images `0`, Arabic body font loaded.

## 5. Cache-headers regression test

`test/security/cache-headers.test.mjs` asserts the **deployed** headers. Run
against the pre-fix deployment it reported **6 failures**; against the current
deployment, **10 assertions · 0 failed**. Private routes report
`private, no-store, max-age=0` with `edge=MISS`, while `/` keeps
`s-maxage=60` and a hashed asset keeps `max-age=31536000, immutable` — so the
check cannot pass by the whole site becoming uncacheable.

The edge's own verdict is reported, not asserted: it is platform behaviour we
cannot change, and a permanently red suite would be noise rather than signal.

## 6. Full suite result

```
unit          26 assertions · 0 failed
isolation     33 assertions · 0 failed   (canary detected)
engine        18 assertions · 0 failed
onboarding     6 assertions · 0 failed
wallet        21 assertions · 0 failed   (new, live database)
cache headers 10 assertions · 0 failed   (new, live HTTP)
guards        check-tokens · check-logical-css · check-routes · tsc --noEmit — clean
```

### Test defect corrected, not silenced

`isolation.test.mjs` phase 4 asserted a **global** `count(*) FROM merchants = 2`,
which coupled the suite to unrelated production data: once two real merchants
existed on the deployment it reported a cross-tenant leak that was not one. The
invariant is "RLS stops filtering for a super admin", so the assertion is now
scoped to the fixtures — the same strength for what is being proven, and immune to
live data. The unfiltered count is still printed as a sanity signal.

## 7. Honest notes

- The provider key is a **trial** account (1000 passes/month, expires
  2026-12-10). Only Free-plan-safe fields are sent (`colorPreset`, field arrays,
  `organizationName`, `sharingProhibited`), so nothing breaks when the trial ends.
- No Apple or Google **badge artwork** is shipped. Both vendors require their
  official assets and shipping a redrawn badge violates those guidelines; the
  official files are not in this repository. The action is presented in
  taployal's own words and colours, and the underlying function is identical.
- **Live pass updates are not implemented yet.** The provider supports
  `PUT /api/passes/<serial>` and no code calls it, so a balance change does not
  yet reach an installed pass. The pass installed today shows the balance at
  issuance.
- The QR points at our own `/c/[token]` rather than the provider's `shareUrl`, so
  the journey stays on our domain; `shareUrl` is stored and unused.
