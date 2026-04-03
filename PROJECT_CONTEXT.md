# Project Context — Secret Library App

**Last updated:** 2026-04-03 (v0.9.282, build 1282)

> This is a living briefing document. Claude must revise it continuously during work — see CLAUDE.md for the rules. A Stop hook will remind you if source files are newer than this file.

---

## What This Is

A custom React Native/Expo audiobook player app ("Secret Library") for a self-hosted AudiobookShelf server (~2,700 books). Not a fork of the official ABS app. Distributed via TestFlight (iOS) and Google Play internal testing + sideloaded APK (Android).

## Current State

Feature-complete, in daily use. Development focused on polish, performance, platform compliance, and i18n.

### What's Working
- Full audiobook streaming + download playback
- ExoPlayer on Android (Media3 foreground service) / expo-av on iOS
- Android Auto and CarPlay integration
- Real-time WebSocket progress sync across devices
- Offline listening with deferred sync
- Community + generative spine image system
- Book DNA recommendations ("Because You Finished")
- Chromecast support
- i18n framework with 11 language files (en, de, es, fr, it, ja, ko, nl, pt, ru, zh)
- Per-book playback speed, sleep timer, bookmarks
- Full-screen CD player UI

### Uncommitted Work (as of 2026-04-03)

There is a large batch of uncommitted changes (42 files modified, 24 new files). Key areas:

1. **i18n system** — `i18next` + `react-i18next` added. All user-facing strings across 15+ screens wrapped in `t()` calls. 11 locale files in `src/i18n/locales/`. Initializes in parallel with app startup.

2. **Native HTTP plugin + OIDC auth redesign** — New `plugins/native-http/` Expo config plugin (Kotlin + Swift) that makes HTTP GET requests without following redirects — needed because RN's `fetch()` returns opaque responses for `redirect:'manual'`. Used by `oauthService.ts` for proper OIDC mobile flow matching the official ABS Capacitor app: native HTTP captures the 302 + session cookie from `/auth/openid`, system browser handles IdP auth, native HTTP exchanges the code at `/auth/openid/callback` with the session cookie. Replaced the old WebView-based SSO approach which couldn't extract tokens from httpOnly cookies. `OAuthWebView.tsx` was deleted. `app.json` scheme is now `["secretlibrary", "audiobookshelf"]` (second scheme for OIDC redirect URI). **Currently building — needs iOS rebuild verification.**

3. **Android Auto fixes** — TOCTOU race crash fix, cold-start race condition fix, stale progress in browse data, sign-in prompt for unauthenticated state (Google Play rejection fix). Changes in both `plugins/android-auto/src/` and `android/` copies.

4. **Auth improvements** — Logout timeout (no more hanging), login screen pre-fills server URL, better error visibility with red-tinted error containers.

5. **Player performance** — Memoized ChapterItem/BookmarkItem, throttled slider animations, debounced chapter search, static keep-awake import.

6. **OAuth service rewrite** — `oauthService.ts` rewritten to use PKCE + native HTTP + system browser (see #2 above). Old WebView-based `OAuthWebView.tsx` deleted. `LoginScreen.tsx` simplified — `handleSsoLogin` now calls `oauthService.startOAuthFlow()` directly instead of managing WebView state.

7. **Download manager updates** — `src/core/services/downloadManager.ts` has 90+ lines of changes.

8. **Display settings expansion** — `DisplaySettingsScreen.tsx` grew by ~200 lines.

9. **PROJECT_CONTEXT.md + Stop hook** — This briefing document was created, CLAUDE.md was updated to mandate continuous updates, and a Stop hook in `.claude/settings.local.json` reminds Claude if source files are newer than this file.

### Recent Focus Areas (last ~5 sessions)
1. **Splash screen + spine loading overhaul** — Real progress bar via appInitializer callback, descriptive status text per step. Server-unreachable → login redirect. Spine prefetch behind splash: waits for community manifest match, prefetches first 12 visible spines (only books with known community/server spines). Community spine server serves pre-generated 800px small versions (`?h=800` → `-sm.webp`, ~17KB vs ~33KB). App always requests `?h=800` for community spines. Stable URLs built directly (no `apiClient` cache buster) prevent black flash on background refresh. 6s fallback if manifest stalls.
2. **Full-app code review + bug fixes** — 6 bugs fixed: iOS URLSession leak, barrel export build error, SleepTimerSheet i18n, sort label maps, Android Auto stale progress, iOS redirect inconsistency. BookmarksSheet + ChaptersSheet i18n completed.
3. **OIDC auth redesign** — Replaced WebView SSO with proper mobile OIDC flow (native HTTP plugin + system browser + PKCE)
4. **Android Auto stability** — Race conditions (TOCTOU fix), stale data, Google Play compliance
5. **Cover pinch-to-zoom polish** — `ZoomableCoverModal` now uses semi-transparent backdrop (80% opacity), smooth spring animation back to 1x before closing (pinch-out or double-tap), no more instant snap-to-center

### Known Issues / Tech Debt
- `package.json` version (0.9.261) is out of sync with `version.ts` (0.9.282)
- No CI/CD — builds are manual
- Large uncommitted diff (48+ modified files, 24 new) — needs to be committed and organized
- Full library scan over SSHFS takes ~9 hours — never trigger without explicit ask
- Non-English translations are LLM-generated — should be reviewed by native speakers before release
- No `i18next.d.ts` type declaration — `t()` key typos fail silently at runtime

---

## Key Architectural Decisions

1. **Expo config plugins for native code** — ExoPlayer (`plugins/exo-player/`), Android Auto (`plugins/android-auto/`), Native HTTP (`plugins/native-http/`), Chromecast, CarPlay. Source lives in `plugins/*/src/` (Kotlin) and `plugins/*/ios/` (Swift). Gets copied to `android/`/`ios/` by the plugin. After editing source, also copy to `android/`/`ios/` for builds without prebuild. For iOS, files must also be added to the Xcode project's compile sources (the config plugin does this during prebuild, but manual copies need manual Xcode project updates).

2. **Android Auto shares ExoPlayer's MediaSession** — no own player. `updatePlaybackState()` etc. in AndroidAutoModule are intentional no-ops.

3. **Seeking lock is critical** — `seekingStore.isSeeking` blocks position updates from audio engine. Without this, UI jitters during scrubs.

4. **Three-place favorites is intentional** — Books sync to server (SQLite), series/authors/narrators/genres are local-only (AsyncStorage).

5. **Community spine server is multi-instance** — matching uses ASIN/ISBN/hash, not ABS UUIDs.

6. **Upload keystore lost twice before** — at `android/upload.keystore`, backup at `~/Desktop/upload.keystore.backup`. Be careful with `expo prebuild --clean`.

---

## Build & Server Notes

See CLAUDE.md for the full pre-build checklist. Key: `expo prebuild` resets signing config, AndroidManifest needs `tools:node="remove"` entries, keystore must exist.

Server at `secretlibrary.org` (Oregon). Audio on 5TB Storage Box (Germany) via SSHFS. Three cache layers mask latency. Full server docs in `~/CLAUDE.md`. **Never trigger a full library scan unless explicitly asked.**

---

## Conventions

- Update `src/constants/version.ts` + `CHANGELOG.md` after changes
- Verify Metro bundling after import path changes (Jest mocks hide broken paths)
- `scale()` for responsive sizing, `minHeight: scale(44)` for touch targets
- Features don't import from other features — cross-feature code goes in `src/shared/`
- Keep this file updated continuously during work sessions
