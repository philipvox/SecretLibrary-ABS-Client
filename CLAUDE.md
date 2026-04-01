# Claude Code Instructions

Quick reference for AI-assisted development on the AudiobookShelf mobile app.

**Current Version:** See `src/constants/version.ts`
**Changelog:** See `CHANGELOG.md`

---

## Before Making Changes

1. **Read relevant files first** - Never modify code you haven't read
2. **Check CHANGELOG.md** - Understand recent changes and patterns
3. **Update version** after changes in `src/constants/version.ts`
4. **Add changelog entry** documenting what you changed

---

## Project Overview

React Native/Expo audiobook player app for AudiobookShelf servers.

| Category | Technology |
|----------|------------|
| Framework | React Native 0.81 + Expo SDK 54 |
| Language | TypeScript (strict) |
| Navigation | React Navigation v7 |
| Server State | TanStack Query v5 |
| Client State | Zustand v5 |
| Storage | Expo SQLite + AsyncStorage |
| Audio | expo-av, expo-media-control |

---

## Project Structure

```
src/
├── constants/        # App constants (version.ts, layout.ts)
├── core/             # Foundation layer
│   ├── api/          # API client, endpoints
│   ├── auth/         # Authentication
│   ├── cache/        # Library cache
│   ├── hooks/        # Core hooks (useDownloads, useBootstrap)
│   ├── services/     # SQLite, downloads, sync
│   └── types/        # TypeScript definitions
│
├── features/         # Feature modules (18 total)
│   ├── player/       # Audio playback (largest - playerStore ~2000 lines)
│   ├── queue/        # Playback queue
│   ├── library/      # My Library screen
│   ├── downloads/    # Download management
│   ├── search/       # Search functionality
│   ├── home/         # Home screen
│   ├── browse/       # Browse/discover
│   ├── book-detail/  # Book detail view
│   ├── series/       # Series detail
│   ├── author/       # Author detail
│   ├── narrator/     # Narrator detail
│   ├── profile/      # Profile & settings
│   ├── automotive/   # CarPlay/Android Auto
│   └── ...
│
├── navigation/       # React Navigation setup
│   ├── AppNavigator.tsx
│   └── components/   # TabBar, MiniPlayer, NavigationBar
│
└── shared/           # Reusable code
    ├── components/   # ~25 UI components
    ├── theme/        # Design tokens (colors, spacing, typography)
    ├── hooks/        # Shared hooks
    └── utils/        # Utilities
```

---

## Key Files to Know

| File | Purpose |
|------|---------|
| `src/constants/version.ts` | Version tracking - UPDATE AFTER CHANGES |
| `CHANGELOG.md` | Change history - ADD ENTRY AFTER CHANGES |
| `src/features/player/stores/playerStore.ts` | Main player state (~2000 lines, heavily documented) |
| `src/features/queue/stores/queueStore.ts` | Queue management |
| `src/features/library/stores/myLibraryStore.ts` | User's library |
| `src/core/services/downloadManager.ts` | Download system |
| `src/core/cache/libraryCache.ts` | In-memory cache |
| `src/shared/theme/` | Design tokens |

---

## State Management Rules

| State Type | Tool | When to Use |
|------------|------|-------------|
| Server data | React Query | API responses, cached data |
| App state | Zustand | Player, downloads, preferences |
| UI state | useState | Form inputs, modals, toggles |

### Zustand Store Pattern

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useFeatureStore = create(
  persist(
    (set, get) => ({
      value: null,
      setValue: (v) => set({ value: v }),
    }),
    { name: 'feature-store', storage: createJSONStorage(() => AsyncStorage) }
  )
);
```

---

## Critical Patterns

### 1. Seeking Mode (Player)

The player has a critical seeking fix. When seeking (scrubbing or jumping chapters), position updates are blocked to prevent UI jitter:

```typescript
// In playerStore
isSeeking: boolean      // True during seek operations
seekPosition: number    // Position being sought to

// CRITICAL: Skip position updates while seeking
if (get().isSeeking) return;
```

### 2. Per-Book Playback Speed

Each book remembers its playback rate:

```typescript
bookSpeedMap: Record<string, number>  // { bookId: speed }
```

### 3. Non-Blocking Loading

Always show cached data immediately, load fresh in background:

```typescript
// Good - non-blocking
const cached = cache.get(id);
if (cached) showUI(cached);
fetchFresh(id).then(updateUI);

// Bad - blocking
const fresh = await fetch(id);
showUI(fresh);
```

### 4. Responsive Scaling

Use the `scale()` function for responsive sizing:

```typescript
import { scale } from '@/shared/theme';

const styles = StyleSheet.create({
  container: {
    padding: scale(16),
    minHeight: scale(44),  // Touch target minimum
  },
});
```

---

## Design System

### Colors

```typescript
import { colors } from '@/shared/theme';

colors.accent           // Gold #F3B60C
colors.backgroundPrimary // #000000
colors.textPrimary      // #FFFFFF
colors.textSecondary    // rgba(255,255,255,0.70)
```

### Spacing

```typescript
import { spacing, scale } from '@/shared/theme';

spacing.xs  // 4
spacing.sm  // 8
spacing.md  // 12
spacing.lg  // 16
spacing.xl  // 20
```

### Touch Targets

Always use `minHeight: scale(44)` for interactive elements (Apple HIG / Material Design requirement).

---

## Common Issues & Fixes

### Android Text Input Overflow

Always use `minHeight` not fixed `height`, and add vertical padding:

```typescript
// Good
searchContainer: {
  minHeight: scale(44),
},
searchInput: {
  paddingVertical: scale(4),
}

// Bad - causes text clipping on Android
searchContainer: {
  height: 40,
},
searchInput: {
  paddingVertical: 0,
}
```

### Touch Target Size

Add `hitSlop` to small buttons:

```typescript
<TouchableOpacity
  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
>
```

---

## Feature Module Pattern

```
features/{name}/
├── components/     # UI components
├── hooks/          # Data fetching hooks
├── screens/        # Screen components
├── services/       # Business logic
├── stores/         # Zustand stores (if needed)
├── types.ts        # Feature types
└── index.ts        # Public exports
```

**Rules:**
- Features should NOT import from other features
- Shared code goes in `src/shared/`
- Cross-feature communication via stores or navigation params

---

## Navigation Structure

```
AppNavigator
├── Login (unauthenticated)
└── MainTabs (authenticated)
    ├── HomeTab → HomeScreen
    ├── LibraryTab → MyLibraryScreen
    ├── DiscoverTab → BrowseScreen
    └── ProfileTab → ProfileScreen

Modal Stacks:
├── BookDetail, SeriesDetail, AuthorDetail, NarratorDetail
├── Search, Downloads, Stats, QueueScreen
├── PlaybackSettings, DataStorageSettings, DisplaySettings
└── CDPlayerScreen (full-screen player)

Global Overlays:
├── GlobalMiniPlayer (floating at bottom)
└── NavigationBar (custom tab bar)
```

---

## Commands

```bash
npm start              # Start Expo dev server
npm run ios            # Run on iOS simulator
npm run android        # Run on Android emulator
npx expo run:android   # Build and run Android
npx expo run:ios       # Build and run iOS
```

---

## Pre-Build Checklist (MANDATORY)

**ALWAYS run these checks before building an APK or AAB:**

### 1. Upload Keystore

The release signing keystore MUST exist at `android/upload.keystore`. Backup copy at `~/Desktop/upload.keystore.backup`.

```bash
# Verify keystore exists
test -f android/upload.keystore && echo "✓ Keystore OK" || echo "✗ KEYSTORE MISSING - restore from ~/Desktop/upload.keystore.backup"
```

**Signing properties** must be in `android/gradle.properties`:
```properties
RELEASE_STORE_FILE=../upload.keystore
RELEASE_STORE_PASSWORD=secretlibrary
RELEASE_KEY_ALIAS=upload
RELEASE_KEY_PASSWORD=secretlibrary
```

**Release signing config** must be in `android/app/build.gradle` (expo prebuild may reset this):
```gradle
signingConfigs {
    release {
        if (project.hasProperty('RELEASE_STORE_FILE')) {
            storeFile file(RELEASE_STORE_FILE)
            storePassword RELEASE_STORE_PASSWORD
            keyAlias RELEASE_KEY_ALIAS
            keyPassword RELEASE_KEY_PASSWORD
        }
    }
}
buildTypes {
    release {
        signingConfig project.hasProperty('RELEASE_STORE_FILE') ? signingConfigs.release : signingConfigs.debug
    }
}
```

### 2. AndroidManifest.xml Fixes

The manifest MUST include these `tools:node="remove"` entries to strip unwanted permissions/services from `react-native-carplay`:

```xml
<uses-permission android:name="androidx.car.app.MAP_TEMPLATES" tools:node="remove"/>
<uses-permission android:name="androidx.car.app.ACCESS_SURFACE" tools:node="remove"/>
<uses-permission android:name="androidx.car.app.NAVIGATION_TEMPLATES" tools:node="remove"/>
<uses-permission android:name="android.permission.ACTIVITY_RECOGNITION" tools:node="remove"/>
<!-- Inside <application>: -->
<service android:name="org.birkir.carplay.CarPlayService" tools:node="remove"/>
```

Without these, Google Play will reject the upload.

### 3. Android Auto Must Have

Verify these exist in `AndroidManifest.xml`:
- [ ] `<service android:name=".automotive.AndroidAutoMediaBrowserService"` declaration
- [ ] `<meta-data android:name="com.google.android.gms.car.application"` with `@xml/automotive_app_desc`

Verify file exists:
- [ ] `android/app/src/main/res/xml/automotive_app_desc.xml`

### 4. Quick Verification Command

```bash
# Full pre-build verification:
grep -q "AndroidAutoMediaBrowserService" android/app/src/main/AndroidManifest.xml && \
  test -f android/app/src/main/res/xml/automotive_app_desc.xml && \
  test -f android/upload.keystore && \
  grep -q "RELEASE_STORE_FILE" android/gradle.properties && \
  grep -q "CarPlayService.*tools:node=\"remove\"" android/app/src/main/AndroidManifest.xml && \
  grep -q "ACTIVITY_RECOGNITION.*tools:node=\"remove\"" android/app/src/main/AndroidManifest.xml && \
  echo "✓ All pre-build checks passed" || echo "✗ Pre-build check FAILED"
```

### 5. Build Commands

Only after verification passes:
```bash
# AAB for Google Play (internal testing or production):
cd android && ./gradlew bundleRelease

# APK for sideloading:
cd android && ./gradlew assembleRelease
```

Output locations:
- AAB: `android/app/build/outputs/bundle/release/app-release.aab`
- APK: `android/app/build/outputs/apk/release/app-release.apk`
- Mapping file (for Play Console): `android/app/build/outputs/mapping/release/mapping.txt`

### 6. After `expo prebuild`

Running `npx expo prebuild --platform android` will reset `build.gradle`. You MUST re-check:
- Release signing config in `build.gradle` (step 1)
- Manifest removal entries (step 2)
- The keystore file itself is NOT deleted by prebuild, but verify anyway

---

## Version Update Checklist

After making changes:

1. Update `src/constants/version.ts`:
   ```typescript
   export const APP_VERSION = 'X.Y.Z';
   export const BUILD_NUMBER = N;
   export const VERSION_DATE = 'YYYY-MM-DD';
   ```

2. Add entry to `CHANGELOG.md`:
   ```markdown
   ## [X.Y.Z] - YYYY-MM-DD

   ### Added/Fixed/Changed
   - Description of changes

   ### Files Modified
   - List of files changed
   ```

---

## Architecture Decisions

### Favorites Storage (Intentional Split)

Favorites are stored in three places by design:

| Type | Storage | Location | Syncs to Server |
|------|---------|----------|-----------------|
| **Books** | SQLite | `user_books.isFavorite` | ✅ Yes |
| **Series** | AsyncStorage | `myLibraryStore.favoriteSeriesNames` | ❌ No (local) |
| **Authors** | AsyncStorage | `preferencesStore.favoriteAuthors` | ❌ No (local) |
| **Narrators** | AsyncStorage | `preferencesStore.favoriteNarrators` | ❌ No (local) |
| **Genres** | AsyncStorage | `preferencesStore.favoriteGenres` | ❌ No (local) |

**Rationale:**
- **Books**: Core library content, syncs with AudiobookShelf server
- **Series**: Library organization feature, server doesn't support series favorites
- **Authors/Narrators/Genres**: Discovery preferences, used for recommendations

### Progress Storage Architecture

Progress is stored in the unified `user_books` SQLite table:

```typescript
interface UserBook {
  bookId: string;
  currentTime: number;     // Position in seconds
  duration: number;        // Total duration
  progress: number;        // currentTime / duration (0.0 - 1.0)
  currentTrackIndex: number;
  isFinished: boolean;     // True when progress >= 0.95
  progressSynced: boolean; // False = needs sync to server
  lastPlayedAt: string;
  // ... other fields
}
```

**Sync Flow:**
1. Player updates `currentTime` locally → `progressSynced = false`
2. `backgroundSyncService` detects unsynced progress
3. Sends to server via `progressService.updateProgress()`
4. On success: `progressSynced = true`
5. On app startup: `finishedBooksSync.fullSync()` reconciles with server

**Finished Books:**
- Automatically marked finished when `progress >= 0.95`
- Can be manually marked via "Mark as Finished" action
- `finishSource` tracks how it was marked: `'progress' | 'manual' | 'bulk_author' | 'bulk_series'`

### Player Store Architecture

The player feature uses a modular store architecture (refactored January 2026):

```
features/player/stores/
├── playerStore.ts        # Main orchestrator (2,156 lines)
├── playerSettingsStore.ts # Persisted settings
├── sleepTimerStore.ts     # Sleep timer state
├── speedStore.ts          # Per-book playback speed
├── bookmarksStore.ts      # Bookmark CRUD
├── completionStore.ts     # Book completion
├── seekingStore.ts        # Seeking operations (CRITICAL)
├── playerSelectors.ts     # Derived state selectors
└── index.ts               # Facade exports
```

**Store Ownership:**

| Store | Owns | Persisted |
|-------|------|-----------|
| `playerStore` | Book state, position, chapters, playback | No |
| `playerSettingsStore` | showTimeRemaining, sleepAtChapterEnd, etc. | Yes |
| `sleepTimerStore` | sleepTimer, shakeToExtend, fade duration | No |
| `speedStore` | bookSpeedMap (per-book rates) | Yes |
| `bookmarksStore` | Bookmarks list and CRUD | No |
| `completionStore` | Completion prompt prefs, completion sheet | Partial |
| `seekingStore` | isSeeking, seekPosition (blocks position updates) | No |

**Cross-Store Communication:**
- Use `getState()` for reads (never subscribe for writes)
- Callback pattern for events (e.g., `sleepTimer.onExpire → playerStore.pause`)
- `seekingStore.isSeeking` checked by playerStore to block position updates during seeking

**Usage:**
```typescript
// Import from facade
import { usePlayerStore, useSpeedStore, useSeekingStore } from '@/features/player/stores';

// Or import selectors directly
import { useDisplayPosition, useBookProgress } from '@/features/player/stores/playerSelectors';
```

### HomeScreen Hero Design

The HomeScreen uses a `HeroSection` component (not a CD disc):

```
┌─────────────────────────────────────────┐
│  HeroSection (Continue Listening)       │
│  ┌─────────┐                           │
│  │  Cover  │  Book Title               │
│  │  Image  │  Author Name              │
│  │         │  Progress Bar  ▶ Play     │
│  └─────────┘                           │
└─────────────────────────────────────────┘
```

**Rationale:**
- CD disc design is exclusive to `CDPlayerScreen` (full-screen player)
- HomeScreen prioritizes quick access and information density
- Hero card shows continue listening with large tap target for resume

---

## Documentation

- [CHANGELOG.md](CHANGELOG.md) - Version history
- [docs/architecture.md](docs/architecture.md) - Technical architecture
- [docs/DOCUMENTATION.md](docs/DOCUMENTATION.md) - Full documentation
- [docs/COMPONENTS.md](docs/COMPONENTS.md) - Component library
- [docs/STATE_MANAGEMENT.md](docs/STATE_MANAGEMENT.md) - State patterns
