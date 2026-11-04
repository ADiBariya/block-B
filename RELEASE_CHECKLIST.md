# Block Party release checklist

Status as of November 4, 2026. The local-first app UI and Capacitor source are implemented. Android packaging and device validation are blocked in this environment because Java, Android SDK files, and ADB are not installed or available.

## Implemented

- [x] Existing React and TypeScript app and 8×8 game preserved
- [x] Offline play, touch and mouse dragging, tap placement, rotation, scoring, combos, pause/resume, local save/restore, and game-over flow
- [x] Home shortcuts for Play, Daily Challenge, Global Leaderboard, Profile, Statistics, Collection, Shop, and Settings
- [x] Daily Challenge uses a local date seed and clearly stays device-local
- [x] Profile and aggregate local statistics; playtime is explicitly marked not tracked
- [x] Locally persisted board themes and block finishes
- [x] Proposed cosmetic shop catalogue with purchases disabled until Google Play Billing is configured
- [x] Sound, haptics, and motion preferences; privacy and app version information
- [x] All-time verified global rankings retained; weekly tab is explicitly unavailable and no sample rankings are shown
- [x] Adaptive launcher icon and Android 12+ splash use Block Party's four-block brand mark
- [x] Android package ID `com.blockparty.game`; compile and target SDK 36; Capacitor app, haptics, splash, and status bar plugins
- [x] Mobile-sized browser screenshots saved in `artifacts/screenshots/` for visual review; these are not Android-device screenshots
- [x] Playwright's local server moved to port 5197 to avoid colliding with other apps on 5173

## Verification recorded

- [x] `npm run typecheck`
- [x] `npm run build`
- [x] `npm run cap:sync`
- [x] Original 28 Playwright tests preserved; five local-screen checks and one screenshot check added
- [x] Final Playwright run: 33 passed, 1 skipped (the live Supabase test requires explicit test credentials)
- [x] Previous Phase 2 local database verification: 12 pgTAP assertions and Supabase Edge/Auth/Realtime integration passed

The live Supabase Playwright test is skipped unless `SUPABASE_TEST_URL` and `SUPABASE_TEST_PUBLISHABLE_KEY` are set.

## Blocked or still needed

- [ ] Android debug APK: blocked because `java`/`JAVA_HOME` is missing and Android SDK 36 is not present at the configured SDK path. Expected output after building: `android/app/build/outputs/apk/debug/app-debug.apk`.
- [ ] Emulator or physical-device testing: ADB is unavailable and no device could be enumerated. Browser mobile emulation is not a substitute for device testing.
- [ ] Production Supabase project deployment, anonymous Auth configuration, migration and Edge Function deployment, and production Realtime verification. No production credentials were provided; none were used or deployed in this phase.
- [ ] Signed release AAB and Play Store submission. Signing credentials and Google Play configuration are not available.
- [ ] Account linking/recovery for guest users who clear app data or reinstall.
- [ ] Google Play Billing, privacy policy, Data safety form, content rating, Play store artwork, and internal testing.

Replay verification checks that a score follows the seeded rules and recorded moves. It does not prove a human played or prevent valid bot play. Production rankings remain unconnected until the backend is deployed.

## Next Android build steps

1. Install a supported JDK and Android Studio with Android SDK Platform 36 and platform tools.
2. From the repository root, run `npm run typecheck`, `npm test`, `npm run build`, and `npm run cap:sync`.
3. Run `cd android; .\gradlew.bat assembleDebug`; verify `android/app/build/outputs/apk/debug/app-debug.apk`.
4. Install on Android devices at small and standard screen sizes. Check launch/splash, touch drag, background/resume, back button, rotation, sound, haptics, safe areas, and offline play.
5. Configure Play App Signing and billing only after their product flows and disclosures are ready.

Do not describe the APK as built or device-tested, or an AAB as signed, until those checks actually pass.
