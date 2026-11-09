## 1. Role and Objective

You are a senior full-stack engineer and SaaS product architect. You will build this project in phases.

Build a multi-tenant SaaS platform named "taployal" (always written in lowercase) that lets any business (cafe, salon, shop, restaurant) create a digital loyalty card in its own visual identity and issue it to its customers. Customers add the card to Apple Wallet or Google Wallet with one tap, with no app download.

Brand tagline: "TAP. COLLECT. REDEEM." (English). Propose an Arabic tagline for my approval before using it anywhere.
Audience: small and medium businesses in the Gulf and the wider Arab world.
Business model: monthly subscription (limited free plan, Basic plan, Pro plan).
Languages: Arabic (default, RTL) and English, with a language toggle.

## 2. Users, Roles and Permissions

- Merchant Owner: creates the account and store, designs the card, manages branches, staff and rewards, views analytics, manages the subscription. Cannot see any other merchant's data.
- Staff: signs in with a PIN or an invitation link. Scans the customer's pass barcode, adds a visit or points, redeems a reward. Cannot view analytics, edit the card, or export data.
- End Customer: has no account and no password. Joins via QR, adds the card to their wallet, and receives updates through it.
- Super Admin: manages all merchants, plans and subscriptions, suspends accounts, views system health and audit logs. Two-factor authentication is mandatory.

Enforce permissions at the database level with Row Level Security keyed on merchant_id in every tenant table, not only in the UI.

## 3. User Journeys

Merchant journey:
1. Sign up with email and password (or Google) and verify the email.
2. Complete a 4-step setup wizard: store details, then logo upload and color selection, then card type (points or stamps) with stamp icon and reward rule, then a live preview of the card as it will look in Apple Wallet and Google Wallet.
3. Set the location of each branch with a map picker and write the optional "nearby" message.
4. Publish the card. The system generates a printable QR (A5 poster and table card) and a short join link.
5. Add staff by sending an invitation link or creating a PIN.
6. Monitor the dashboard, add rewards, and upgrade the plan when the free limit is reached.

Customer journey:
1. Scan the QR in the shop with the phone camera.
2. A lightweight join page opens in the store's branding: name field, mobile number field, optional email, and a privacy consent checkbox.
3. The system detects the device. iPhone shows the official "Add to Apple Wallet" badge. Android shows the official "Add to Google Wallet" badge. Desktop shows a QR to continue on mobile.
4. The card appears in the wallet with the customer's own QR barcode.
5. After the customer taps the wallet badge, show the "You're In!" success screen (green check icon, text "Your loyalty card has been added successfully." and a "View Card" button). "View Card" opens an unguessable-token web view of the card (first name, balance, stamps or points, QR) as a fallback for customers who dismiss the wallet sheet.
6. After every visit the card balance updates and a lock-screen message appears.
7. When the customer's phone finds itself near a store branch, the phone may surface the card on the lock screen with the merchant's nearby message.

Staff journey:
1. Open the staff web app (PWA) and sign in once per device with a PIN.
2. Tap "Scan Customer" to open the camera and scan the barcode from the customer's wallet.
3. The customer screen shows name, balance and available rewards.
4. Tap "Add Visit" (or enter the bill amount in points mode) and confirm.
5. If the customer reached a reward threshold, a distinctly colored "Redeem Reward" button appears.
6. A large success message shows within 2 seconds. Undo is available for 60 seconds.

Super Admin journey:
1. Sign in with two-factor authentication.
2. Search a merchant and review plan, subscription status and usage.
3. Suspend an account, extend a subscription, or change a plan manually. Every action is written to the audit log.
4. Monitor Apple and Google integration health (update queue, errors).

## 4. Page and Screen Map

Marketing site (public):
- Top navigation: logo, Features, How It Works, Pricing, About, FAQ, a gold "Get Started" button with an arrow, and an "AR | EN" language toggle.
- Home hero: headline "Turn Every Visit Into Lasting Loyalty", sub-text "Create and manage your digital loyalty program with ease. Add your customers' cards to Apple Wallet and Google Wallet in just one tap.", primary button "Start Free Trial" with arrow, secondary button "Watch Demo" with a circular play icon, and three trust badges: "Easy Setup", "Secure & Reliable", "Powerful Insights". The hero visual is a phone mockup plus a floating card using the sample merchant "Rivano Café".
- Below the hero: How It Works (3 steps: Tap, Collect, Redeem), Features, Pricing comparison of the three plans, FAQ, footer.
- Privacy Policy, Terms and Conditions.
- Sign in, Sign up, Password reset.

Merchant dashboard (sidebar order is fixed):
1. Overview: four KPI cards (Total Customers, Total Visits, Points Earned or Stamps Earned depending on mode, Rewards Redeemed), each with a percentage change versus the previous period; a line chart of visits over time; a "Top Reward" card; a date-range selector (Last 7 / 30 / 90 days).
2. Loyalty Program: the Card Builder (logo, colors, type, stamp icon, texts, live preview), the "Nearby Notification" panel (on/off switch, Arabic and English message fields max 80 characters with a live counter, and a lock-screen preview for iPhone and Android), and a QR and Print Materials tab (generate and download PDF). Broadcast messages to pass holders live here in Phase 2.
3. Customers: searchable and filterable list; customer detail page (transaction history, manual balance adjustment).
4. Rewards: create, edit, deactivate.
5. Staff: invitations, PINs, enable/disable, and Branches with a map picker (click or drag a pin, plus an address search field), an enable/disable toggle for location notifications, and a "featured" toggle per branch.
6. Analytics: visits, new customers and redemptions over time, top rewards, busiest days and hours; per-branch breakdown arrives in Phase 2.
7. Subscription: current plan, usage, upgrade, invoice history.
8. Settings: store details, language, data export.

Dashboard header: business name dropdown (account menu: profile, language, sign out), notification bell, user avatar. Switching between multiple businesses is Phase 2; in the MVP the dropdown shows the single business.

Staff app (PWA):
- PIN sign-in, Scan Customer, Customer and Action screen, last 20 operations, language toggle.

Customer join page:
- Join form, "You're In!" success page with the View Card button, token-protected card web view, "You already have this card" page.

Super Admin dashboard:
- Merchants, Merchant detail, Plans, Subscriptions and Invoices, Integration Health, Audit Log, Global Settings.

## 5. Features

Mandatory MVP:
- Merchant sign-up, setup wizard and card builder with points or stamps mode and a stamp icon picker.
- QR join page and issuance of an Apple Wallet pass and a Google Wallet pass.
- Staff PWA: barcode scan, add visit or points, redeem reward, undo.
- Automatic pass updates in both wallets after each transaction, with a lock-screen message.
- Location-Based Notifications: embed each branch's GPS coordinates inside the pass file so that the customer's phone itself decides when to surface the card on the lock screen near a store. Merchant controls: enable/disable per card, custom nearby message text, per-branch coordinates.
- Merchant dashboard: Overview, Loyalty Program, Customers, Rewards, Staff, Analytics (basic), Subscription, Settings.
- Three plans with enforced limits (customers, staff, branches) and monthly payment.
- Super Admin dashboard: merchants, subscriptions, suspension.
- Full Arabic RTL interface plus English, and the full taployal brand system described in Section 10.

Phase 2:
- Broadcast messages to pass holders.
- Tiered cards (Tiers).
- Multiple branches with separate analytics, and switching between multiple businesses in the dashboard header.
- Birthday rewards.
- Subdomain or custom domain for the join page.
- API and Webhooks for POS integrations.

Out of scope:
- Native iOS or Android app.
- POS or inventory system.
- Payment wallet or stored-value gift cards.
- Referral programs and email or SMS marketing.
- Customer password authentication.

## 6. Data Model

Every table has id (UUID), created_at and updated_at. Every merchant-owned table has merchant_id as an indexed foreign key.

- Merchants: id, name, slug (unique), logo_url, default_language, country, timezone, status (active/suspended), owner_user_id (FK to Users).
- Users: id (linked to the auth table), email, full_name, role (merchant_owner/staff/super_admin), merchant_id (FK, null for super admin), pin_hash (staff), is_active.
- Branches: id, merchant_id (FK), name, address, latitude (decimal), longitude (decimal), is_featured (boolean), location_priority (integer), location_enabled (boolean).
- LoyaltyCards (card design): id, merchant_id (FK), name, mode (points/stamps), stamps_required, stamp_icon (text key from the icon library), points_per_unit, background_color, foreground_color, label_color, logo_url, strip_image_url, terms_text, location_notifications_enabled (boolean, default true), nearby_message_ar (text, max 80 characters), nearby_message_en (text, max 80 characters), status (draft/published).
- Customers: id, merchant_id (FK), full_name, phone, email, consent_at, unique(merchant_id, phone).
- Passes: id, merchant_id (FK), card_id (FK to LoyaltyCards), customer_id (FK to Customers), joined_branch_id (FK to Branches, optional), serial_number (unique, random, unguessable), auth_token (hashed), web_view_token (hashed, unguessable), balance (points or stamps), apple_status, google_object_id, last_updated_tag, unique(card_id, customer_id).
- ApplePassRegistrations: id, pass_id (FK), device_library_id, push_token, created_at.
- Transactions: id, merchant_id (FK), pass_id (FK), branch_id (FK), staff_user_id (FK to Users), type (earn/redeem/adjust/undo), amount, reward_id (FK, optional), reverted_transaction_id (self FK, optional), idempotency_key (unique).
- Rewards: id, merchant_id (FK), card_id (FK), name, image_url (optional), cost (points or stamps), is_active.
- Redemptions: id, transaction_id (FK), reward_id (FK), pass_id (FK).
- Plans: id, code (free/basic/pro), price_monthly, max_customers, max_staff, max_branches, allows_broadcast, allows_location_notifications (boolean; default false for free, true for Basic and Pro).
- Subscriptions: id, merchant_id (FK), plan_id (FK), status (trialing/active/past_due/canceled), current_period_end, payment_provider_customer_id, payment_provider_subscription_id.
- Invoices: id, subscription_id (FK), amount, currency, status, provider_invoice_id.
- PushJobs: id, pass_id (FK), platform (apple/google), status, attempts, last_error.
- AuditLogs: id, actor_user_id (FK), merchant_id (FK, optional), action, entity, metadata (JSON).

Transactions is append-only. The balance in Passes is updated inside the same database transaction that inserts the Transaction row, and is never edited manually except through a transaction of type adjust.

## 7. Technical Stack

- Frontend: Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, with brand tokens from Section 10 defined once in the Tailwind theme. Chosen for SSR, easy RTL support and a mature component library.
- Fonts: loaded through next/font (Playfair Display, Inter, IBM Plex Sans Arabic, Noto Naskh Arabic).
- Icons: Lucide, line style.
- Charts: Recharts.
- Staff app: a PWA inside the same Next.js project with camera-based barcode scanning, to avoid a separate app.
- Backend: Next.js Route Handlers and Server Actions on the Node.js runtime (not Edge), because .pkpass signing and APNs require Node libraries.
- Database and auth: Supabase (PostgreSQL, Auth, Row Level Security, Storage for logos). RLS enforces tenant isolation at the data layer.
- Queues and background jobs: Upstash QStash or Supabase Queues for wallet update delivery with retries and rate limiting.
- Apple pass generation: the passkit-generator library.
- Server-side image generation (sharp or Satori) to render the stamp strip image for each pass, with the right number of filled and empty stamps.
- Google Wallet: the official Google Wallet API (Loyalty Class and Loyalty Object) with a Service Account.
- Maps (branch location picker): a map component with address search and a draggable pin, loaded only in the merchant dashboard.
- Payments: Tap Payments, Moyasar or PayTabs for monthly subscriptions in Gulf currencies, with Stripe as a secondary option for merchants outside the Gulf.
- Hosting: Vercel for the app, Supabase for data.
- Monitoring: Sentry for error tracking and structured logs for every wallet operation.

## 8. Apple Wallet and Google Wallet Technical Flow

8.1 External dependencies (state these explicitly in the project docs):
- A paid annual Apple Developer Program account owned by the platform.
- A Pass Type ID certificate and Apple's WWDR intermediate certificate.
- Apple Push Notification service (APNs) for pushing updates.
- A Google Wallet Issuer account, which requires Google approval before public launch.
Any outage or policy change on their side affects the product, so build a Wallet Provider Interface abstraction that separates platform logic from the wallet provider.

8.2 Unified certificate strategy (multi-tenant):
- Create one Pass Type ID for the platform (for example pass.com.taployal.card) under the platform's own account. No merchant extracts a certificate.
- Each merchant's branding is delivered through pass.json content (colors, logo, text, organization name set to the merchant's name), not through a separate certificate. Isolation between merchants is achieved through a unique serialNumber tied to a Passes record and merchant_id.
- Swappable alternative: use an external provider such as PassKit.io through its API, where the certificate lives on their side. Implement the first path by default and wrap the second behind the same Wallet Provider Interface.

8.3 Apple Wallet implementation steps:
1. Create the Pass Type ID and its certificate. Store the certificate, private key, password and WWDR certificate in server-side secrets only (never in the repo or a public database).
2. When a customer joins, create a Passes record with a long random serial_number and a random auth_token.
3. Build pass.json of type storeCard or generic containing: formatVersion, passTypeIdentifier, teamIdentifier, serialNumber, organizationName, description, card colors, fields (balance, customer name, next reward), a QR barcode that carries only the serialNumber (no personal data), webServiceURL, authenticationToken, and the "locations" array described in 8.5.
4. Generate the required images (icon, logo, strip) at 1x, 2x and 3x from the merchant's logo. In stamps mode, render the strip image dynamically from stamps_required, stamp_icon and the current balance (filled stamps in the card's accent color, empty stamps as outlines).
5. Create manifest.json with a SHA-1 hash of every file, then sign it with a detached PKCS#7 signature using the Pass Type ID certificate and the WWDR certificate, producing the signature file.
6. Zip everything into a .pkpass bundle and serve it with content type application/vnd.apple.pkpass.
7. Implement the Web Service Apple calls, with the five standard endpoints: register a device (POST), unregister a device (DELETE), list passes updated since a given tag (GET), fetch the latest version of a pass (GET), and log errors (POST). Validate the Authorization header (ApplePass scheme) against auth_token.
8. When a balance changes: update last_updated_tag, then send an empty APNs push to every registered push_token for that pass, with the topic equal to passTypeIdentifier, over HTTP/2.
9. The device then calls the Web Service to fetch the new version (a freshly rendered strip image in stamps mode). Use changeMessage on the balance field to show a lock-screen message such as "Your balance is now %@".
10. Handle failures: retry with exponential backoff, delete any push_token that APNs reports as invalid, and log every failure in PushJobs.

8.4 Google Wallet implementation steps:
- Create a Loyalty Class per published card (in the merchant's branding) and a Loyalty Object per customer.
- In stamps mode, update the hero image of the Object with the rendered stamp strip whenever the balance changes.
- Generate the "Save to Google Wallet" link as a JWT signed with the Service Account key.
- When a balance changes, update the Object through the REST API and send a Message if needed.
- Include the "locations" field as described in 8.5.

8.5 Location-Based Notifications:
Critical architecture rule: the platform's server NEVER tracks, stores, receives or processes the customer's location. The location logic runs entirely on the customer's device and is driven by data baked into the pass.

1. Apple Wallet: add a "locations" array to pass.json. Each entry contains latitude, longitude, and a relevantText string (the message shown on the lock screen, for example "You are near [Store] - you have 3 stamps"). Optionally set maxDistance (meters) per pass to tune the trigger radius. Apple allows a maximum of 10 locations per pass; the iPhone itself monitors them and shows the pass on the lock screen when the customer is within range.
2. Google Wallet: set the "locations" field (latitude and longitude) on the Loyalty Class and/or Loyalty Object, up to 10 locations. Google Wallet and Google Play services on the device decide when to surface a nearby notification.
3. Both platforms control display timing and frequency. Do NOT promise or display guaranteed delivery, exact trigger distance, or exact timing anywhere in the UI or marketing copy. Use wording such as "may appear when your customers are near your store."
4. The platform receives no signal when a notification is triggered. Do NOT build trigger analytics, "notifications shown" counters, or geofence event tracking. Show only real data (visits and redemptions recorded by staff).
5. The customer controls this feature on their own device (wallet lock-screen suggestions and location/notification settings). If they disable it, nothing happens. Never ask the customer for location permission on the join page and never request their location from the browser.
6. Selection rule when a merchant has more than 10 enabled branches: include the branch where the customer joined first (joined_branch_id), then branches flagged "featured", then the rest by location_priority, up to the platform limit of 10.
7. Because locations live inside the pass, changing a branch's coordinates or message must trigger the normal update flow for all affected passes (Apple: bump last_updated_tag and send an empty APNs push; Google: update the Loyalty Object/Class via REST API). Queue these updates in batches with rate limiting, since one branch edit can affect thousands of passes.
8. Validate coordinates: latitude between -90 and 90, longitude between -180 and 180, and reject (0,0). Provide a map picker in the dashboard so the merchant never types raw coordinates.
9. Apply plan gating: only plans with allows_location_notifications = true can enable the feature; the free plan sees an upgrade prompt.

## 9. Security and Compliance

- Encrypt data in transit (HTTPS mandatory, HSTS) and at rest (database and storage encryption).
- Keep secrets (Apple certificates, Google key, payment keys) in the hosting platform's secret manager only. Rotate them, and alert 60 days before certificate expiry.
- Enable RLS on every table and test that one merchant can never read or modify another merchant's data.
- Hash PINs, auth_token and web_view_token values with a strong algorithm. Never store them in plaintext.
- Apply rate limiting to: customer join, sign-in, barcode scan, the card web view, and the Apple Web Service endpoints.
- Require an idempotency key on every transaction to prevent double-recording on poor connections.
- Enforce two-factor authentication for the Super Admin and make it optional for merchants.
- The pass barcode carries no personal data, only the serialNumber. The card web view shows only first name, balance and QR.
- Do not collect, log or store any customer location data. State this explicitly in the Privacy Policy and in the join page consent text.
- Branch coordinates are business data, not personal data, but they are visible inside the downloaded pass file. Tell the merchant this in the dashboard next to the map picker.
- Log every sensitive action in AuditLogs.
- Respect personal data protection: explicit consent at join, a privacy policy page, a delete-customer and export-data function, and alignment with the personal data protection laws of Bahrain, Saudi Arabia and the UAE.
- Automatic daily database backups retained for at least 14 days, and test a restore once before launch.
- Apply security headers (CSP, X-Frame-Options) and validate every input with a server-side schema.

## 10. Design: taployal Brand System

Principle: "simple enough that a cafe owner can use it without explanation." Every screen has one clear primary action, and no core journey exceeds 3 taps. The look is premium and calm: deep navy surfaces, generous spacing, large rounded containers, thin gold accent lines, and sparing use of gold.

10.1 Brand colors (define as design tokens once; use only these for the platform UI):
- Deep Navy #0B1F3B: sidebar, hero and dark sections, headings on light backgrounds.
- Teal #00A896: links, active states, chart lines, positive deltas, success states.
- Mint #E6F7F2: soft fills, chart area fills, selected rows, subtle highlights.
- Cream #FAFAF7: page background and light cards.
- Gold #D4AF37: primary call-to-action buttons on dark backgrounds, thin accent lines, key highlights. Never use gold for status messages.
- Neutrals: derive text and border greys from Deep Navy at reduced opacity.
- Status: success uses Teal, error #C0392B, warning #D97706, and every status always pairs color with an icon and a text label.
- Contrast: all text must meet WCAG AA against its background.

10.2 Typography:
- Latin headings: Playfair Display. Latin body and all UI text: Inter.
- Arabic headings: Noto Naskh Arabic (the serif counterpart, because Playfair Display has no Arabic glyphs). Arabic body and UI text: IBM Plex Sans Arabic.
- Sizes: hero 56 (desktop) / 36 (mobile), page title 28, section 20, body 16, note 13.

10.3 Logo and tagline:
- The logo is the stylized "T" mark (gold-to-teal folded ribbon) next to the lowercase wordmark "taployal" set in Playfair Display. Use the logo files I will upload. Until they are supplied, use a plain text wordmark placeholder and do not redraw the mark. Never write the name in capitals or title case in the UI.
- Show the tagline "TAP. COLLECT. REDEEM." in uppercase, wide letter-spacing, gold on navy, in the marketing header area only.

10.4 Layout and components:
- Radius: large containers 24px, cards 16px, buttons fully rounded (pill).
- Primary button on dark backgrounds: gold fill with navy text and a trailing arrow icon (mirrored in RTL). Primary button on light backgrounds: navy fill with cream text. Secondary button: outlined in navy. Circular icon button: navy fill with a cream play icon.
- Sidebar (dashboard): Deep Navy, 240px wide, collapsible on tablet, active item highlighted with a Mint tint and a Teal indicator. Items in this exact order: Overview, Loyalty Program, Customers, Rewards, Staff, Analytics, Subscription, Settings.
- KPI cards: cream card, icon in a Mint circle, large number, label, and a small percentage delta (Teal with an up arrow when positive, red with a down arrow when negative).
- Charts: Teal line with a Mint area fill, no heavy gridlines.
- Icons: Lucide line icons at 1.5px stroke. The brand set includes star, gift, trophy, credit card, bar chart and settings.
- Also include: sortable and searchable tables, forms with instant validation, status badges, confirmation dialogs, toast notifications, and empty states with one sentence and one action button.
- Wallet badges: use the official "Add to Apple Wallet" and "Add to Google Wallet" badges as published by Apple and Google, unmodified.
- Success screen: large Teal check inside a ring with small radiating accent strokes, the title "You're In!", a one-line message, and a navy "View Card" button.
- Demo and seed data: use the sample merchant "Rivano Café" (coffee-cup stamp icon) for marketing mockups, screenshots and seed data.

10.5 RTL and bilingual rules:
- RTL first: use logical CSS properties (margin-inline, padding-inline) instead of left/right, mirror directional icons and arrows, and use Western digits (0-9) everywhere.
- The language toggle ("AR | EN") is available in the marketing header, the dashboard account menu, the staff app and the join page. The join page defaults to the merchant's default language.

10.6 Merchant card design (separate from platform branding):
- The platform brand applies to the platform UI only. The wallet pass uses the merchant's own logo and colors.
- Offer a default pass template in the taployal look (navy background, gold accents, stamps in a row) so a merchant without a brand can publish immediately.
- The Card Builder includes a stamp icon picker (coffee cup, scissors, shopping bag, fork and knife, star, and similar) and a live preview that mimics Apple Wallet and Google Wallet.
- Nearby message guidance in the UI: short, action-oriented, max 80 characters, with a one-tap default template in Arabic and English.

10.7 Staff app and performance:
- Staff app: buttons at least 56px tall, large type, a full-screen Teal success screen, designed for one-handed phone use.
- Accessibility: keyboard support and clear field labels.
- Performance: the join page is under 100KB and loads in under 2 seconds on 4G.

## 11. Acceptance Criteria

Brand system:
- All platform colors and fonts come from the tokens in Section 10; no other hex value or font family appears in platform UI code.
- Arabic pages render headings in Noto Naskh Arabic and body in IBM Plex Sans Arabic with no fallback glyphs.
- The sidebar items match the exact order in Section 4 and the marketing hero matches the specified copy and buttons.

Card builder:
- The preview updates instantly when a color, logo or stamp icon changes.
- Publishing is blocked without a logo, a name and a reward rule.
- Both modes (points/stamps) work and render correctly in .pkpass and Google Wallet, and the stamp strip shows the correct number of filled stamps.

Joining:
- Scanning the QR and adding the card to the wallet takes under 30 seconds.
- A duplicate mobile number for the same merchant does not create a second card; the existing one is shown again.
- iPhone receives a .pkpass that Wallet accepts, and Android receives a working Google Wallet link.
- The "You're In!" screen and the token-protected card web view work, and an invalid or expired token shows a generic error without revealing whether the card exists.

Staff app:
- Reads the barcode in under 2 seconds in normal lighting.
- Double-tapping "Add" does not record two transactions (idempotency).
- Undo within 60 seconds restores the balance and updates the pass.
- A staff member from another merchant cannot scan this merchant's pass (rejected with a clear error).

Live updates:
- After a visit is recorded, the pass balance updates on Apple Wallet and Google Wallet within 10 seconds under normal conditions.
- A lock-screen message appears in Apple Wallet when the balance changes.
- An APNs or Google failure is retried at least 5 times and logged.

Location-Based Notifications:
- A merchant can set a branch location with the map picker and the saved latitude and longitude match the pin within 5 meters.
- A newly issued .pkpass contains the "locations" array with the merchant's enabled branches, capped at 10, and the relevantText equals the merchant's configured message.
- A newly issued Google Wallet pass contains the "locations" field with the same branches, capped at 10.
- Disabling location notifications on a card removes locations from newly issued passes and triggers an update that removes them from existing passes within 10 minutes.
- Editing a branch's coordinates updates all existing passes through the queue without errors and without blocking the dashboard.
- No server endpoint, database table or log contains any customer location.
- The free plan cannot enable the feature and sees an upgrade prompt.
- On a real iPhone and a real Android device, walking into range of a test location surfaces the card on the lock screen or as a notification. (Manual test, documented; timing is controlled by the OS and is not an automated pass/fail criterion.)

Merchant dashboard:
- Overview figures match the sum of Transactions.
- No customer or transaction from another merchant appears on any page.

Subscriptions:
- Exceeding the free plan limit blocks adding new customers and shows an upgrade button, without deleting data.
- A successful payment activates the plan immediately; a failed payment sets the account to past_due with a 7-day grace period.

Super Admin:
- Suspending a merchant stops the staff app and join page for that merchant within one minute, while customers' existing passes remain.
- Every Super Admin action appears in AuditLogs.

Interface:
- Every screen works correctly in RTL at 360px width and above.

## 12. What You Must Not Do

- Do not build a native mobile app, a POS system, or stored-value gift cards.
- Do not add marketing features (SMS, email, referrals) or AI features beyond what is listed.
- Do not ask merchants to extract an Apple certificate or hold an Apple or Google account.
- Do not store Apple certificates, Google keys or payment keys in code, the repo or the frontend.
- Do not put personal data inside the pass barcode.
- Do not require customers to create an account or password.
- Do not build server-side geofencing, customer location tracking, location history, or location-based analytics.
- Do not request browser or device location permission from customers.
- Do not describe location notifications as "push notifications" or promise guaranteed delivery.
- Do not redraw or alter the logo, change the brand palette, or introduce other fonts or colors into the platform UI.
- Do not modify the official Apple Wallet and Google Wallet badges.
- Do not go beyond the MVP before the first and second phases are approved.
- Do not use libraries or services outside the specified stack without asking me first.
- Do not edit a customer's balance directly without a recorded transaction.
- Do not write generic interface text such as "beautiful UI"; follow the specifications above exactly.

## 13. Suggested Implementation Order

Phase 0, Foundation: Next.js, Supabase and Tailwind project; brand tokens, fonts and RTL; authentication; roles; RLS policies; table schema. Deliverable: sign-in for every role with isolation proven by a test, and a style page showing every brand token and component.

Phase 1, Card builder and merchant: setup wizard, card builder with live preview and stamp icon picker, branch coordinates with the map picker, the Nearby Notification panel, staff and rewards. Deliverable: a merchant publishes a card with branch locations and gets a QR and a join page.

Phase 2, Google Wallet: Issuer, Loyalty Class and Object (including the locations field and the stamp hero image), customer join on Android, balance updates. Deliverable: a working, updating card on Android.

Phase 3, Apple Wallet: unified certificate, .pkpass generation (including the locations array and the dynamic stamp strip), Web Service, registration, APNs push. Deliverable: a working, updating card on iPhone with a lock-screen message.

Phase 4, Staff app: PWA, barcode scanning, add visit, redeem reward, undo. Deliverable: a full cycle from joining to reward redemption, ending on the "You're In!" and card web view screens.

Phase 5, Merchant dashboard and analytics: Overview KPI cards and chart, Customers, Analytics, export. Deliverable: correct figures matching transactions.

Phase 6, Subscriptions and Super Admin: plans, payments, limit enforcement, admin dashboard, audit log. Deliverable: a full subscription cycle and merchant suspension.

Phase 7, Launch: marketing site per the Section 4 hero and navigation spec, security hardening, backups, monitoring, acceptance tests, and the real-device location test on both platforms. Deliverable: a completed launch checklist and a platform ready for the first 10 merchants.

Before starting, ask me about any ambiguity in the requirements, then wait for my approval.
