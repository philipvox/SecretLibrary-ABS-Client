# Orphaned Components Audit Report

**Date:** January 5, 2026
**Phase:** 2 - Cross-Reference Components Against Design System

## Summary

Audited 34 component files in `src/shared/components/` against the public exports in `index.ts`. Found **5 orphaned files** that are exported or defined but never actually used.

## Orphaned Files

### 1. Unused Standalone Components (2 files)

These components exist but are never imported anywhere:

| File | Path | Lines | Recommendation |
|------|------|-------|----------------|
| AnimatedSplash.tsx | `src/shared/components/` | ~150 | DELETE or integrate |
| CircularProgressRing.tsx | `src/shared/components/` | ~100 | DELETE or integrate |

**Verification:**
```bash
grep -r "import.*AnimatedSplash" src/     # No results
grep -r "import.*CircularProgressRing" src/ # No results
```

**Notes:**
- `AnimatedSplash` may have been intended for app startup but is not wired up
- `CircularProgressRing` is different from `CircularDownloadButton` which IS used

### 2. Unused Icon Components (3 files)

The entire `icons/` subdirectory contains components that are never used:

| File | Path | Lines | Recommendation |
|------|------|-------|----------------|
| LucideIcon.tsx | `src/shared/components/icons/` | ~100 | DELETE or migrate usages |
| SkipBack30.tsx | `src/shared/components/icons/` | ~50 | DELETE |
| SkipForward30.tsx | `src/shared/components/icons/` | ~50 | DELETE |

**Evidence:**
- `icons/index.ts` exports these components but has **zero importers**
- JSX usage `<SkipBack30>` and `<LucideIcon>` returns zero matches
- App uses `lucide-react-native` directly instead of these wrappers

**Verification:**
```bash
grep -r "from.*@/shared/components/icons" src/ # Only the index.ts itself
grep -r "<SkipBack30" src/    # No results
grep -r "<LucideIcon" src/    # No results
```

## Components Properly Exported & Used

All 26 components in `index.ts` are actively used:

| Category | Components | Usage Count |
|----------|------------|-------------|
| Buttons | Button, IconButton | High |
| Inputs | TextInput, SearchInput | Medium |
| Feedback | LoadingSpinner, ErrorView, EmptyState | High |
| Icons | Icon (ICON_SIZES) | High |
| Skeletons | 10+ skeleton variants | Medium |
| Cards | BookCard, SeriesCard, EntityCard | High |
| Progress | ProgressDots, SeriesProgressBadge, ThumbnailProgressBar | Medium |
| Interactive | HeartButton, SeriesHeartButton, CoverPlayButton | High |
| Navigation | AlphabetScrubber, FilterSortBar | Medium |
| Utility | StackedCovers, NetworkStatusBar, Snackbar, BookContextMenu | Medium |
| New | ToastContainer, PinInput | Low (recently added) |

## Total Impact

| Metric | Count |
|--------|-------|
| Files to Delete | 5 |
| Directories to Delete | 1 (`icons/`) |
| Estimated Lines | ~450 |
| Exports to Clean | icons/index.ts exports |

## Cleanup Actions

### Step 1: Delete orphaned standalone components
```bash
rm src/shared/components/AnimatedSplash.tsx
rm src/shared/components/CircularProgressRing.tsx
```

### Step 2: Delete entire icons subdirectory
```bash
rm -rf src/shared/components/icons/
```

### Step 3: Verify no broken imports
```bash
npx tsc --noEmit
```

## Design System Alignment Notes

From the typography audit (agent ab3d863), key findings:

### Typography Consistency Issues
- **Screen titles**: 10px variance (22-32px) - should standardize to 28px
- **~80% of code uses scale()** correctly, 12% uses hardcoded pixels
- **Color system migration incomplete**: Some files still use legacy flat `colors` object

### Recommended Next Steps
1. Create `<Text variant="heading">` component to enforce typography tokens
2. Complete migration from `useThemeColors()` (flat) to `useColors()` (nested)
3. Audit remaining hardcoded pixel values in CDPlayerScreen, SearchScreen

## Feature-Level Component Analysis

Feature components were NOT deeply audited in this phase, but here's the export pattern:

| Feature | Components Exported | Status |
|---------|---------------------|--------|
| home | ContinueListeningSection, etc. | Active |
| library | AddToLibraryButton, tabs/* | Active |
| player | sheets/*, components/* | Active (recently refactored) |
| downloads | DownloadItem | Active |
| queue | QueueItem | Active |
| browse/discover | HeroSection, GenreCards | Active |

Feature components would require a separate detailed audit if needed.
