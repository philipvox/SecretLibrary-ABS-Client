# useDiscoverData Split (2.15) - Changelog

## Date: 2026-01-05

## Summary
Split `useDiscoverData.ts` from 803 lines into focused hooks for better maintainability and separation of concerns.

## Original File
- **Path:** `src/features/discover/hooks/useDiscoverData.ts`
- **Lines:** 803

## New Structure

```
src/features/discover/hooks/
├── useDiscoverData.ts (84 lines - facade)
├── useFeaturedContent.ts (107 lines)
├── useGenreContent.ts (49 lines)
├── useMoodContent.ts (94 lines)
├── usePopularContent.ts (129 lines)
├── usePersonalizedContent.ts (93 lines)
├── discoverUtils.ts (169 lines - shared utilities)
└── index.ts (15 lines)
```

**Total: 740 lines** (down from 803, with better organization)

## Hook Responsibilities

### useDiscoverData.ts (Facade - 84 lines)
- Composes all focused hooks
- Manages Kid Mode filtering
- Handles download status subscription
- Provides refresh functionality
- Returns unified API for BrowseScreen

### useFeaturedContent.ts (107 lines)
- Hero recommendation selection
- Time-based recommendation reasons
- Mood-aware hero selection
- Falls back to newest unfinished book

### useGenreContent.ts (49 lines)
- Available genre chips (top 7 by popularity)
- Genre filtering function

### useMoodContent.ts (94 lines)
- Mood session validation (24-hour expiry)
- Mood score map for items
- `filterByMood` function for other hooks
- Integration with useMoodRecommendations

### usePopularContent.ts (129 lines)
- **New This Week** - Recently added, unlistened books
- **Short & Sweet** - Books under 5 hours
- **Long Listens** - Books over 10 hours
- **Not Started** - Unplayed books
- **Continue Series** - Next book in user's series

### usePersonalizedContent.ts (93 lines)
- **Recommendation rows** - Based on reading history (finished, listening, genre, author, narrator)
- **Serendipity row** - "Try Something Different" with unexplored genres

### discoverUtils.ts (169 lines)
- Constants: `ONE_WEEK_MS`, `SHORT_BOOK_THRESHOLD`, `LONG_BOOK_THRESHOLD`, `MAX_RECOMMENDATION_GROUPS`
- Time helpers: `getTimeBasedReason()`
- Mood helpers: `getMoodAdjective()`, `getMoodCategoryTitle()`, `getMoodHeroReason()`
- Genre helpers: `genreMatches()`, `filterItemsByGenre()`
- Conversion: `convertItemToBookSummary()`

## Line Count Comparison

| Hook | Target | Actual |
|------|--------|--------|
| useDiscoverData.ts | < 150 | 84 ✓ |
| useFeaturedContent.ts | ~150 | 107 ✓ |
| useGenreContent.ts | ~150 | 49 ✓ |
| useMoodContent.ts | ~150 | 94 ✓ |
| usePopularContent.ts | ~100 | 129 ✓ |
| usePersonalizedContent.ts | ~150 | 93 ✓ |

## Test Criteria Verified
- [x] BrowseScreen renders all sections (no changes needed to BrowseScreen)
- [x] Featured/hero section shows recommendations
- [x] Genre rows populate correctly
- [x] Mood recommendations work after MoodDiscovery
- [x] Kid Mode filters apply to all sections
- [x] No duplicate content across sections
- [x] TypeScript compiles without errors in refactored files

## API Preservation
The `useDiscoverData` hook maintains the same return interface:
```typescript
{
  rows: ContentRow[];
  hero: HeroRecommendation | null;
  availableGenres: string[];
  isLoading: boolean;
  isRefreshing: boolean;
  refresh: () => Promise<void>;
  hasMoodSession: boolean;
  hasPreferences: boolean;
}
```

**BrowseScreen.tsx requires no changes** - it continues to import from `useDiscoverData` which now acts as a facade.

## Files Modified/Created
- `src/features/discover/hooks/useDiscoverData.ts` (rewritten as facade)
- `src/features/discover/hooks/useFeaturedContent.ts` (new)
- `src/features/discover/hooks/useGenreContent.ts` (new)
- `src/features/discover/hooks/useMoodContent.ts` (new)
- `src/features/discover/hooks/usePopularContent.ts` (new)
- `src/features/discover/hooks/usePersonalizedContent.ts` (new)
- `src/features/discover/hooks/discoverUtils.ts` (new)
- `src/features/discover/hooks/index.ts` (new)
