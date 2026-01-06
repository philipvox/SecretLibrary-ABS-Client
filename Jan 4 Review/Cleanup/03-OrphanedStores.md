# Orphaned Stores Audit Report

**Date:** January 5, 2026
**Phase:** 3 - Cross-Reference Stores Against playerStore Refactor

## Summary

Audited 35 store files across `src/features/*/stores/` and `src/shared/stores/`. Found **3 orphaned stores** and **2 stores not exported from facade**.

## Orphaned Files

### 1. Player Store Backup (1 file)

| File | Path | Lines | Recommendation |
|------|------|-------|----------------|
| playerStore.backup.ts | `src/features/player/stores/` | ~2000 | DELETE |

**Verification:**
```bash
grep -r "playerStore.backup" src/  # No results
```

### 2. Orphaned Player Sub-Stores (2 files)

These stores were created during refactoring but are only referenced in tests, not production code:

| File | Path | Used In | Recommendation |
|------|------|---------|----------------|
| progressStore.ts | `src/features/player/stores/` | Test only | DELETE or integrate |
| uiStore.ts | `src/features/player/stores/` | Test only | DELETE or integrate |

**Evidence:**
```bash
# progressStore
grep -r "progressStore" src/
  → Only found in __tests__/progressStore.test.ts

# uiStore
grep -r "uiStore" src/
  → Only found in __tests__/uiStore.test.ts
```

## Stores Not in Facade (But Used)

These stores are actively used but not exported from `player/stores/index.ts`:

| File | Used By | Recommendation |
|------|---------|----------------|
| joystickSeekStore.ts | JoystickSeekSettingsScreen, CoverPlayButton | Add to index.ts |
| settingsStore.ts | CDPlayerScreen.tsx | Verify if should merge with playerSettingsStore |

## Store Architecture After Refactor

### Player Stores (index.ts exports)

| Store | Purpose | Status |
|-------|---------|--------|
| playerStore | Core playback state | Active |
| playerSettingsStore | UI/behavior settings | Active |
| bookmarksStore | Bookmark CRUD | Active |
| sleepTimerStore | Sleep timer | Active |
| speedStore | Per-book playback speed | Active |
| completionStore | Book completion (player-level) | Active |
| seekingStore | Seeking state (UI jitter fix) | Active |
| playerSelectors | Derived state | Active |

### Other Feature Stores

| Store | Feature | Status |
|-------|---------|--------|
| myLibraryStore | library | Active (in shared/) |
| queueStore | queue | Active |
| moodSessionStore | mood-discovery | Active |
| galleryStore | reading-history-wizard | Active |
| preferencesStore | recommendations | Active |
| dismissedItemsStore | recommendations | Active |
| wishlistStore | wishlist | Active |
| chapterCleaningStore | profile | Active |
| hapticSettingsStore | profile | Active |
| kidModeStore | profile | Active (also in shared/) |

### Intentional Re-Exports (Not Orphans)

These files exist to maintain import path compatibility:

| File | Type |
|------|------|
| `features/library/stores/myLibraryStore.ts` | Re-exports from shared/ |
| `shared/stores/index.ts` | Facade for kidModeStore + myLibraryStore |

### Dual completionStore Files (BY DESIGN)

There are TWO completionStore files with **different purposes**:

| File | Purpose | Used By |
|------|---------|---------|
| `features/player/stores/completionStore.ts` | Player completion UI (sheet, prompts) | Player components |
| `features/completion/stores/completionStore.ts` | Library-level book completion status | HeroSection, FilteredBooks, useLibraryData |

These are NOT duplicates - they serve different architectural layers.

## Total Impact

| Metric | Count |
|--------|-------|
| Files to Delete | 3 |
| Tests to Update | 2 (progressStore.test, uiStore.test) |
| Exports to Add | 1-2 (joystickSeekStore, settingsStore) |
| Estimated Lines | ~500 |

## Cleanup Actions

### Step 1: Delete orphaned stores

```bash
rm src/features/player/stores/playerStore.backup.ts
rm src/features/player/stores/progressStore.ts
rm src/features/player/stores/uiStore.ts
```

### Step 2: Delete or update associated tests

```bash
rm src/features/player/stores/__tests__/progressStore.test.ts
rm src/features/player/stores/__tests__/uiStore.test.ts
```

### Step 3: Add missing exports to index.ts

```typescript
// Add to src/features/player/stores/index.ts
export { useJoystickSeekStore } from './joystickSeekStore';
```

### Step 4: Verify build

```bash
npx tsc --noEmit
```
