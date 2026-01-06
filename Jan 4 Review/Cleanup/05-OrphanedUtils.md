# Orphaned Utils Audit Report

**Date:** January 5, 2026
**Phase:** 5 - Cross-Reference Utils Against Review

## Summary

Audited 39 utility files across `src/shared/utils/`, `src/core/utils/`, `src/utils/`, and `src/features/*/utils/`. Found **3 orphaned utils** that are never used.

## Orphaned Files

### Shared Utils Directory (3 files)

| File | Path | Recommendation |
|------|------|----------------|
| genreUtils.ts | `src/shared/utils/` | DELETE |
| navigation.ts | `src/shared/utils/` | DELETE (only used by orphaned hook) |
| featuredReason.ts | `src/shared/utils/` | DELETE (functions never called) |

**Verification:**
```bash
grep -r "import.*genreUtils" src/          # No results
grep -r "@/shared/utils/navigation" src/   # No results
grep -r "getFeaturedReason" src/           # Only in featuredReason.ts itself
```

## Active Utils

### Shared Utils

| File | Used By | Status |
|------|---------|--------|
| audioDebug.ts | 8 files (player, automotive) | Active |
| format.ts | Multiple files | Active |
| kidModeFilter.ts | 5 files | Active |
| logger.ts | Many files | Active |
| metadata.ts | Many files | Active |
| seriesFilter.ts | 4 files | Active |

### Core Utils

| File | Used By | Status |
|------|---------|--------|
| seriesUtils.ts | Multiple components | Active |

### Root Utils (src/utils/)

| File | Used By | Status |
|------|---------|--------|
| runtimeMonitor.ts | 5 files | Active |
| perfDebug.ts | 3 files | Active |

### Player Utils

All player utils are actively used by CDPlayerScreen and player services:
- bookLoadingHelpers.ts
- chapterNavigator.ts
- downloadListener.ts
- listeningSession.ts
- playbackRateResolver.ts
- playerTheme.ts
- positionResolver.ts
- progressCalculator.ts
- smartRewind.ts
- smartRewindCalculator.ts
- tickGenerator.ts
- timeFormatters.ts
- trackNavigator.ts
- types.ts

### Other Feature Utils

| Directory | Status |
|-----------|--------|
| mood-discovery/utils | Active (tagScoring.ts) |
| search/utils | Active (fuzzySearch.ts) |

## Total Impact

| Metric | Count |
|--------|-------|
| Files to Delete | 3 |
| Exports to Remove | From shared/utils/index.ts |
| Estimated Lines | ~200 |

## Cleanup Actions

### Step 1: Update shared/utils/index.ts

Remove featuredReason export:
```diff
  export * from './format';
- export * from './featuredReason';
  export * from './logger';
```

### Step 2: Delete orphaned utils

```bash
rm src/shared/utils/genreUtils.ts
rm src/shared/utils/navigation.ts
rm src/shared/utils/featuredReason.ts
```

### Step 3: Verify build

```bash
npx tsc --noEmit
```

## Notes

- `genreUtils.ts` may have been replaced by direct genre handling in components
- `navigation.ts` was created for mini-player padding but the hook is unused
- `featuredReason.ts` was likely intended for content curation but never integrated
