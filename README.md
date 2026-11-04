# Block Party

A complete, untimed 8-by-8 block puzzle built with React, TypeScript, and Vite. Drag, tap, or use the keyboard to fill rows and columns. Consecutive clears build combos; clearing multiple lines at once gives a larger bonus.

## Run

- `npm install`
- `npm run dev`
- `npm run typecheck` to check TypeScript
- `npm test` to run Playwright coverage
- `npm run build` to typecheck and create the production web app in `dist/`
- `npm run preview` to serve the production build
- `npm run cap:sync` to copy the production web app into Android
- `npm run android` to open the Android project in Android Studio
- `cd android; .\gradlew.bat assembleDebug` to build an APK with JDK and Android SDK 36 installed

## Controls

- Mouse: drag a shape, or click a shape and then its top-left destination cell.
- Touch: drag a shape above your finger, or tap a shape and then the board.
- `1`, `2`, `3`: choose a shape.
- Arrow keys: move the placement preview.
- `Enter`: place the selected shape.
- `Space`: rotate the selected shape. A Rotate button is also available.
- `P` or `Escape`: pause or resume.
- `R`: immediately restart. The previous round is saved to the high-score table.

The game pauses when its browser tab is hidden. Unfinished rounds, sound and haptic preferences, selected board theme and block finish, local statistics, and the ten best completed or restarted rounds are saved locally. The game remains playable offline. The daily challenge uses a date-seeded local round and never claims a global result. Profile, statistics, collection, settings, and a proposed cosmetic catalogue are available from the home shortcuts. Purchases remain disabled until Google Play Billing is configured. When Supabase is configured, a guest account and server-seeded session are used for scores submitted to the separate verified global leaderboard; local scores never appear there. Scores can be cleared from Best Runs.

## Sound and celebrations

All audio is synthesized with the Web Audio API, routed through a master compressor, and can be muted in the header. Selection and rotation have small tactile chirps; placement has a soft low “thock.” Clear fanfares rise with the size of the move, from a single **NICE!** line clear through **GREAT!**, **AMAZING!**, **INCREDIBLE!**, and **LEGENDARY!** for huge combo finishes. A personal best adds a trophy celebration and separate fanfare.

Bigger clears also add letter-by-letter praise animation, radiating rays, an expanding board ring, extra confetti particles, a score pop, longer screen shake, and stronger haptics on supported phones. Clearing more than one line or carrying a combo raises both the praise tier and the sound layering. The in-game help explains the full praise scale, and all decorative motion respects reduced-motion preferences.

## Verification

- `npx tsc --noEmit`
- `npx playwright install --with-deps chromium` for initial browser-test setup
- `npx playwright test` for engine, randomized gameplay, mouse, keyboard, mobile touch, persistence, and responsive-layout tests

The independent rules engine is in `src/game/engine.ts`. The application entry is `src/App.tsx`; synthesized audio and the requestAnimationFrame particle renderer live in `src/game/`. Motion respects the user's reduced-motion preference, and particle rendering stops when idle.

The original DM Sans font binary was missing from the repository, so the broken font request was removed and the app uses its system sans-serif fallback.

See [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) for the Android, backend, privacy, and store release status.

See [supabase/README.md](supabase/README.md) for global leaderboard setup, migrations, deployment, and security boundaries.

Playwright uses port `5197` to avoid colliding with other local development servers. Mobile-sized screen captures are written to `artifacts/screenshots/`.
