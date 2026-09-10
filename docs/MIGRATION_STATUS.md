# Bajanmarket Migration Status

## Safety state

- Current Lovable production project remains untouched.
- New repository: `bajanmarket/bajanmarket-web`.
- `main` contains only the repository bootstrap.
- `migration/staging` contains migration-safe environment handling.
- `migration/algorithm-v1` contains the first isolated Algorithm V1 scoring work.
- No DNS, live-domain, or production deployment changes have been made.

## Source application

The current Lovable/GitHub source application is `bajanmarket/bajanmarketplacetest` and contains the complete marketplace application, including approximately 250 tracked files across UI, routes, Supabase migrations, payments, WhatsApp, seller growth, and buyer matching.

## Environment finding

The source repository has a committed `.env` file and points at a different Supabase project than the standalone production project. The new repository deliberately does not copy that file.

The new repo ignores `.env` and `.env.*` and includes `.env.example`. Production credentials must be supplied by the hosting environment.

## Supabase production

Connected Supabase project:

- Name: BajanMarket Production
- Status at audit: ACTIVE_HEALTHY
- Buyer algorithm tables found: `buyer_intents`, `buyer_activity_events`
- Feature flags found:
  - `buyer_intent_capture_enabled = false`
  - `buyer_recommendations_enabled = false`

Both algorithm flags remain OFF during migration.

## Algorithm V1

North Star objective:

`successful transaction probability × buyer intent × listing relevance × seller trust × local convenience − risk/spam penalties`

Initial buyer-signal defaults:

- completed transaction: +100
- seller message: +40
- contact click: +35
- favourite: +25
- repeat search: +18
- long listing view: +12
- listing view: +5
- impression: +1
- hide/not interested: -30
- report: -100

`src/lib/matching/northStar.ts` implements the first pure scoring layer and `northStar.test.ts` covers signal hierarchy, intent decay, locality weighting, and risk penalties.

## Remaining migration work

1. Transfer the complete application code from `bajanmarketplacetest` into the new repository without copying committed secrets.
2. Remove or replace Lovable-specific runtime dependencies where they are not needed outside Lovable.
3. Point the migrated application at BajanMarket Production through deployment environment variables.
4. Build and run the existing test suite plus Algorithm V1 tests.
5. Verify authentication, listings, images, messaging, payments, WhatsApp, admin, seller tools, and buyer-intent capture against the migrated environment.
6. Keep `buyer_recommendations_enabled` OFF until recommendation output is reviewed and approved.
7. Configure a staging deployment before any production-domain cutover.

## Current constraint

The connected GitHub API does not expose a repository-import/mirror operation, and cross-repository Git object reuse is rejected. Therefore the full codebase must be transferred through a repository-level Git operation outside the current connector or copied file-by-file through the connector. No production cutover should occur until that transfer and build verification are complete.
