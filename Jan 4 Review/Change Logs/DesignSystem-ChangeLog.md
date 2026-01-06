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

### B.4 - Replace EmptyState Custom SVGs
**Status:** Complete
**Files Modified:**
- `src/shared/components/EmptyState.tsx`

**Changes:**
- [x] Replaced 10 custom SVG icon definitions with Lucide React Native imports
- [x] Removed inline SVG components (BookIcon, SearchIcon, HeartIcon, etc.)
- [x] Updated ICONS mapping to use Lucide components:
  - `book` → `BookOpen`
  - `search` → `Search`
  - `heart` → `Heart`
  - `download` → `Download`
  - `list` → `LayoutGrid`
  - `user` → `User`
  - `mic` → `Mic`
  - `library` → `Library`
  - `celebrate` → `PartyPopper`
  - `collection` → `LayoutDashboard`
- [x] Uses `iconSizes.xxxl` (64px) token for empty state icons
- [x] Uses `EMPTY_STATE_ICON_COLOR` constant for consistent color

### B.5 - Create EntityCard Component
**Status:** Complete
**Files Created:**
- `src/shared/components/EntityCard.tsx`

**Files Modified:**
- `src/shared/components/index.ts` - Added EntityCard export
- `src/features/author/components/AuthorCard.tsx` - Refactored to use EntityCard
- `src/features/narrator/components/NarratorCard.tsx` - Refactored to use EntityCard

**Changes:**
- [x] Created unified EntityCard component for Author/Narrator grid cards
- [x] Uses `useThemeColors()` for theme-aware colors
- [x] Uses `typography.headlineMedium` and `typography.bodySmall`
- [x] Uses `interactiveStates.press.opacity` for touch feedback
- [x] Uses `scale()` for responsive sizing
- [x] Uses `elevation.small` for avatar shadow
- [x] Generates consistent initials and colors from name
- [x] AuthorCard now wraps EntityCard (backward compatible)
- [x] NarratorCard now wraps EntityCard (backward compatible)
- [x] PersonCard remains separate (different layout for horizontal lists)

### B.6 - Update Icon Component Default Color
**Status:** Complete
**Files Modified:**
- `src/shared/components/Icon.tsx`

**Changes:**
- [x] Replaced legacy `colors.textPrimary` default with theme-aware color
- [x] Added `useThemeColors()` hook import
- [x] Color now defaults to `themeColors.text` if not provided
- [x] Removed dependency on legacy `colors` object
- [x] Added JSDoc note about theme-aware default color

---

## Phase B Summary

All Phase B component unification tasks complete:
- B.1: Merged SeriesCard variants into shared component
- B.2: Migrated AuthorCard to use theme tokens
- B.3: Replaced 8 BookCard custom SVGs with Lucide icons
- B.4: Replaced 10 EmptyState custom SVGs with Lucide icons
- B.5: Created unified EntityCard for Author/Narrator cards
- B.6: Updated Icon component to use theme-aware default color

**Commits:**
- `style(design-system): Phase A - consolidate design tokens`
- `style(design-system): Phase B.1 - unify SeriesCard components`
- `style(design-system): Phase B.2 - migrate AuthorCard to theme`
- `style(design-system): Phase B.3 - replace BookCard custom SVGs with Lucide icons`
- `style(design-system): Phase B.4 - replace EmptyState custom SVGs with Lucide icons`
- `style(design-system): Phase B.5 - create unified EntityCard component`
- `style(design-system): Phase B.6 - update Icon default color to theme-aware`

---

## Phase C: Screen Updates

### Typography Token Mapping Reference

| Hardcoded Size | Typography Token |
|----------------|------------------|
| `scale(32)` | `typography.displayLarge` |
| `scale(24)` | `typography.displayMedium` |
| `scale(22)` | `typography.displaySmall` |
| `scale(18)` | `typography.displaySmall` |
| `scale(17)` | `typography.headlineLarge` |
| `scale(16)` | `typography.headlineMedium` |
| `scale(15)` | `typography.headlineMedium` |
| `scale(14)` | `typography.bodyLarge` |
| `scale(13)` | `typography.bodyMedium` |
| `scale(12)` | `typography.bodySmall` |
| `scale(11)` | `typography.labelMedium` |
| `scale(10)` | `typography.labelSmall` |
| `scale(9)` | `typography.caption` |

---

### C.1 - CDPlayerScreen Typography
**Status:** Complete
**Files Modified:**
- `src/features/player/screens/CDPlayerScreen.tsx`

**Changes:**
Replaced all 40+ hardcoded `fontSize: scale()` values with typography tokens:

**Display text (large headings):**
- [x] `standardTitle` → `typography.displayLarge` with `fontSize['4xl']`
- [x] `noteInputTitle` → `typography.displaySmall`
- [x] `chapterTimeCentered` → `typography.displaySmall`
- [x] `standardChapterTextTop` → `typography.displaySmall` with `fontSize.xl`

**Headline text (section headers, titles):**
- [x] `title` → `typography.headlineMedium`
- [x] `bookmarkTitle` → `typography.headlineMedium`
- [x] `bookmarkToastText` → `typography.headlineMedium`
- [x] `bookmarkToastAction` → `typography.headlineMedium`
- [x] `noteInputSaveText` → `typography.headlineMedium`
- [x] `bookmarksEmptyText` → `typography.headlineLarge`
- [x] `noteInput` → `typography.headlineLarge`

**Body text (content, descriptions):**
- [x] `author` → `typography.bodyMedium`
- [x] `speedIndicatorText` → `typography.bodyMedium`
- [x] `scrubTooltipText` → `typography.bodyMedium`
- [x] `overviewTitle` → `typography.bodyMedium`
- [x] `overviewText` → `typography.bodySmall`
- [x] `chapter` → `typography.bodyMedium`
- [x] `time` → `typography.bodyMedium`
- [x] `chapterCentered` → `typography.bodyLarge`
- [x] `chapterRemaining` → `typography.bodyLarge`
- [x] `pillText` → `typography.bodyLarge`
- [x] `pillTextSmall` → `typography.bodyMedium`
- [x] `standardChapterText` → `typography.bodyLarge`
- [x] `standardChapterTime` → `typography.bodyLarge`
- [x] `standardMetaLabel` → `typography.bodySmall`
- [x] `standardMetaValue` → `typography.bodyLarge`
- [x] `settingsActionText` → `typography.bodyLarge`
- [x] `sheetBackText` → `typography.bodyLarge`
- [x] `bookmarksEmptySubtext` → `typography.bodyLarge`
- [x] `bookmarkChapter` → `typography.bodyMedium`
- [x] `bookmarkTime` → `typography.bodyLarge`
- [x] `bookmarksEmptyHint` → `typography.bodyMedium`
- [x] `bookmarkNote` → `typography.bodyMedium`
- [x] `bookmarkDate` → `typography.bodySmall`
- [x] `bookmarkPillText` → `typography.bodyLarge`
- [x] `bookmarkPillNoteText` → `typography.bodyMedium`
- [x] `noteCharCount` → `typography.bodyMedium`

**Label text (badges, small UI elements):**
- [x] `sourceText` → `typography.labelMedium`
- [x] `queueBadgeText` → `typography.labelSmall`
- [x] `standardChapterTimeTop` → `typography.labelSmall`
- [x] `coverButtonBadgeText` → `typography.labelSmall`
- [x] `settingsActionBadgeText` → `typography.labelMedium`
- [x] `skipButtonLabel` → `typography.labelMedium`
- [x] `scrubScaleText` → `typography.labelSmall`
- [x] `playingBadgeText` → `typography.labelMedium`
- [x] `speedBadgeOnDiscText` → `typography.labelMedium`
- [x] `bufferingBadgeText` → `typography.labelMedium`

**Caption text:**
- [x] `progressTimeText` → `typography.caption`

**Font weight token replacements:**
- [x] All `fontWeight: '400'` → `fontWeight.regular`
- [x] All `fontWeight: '500'` → `fontWeight.medium`
- [x] All `fontWeight: '600'` → `fontWeight.semibold`
- [x] All `fontWeight: '700'` → `fontWeight.bold`

---

### C.2 - ProfileScreen Typography
**Status:** Complete
**Files Modified:**
- `src/features/profile/screens/ProfileScreen.tsx`

**Changes:**
Replaced all 13 hardcoded `fontSize: scale()` values with typography tokens:

**Display text:**
- [x] `headerTitle` → `typography.displayLarge`
- [x] `avatarText` → `typography.displayMedium`
- [x] `username` → `typography.displaySmall`

**Headline text:**
- [x] `linkLabel` → `typography.headlineMedium`
- [x] `signOutText` → `typography.headlineMedium`
- [x] `appName` → `typography.headlineMedium`

**Body text:**
- [x] `userRole` → `typography.bodyLarge`
- [x] `sectionTitle` → `typography.bodyMedium`
- [x] `serverText` → `typography.bodySmall`
- [x] `linkSubtitle` → `typography.bodySmall`
- [x] `versionText` → `typography.bodySmall`

**Label text:**
- [x] `badgeText` → `typography.labelMedium`
- [x] `buildDate` → `typography.labelSmall`

---

### C.3 - PlaybackSettingsScreen Typography
**Status:** Complete
**Files Modified:**
- `src/features/profile/screens/PlaybackSettingsScreen.tsx`

**Changes:**
Replaced all 12 hardcoded `fontSize: scale()` values with typography tokens:

**Headline text:**
- [x] `headerTitle` → `typography.headlineLarge`
- [x] `rowLabel` → `typography.headlineMedium`
- [x] `pickerTitle` → `typography.headlineLarge`
- [x] `pickerOptionText` → `typography.headlineMedium`

**Body text:**
- [x] `sectionHeader` → `typography.bodyMedium`
- [x] `rowNote` → `typography.bodySmall`
- [x] `rowValue` → `typography.bodyLarge`
- [x] `infoText` → `typography.bodySmall`
- [x] `maxRewindLabel` → `typography.bodyMedium`
- [x] `maxRewindOptionText` → `typography.bodyLarge`
- [x] `pickerSubtitle` → `typography.bodyMedium`

**Label text:**
- [x] `maxRewindNote` → `typography.labelMedium`

---

### C.4 - KidModeSettingsScreen Typography
**Status:** Complete
**Files Modified:**
- `src/features/profile/screens/KidModeSettingsScreen.tsx`

**Changes:**
Replaced all 29 hardcoded `fontSize: scale()` values with typography tokens:

**Display text:**
- [x] `modalTitle` → `typography.displaySmall`

**Headline text:**
- [x] `headerTitle` → `typography.headlineLarge`
- [x] `masterToggleLabel` → `typography.headlineMedium`
- [x] `sectionHeader` → `typography.headlineMedium`
- [x] `ageToggleLabel` → `typography.headlineMedium`
- [x] `pinRowLabel` → `typography.headlineMedium`
- [x] `modalButtonText` → `typography.headlineMedium`

**Body text:**
- [x] `masterToggleNote` → `typography.bodyMedium`
- [x] `infoText` → `typography.bodyMedium`
- [x] `chipText` → `typography.bodyMedium`
- [x] `addButtonText` → `typography.bodyMedium`
- [x] `addInput` → `typography.bodyMedium`
- [x] `subSectionLabel` → `typography.bodyMedium`
- [x] `pinActionButtonText` → `typography.bodyMedium`
- [x] `confirmHint` → `typography.bodyMedium`
- [x] `tipsTitle` → `typography.bodyLarge`
- [x] `categoryPickerLabel` → `typography.bodyLarge`
- [x] `categoryOptionLabel` → `typography.bodyLarge`
- [x] `ratingPickerLabel` → `typography.bodyLarge`
- [x] `ratingOptionLabel` → `typography.bodyLarge`
- [x] `modalSubtitle` → `typography.bodyLarge`
- [x] `pinErrorText` → `typography.bodyLarge`
- [x] `sectionSubtitle` → `typography.bodySmall`
- [x] `tipText` → `typography.bodySmall`
- [x] `ageToggleNote` → `typography.bodySmall`
- [x] `categoryPickerHint` → `typography.bodySmall`
- [x] `ratingPickerHint` → `typography.bodySmall`
- [x] `pinRowNote` → `typography.bodySmall`

**Label text:**
- [x] `ratingOptionAge` → `typography.labelSmall`

---

### C.5 - JoystickSeekSettingsScreen Typography
**Status:** Complete
**Files Modified:**
- `src/features/profile/screens/JoystickSeekSettingsScreen.tsx`

**Changes:**
Replaced all 20 hardcoded `fontSize: scale()` values with typography tokens:

**Headline text:**
- [x] `headerTitle` → `typography.headlineLarge`
- [x] `rowLabel` → `typography.headlineMedium`
- [x] `sliderValue` → `typography.headlineLarge`
- [x] `testStatValue` → `typography.headlineLarge`
- [x] `resetButtonText` → `typography.headlineMedium`

**Body text:**
- [x] `description` → `typography.bodyLarge`
- [x] `sectionHeader` → `typography.bodyMedium`
- [x] `rowValue` → `typography.bodyLarge`
- [x] `presetLabel` → `typography.bodyMedium`
- [x] `presetPillText` → `typography.bodySmall`
- [x] `sliderLabel` → `typography.bodyLarge`
- [x] `sliderNote` → `typography.bodySmall`
- [x] `sliderDescription` → `typography.bodySmall`
- [x] `testAreaTitle` → `typography.bodyLarge`
- [x] `testAreaSubtitle` → `typography.bodySmall`
- [x] `rowNote` → `typography.bodySmall`

**Label text:**
- [x] `dragHintText` → `typography.labelSmall`
- [x] `customNote` → `typography.labelMedium`
- [x] `sliderMinMax` → `typography.labelMedium`
- [x] `testStatLabel` → `typography.labelMedium`

---

### C.6 - Other Settings Screens Typography (Pending)

**Remaining screens:**
- `HapticSettingsScreen.tsx`
- `ChapterCleaningSettingsScreen.tsx`
- Various other settings screens

---

