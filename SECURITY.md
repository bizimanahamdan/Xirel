# Security hardening notes

## Baseline

- Repository: `bizimanahamdan/Xirel`
- Inspected baseline: `95d652dbfde55035312f004db2b9249bdf17a01b` (`main`)
- This work is being kept on Arena's fixed session branch, `arena/4644a3db-xirel`; no changes are made to `main` and nothing is deployed automatically.
- The baseline had one logout test, no shared login limiter, a predictable JWT fallback, first-public-user administrator promotion, one-year auth cookies, direct user-row API responses, and a Stripe settings response that could include its stored secret. The server already used SQLite/libSQL with optional Turso and server-side admin procedures.

## Required production configuration

- `JWT_SECRET`: required in production. Use a unique random secret with at least 32 bytes of cryptographic strength; placeholder, repeated, sequential, or weak values are rejected. For example, generate one in a secure terminal with `openssl rand -base64 48` and store it in the hosting provider's secret manager. Do not put it in a `VITE_` variable, source control, browser code, or logs.
- `ADMIN_EMAIL`: set to an operator-controlled email before establishing the first administrator. It is optional by design: when absent, public registrations remain ordinary users.
- `SESSION_TTL_DAYS`: optional integer from 1 to 30; defaults to 7 days.
- `TRUST_PROXY_HOPS`: integer from 0 to 10. Render is configured for one trusted proxy hop. Set the exact value for the production proxy chain; use `0` when there is no trusted proxy.
- `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`: for multi-instance deployments, all instances must use the same shared Turso database and the same `JWT_SECRET`. A local SQLite file is appropriate only for a single instance with persistent storage. The checked-in Render blueprint uses the free plan without a persistent disk, so configure Turso before relying on it for production records; otherwise the local fallback can be lost on restart/redeploy.
- `SESSION_COOKIE_DOMAIN`: optional. Leave unset unless the storefront intentionally needs a shared parent-domain cookie; the default is host-only.

The app does not enable permissive CORS. The browser uses the same-origin `/api/trpc` endpoint. A strict CSP is intentionally not set because the storefront uses external product imagery and existing asset/script integrations; test a tailored policy before enabling one.

## Data returned by public APIs

Authentication and admin-user endpoints serialize an explicit allowlist; password hashes and database user rows are never returned. Payment-settings responses omit the stored Stripe secret and report only whether one is configured. Public product-review responses expose a first-name display label but not the reviewer's email or stable user ID. Supplier status endpoints return configuration booleans rather than tokens or keys.

## Safe first-administrator setup

### Fresh installation

1. Configure `ADMIN_EMAIL` to the operator's controlled email before opening registration.
2. Start the app and register that exact email through the normal registration flow.
3. The server performs a conditional, atomic database promotion only if no administrator exists. Publicly submitted role fields are ignored and new users are created as `user`.

The server also checks a configured `ADMIN_EMAIL` during startup. If that user already exists in an existing database and there is no administrator, only that configured account can be promoted. Existing administrator rows are never demoted by bootstrap. If an administrator already exists, the configured address is not promoted automatically. Do not remove existing administrator access while changing this configuration.

If `ADMIN_EMAIL` is missing, registration continues safely with ordinary user roles; it does not make the first registrant an administrator. A fresh installation with no `ADMIN_EMAIL` therefore has no public bootstrap path to admin access.

## JWT secret rotation procedure

There is no automatic key rotation or multi-key verification. Changing `JWT_SECRET` invalidates all sessions signed by the old key across every instance. Plan a controlled rotation:

1. Generate and store the new random secret in the production secret manager; do not place it in this repository or chat.
2. Schedule a maintenance window and notify operators that customers may need to sign in again.
3. Update the secret consistently for all instances and restart them together. Do not run overlapping instances with different session keys.
4. Verify login, logout, and admin access, then monitor authentication errors. Keep the old value only according to the hosting provider's secure rollback policy; do not silently restore it without understanding the session impact.

New sessions default to seven days. The verifier also enforces the configured maximum age for legacy one-year tokens; customers with older sessions may need to sign in again after rollout. No password hashes or password hashing settings are changed by this work.

## Rate limiting and persistence

- Login attempts are counted by a pseudonymous HMAC of IP, normalized account identifier, and the IP/account pair. Defaults: 8 attempts per pair, 20 per account, and 100 per IP in 15 minutes. Registration is limited to 20 attempts per IP per hour, and public support-chat calls to 30 per IP per 15 minutes.
- Throttling is temporary; expired attempts are allowed again. Successful login clears its account and pair counters but not the IP-wide counter. Passwords, hashes, raw emails, and raw IPs are not written to the limiter table or logs.
- Counters are stored in the existing SQLite/libSQL database, not solely in process memory. `authRateLimits` is an additive table created with `CREATE TABLE IF NOT EXISTS`; no existing records or tables are reset, dropped, truncated, or recreated. Expired rows are cleaned up periodically.
- For multiple app instances, use the same Turso database and JWT secret. If a production deployment uses a non-shared local file, each instance has an independent limiter; do not scale that deployment horizontally until it uses a shared database.

## Payment and supplier boundaries

- MoMo order amounts come from server-stored order totals, and the server checks MTN's status endpoint before changing an order to paid. A browser redirect or client-supplied `status` is not trusted.
- There is no Stripe webhook route in the inspected baseline. The Stripe PaymentIntent endpoint now takes an owned pending `orderId` and uses the server-side order total, but it does not mark an order paid. Do not treat a client-side Stripe success redirect as payment confirmation; a signed webhook or another trusted server-side confirmation flow is still required before enabling end-to-end Stripe checkout.
- Printify and CJ credentials remain server-side. CJ import values are re-fetched from CJ instead of trusting browser-supplied prices, titles, images, or variant identifiers. Integration status APIs return configuration booleans, not credentials.
- Stripe's existing secret field remains server-side in the database for compatibility. Its API responses are write-only/sanitized; the secret is not returned to the frontend. Database-at-rest encryption and secret-manager migration are outside this change.

## Known limitations and residual risks

- Guest checkout still auto-provisions an account for a previously unseen shipping email, with a random password, because the current order/session model relies on a user row. Guest checkout for an already registered email is rejected unless the customer authenticates, preventing takeover of an existing account by email alone. The app has no email-verification or password-reset flow, so account claiming/recovery for a newly supplied guest email remains incomplete.
- JWT sessions are stateless. Logout correctly clears the current browser's cookie, but a copied token cannot be revoked server-side and remains usable until its enforced maximum age/expiration.
- MoMo, Stripe, CJ, Printify, Cloudinary, and other external provider flows were not live-tested without their account credentials. No webhook behavior was found for Stripe.
- The request body parser retains the existing 50 MB JSON limit for base64 product-image uploads; individual uploaded raster images are capped at 20 MB. URL-encoded requests are capped at 1 MB.
- As of 2026-10-17, `npm audit` on the existing lockfile reports 27 advisories (5 low, 14 moderate, 5 high, 3 critical); `npm audit --omit=dev` reports 13 runtime-tree advisories (5 low, 5 moderate, 2 high, 1 critical). Notable runtime findings include `proxy-addr` below 2.0.8 (critical IP-spoofing advisory) and `drizzle-orm` below 0.45.2 (high SQL-injection advisory). No dependency upgrades were applied in this hardening change; review compatibility and remediate these findings in a separate, tested dependency update.

This document records operational guidance and known boundaries; it is not a claim that the application is fully secure.
