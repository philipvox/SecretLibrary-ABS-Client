# Orphaned Hooks Audit Report

**Date:** January 5, 2026
**Phase:** 4 - Cross-Reference Hooks Against Review

## Summary

Audited 55 hook files across `src/shared/hooks/`, `src/core/hooks/`, and `src/features/*/hooks/`. Found **7 orphaned hooks** in shared/hooks that are exported but never imported.

## Orphaned Files

### Shared Hooks Directory (7 files)

These hooks are exported from `shared/hooks/index.ts` but never used anywhere:

| File | Path | Recommendation |
|------|------|----------------|
| useResponsive.ts | `src/shared/hooks/` | DELETE (marked deprecated in index.ts) |
| useSwipeGesture.ts | `src/shared/hooks/` | DELETE |
| useSeriesProgress.ts | `src/shared/hooks/` | DELETE |
| useFilteredLibrary.ts | `src/shared/hooks/` | DELETE |
| useBookCardState.ts | `src/shared/hooks/` | DELETE |
| useImageColors.ts | `src/shared/hooks/` | DELETE |
| useMiniPlayerPadding.ts | `src/shared/hooks/` | DELETE |

**Verification:**
```bash
# Each of these returns 0 results:
grep -r "import.*useResponsive" src/
grep -r "import.*useSwipeGesture" src/
grep -r "import.*useSeriesProgress" src/
grep -r "import.*useFilteredLibrary" src/
grep -r "import.*useBookCardState" src/
grep -r "import.*useImageColors" src/
grep -r "import.*useMiniPlayerPadding" src/
```

## Active Shared Hooks

These hooks are properly used:

| Hook | Used By | Status |
|------|---------|--------|
| useContinueListening | 9 files | Active |
| useToast | 5 files | Active |
| useNormalizedChapters | 2 files (CDPlayerScreen, ChaptersTab) | Active |

## Re-Export Files (Not Orphans)

These files exist to maintain import compatibility:

| File | Re-exports From |
|------|-----------------|
| `features/home/hooks/useContinueListening.ts` | shared/hooks/useContinueListening |

## Core Hooks Status

All core hooks are actively used:

| Hook | Used By |
|------|---------|
| useAppBootstrap | AppNavigator |
| useDownloads | Multiple screens |
| useLibraryPrefetch | AppNavigator |
| useNetworkStatus | Multiple components |
| useOptimisticMutation | Mutation handlers |
| useScreenLoadTime | Performance tracking |
| useSyncStatus | Player |
| useUserBooks | Library screens |

## Feature Hooks Status

All feature hooks are actively used within their respective features.

## Total Impact

| Metric | Count |
|--------|-------|
| Files to Delete | 7 |
| Exports to Remove | 7 (from shared/hooks/index.ts) |
| Estimated Lines | ~500 |

## Cleanup Actions

### Step 1: Update shared/hooks/index.ts

Remove these lines:
```diff
- // useResponsive is deprecated - import directly from '@/shared/theme'
- export * from './useBookCardState';
- export * from './useImageColors';
- export * from './useMiniPlayerPadding';
- export * from './useSwipeGesture';
- export * from './useSeriesProgress';
- export * from './useFilteredLibrary';
```

Keep:
```typescript
export * from './useNormalizedChapters';
export * from './useToast';
export * from './useContinueListening';
```

### Step 2: Delete orphaned hook files

```bash
rm src/shared/hooks/useResponsive.ts
rm src/shared/hooks/useSwipeGesture.ts
rm src/shared/hooks/useSeriesProgress.ts
rm src/shared/hooks/useFilteredLibrary.ts
rm src/shared/hooks/useBookCardState.ts
rm src/shared/hooks/useImageColors.ts
rm src/shared/hooks/useMiniPlayerPadding.ts
```

### Step 3: Verify build

```bash
npx tsc --noEmit
```
