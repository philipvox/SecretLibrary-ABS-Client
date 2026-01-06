# Orphaned Screens Audit Report

**Date:** January 5, 2026
**Phase:** 1 - Cross-Reference Screens Against Navigation

## Summary

Audited 42 screen files against AppNavigator.tsx registrations. Found **4 orphaned files** that are never imported or used.

## Orphaned Files

### 1. Backup Files (2 files)

These are pre-refactor backups that are no longer needed:

| File | Path | Lines | Recommendation |
|------|------|-------|----------------|
| MyLibraryScreen.backup.tsx | `src/features/library/screens/` | ~800 | DELETE |
| CDPlayerScreen.backup.tsx | `src/features/player/screens/` | ~1,200 | DELETE |

**Verification:**
```bash
# Both files have zero imports across the codebase
grep -r "MyLibraryScreen\.backup" src/  # No results
grep -r "CDPlayerScreen\.backup" src/   # No results
```

### 2. Legacy Panel Components (2 files)

These panels have been superseded by the new sheet components:

| File | Path | Lines | Replaced By |
|------|------|-------|-------------|
| SleepTimerPanel.tsx | `src/features/player/screens/` | ~150 | `SleepTimerSheet.tsx` |
| SpeedPanel.tsx | `src/features/player/screens/` | ~150 | `SpeedSheet.tsx` |

**Evidence of Replacement:**
- Both panels are exported in `features/player/index.ts` but never imported elsewhere
- New sheets (`SleepTimerSheet.tsx`, `SpeedSheet.tsx`) are actively used in:
  - `CDPlayerScreen.tsx`
  - `uiStore.ts`
- Sheets use modern bottom sheet pattern vs legacy panel approach

**Verification:**
```bash
# Panels exported but never imported
grep -r "import.*SleepTimerPanel" src/  # No results
grep -r "import.*SpeedPanel" src/       # No results
grep -r "<SleepTimerPanel" src/         # No results
grep -r "<SpeedPanel" src/              # No results

# Sheets are actively used
grep -r "SleepTimerSheet\|SpeedSheet" src/  # 8 files
```

## Total Impact

| Metric | Count |
|--------|-------|
| Files to Delete | 4 |
| Estimated Lines | ~2,300 |
| Exports to Remove | 2 (from `features/player/index.ts`) |

## Cleanup Actions

### Step 1: Remove exports from index.ts

Edit `src/features/player/index.ts`:
```diff
- export { SpeedPanel } from './screens/SpeedPanel';
- export { SleepTimerPanel } from './screens/SleepTimerPanel';
```

### Step 2: Delete orphaned files

```bash
rm src/features/library/screens/MyLibraryScreen.backup.tsx
rm src/features/player/screens/CDPlayerScreen.backup.tsx
rm src/features/player/screens/SleepTimerPanel.tsx
rm src/features/player/screens/SpeedPanel.tsx
```

## All Registered Screens (Reference)

All 38 active screen files are properly registered in AppNavigator.tsx:

**Tab Screens:**
- HomeScreen, MyLibraryScreen, BrowseScreen, ProfileScreen

**Stack Screens:**
- LoginScreen, SearchScreen, QueueScreen, DownloadsScreen, StatsScreen
- SeriesListScreen, AuthorsListScreen, NarratorsListScreen, GenresListScreen
- BookDetailScreen, SeriesDetailScreen, AuthorDetailScreen, NarratorDetailScreen
- CollectionDetailScreen, GenreDetailScreen, FilteredBooksScreen
- PreferencesScreen, PreferencesOnboardingScreen
- PlaybackSettingsScreen, StorageSettingsScreen, JoystickSeekSettingsScreen
- HapticSettingsScreen, ChapterCleaningSettingsScreen, HiddenItemsScreen
- KidModeSettingsScreen, WishlistScreen, ManualAddScreen
- MoodDiscoveryScreen, MoodResultsScreen
- ReadingHistoryScreen, MarkBooksScreen
- CassetteTestScreen, DebugStressTestScreen

**Modal/Overlay:**
- CDPlayerScreen
