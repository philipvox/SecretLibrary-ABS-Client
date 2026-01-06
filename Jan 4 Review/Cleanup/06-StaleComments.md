# Stale Comments Audit Report

**Date:** January 5, 2026
**Phase:** 6 - Find Stale Comments

## Summary

Found **1 TODO comment** and **26 deprecated markers** across the codebase. Some deprecated items are still actively used and need migration.

## TODO Comments

| File | Line | Comment | Action |
|------|------|---------|--------|
| WishlistScreen.tsx | 125 | `// TODO: Implement edit sheet` | Implement or remove |

## Deprecated Items Still In Use

### Deprecated Components (Need Migration)

These components are marked deprecated but still imported by other files:

| Component | Location | Replacement | Used By |
|-----------|----------|-------------|---------|
| AuthorCard | `features/author/components/` | EntityCard | AuthorsListContent.tsx |
| NarratorCard | `features/narrator/components/` | EntityCard | NarratorsListContent.tsx |
| FannedSeriesCard | `features/library/components/` | SeriesCard | Library tabs |
| SeriesCard | `features/home/components/` | `@/shared/components/SeriesCard` | Library tabs |

**Migration Required:**
```typescript
// Before
import { AuthorCard } from '@/features/author/components';

// After
import { EntityCard } from '@/shared/components';
<EntityCard type="author" ... />
```

### Deprecated Theme Items (Active Deprecation)

| Item | Location | Replacement |
|------|----------|-------------|
| `useThemeColors` | `shared/theme/themeStore` | `useColors()` |
| `themeColors` | `shared/theme/themeStore` | `useColors()` |
| `colors` | `shared/theme/index` | `useColors()` |
| `gold`, `silver`, `bronze` aliases | `shared/theme/colors` | `primary`, `primaryDark`, `primarySubtle` |

### Deprecated Hooks (Already Orphaned)

| Hook | Location | Replacement | Status |
|------|----------|-------------|--------|
| useResponsive | `shared/hooks/` | Direct theme imports | ORPHAN - delete |

### Deprecated Re-Export Files (Keep as Redirects)

These files serve as import compatibility redirects and should be kept:

| File | Redirects To |
|------|-------------|
| `features/library/stores/myLibraryStore.ts` | `shared/stores/myLibraryStore` |
| `features/profile/stores/kidModeStore.ts` | `shared/stores/kidModeStore` |
| `features/home/hooks/useContinueListening.ts` | `shared/hooks/useContinueListening` |

## Cleanup Actions

### Step 1: Migrate deprecated component imports

Update these files:
- `features/library/components/tabs/AllBooksTab.tsx`
- `features/library/components/tabs/FavoritesTab.tsx`
- `features/library/components/tabs/InProgressTab.tsx`
- `features/library/components/tabs/DownloadedTab.tsx`
- `features/browse/components/NarratorsListContent.tsx`
- `features/browse/components/AuthorsListContent.tsx`

### Step 2: Complete theme color migration

Files still using `useThemeColors()`:
- SearchScreen.tsx
- BookDetailScreen.tsx

### Step 3: Delete orphaned deprecated files

After migration, delete:
- `features/author/components/AuthorCard.tsx`
- `features/narrator/components/NarratorCard.tsx`
- `features/library/components/FannedSeriesCard.tsx`
- `features/home/components/SeriesCard.tsx`
- `shared/hooks/useResponsive.ts`

### Step 4: Address TODO comment

In WishlistScreen.tsx:125, implement the edit sheet or remove the placeholder.
