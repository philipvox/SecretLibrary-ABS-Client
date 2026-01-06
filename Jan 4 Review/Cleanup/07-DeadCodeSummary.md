# Dead Code & Refactor Cleanup Summary

**Date:** January 5, 2026
**Phases:** 7-8 Combined

## Overview

This report consolidates all dead code findings from the audit and provides a comprehensive cleanup checklist.

## All Dead Code by Category

### 1. Backup Files (4 files, ~4,000 lines)

| File | Path | Lines |
|------|------|-------|
| MyLibraryScreen.backup.tsx | `features/library/screens/` | ~800 |
| CDPlayerScreen.backup.tsx | `features/player/screens/` | ~1,200 |
| playerStore.backup.ts | `features/player/stores/` | ~2,000 |
| (none in components) | - | - |

### 2. Orphaned Screens (2 additional files, ~300 lines)

| File | Path | Purpose |
|------|------|---------|
| SleepTimerPanel.tsx | `features/player/screens/` | Replaced by SleepTimerSheet |
| SpeedPanel.tsx | `features/player/screens/` | Replaced by SpeedSheet |

### 3. Orphaned Components (5 files, ~450 lines)

| File | Path |
|------|------|
| AnimatedSplash.tsx | `shared/components/` |
| CircularProgressRing.tsx | `shared/components/` |
| icons/LucideIcon.tsx | `shared/components/icons/` |
| icons/SkipBack30.tsx | `shared/components/icons/` |
| icons/SkipForward30.tsx | `shared/components/icons/` |

### 4. Orphaned Stores (3 files, ~500 lines)

| File | Path | Reason |
|------|------|--------|
| progressStore.ts | `features/player/stores/` | Only used in test |
| uiStore.ts | `features/player/stores/` | Only used in test |
| playerStore.backup.ts | `features/player/stores/` | Backup file |

### 5. Orphaned Hooks (7 files, ~500 lines)

| File | Path |
|------|------|
| useResponsive.ts | `shared/hooks/` |
| useSwipeGesture.ts | `shared/hooks/` |
| useSeriesProgress.ts | `shared/hooks/` |
| useFilteredLibrary.ts | `shared/hooks/` |
| useBookCardState.ts | `shared/hooks/` |
| useImageColors.ts | `shared/hooks/` |
| useMiniPlayerPadding.ts | `shared/hooks/` |

### 6. Orphaned Utils (3 files, ~200 lines)

| File | Path |
|------|------|
| genreUtils.ts | `shared/utils/` |
| navigation.ts | `shared/utils/` |
| featuredReason.ts | `shared/utils/` |

## Tests That Reference Dead Code

| Test File | References |
|-----------|------------|
| progressStore.test.ts | progressStore (dead) |
| uiStore.test.ts | uiStore (dead) |

## Exports That Need Cleanup

### player/stores/index.ts
- Remove exports for SpeedPanel, SleepTimerPanel (if present)

### shared/components/index.ts
- No changes needed (orphaned files aren't exported)

### shared/hooks/index.ts
Remove:
```typescript
export * from './useBookCardState';
export * from './useImageColors';
export * from './useMiniPlayerPadding';
export * from './useSwipeGesture';
export * from './useSeriesProgress';
export * from './useFilteredLibrary';
```

### shared/utils/index.ts
Remove:
```typescript
export * from './featuredReason';
```

## Total Impact Summary

| Category | Files | Est. Lines |
|----------|-------|------------|
| Backup files | 4 | 4,000 |
| Orphaned screens | 2 | 300 |
| Orphaned components | 5 | 450 |
| Orphaned stores | 3 | 500 |
| Orphaned hooks | 7 | 500 |
| Orphaned utils | 3 | 200 |
| Orphaned tests | 2 | 300 |
| **TOTAL** | **26** | **~6,250** |

## Refactor Verification

### Player Store Refactor (January 2026)

The playerStore refactor split the monolithic store into:
- playerStore.ts (core)
- playerSettingsStore.ts
- bookmarksStore.ts
- sleepTimerStore.ts
- speedStore.ts
- completionStore.ts
- seekingStore.ts
- playerSelectors.ts

**Status:** ✓ Complete, backup can be deleted

### Component Migrations

| Old | New | Status |
|-----|-----|--------|
| AuthorCard | EntityCard | Still used - needs migration |
| NarratorCard | EntityCard | Still used - needs migration |
| FannedSeriesCard | SeriesCard | Still used - needs migration |
| SeriesCard (home) | SeriesCard (shared) | Still used - needs migration |

### Theme Color Migration

| Old | New | Status |
|-----|-----|--------|
| useThemeColors() | useColors() | ~80% complete |
| themeColors.X | colors.X.Y | ~80% complete |

## Cleanup Script

```bash
#!/bin/bash
# Run from project root

# 1. Delete backup files
rm src/features/library/screens/MyLibraryScreen.backup.tsx
rm src/features/player/screens/CDPlayerScreen.backup.tsx
rm src/features/player/stores/playerStore.backup.ts

# 2. Delete orphaned screens
rm src/features/player/screens/SleepTimerPanel.tsx
rm src/features/player/screens/SpeedPanel.tsx

# 3. Delete orphaned components
rm src/shared/components/AnimatedSplash.tsx
rm src/shared/components/CircularProgressRing.tsx
rm -rf src/shared/components/icons/

# 4. Delete orphaned stores
rm src/features/player/stores/progressStore.ts
rm src/features/player/stores/uiStore.ts

# 5. Delete orphaned hooks
rm src/shared/hooks/useResponsive.ts
rm src/shared/hooks/useSwipeGesture.ts
rm src/shared/hooks/useSeriesProgress.ts
rm src/shared/hooks/useFilteredLibrary.ts
rm src/shared/hooks/useBookCardState.ts
rm src/shared/hooks/useImageColors.ts
rm src/shared/hooks/useMiniPlayerPadding.ts

# 6. Delete orphaned utils
rm src/shared/utils/genreUtils.ts
rm src/shared/utils/navigation.ts
rm src/shared/utils/featuredReason.ts

# 7. Delete orphaned tests
rm src/features/player/stores/__tests__/progressStore.test.ts
rm src/features/player/stores/__tests__/uiStore.test.ts

# 8. Verify build
npx tsc --noEmit
```
