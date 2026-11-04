# Supabase global leaderboard

This backend stores only scores accepted after replaying a server-issued seeded session against ruleset v1. Browser-local high scores are never uploaded as verified scores. Replay verification proves that a reported score follows the published rules and move history; it does not prove that moves were human-generated or make botting impossible.

Anonymous identities use Supabase Auth's persisted client session. They survive normal app/browser restarts while local app data remains; signing out, clearing app data, or reinstalling can make an anonymous identity unrecoverable. Account linking is a follow-up feature.

## Required project setup

1. Create a Supabase project and enable **Anonymous Sign-Ins** under Auth providers. Apply the migration before allowing players to sign in so the auth trigger can create their profile.
2. Enable Realtime Broadcast for the project (enabled by default on Supabase projects) and keep Realtime Authorization enabled.
3. From the repository root, link the Supabase CLI and deploy the migration and functions:

   ```powershell
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   supabase functions deploy start-session
   supabase functions deploy submit-score
   supabase functions deploy leaderboard-page
   supabase functions deploy change-username
   ```

4. Set server secrets in Supabase Edge Functions settings/CLI. Prefer current key names; the functions retain compatibility with legacy environment names:

   ```powershell
   supabase secrets set SUPABASE_PUBLISHABLE_KEY=sb_publishable_... SUPABASE_SECRET_KEY=sb_secret_...
   ```

   `SUPABASE_SECRET_KEY` is server-only. Never place it in `.env`, a `VITE_` variable, the Android bundle, or client code. Supabase's Edge environment also supplies `SUPABASE_URL`; configure it explicitly as a function secret only if your project does not inject it.

5. Copy `.env.example` to `.env.local`, then set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from the project Connect dialog. The publishable key is designed for client use; all competitive writes still go through authenticated Edge Functions.
6. Build/rebuild the Android app after setting Vite variables. Vite embeds public URL/key values at build time.
7. In Auth settings, configure abuse protection/CAPTCHA for anonymous sign-ups before a public launch. Anonymous identities are easy to create and are not a durable recovery method.

## Data and trust boundaries

- `players`: Auth user ID and case-insensitive unique username. An Auth insert trigger generates a unique `Party_...` username. Username changes are validated server-side, unique in PostgreSQL, and limited to once per 24 hours.
- `game_sessions`: server-generated UUID, unpredictable 32-bit seed, ruleset version, expiry, and one-time idempotency metadata. The player ID comes from the validated Auth JWT.
- `leaderboard_scores`: one verified record per session. RLS is enabled with no client write or read policies. Edge Functions use their server-only secret for verified inserts and ranking RPCs.
- `player_best_scores`: view of each player's highest verified score, with earliest accepted tie retained.
- `global_leaderboard_page`: server-side 50-row keyset pagination. Stable ordering is score descending, acceptance time ascending, then player UUID ascending. The response includes the player's rank/own best even when outside the fetched page.
- Realtime: inserts into `leaderboard_scores` emit a private `global-leaderboard` Broadcast. The client treats notifications as hints and refreshes the first page/current rank; it does not trust broadcast data as a ranking result.
- Edge Functions verify the caller JWT, session ownership, ruleset, expiry, action limit, legal placements, score, line count, move count, and game-over state. Session creation is serialized/rate-limited to five per player per ten minutes. The session submission RPC locks the session and makes retries idempotent.

## Local development and tests

```powershell
supabase start
supabase functions serve
npm run typecheck
npm test
```

`supabase start` applies local migrations. `supabase db reset` drops and recreates the local database, so use it only when you intend to erase local development data.

To run the live Playwright integration test against the local stack, pass its public settings into the test process without committing them:

```powershell
$localSupabase = supabase status --output env | ConvertFrom-StringData
$env:SUPABASE_TEST_URL = $localSupabase.API_URL.Trim('"')
$env:SUPABASE_TEST_PUBLISHABLE_KEY = $localSupabase.PUBLISHABLE_KEY.Trim('"')
npm test
```

The Playwright suite covers the deterministic engine/replay path, modified results, invalid moves, cursor deduplication, duplicate Realtime event handling, and the no-config/offline UI. With the live variables above, it also exercises anonymous Auth, Edge verification and idempotency, ranking/search, client write denial, username conflicts, and Realtime Broadcast against local Supabase. `supabase test db` runs the pgTAP RLS, uniqueness, idempotency, rate limit, and keyset pagination assertions.

## Release caveats

The current build is provisional until the migrations and functions are deployed to a Supabase project and tested with real guest accounts. Verified here means replay-consistent under ruleset v1. It is not a complete anti-cheat guarantee: a modified client or bot can still submit a valid legal move sequence. There is no account-linking UI yet.
