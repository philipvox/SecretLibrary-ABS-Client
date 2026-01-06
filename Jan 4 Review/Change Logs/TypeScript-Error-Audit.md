# TypeScript Error Audit

**Date:** January 5, 2026
**Branch:** refactor/cdplayer-screen
**Total Errors:** 156

## Executive Summary

The 156 TypeScript errors are **mostly real bugs** (102/156 = 65%), not strict mode warnings. These would cause runtime errors or undefined behavior if not fixed.

---

## Error Breakdown by Category

| Category | Count | Severity |
|----------|-------|----------|
| Undefined variables/scope bugs | 102 | **Critical** |
| Type mismatches | 25 | Medium |
| Implicit any (strict mode) | 11 | Low |
| Missing exports | 4 | Medium |
| Missing dependencies | 2 | Low |
| Duplicate object keys | 2 | Low |

---

## Critical Files (Priority Order)

### 1. ReadingHistoryScreen.tsx — 80 errors

**Problem:** Structural scope bug. Helper components (`Toolbar`, `SearchBar`, etc.) are defined before the main component, but they use `styles` and `COLORS` which are defined inside the main component via `useMemo`.

```typescript
// Lines 213-270: Toolbar uses styles.toolbar, COLORS.accent
// Lines 283-300: SearchBar uses styles.searchBar, COLORS.textTertiary
// ...
// Line 614: COLORS is defined here (inside main component)
// Line 629: styles is defined here (inside main component)
```

**Fix Options:**
1. Move helper components inside the main component (closure access)
2. Pass `styles` and `COLORS` as props to each helper component
3. Move `COLORS` and `styles` definitions to module scope (before helpers)

---

### 2. QueuePanel.tsx — 17 errors

**Problem:** Theme token mismatch. Code expects `colors.light.queue.text`, `colors.light.queue.subtext`, etc. but theme only provides:
- `background`, `itemBackground`, `nowPlaying`, `handle`, `divider`

**Missing tokens:**
- `text`, `subtext`, `badge`, `item`, `itemActive`, `border`
- `colors.light.icon.disabled`

**Fix:** Add missing tokens to `src/shared/theme/colors.ts` queue section.

---

### 3. CDPlayerScreen.tsx — 15 errors

| Line | Issue | Type |
|------|-------|------|
| 547 | `isDirectScrubbing` used before declaration | Variable ordering |
| 571 | `title` doesn't exist on `TimelineChapter` | Type mismatch |
| 1149 | Sort callback with wrong signature | Type error |
| 1149, 1675, 1703, 1723, 1751 | Implicit `any` on parameters | Strict mode |
| 1788, 1798 | `unknown` not assignable to `number` | Type error |
| 1895 | `"speedPanel"` not in type union | Dead code comparison |

---

### 4. FloatingTabBar.tsx — 5 errors

**Problem:** Uses `ICON_COLOR_INACTIVE` as default parameter but never defines it.

```typescript
// Line 59: color = ICON_COLOR_INACTIVE  // undefined!
```

**Fix:** Add constant at top of file:
```typescript
const ICON_COLOR_INACTIVE = 'rgba(0,0,0,0.4)';
```

---

### 5. reading-history-wizard/index.ts — 4 errors

**Problem:** Exports members that don't exist in galleryStore:
- `useIsBookMarked`
- `useMarkedCount`
- `MarkedBook`
- `UndoAction`

**Fix:** Either add these to galleryStore or remove from index.ts.

---

### 6. Other Files (< 3 errors each)

| File | Errors | Issue |
|------|--------|-------|
| JoystickSeekSettingsScreen.tsx | 2 | Undefined `colors` |
| MarkBooksScreen.tsx | 1 | Uses `colors` instead of defined `COLORS` |
| libraryCache.ts | 4 | Implicit any on `.filter()` callbacks |
| automotiveService.ts | 2 | Wrong method names: `resume`, `previousChapter` |
| sentry.ts | 2 | Missing @sentry/react-native module |
| tagMoodMap.ts | 2 | Duplicate object keys |
| Various | 12 | Type compatibility issues |

---

## Strict Mode Warnings (11 total)

These are TS7006 "Parameter implicitly has 'any' type" errors. Low priority but should be fixed for type safety.

```typescript
// Example fixes:
// Before: .filter(w => w.length > 0)
// After:  .filter((w: string) => w.length > 0)

// Before: .sort((a, b) => ...)
// After:  .sort((a: number, b: number) => ...)
```

---

## Recommendations

### Immediate Fixes (blocks compilation)
1. **ReadingHistoryScreen.tsx** - Restructure component scope
2. **FloatingTabBar.tsx** - Add ICON_COLOR_INACTIVE constant
3. **reading-history-wizard/index.ts** - Remove invalid exports

### Theme Token Fixes
4. **QueuePanel.tsx** - Add missing queue theme tokens
5. **JoystickSeekSettingsScreen.tsx** - Import colors from theme

### Type Annotation Fixes
6. **CDPlayerScreen.tsx** - Fix variable ordering, add type annotations
7. **libraryCache.ts** - Add parameter types to callbacks
8. **automotiveService.ts** - Fix method names (resume → play, previousChapter → prevChapter)

### Low Priority
9. **tagMoodMap.ts** - Remove duplicate keys
10. **Test files** - Fix type assertions
11. **sentry.ts** - Install @sentry/react-native or remove file

---

## Estimated Effort

| Priority | Files | Est. Time |
|----------|-------|-----------|
| Critical | 3 | 2-3 hours |
| Medium | 5 | 1-2 hours |
| Low | 8 | 30 min |

**Total: ~4-5 hours to achieve 0 TypeScript errors**
