# Design System Unification Changelog

**Started:** January 5, 2026
**Based on:** 10-DesignSystemSpec.md, 11-DesignSystemActionPlan.md

---

## Phase A: Token Consolidation

### A.1 - Add Missing Tokens to sizes.ts
**Status:** Complete
**Files Modified:**
- `src/shared/theme/sizes.ts`

**Changes:**
- [x] Updated `iconSizes` scale: xs=12, sm=16, md=20, lg=24, xl=32, xxl=48, xxxl=64
- [x] Added `iconSizes.xxxl` (64px) for empty states
- [x] Updated `cardTokens.cover.listRow` from 56 to 64 (BookCard covers)
- [x] Updated `cardTokens.avatar` with grid=80, detail=120
- [x] Updated `cardTokens.stackedCovers` with size=60, maxCount=5, offset=18, rotation=8
- [x] Added `cardTokens.rowHeight.settings` (56) and `chapter` (48)

### A.2 - Add Feature Colors to colors.ts
**Status:** Complete
**Files Modified:**
- `src/shared/theme/colors.ts`

**Changes:**
- [x] Added `feature.streaming: '#6496FF'` to both lightColors and darkColors

### A.3 - Add Interactive State Tokens to spacing.ts
**Status:** Complete
**Files Modified:**
- `src/shared/theme/spacing.ts`

**Changes:**
- [x] Added `interactiveStates.press` with opacity=0.7, duration=100
- [x] Added `interactiveStates.bounce` with scale=1.3, duration=300
- [x] Added `interactiveStates.disabled` with opacity=0.4

### A.4 - Update Theme Index
**Status:** Complete
**Files Modified:**
- `src/shared/theme/index.ts`

**Changes:**
- [x] Added `interactiveStates` to imports and theme object

---

## Phase B: Component Unification

### B.1 - Merge SeriesCard Variants
**Status:** Complete
**Files Created:**
- `src/shared/components/SeriesCard.tsx`

**Files Modified:**
- `src/shared/components/index.ts` - Added SeriesCard export
- `src/features/home/components/SeriesCard.tsx` - Re-exports from shared
- `src/features/library/components/FannedSeriesCard.tsx` - Re-exports from shared

**Changes:**
- [x] Created unified SeriesCard in shared/components
- [x] Uses cardTokens.stackedCovers for consistent fan dimensions
- [x] Uses typography.headlineSmall and typography.labelSmall
- [x] Uses interactiveStates.press.opacity for touch feedback
- [x] Uses radius.lg for card, radius.sm for covers
- [x] Supports both progress and non-progress modes
- [x] Backward-compatible re-exports from feature folders

**Note:** `src/features/series/components/SeriesCard.tsx` remains separate due to significantly different functionality (StackedCovers, detailed progress bar, up-next tracking).

### B.2 - Migrate AuthorCard to Theme
**Status:** Complete
**Files Modified:**
- `src/features/author/components/AuthorCard.tsx`

**Changes:**
- [x] Replaced `colors.textPrimary/Secondary` with `themeColors.text/textSecondary`
- [x] Replaced hardcoded `fontSize: 15` with `typography.headlineMedium`
- [x] Replaced hardcoded `fontSize: 13` with `typography.bodySmall`
- [x] Added `scale()` to initials fontSize (36 → scale(36))
- [x] Uses `interactiveStates.press.opacity` for press feedback
- [x] Uses `themeColors.backgroundSecondary` for avatar container
- [x] Removed dependency on legacy `colors` object

### B.3 - Replace BookCard Custom SVGs
**Status:** Complete
**Files Modified:**
- `src/shared/components/BookCard.tsx`

**Changes:**
- [x] Replaced 8 custom SVG icon components with Lucide React Native imports
- [x] Removed inline SVG definitions (DownloadIcon, PlayIcon, PlusIcon, CheckIcon, etc.)
- [x] Updated all icon usages to use Lucide components:
  - `Download` - download action button
  - `Play` - play overlay and play action button (with fill for solid)
  - `Plus` - add to queue button
  - `Check` - in-queue and downloaded badges
  - `Cloud` - streaming status badge
  - `CloudOff` - offline unavailable status
  - `Bookmark` - wishlist button (with fill for active state)
  - `Pause` - paused download indicator in ProgressRing
- [x] Uses `iconSizes.xs`, `iconSizes.sm`, `iconSizes.md` tokens for consistent sizing

---

