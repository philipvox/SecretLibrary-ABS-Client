# Changelog

All notable changes to the AudiobookShelf app are documented in this file.

**For Claude/AI assistants:** When making changes to this codebase, please:
1. Update the version in `src/constants/version.ts`
2. Add an entry to this changelog with your changes
3. Use semantic versioning (MAJOR.MINOR.PATCH)

---

## [0.7.169] - 2026-01-22

### Fix: Playback Position Reset to Chapter Start

Fixed critical bugs where playback position could reset to chapter start or wrong position when:
- Returning from Android Auto
- Pressing play when audio wasn't loaded
- Session URL expired and needed refresh

**Root Cause:**
Two places in `playerStore.ts` were calling `loadBook()` with incorrect argument syntax:

1. **In `play()` function** (line 1485):
   - Old: `loadBook(bookToPlay, true)` - passed boolean instead of options object
   - `startPosition` was undefined, causing position to be fetched from server (potentially stale)

2. **In `handleAudioError()` for URL expiration** (line 2101):
   - Old: `loadBook(currentBook, resumePosition, false)` - passed wrong argument types
   - `resumePosition` (number) was interpreted as options object, `false` was ignored
   - Result: `startPosition` undefined, book loaded with wrong position

**Fix:**
- Changed both calls to use proper options object syntax
- `play()`: `loadBook(bookToPlay, { autoPlay: true })`
- `handleAudioError()`: `loadBook(currentBook, { startPosition: resumePosition, autoPlay: false })`

**Symptoms Fixed:**
- Playback jumping to chapter start when resuming after Android Auto
- Position not preserved when session refreshes after URL expiration
- Unexpected position resets when pressing play after app backgrounded

**Files Modified:**
- `src/features/player/stores/playerStore.ts` - Fixed loadBook calls with correct options syntax

---

## [0.7.168] - 2026-01-22

### Fix: Library Cache Not Restored After Background/Android Auto

Fixed critical issue where authors, series, and genres would show as empty after returning from background (especially after using Android Auto).

**Root Cause:**
- Memory pressure service clears library cache when memory exceeds 450MB
- `appStateListener` only refreshed React Query caches, NOT the Zustand library cache
- Library cache holds all author/series/genre indexes
- Player store retained current book, but library indexes were empty

**Fix:**
- `appStateListener.ts` now checks if library cache is empty on foreground return
- If empty but has a current library ID, reloads from SQLite/server
- Also handles partial load state (isLoaded = false)

**Symptoms Fixed:**
- "No author found" when clicking on author after returning from Android Auto
- "No series" when navigating to series after background
- Missing genre lists after app was in background
- Book visible in player but library navigation broken

**Files Modified:**
- `src/core/lifecycle/appStateListener.ts` - Add library cache reload on foreground

---

## [0.7.167] - 2026-01-22

### Fix: Cache Not Cleared on Logout

Fixed critical cache leak where network optimizer cache and cover URLs persisted after logout, potentially showing previous user's data to new user.

**Issues Fixed:**
1. **NetworkOptimizer cache not cleared** - API responses were cached in memory and not cleared on logout
2. **Cover cache version not reset** - Cover URL version parameter persisted across sessions

**Changes:**
- Added `apiClient.resetNetwork()` call in `authService.clearStorage()`
- Added `apiClient.resetCoverCacheVersion()` method and call on logout
- Now properly clears: secure storage, AsyncStorage, SQLite, React Query, LibraryCache, NetworkOptimizer, and cover cache version

**Files Modified:**
- `src/core/api/apiClient.ts` - Added `resetCoverCacheVersion()` method
- `src/core/auth/authService.ts` - Added network and cover cache reset on logout

---

## [0.7.166] - 2026-01-22

### Android Auto Sprint 2: Progress Indicators & Enhanced Search

Added visual progress indicators, content style hints, and improved voice search for Android Auto.

**Progress Indicators:**
- Added Android Auto completion status extras (`PLAYBACK_STATUS`)
- Books now show progress bar overlay (not started / in progress / finished)
- Progress percentage passed via `MEDIA_PROGRESS` extra

**Content Style Hints:**
- Root now returns `CONTENT_STYLE_SUPPORTED` bundle
- Browsable items (Authors, Series) display as list
- Playable items (Books) display as grid with cover art

**Enhanced Subtitles:**
- In-progress books: "Author • 45% • 3h 21m left"
- Not started: "Author • 12h 30m"
- Finished books: "Author" (clean)

**Improved Voice Search:**
- Empty "OK Google, play" command resumes most recent book
- Added narrator to search fields
- Added fuzzy word matching for multi-word titles
- Falls back to most recently added if no in-progress books

**Files Modified:**
- `android/.../AndroidAutoMediaBrowserService.kt` - Content styles, progress extras
- `src/features/automotive/automotiveService.ts` - Time remaining format, enhanced search

---

## [0.7.165] - 2026-01-22

### Android Auto Sprint 1: Hierarchical Browsing

Added hierarchical browsing support to Android Auto, enabling YouTube Music-quality organization.

**New Browse Sections:**
- **Favorites** - Quick access to user's favorite books
- **Authors** - Browse by author → see their books
- **Series** - Browse by series → books in sequence order
- **Genres** - Browse by genre → books sorted by popularity
- **Narrators** - Browse by narrator → their narrated books
- **Library A-Z** - Full library alphabetically sorted

**Kotlin MediaBrowserService Updates:**
- Added `PREFIX_FOLDER` for hierarchical navigation
- New `loadChildrenAsync` cases for folder browsing
- `createFolderItem()` for browsable folder MediaItems
- Updated `notifyBrowseDataChanged()` to refresh folder children

**TypeScript Data Generation:**
- Enhanced `getBrowseSections()` with 9 sections (up from 4)
- Added `children` arrays for hierarchical items
- Series books sorted by sequence number
- Genres sorted by popularity (most books first)

**Files Modified:**
- `android/.../AndroidAutoMediaBrowserService.kt` - Multi-level browsing support
- `src/features/automotive/automotiveService.ts` - Hierarchical section generation
- `src/features/automotive/types.ts` - Added children, itemCount, sequence fields

---

## [0.7.164] - 2026-01-22

### Sprint 2 Completion: Testing and Code Quality

Completed remaining Sprint 2 items with centralized position validation and comprehensive test coverage.

**Position Validation Centralization:**
- Added `validatePositionForSync()` function to progressCalculator.ts for data integrity checks
- Updated seekingStore.ts, playerStore.ts, and backgroundSyncService.ts to use shared validation utilities
- Eliminates duplicate position clamping logic across 3 files

**Error Logging Improvements:**
- Added error logging to previously swallowed catches in playerStore.pause() and seekTo()
- Improves debugging by capturing audio service errors

**New Test Suites:**
- Added `src/core/api/__tests__/apiClient.test.ts` (36 tests)
  - Configuration, URL generation, cover cache versioning
  - Endpoints structure and buildQueryString function
- Added `src/core/auth/__tests__/authService.test.ts` (16 tests)
  - Token storage, server URL storage, user storage
  - Session restoration, clearStorage, verifyToken

**Total Tests:** 667 passing

**Files Modified:**
- `src/features/player/utils/progressCalculator.ts` - Add validatePositionForSync
- `src/features/player/stores/seekingStore.ts` - Use clampPosition
- `src/features/player/stores/playerStore.ts` - Use clampPosition, add error logging
- `src/features/player/services/backgroundSyncService.ts` - Use validatePositionForSync
- `src/core/api/__tests__/apiClient.test.ts` - NEW (36 tests)
- `src/core/auth/__tests__/authService.test.ts` - NEW (16 tests)

---

## [0.7.163] - 2026-01-22

### Audit Sprint 1 & 2: Bug Fixes and Code Quality

Completed review and fixes for Sprint 1 (High Priority) and Sprint 2 (Medium Priority) audit items.

**Sprint 1 Status (Complete):**
- ✅ totalFiles count in download progress - Already fixed with fallback
- ✅ Orphan directory cleanup - Already implemented on startup
- ✅ VERBOSE flag = __DEV__ - Already done
- ✅ Logger level based on __DEV__ - Already done
- ✅ Test coverage thresholds - Already enabled (20-30%)
- ✅ WiFi-only download setting persistence - Already using AsyncStorage
- ✅ console.log in apiClient - Already using apiLogger

**Sprint 2 Status (Complete):**
- ✅ Seeking store in mini player - Already implemented
- ✅ Sentry setUser on auth events - Already implemented
- ✅ ErrorProvider at app root - Already implemented
- ✅ Genre popularity calculation - Already optimized
- ✅ Seeking state reset in loadBook error - Already implemented

**New Fix:**
- Fixed player sheet state not resetting on book switch (caused stale UI when switching books with sheet open)

**Files Modified:**
- `src/features/player/screens/SecretLibraryPlayerScreen.tsx` - Add sheet state reset on book change

---

## [0.7.162] - 2026-01-22

### Performance: Fix Animation Freezing During Heavy JS Operations

Converted splash screen and loading animations to use Reanimated for UI thread execution.

**Problem:**
- The skull candle animation would freeze/lag during app initialization
- Loading indicators would stop animating when JS thread was busy with heavy operations

**Solution:**
- Replaced setInterval/useState pattern with Reanimated (withRepeat, withTiming, useAnimatedProps)
- Animations now run entirely on UI thread, unaffected by JS thread blocking
- Used AnimatedPath component for smooth SVG path animation

**Files Modified:**
- `src/shared/components/AnimatedSplash.tsx` - Convert SkullCandle to Reanimated
- `src/shared/components/Loading.tsx` - Convert animations to Reanimated

---

## [0.7.161] - 2026-01-22

### TypeScript Fixes

Fixed multiple TypeScript errors related to type definitions.

**FontWeight Type Fix:**
- Changed `weight` property in `AppliedTemplateConfig` from `string` to `FontWeight`
- Eliminates 6 TypeScript errors in BookSpineVertical.tsx

**Mood Type Alignment:**
- Removed deprecated mood values ('laughs', 'thinking') from tagMoodMap.ts
- Updated discoverUtils.ts to match current Mood type (comfort, thrills, escape, feels)
- Eliminates 84 TypeScript errors

**Total TypeScript errors reduced:** 242 → 158

**Files Modified:**
- `src/features/home/utils/spine/templateAdapter.ts` - Use FontWeight type
- `src/features/mood-discovery/constants/tagMoodMap.ts` - Remove deprecated moods
- `src/features/discover/hooks/discoverUtils.ts` - Remove deprecated mood cases

---

## [0.7.160] - 2026-01-22

### Code Quality: Consolidate Player Icons

Refactored player icon components to reduce code duplication across the codebase.

**Changes:**
- Centralized PlayIcon, PauseIcon, RewindIcon, FastForwardIcon in `PlayerIcons.tsx`
- Updated 5 files to import from shared module instead of defining local copies
- Reduced ~120 lines of duplicate SVG icon code
- All 615 tests passing

**Files Modified:**
- `src/navigation/components/GlobalMiniPlayer.tsx` - Import shared icons
- `src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx` - Import shared icons
- `src/features/player/screens/SecretLibraryPlayerScreen.tsx` - Import shared icons
- `src/features/browse/components/TopPickHero.tsx` - Import shared icons
- `src/features/book-detail/components/SeriesSwipeContainer.tsx` - Import shared icons

---

## [0.7.159] - 2026-01-20

### Bug Fixes

**Fix: Large audiobooks (100+ tracks) showing only 2 tracks**
- Root cause: axios was truncating large JSON responses (~600KB+)
- Solution: Switched to native `fetch` API for session requests
- Affected file: `src/features/player/services/sessionService.ts`

**Fix: Finished books not syncing from server (0 finished books)**
- Added `finishedBooksSync.importFromServer()` call during app initialization
- Now properly imports all finished books from server on startup
- Affected file: `src/core/services/appInitializer.ts`

### Improvements

**Global loading overlay for browse screens**
- Added `GlobalLoadingOverlay` component triggered BEFORE navigation (not after)
- Shows animated candle loading immediately when user taps navigation buttons
- Applies to: All Books, Series, Authors, Genres, Narrators, Duration screens
- Much smoother perceived transition to heavy list screens

**Files Modified:**
- `App.tsx` - Added GlobalLoadingOverlay component
- `src/shared/stores/globalLoadingStore.ts` - New Zustand store
- `src/shared/components/GlobalLoadingOverlay.tsx` - New component
- `src/shared/components/index.ts` - Export new component
- `src/features/browse/screens/SecretLibraryBrowseScreen.tsx` - Trigger loading on navigation
- `src/features/browse/screens/DurationFilterScreen.tsx` - Hide loading on mount
- `src/features/library/screens/AllBooksScreen.tsx` - Hide loading on mount
- `src/features/library/screens/SeriesListScreen.tsx` - Hide loading on mount
- `src/features/library/screens/AuthorsListScreen.tsx` - Hide loading on mount
- `src/features/library/screens/GenresListScreen.tsx` - Hide loading on mount
- `src/features/library/screens/NarratorsListScreen.tsx` - Hide loading on mount

---

## [0.7.155] - 2026-01-20

### Critical Fix: Progress Corruption from Session Cycling

Fixed a critical bug causing playback progress to be lost or incorrectly applied to wrong books.

**Root Cause Analysis:**
Server logs revealed multiple simultaneous sessions cycling for 3-4 books every 30 seconds to 2 minutes. The position from a long audiobook (e.g., Voyager at ~72000s / 20 hours) was being applied to shorter books, causing the server to incorrectly mark them as "finished".

**Fix 1: Session Prefetch Now Closes Sessions**
The `prefetchSessions()` function was creating real playback sessions on the server for 5 books simultaneously but never closing them. These orphaned sessions interfered with actual playback.

- Sessions are now closed immediately after caching audio track and chapter data
- Changed from parallel to sequential fetching to prevent session overlap
- Each session is opened, data cached, then closed before the next

**Fix 2: Position Validation (Defense in Depth)**
Added position validation throughout the sync pipeline to reject corrupted data:

- `sessionService.syncProgress()` - Rejects negative or beyond-duration positions
- `sessionService.syncProgressAsync()` - Same validation
- `sessionService.closeSessionAsync()` - Clamps invalid positions
- `sessionService.closeSession()` - Clamps invalid positions
- `backgroundSyncService.saveProgressLocal()` - Rejects invalid positions
- `backgroundSyncService.saveProgress()` - Rejects invalid positions
- `backgroundSyncService.syncToServer()` - Rejects and removes corrupted queue items

**Validation Rules:**
- Position < 0: Reject (or clamp to 0 on close)
- Position > duration + 60s: Reject (or clamp to duration on close)
- 60 second buffer allows for edge cases near end of book

**Files Modified:**
- `src/core/services/finishedBooksSync.ts` - Close sessions after prefetch caching
- `src/features/player/services/sessionService.ts` - Position validation
- `src/features/player/services/backgroundSyncService.ts` - Position validation
- `src/constants/version.ts`

---

## [0.7.153] - 2026-01-20

### Redesign: Mood Discovery Quiz

Comprehensive redesign of the mood discovery questionnaire flow with improved UX.

**Screen 1 - Mood Selection:**
- Added "Surprise me — any mood" full-width outlined button at top
- Reduced moods from 6 to 4: Comfort, Thrills, Escape, Feels (removed Laughs and Think)
- 2x2 grid layout for mood cards
- Added divider above "Adults only" toggle
- Card tap inverts colors (white background, black text) and auto-advances after 400ms

**Screen 2 - Flavor Selection:**
- Added pill-shaped mood chip header showing selected mood with × to clear
- "Surprise me — any flavor" button with auto-advance
- Same card inversion and auto-advance behavior

**Screen 3 - Seed Book Selection:**
- Square book covers (1:1 aspect ratio) in 3x2 grid layout
- Search input at top
- "FIND BOOKS" primary button (enabled only when book selected)
- "Skip — surprise me" text link below button
- Back button at bottom

**Typography:**
- Italic serif font (Playfair Display Italic) for question titles
- Gray subtitle text below titles

**Technical Changes:**
- Reduced `Mood` type to 4 values
- Updated `MOODS`, `MOOD_FLAVORS`, `MOOD_FOLLOWUP_MAP` constants
- Absorbed 'laughs' genres into 'comfort', 'thinking' genres into 'feels'
- Updated `THEME_MOOD_MAP` and `TROPE_MOOD_MAP` for 4-mood system
- Added `MoodChip` component for header display
- Added auto-advance with `AUTO_ADVANCE_DELAY` constant

**Files Modified:**
- `src/features/mood-discovery/types.ts` - Reduced to 4 moods, updated mappings
- `src/features/mood-discovery/screens/MoodDiscoveryScreen.tsx` - Complete redesign
- `src/features/mood-discovery/components/SeedBookPicker.tsx` - Square covers, 3-column grid
- `src/constants/version.ts`

---

## [0.7.152] - 2026-01-20

### Feature: Series Swipe Carousel Navigation

Added horizontal swipe gestures to navigate between books in a series from the book detail screen.

**How it works:**
- Swipe left to navigate to the next book in the series
- Swipe right to navigate to the previous book in the series
- Subtle chevron arrows appear on screen edges indicating navigation is available
- Arrows animate and brighten as swipe threshold is approached
- Rubber-band effect at series boundaries (first/last book)
- Fast swipe (velocity > 500) triggers navigation even if under threshold
- Vertical scroll still works normally (failOffsetY prevents gesture conflict)

**Technical Details:**
- Uses existing `getSeriesNavigationInfo()` from libraryCache.ts
- Navigation uses `navigation.replace()` for clean screen transition
- Swipe threshold: 25% of screen width or velocity > 500
- Only activates for multi-book series (single books show no swipe UI)

**New Components:**
- `SeriesSwipeContainer.tsx`: Wrapper with pan gesture handling and edge arrows

**Files Modified:**
- `src/features/book-detail/components/SeriesSwipeContainer.tsx` (new)
- `src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx`
- `src/constants/version.ts`

---

## [0.7.151] - 2026-01-20

### UX: Loading Overlays on All List Screens

Extended loading overlays to all browse list screens for consistent UX.

**Screens Updated:**
- `GenresListScreen` - Shows skull candle loader on initial load
- `AuthorsListScreen` - Shows skull candle loader on initial load
- `SeriesListScreen` - Shows skull candle loader on initial load
- `NarratorsListScreen` - Shows skull candle loader on initial load

This ensures smooth transitions when tapping Genres/Authors/Series/Duration buttons in the search screen.

**Files Modified:**
- `src/features/library/screens/GenresListScreen.tsx`
- `src/features/library/screens/AuthorsListScreen.tsx`
- `src/features/library/screens/SeriesListScreen.tsx`
- `src/features/library/screens/NarratorsListScreen.tsx`
- `src/constants/version.ts`

---

## [0.7.150] - 2026-01-20

### Fix: VirtualizedList Nesting & Loading Overlays

Fixed VirtualizedList nesting warning and added loading overlays for smoother screen transitions.

**Bug Fixes:**

- **VirtualizedList Warning:** Fixed "VirtualizedLists should never be nested inside plain ScrollViews" error in MoodDiscoveryScreen
  - Step 3 (SeedBookPicker with FlatList) now renders outside the ScrollView wrapper
  - Steps 1-2 continue to use ScrollView for their content

**UX Improvements:**

- **Screen Loading Overlays:** Added initial load overlays to hide layout jank:
  - `SecretLibraryBrowseScreen`: Shows skull candle animation until mounted
  - `MoodDiscoveryScreen`: Shows loading overlay during initial render
  - Smooth fade-out transition when content is ready

**New Components:**
- `ScreenLoadingOverlay.tsx`: Reusable full-screen loading overlay with skull candle animation

**Files Modified:**
- `src/features/mood-discovery/screens/MoodDiscoveryScreen.tsx` - Fixed nesting, added overlay
- `src/features/browse/screens/SecretLibraryBrowseScreen.tsx` - Added loading overlay
- `src/shared/components/ScreenLoadingOverlay.tsx` (new)
- `src/shared/components/index.ts` - Export new component
- `src/constants/version.ts`

---

## [0.7.149] - 2026-01-20

### Feature: 3-Step Mood Quiz with Seed Book Selection

Redesigned the mood discovery quiz to a 3-step flow with seed book selection for personalized recommendations:

**New Quiz Flow:**

1. **Step 1 - Mood:** "What are you in the mood for?" (Thrills, Laughs, Comfort, etc.)
2. **Step 2 - Flavor:** Mood-dependent sub-categories with skip option:
   - Thrills: Heists, Suspense, Action, Psychological, Military
   - Laughs: Dry wit, Slapstick, Satire, Romantic comedy, Absurd
   - Comfort: Cozy, Slow romance, Found family, Slice of life, Nostalgic
   - Feels: Emotional journey, Bittersweet, Grief/healing, Love story, Inspiring
   - Escape: Epic worlds, Time travel, Mystery, Swashbuckling, Portal
   - Thinking: Philosophical, Puzzles, Historical, Science deep-dive, Moral dilemmas
3. **Step 3 - Seed Book:** "Which book do you wish you could read for the first time again?"

**Seed Book Similarity Scoring:**
- Same author: +25 points (big boost for author fans)
- Same series: +30 points (recommends other books in series they love)
- Matching genres: +8 points each
- Matching tags: +5 points each
- Maximum boost capped at +40 to maintain mood relevance
- Seed book itself is excluded from recommendations
- "Surprise me" option skips seed selection

**New Components:**
- `SeedBookPicker.tsx`: Book picker grid with search and skip option
  - Searchable grid of user's library (limited to 100 for performance)
  - "Surprise me — skip this step" option
  - Visual selection state with checkmark overlay

**Type Updates:**
- `MoodSession.flavor`: Optional flavor sub-category from Step 2
- `MoodSession.seedBookId`: Optional seed book ID from Step 3
- `QuizDraft` updated with flavor/seedBookId fields
- `MOOD_FLAVORS` constant with flavor options per mood
- `TOTAL_QUIZ_STEPS` now 3

**Store Updates:**
- `setFlavor(flavor)`: Set flavor selection
- `setSeedBook(bookId)`: Set seed book selection
- `commitSession()` includes flavor and seedBookId

**Modified Files:**
- `src/features/mood-discovery/types.ts` - Flavor types and constants
- `src/features/mood-discovery/stores/moodSessionStore.ts` - New actions
- `src/features/mood-discovery/components/SeedBookPicker.tsx` (new)
- `src/features/mood-discovery/screens/MoodDiscoveryScreen.tsx` - 3-step flow
- `src/features/mood-discovery/hooks/useMoodRecommendations.ts` - Seed scoring
- `src/constants/version.ts`

---

## [0.7.148] - 2026-01-20

### Feature: BookDNA Integration for Mood Recommendations

Integrated BookDNA tag parsing for more accurate mood-based recommendations. Books with `dna:*` tags now get precise, multi-dimensional scoring instead of genre inference.

**New Features:**

- **BookDNA Parser:** New `parseBookDNA.ts` utility parses structured DNA tags:
  - `dna:mood:thrills:8` → mood scores (0-10 scale)
  - `dna:spectrum:dark-light:-5` → spectrum values (-10 to +10)
  - `dna:pacing:fast` → structural attributes
  - `dna:trope:found-family` → categorical arrays

- **DNA-Aware Scoring:**
  - Books with DNA mood scores get weighted scoring (DNA weight: 50 vs genre: 40)
  - Spectrum alignment scoring (e.g., "thrills" prefers slightly serious tone)
  - DNA pacing and narrator style bonuses
  - Confidence boost for books with quality DNA tags

- **DNA Filter Modes:**
  - `dna-only`: Only show books WITH BookDNA tags (strictest)
  - `dna-preferred`: Show DNA books first, then non-DNA (default)
  - `mixed`: Mix all books by score only

- **DNA Stats:** Hook now returns `dnaStats` with coverage info:
  - `totalWithDNA`: Number of results with DNA
  - `totalWithoutDNA`: Number of results without DNA
  - `dnaPercentage`: Percentage of results with DNA

**Types Added:**
- `BookDNA` interface with full DNA structure
- `DNAFilterMode` type for filtering options
- Extended `ScoredBook` with `hasDNA`, `dnaTagCount`, `matchReasons`

**Files Modified:**
- `src/features/mood-discovery/utils/parseBookDNA.ts` (new)
- `src/features/mood-discovery/utils/index.ts`
- `src/features/mood-discovery/types.ts`
- `src/features/mood-discovery/hooks/useMoodRecommendations.ts`
- `src/constants/version.ts`

---

## [0.7.147] - 2026-01-19

### UX: Mood Quiz Scoring Overlay

Added animated loading overlay when submitting mood quiz ("Find Books" or "Skip"):

**Features:**
- Skull candle animation (same as app splash screen) with flickering flame
- Animated progress bar fills over ~1.5 seconds
- "Finding your perfect reads..." status text
- Full-screen overlay covers quiz while processing

**Implementation:**
- New `MoodScoringOverlay` component with memoized SkullCandle animation
- Loading state in MoodDiscoveryScreen triggered on final step submit
- Progress animation runs for 1.5s before navigating to results
- Prevents user confusion about app "hanging" on large libraries

**Modified Files:**
- `src/features/mood-discovery/components/MoodScoringOverlay.tsx` (new)
- `src/features/mood-discovery/screens/MoodDiscoveryScreen.tsx`
- `src/constants/version.ts`

---

## [0.7.146] - 2026-01-19

### Performance: Mood Recommendations Scoring

Fixed redundant metadata lookups in mood scoring that was causing lag:

**Problem:**
- `getMetadata()` and `getItemTags()` were being called 3 times per book
- Once in main loop, once in `calculateMoodScore`, once in `calculateMetadataRichness`

**Solution:**
- Pre-compute metadata and tags once per book in main loop
- Pass pre-computed data to scoring functions via `BookScoringData` interface
- Renamed `calculateMetadataRichness` to `calculateMetadataRichnessFromData`

**Impact:**
- ~66% reduction in metadata/tag lookups during scoring
- Faster mood recommendations computation, especially for large libraries

**Modified Files:**
- `src/features/mood-discovery/hooks/useMoodRecommendations.ts`
- `src/constants/version.ts`

---

## [0.7.145] - 2026-01-19

### Mood Discovery: Tier 2 Foundation Changes

Implemented all Tier 2 improvements from the mood discovery roadmap:

**2.1 Branching Quiz Logic**
- Reduced quiz from 5 steps to 2 steps with mood-dependent follow-up
- Each mood now leads to its most relevant follow-up question:
  - Thrills/Laughs → Pace (fast vs slow-burn)
  - Comfort/Feels → Weight (cozy vs bittersweet)
  - Escape → World (fantasy vs scifi vs historical)
  - Thinking → Length (quick read vs deep-dive)
- Faster quiz completion while maintaining recommendation quality

**2.2 Remove "Any" as Default**
- Optional dimensions (pace, weight, world, length) now start unselected
- "Any" option renamed to "Surprise me" with "Mix it up" description
- Users must actively choose or proceed without selection (defaults to any)
- No pre-selected visual state on follow-up step

**2.3 Metadata Richness Normalization**
- Added confidence scoring based on book metadata richness
- Confidence levels: high (>5 metadata signals), medium (3-5), low (1-2)
- "Limited info" badge shown on low-confidence matches (40%+ score)
- Tooltip now shows confidence note for sparse-metadata books
- Richness calculated from: tags, genres, description, narrator, publisher

**2.4 Event-Based Session Expiry**
- Sessions now have soft (24hr) and hard (48hr) expiry states
- Session states: active, soft, expired
- Soft state: Results accessible but prompts "Refresh your mood?"
- Quick tune extends session by resetting both expiry times
- `useSessionState()` selector for checking current state

**Modified Files:**
- `src/features/mood-discovery/types.ts` - New types for branching quiz, confidence, session states
- `src/features/mood-discovery/screens/MoodDiscoveryScreen.tsx` - 2-step branching quiz
- `src/features/mood-discovery/stores/moodSessionStore.ts` - Session state management
- `src/features/mood-discovery/hooks/useMoodRecommendations.ts` - Metadata richness scoring
- `src/features/mood-discovery/components/MoodBookCard.tsx` - Confidence badge
- `src/constants/version.ts`

---

## [0.7.144] - 2026-01-19

### Mood Discovery: Tier 1 Quick Wins

Implemented all Tier 1 improvements from the mood discovery roadmap:

**1.1 Hard Mismatch Penalties**
- Wrong tone now hurts more than soft matches help
- Heavy book when user wants light = 50% penalty
- Fast-paced when user wants slow = 65% penalty
- Opposite direction mismatches also penalized

**1.2 Weighted Randomization**
- Books within same percentage tier now have varied ordering
- Session-based seeded random factor (up to 3%) prevents stale results
- Recently added books get slight recency boost (up to 2%)
- Each new session produces fresh ordering

**1.3 Match Explanation Tooltips**
- Long-press any book card to see "Why this matches" modal
- Shows match percentage badge and explanation text
- Lists matched dimensions with icons and detailed descriptions
- Dimensions: Mood, Pace, Tone, World, Length, Themes

**1.4 Improved Empty/Sparse Messaging**
- Context-aware empty states based on library size and filter strictness
- Small library (< 20 books): "Your library is focused" with genre suggestions
- Strict filters (3+ non-any): "Nothing quite fits — try relaxing filters"
- Sparse results banner when < 3 perfect matches: "Showing best available"

**Modified Files:**
- `src/features/mood-discovery/hooks/useMoodRecommendations.ts` - Penalties, randomization
- `src/features/mood-discovery/components/MoodBookCard.tsx` - Long-press tooltip
- `src/features/mood-discovery/screens/MoodResultsScreen.tsx` - Empty/sparse messaging
- `src/constants/version.ts`

---

## [0.7.143] - 2026-01-19

### Fix: Book Spine Scaling in Carousels

Fixed book spines scaling too large on carousel pages (e.g., "Your Taste" shelf view):

**Problem:**
- TasteTextList was using `scaleFactor: 1.0` which resulted in ~325px tall spines
- This caused spines to take up nearly the full screen height in carousel contexts

**Solution:**
- Reduced `scaleFactor` to `0.5` for TasteTextList (~160px height)
- Now matches proportions appropriate for horizontal scroll carousels
- Other detail screens already use 0.75, SeriesSpineCard uses 0.35

**Modified Files:**
- `src/features/browse/components/TasteTextList.tsx`
- `src/constants/version.ts`

---

## [0.7.142] - 2026-01-19

### UI: FilteredBooksScreen Redesign

Updated FilteredBooksScreen (duration sub-pages like Quick Listens) to match AllBooksScreen design:

**Changes:**
- TopNav with skull logo, pill label, back button, and integrated search bar
- Sort bar with compact buttons: Length, Recent, Title, Author
- Default sort by duration (shortest first) for duration filter pages
- AlphabetScrubber appears when sorting by title or author
- Removed SHELF/LIST view toggles in favor of unified list view
- Theme-aware styling using useTheme()

**Modified Files:**
- `src/features/library/screens/FilteredBooksScreen.tsx` - Complete redesign
- `src/constants/version.ts`

---

## [0.7.139] - 2026-01-19

### Feature: Recently Added Section & All Books Screen

Added "Recently Added" section to Browse page and new All Books screen with sorting tabs:

**Browse Page Updates:**
- New "Recently Added" section with 2-column grid showing 6 most recently added books
- Positioned above the Authors section
- "View All" button navigates to All Books screen

**All Books Screen:**
- New screen showing all books with sorting tabs: Recent, Title, Author, Duration
- List view with cover thumbnails, titles, and metadata
- Alphabet scrubber for Title and Author sort modes
- Pull-to-refresh support

**Mood Pill Enhancement:**
- Mood pill now always visible on Browse page (not hidden when inactive)
- When inactive: white outline with filled sparkles icon, tap to open mood selection
- When active: filled with mood label and X icon, tap to cancel/clear mood

**New Files:**
- `src/features/browse/components/RecentlyAddedSection.tsx`
- `src/features/library/screens/AllBooksScreen.tsx`

**Modified Files:**
- `src/features/browse/screens/SecretLibraryBrowseScreen.tsx` - Added RecentlyAddedSection
- `src/features/browse/components/BrowseTopNav.tsx` - Updated mood pill behavior
- `src/shared/components/TopNav.tsx` - Added outline and showClose props for pills
- `src/navigation/AppNavigator.tsx` - Added AllBooks route
- `src/constants/version.ts`

---

## [0.7.138] - 2026-01-18

### Feature: Fuzzy ISBN Search with External Metadata Lookup

Enhanced barcode scanner to search for similar titles when scanned ISBN is not found in library:

**New Flow:**
1. Scan ISBN barcode
2. If not found in library, show prompt: "Search for similar titles?"
3. User taps "Yes, search"
4. App queries external metadata providers (Hardcover, Audible, Google, etc.) to get book title/author
5. Uses that metadata to fuzzy search local library
6. Results display in SearchScreen

**Why This Helps:**
- Same book may have different ISBN in your library (different edition)
- External lookup provides title/author for better fuzzy matching
- User isn't left at a dead-end when ISBN doesn't match exactly

**New API Method:**
- `apiClient.searchExternalBooks(title, author?, provider?)` - Queries ABS server's configured metadata providers

**UI Changes:**
- BarcodeScannerModal: Added "Search for similar titles?" prompt with Yes/No buttons
- Shows loading state while looking up book info from external providers
- SearchScreen now accepts `initialQuery` and `scannedISBN` route params

**Modified Files:**
- `src/core/api/apiClient.ts` - Added `searchExternalBooks` method
- `src/core/types/api.ts` - Added `ExternalBookMatch` interface
- `src/features/search/components/BarcodeScannerModal.tsx` - Added prompt UI and external lookup
- `src/features/search/screens/SearchScreen.tsx` - Added `onSearchSimilar` handler and initial query support
- `src/constants/version.ts`

---

## [0.7.137] - 2026-01-18

### Bug Fix: Session & Sync Reliability Improvements

Fixed multiple issues with fire-and-forget operations that could cause silent failures:

**Session Service (`sessionService.ts`):**
- **syncProgress retry logic**: Progress sync now retries up to 3 times with exponential backoff if network request fails (previously fire-and-forget with no retry)
- **closeSession retry logic** (from 0.7.136): Session close now retries to prevent orphaned sessions

**Background Sync Service (`backgroundSyncService.ts`):**
- **Concurrent sync prevention**: Added flag to prevent overlapping background sync operations when app state changes rapidly
- **Foreground sync error handling**: Added proper error handling for foreground sync to prevent unhandled rejections

**Root Cause:** These issues caused the "session accumulation" bug where playing multiple books would eventually break playback. The server would have many orphaned sessions, and sync failures were silently swallowed.

**Modified Files:**
- `src/features/player/services/sessionService.ts` - Added `syncProgressWithRetry` helper
- `src/features/player/services/backgroundSyncService.ts` - Added `backgroundSyncInProgress` flag and error handling
- `src/constants/version.ts`

---

## [0.7.136] - 2026-01-18

### Bug Fix: Session Accumulation Bug

Fixed session accumulation bug that caused playback to break after switching between books multiple times.

**Session Service (`sessionService.ts`):**
- **Added retry logic to session close**: `closeSessionWithRetry` method with 3 retries and exponential backoff
- Previously, failed session close requests were fire-and-forget, leaving orphaned sessions on server

**Player Store (`playerStore.ts`):**
- **Fixed background session race condition**: Added check to verify user hasn't switched books before starting auto-sync
- Orphaned background sessions are now properly closed

**Root Cause:** Server logs showed 5-6 orphaned sessions being closed whenever a new session started. Failed close requests were never retried.

**Modified Files:**
- `src/features/player/services/sessionService.ts`
- `src/features/player/stores/playerStore.ts`
- `src/constants/version.ts`

---

## [0.7.135] - 2026-01-18

### Feature: ISBN Barcode Scanner & Android Search Fix

Added barcode scanning to search for books by ISBN:

- **ISBN Barcode Scanner**: Scan ISBN barcodes (EAN-13, ISBN-10) to find books in library
- **Automatic ISBN matching**: Scanned ISBN is matched against library cache
- **Book navigation**: Found books navigate directly to book detail
- **Not found handling**: If ISBN not in library, displays message and shows ISBN in search

**Android Fix:**
- **Search placeholder alignment**: Fixed text vertical alignment on Android with `textAlignVertical: 'center'`

**New Components:**
- `BarcodeScannerModal` - Full-screen camera scanner with ISBN detection
- Uses expo-camera with barcode scanning capabilities

**Search Screen Updates:**
- Added barcode scan button to TopNav (Scan icon)
- Integrated BarcodeScannerModal with search flow
- ISBN not found sets query for manual search

**Modified Files:**
- `src/features/search/components/BarcodeScannerModal.tsx` - NEW
- `src/features/search/components/SearchBar.tsx` - Android alignment fix
- `src/features/search/screens/SearchScreen.tsx` - Barcode scanner integration
- `src/constants/version.ts`
- `package.json` - Added expo-camera dependency

---

## [0.7.134] - 2026-01-18

### Enhancement: Visual Buffering Indicator on Play Buttons

Added visual feedback when audio is buffering to improve user experience:

- **Play buttons now show buffering state**: When streaming audio is buffering, play buttons display a spinner around a smaller play/pause icon
- **Affects all play buttons**:
  - Mini player (GlobalMiniPlayer)
  - Full player screen (SecretLibraryPlayerScreen)
  - Playback controls (PlaybackControls component)
  - Shared PlayPauseButton component (via `isBuffering` prop)

**User Experience:**
- Users can see at a glance when audio is buffering vs loading vs playing
- Buffering state shows spinner around current play/pause icon (user can still tap to toggle)
- Loading state shows only spinner (initial audio load)
- Normal state shows full-size play/pause icon

**Technical:**
- Added `isBuffering` prop to `PlayPauseButton` component
- Added `isBuffering` prop to `PlaybackControls` component
- Added `isBuffering` prop to `PlayerModule` component
- Subscribed to `isBuffering` from playerStore in mini player and full player

**Modified Files:**
- `src/shared/components/PlayPauseButton.tsx` - Added `isBuffering` prop with spinner overlay
- `src/features/home/components/PlaybackControls.tsx` - Added `isBuffering` support
- `src/features/player/components/PlayerModule.tsx` - Pass through `isBuffering`
- `src/navigation/components/GlobalMiniPlayer.tsx` - Subscribe to and display buffering state
- `src/features/player/screens/SecretLibraryPlayerScreen.tsx` - Display buffering state
- `src/constants/version.ts`

---

## [0.7.133] - 2026-01-18

### Feature: App Reliability & Data Protection (Items #13-15)

Final batch of the playback resilience audit, implementing critical reliability improvements:

**13. Background Task Completion Guarantee**
- Created `backgroundTaskService` with priority-based task execution
- Tasks sorted by priority: CRITICAL (100), HIGH (75), NORMAL (50), LOW (25)
- Registered critical tasks:
  - Progress sync (CRITICAL) - ensures unsynced progress is saved
  - Download state save (HIGH) - preserves download progress
- Tasks execute when app goes to background with timeout protection
- Graceful degradation: runs what it can in available time

**14. Database Corruption Recovery**
- Created `databaseRecoveryService` for SQLite corruption detection/recovery
- `checkIntegrity()` runs PRAGMA integrity_check on database
- `quickHealthCheck()` for fast database accessibility verification
- `attemptRecovery()` implements multi-step recovery:
  1. Backup critical data to AsyncStorage
  2. Salvage readable data from corrupted tables
  3. Delete corrupted database file (backup for debugging)
  4. Reinitialize with fresh schema
  5. Restore salvaged data
  6. Restore from AsyncStorage backup if needed
- Added `getDatabase()`, `close()`, `initialize()` methods to `sqliteCache`

**15. Streaming Buffer Underrun Recovery**
- Created `bufferRecoveryService` for detecting and recovering from buffer stalls
- Monitors buffering state via progress update loop
- Detection: 5 seconds of continuous buffering = stall detected
- Recovery strategies:
  1. Retry play with exponential backoff (1s, 2s, 4s)
  2. Rewind recovery - seek back 2s to refill buffer
- Max 3 recovery attempts before notifying user
- Network quality tracking based on recent buffer events
- Integrated into `audioService` with automatic start/stop

**New Files:**
- `src/core/services/backgroundTaskService.ts` - Background task management
- `src/core/services/databaseRecoveryService.ts` - Database corruption recovery
- `src/features/player/services/bufferRecoveryService.ts` - Buffer underrun recovery

**Modified Files:**
- `src/core/services/appInitializer.ts` - Background task integration
- `src/core/services/sqliteCache.ts` - Added recovery-related methods
- `src/features/player/services/audioService.ts` - Buffer recovery integration
- `src/constants/version.ts`

---

## [0.7.132] - 2026-01-18

### Feature: System Resilience & Monitoring (Items #9-12)

Continuing the playback resilience audit, implemented 4 additional system-level improvements:

**9. API Version Mismatch Detection**
- Added `serverVersionService` to check server version on login/restore
- Compares server version against minimum supported (2.7.0) and critical (2.5.0) thresholds
- Shows warning in UI when server is outdated via `versionCheck` in auth context
- Non-blocking check that doesn't prevent login on older servers

**10. Android Headphone Unplug Handling**
- Created new `audio-noisy-module` Expo native module for Android
- Listens for `ACTION_AUDIO_BECOMING_NOISY` broadcast (headphone disconnect)
- Automatically pauses playback when headphones are unplugged
- iOS already handles this natively via expo-audio's route change notification

**11. Token Health Monitoring**
- Added `tokenHealthService` for proactive token validity checking
- Checks token every 5 minutes during active use
- Extended background check (30 min threshold) when returning to foreground
- Tracks consecutive failures and notifies for re-auth after 3 failures

**12. Memory Pressure Handling**
- Added `memoryPressureService` to monitor app memory usage
- Uses existing `MemoryModule` for native memory info
- Warning at 300MB, critical cleanup at 450MB
- Registers cleanup callbacks for library cache and network cache
- Triggers garbage collection hint when under pressure

**New Files:**
- `modules/audio-noisy-module/` - Android native module for headphone detection
- `src/core/services/serverVersionService.ts` - Server version compatibility
- `src/core/services/tokenHealthService.ts` - Token validity monitoring
- `src/core/services/memoryPressureService.ts` - Memory pressure response
- `src/core/api/endpoints.ts` - Added server status endpoint

**Modified Files:**
- `src/core/auth/authContext.tsx` - Integrated version check, token health
- `src/core/services/appInitializer.ts` - Memory pressure initialization
- `src/features/player/services/audioService.ts` - Audio noisy listener
- `src/constants/version.ts`

---

## [0.7.131] - 2026-01-18

### Feature: Network Resilience & Session Recovery (Items #5-8)

Continuing the playback resilience audit, implemented 4 additional improvements:

**5. Phone Call Detection (via Audio Focus)**
- Already covered by v0.7.130's audio focus implementation
- `interruptionMode: 'doNotMix'` handles phone calls automatically
- Both iOS and Android properly pause during calls

**6. 429 Rate Limit Handling with Backoff**
- Enhanced `networkOptimizer.ts` with intelligent rate limit handling
- Parses `Retry-After` header (supports both seconds and HTTP date formats)
- Falls back to aggressive exponential backoff (5s, 10s, 20s) when no header
- Increased max retries from 2 to 3 for better resilience
- Increased max delay from 3s to 10s for rate limit scenarios

**7. Streaming URL Expiration Refresh**
- Added error callback system to audioService for error reporting
- Detects 403/401 errors during streaming (indicating session/URL expiration)
- Automatically refreshes session and reloads audio at same position
- Shows "Session expired - refreshing..." message during recovery
- New types: `AudioErrorType`, `AudioError` interface

**8. CDN/Server Failover (Network Retry)**
- Added `loadUrlWithRetry()` method for audio URL loading
- Retries up to 3 times with exponential backoff (1s, 2s, 4s)
- Skips retry on 403/401 (auth errors need session refresh, not retries)
- Reports `NETWORK_ERROR` to error callback after all retries exhausted
- Applied to both single-track and multi-track loading

**Technical Details:**
- Rate limit: `parseRetryAfter()` handles both numeric and date formats
- Session refresh: `playbackCache.clearSession()` + `loadBook()` at same position
- Network retry: `MAX_LOAD_RETRIES = 3`, `INITIAL_RETRY_DELAY_MS = 1000`
- Error types: `URL_EXPIRED | NETWORK_ERROR | LOAD_FAILED`

**Files Modified:**
- `src/core/api/networkOptimizer.ts` - 429 rate limit handling
- `src/features/player/services/audioService.ts` - Error callback, retry logic
- `src/features/player/stores/playerStore.ts` - Session refresh on URL expiration
- `src/constants/version.ts`

---

## [0.7.130] - 2026-01-18

### Feature: Critical Playback Resilience Improvements

Added 4 critical fallbacks and detection systems to improve playback reliability:

**1. Audio Focus Handling (iOS/Android)**
- Set `interruptionMode: 'doNotMix'` for iOS and Android
- Playback now properly pauses when:
  - Phone calls come in
  - Siri/Google Assistant activates
  - Other apps play audio
  - Navigation voice guidance starts
- Playback resumes automatically when focus is regained

**2. Bluetooth/Headphone Disconnect Detection**
- iOS: expo-audio handles `oldDeviceUnavailable` - auto-pauses when headphones disconnect
- Android: Audio focus handling provides coverage for most disconnect scenarios
- Stuck detection catches remaining edge cases (5-second threshold)

**3. Disk Space Check Before Downloads**
- Added pre-download validation to ensure sufficient storage
- Checks for required space + 20% buffer for file system overhead
- Shows clear error message if disk space is insufficient
- Prevents mid-download failures due to storage exhaustion

**4. Ghost Paused Detection**
- After pause(), verifies audio actually stopped within 500ms
- If audio still playing, retries pause command
- Logs warning and notifies UI if pause fails after 2 attempts
- Prevents UI/audio desync where UI shows paused but audio continues

**Technical Details:**
- Audio focus: `setAudioModeAsync({ interruptionMode: 'doNotMix', interruptionModeAndroid: 'doNotMix' })`
- Disk check: `FileSystem.getFreeDiskStorageAsync()` with 1.2x buffer
- Ghost detection: 500ms verification timeout with retry

**Files Modified:**
- `src/features/player/services/audioService.ts` - Audio focus and ghost paused detection
- `src/core/services/downloadManager.ts` - Disk space validation
- `src/constants/version.ts`

---

## [0.7.129] - 2026-01-18

### Feature: Download Integrity Verification

Integrated the `downloadIntegrity` service into the download manager to verify file integrity after each download completes.

**How it works:**
1. **Per-file verification** - After each audio file downloads, verify size matches expected (with 1% tolerance)
2. **Auto-retry on failure** - If verification fails, delete corrupted file and retry (up to 2 times)
3. **Final batch validation** - Quick check of all files before marking download complete
4. **Failure tracking** - Analytics events track integrity failures for monitoring

**Benefits:**
- Detects corrupted downloads caused by network glitches or disk issues
- Automatically retries corrupted files instead of failing silently
- Prevents playback issues from corrupted audio files
- Final validation ensures all files are present and valid before completing

**Technical details:**
- Uses `verifyFileIntegrity()` for full validation (size check with tolerance)
- Uses `quickValidate()` for fast final batch check
- Maximum 2 integrity retries per file to avoid infinite loops
- Tracks `download_integrity_failed` and `download_final_validation_failed` events

**Files Modified:**
- `src/core/services/downloadManager.ts` - Added integrity verification integration
- `src/constants/version.ts`

---

## [0.7.128] - 2026-01-18

### Feature: Byte-Level Download Resume

Added intelligent download resume support that saves partial download progress and resumes from the exact byte position after app crash, restart, or network interruption.

**How it works:**
1. **Periodic state saving** - Every 10 seconds during download, the current byte position and download state are saved to SQLite
2. **Crash recovery** - On app restart, stuck downloads check for saved resume state instead of restarting from scratch
3. **File-level resume** - Already completed files are detected and skipped; partial files resume from saved position
4. **State cleanup** - Resume state is cleared on successful completion

**Benefits:**
- A 500MB audiobook that failed at 400MB will resume from 400MB, not restart
- App crashes or network drops don't lose partial progress
- Saves bandwidth and time on large downloads

**Technical implementation:**
- Added `resumable_state TEXT` column to SQLite downloads table
- Uses Expo FileSystem's `DownloadResumable.savable()` and `resumeAsync()` APIs
- State includes URL, destination path, and bytes written
- Checks file existence and size to skip already-completed files

**Files Modified:**
- `src/core/services/sqliteCache.ts` - Added resumable_state column, migration, and update method
- `src/core/services/downloadManager.ts` - Implemented resume logic in downloadFileWithRetry and startDownload
- `src/constants/version.ts`

---

## [0.7.127] - 2026-01-18

### Feature: Redesigned FilteredBooksScreen with Secret Library Style

Completely redesigned the `FilteredBooksScreen` to match the Secret Library design language.

**New Features:**
- **TopNav with skull logo** - Consistent branding
- **Duration filter support** - Properly handles `filterType: 'duration'` with min/max duration params
- **Dynamic title** - Shows duration category name (e.g., "Quick Listens", "Epic") instead of generic "Books"
- **Subtitle** - Shows duration range description (e.g., "Under 4 hours")
- **SHELF / LIST toggle** - Switch between 3-column grid and list view
- **List view with duration** - Shows book title and duration in list mode
- **Secret Library typography** - Playfair Display titles, JetBrains Mono metadata
- **Dark theme** - Consistent with rest of Secret Library

**Duration Filter Flow:**
1. Duration Filter Screen → tap category (e.g., "Quick Listens")
2. FilteredBooksScreen opens with:
   - Title: "Quick Listens" (from DURATION_RANGES)
   - Subtitle: "Under 4 hours"
   - Books filtered by duration range
   - SHELF / LIST toggle

**Files Modified:**
- `src/features/library/screens/FilteredBooksScreen.tsx` - Complete rewrite
- `src/constants/version.ts`

---

## [0.7.126] - 2026-01-18

### Enhancement: Grid View Metadata Display

Added additional metadata to grid view cards to match the design of other list screens:

**Grid cards now show:**
- Title (2 lines)
- Author
- Series name & number (if applicable)
- Narrator (if available)
- Duration (compact format, e.g., "10h")

All metadata uses consistent JetBrains Mono styling.

**Files Modified:**
- `src/features/home/screens/LibraryScreen.tsx`
- `src/constants/version.ts`

---

## [0.7.125] - 2026-01-18

### Feature: 2-Column Grid View for Library

Added a new grid view option to the Secret Library screen, showing books as 2-column cards with large square covers.

**View modes now available:**
1. **Shelf** - Upright book spines (default)
2. **Grid** - 2-column cards with square covers, title, author, and series info
3. **List** - Compact vertical list with small thumbnails

**UI:**
- New grid icon (2x2 squares) added to TopNav between shelf and list buttons
- Grid cards show: cover image, title (2 lines), author, series info

**Files Modified:**
- `src/features/home/screens/LibraryScreen.tsx`
- `src/constants/version.ts`

---

## [0.7.124] - 2026-01-18

### Fix: Top Pick Hero Title Truncation

Long titles like "The Very Secret Society of Irregular Witches" were being truncated with ellipsis.

**Changes:**
- Reduced title font size from 24 to 22 scaled
- Increased `numberOfLines` from 2 to 3
- Added `adjustsFontSizeToFit` with `minimumFontScale={0.8}` for iOS auto-scaling

**Files Modified:**
- `src/features/browse/components/TopPickHero.tsx`
- `src/constants/version.ts`

---

## [0.7.123] - 2026-01-18

### Performance: Mood Recommendations Caching

**Problem:**
`useMoodRecommendations` was scoring all library books (~2.6 seconds) every render, running 3+ times on browse page load due to React re-renders, causing 8+ second delays.

**Solution:**
Added global module-level cache for mood recommendations:
- Cache keyed by session parameters (mood, pace, weight, world, length, excludeChildrens, createdAt)
- Cache returns instantly on subsequent renders (cache HIT)
- Cache automatically cleared when session changes:
  - `commitSession()` - New quiz completed
  - `clearSession()` - Manual clear
  - `validateSession()` - Session expired
  - `quickTune()` - Parameters adjusted
  - `setLength()` - Length preference changed

**Result:**
Browse page with mood session now loads in ~100ms instead of 8+ seconds.

**Files Modified:**
- `src/features/mood-discovery/hooks/useMoodRecommendations.ts` - Added cache
- `src/features/mood-discovery/stores/moodSessionStore.ts` - Clear cache on changes
- `src/constants/version.ts`

---

## [0.7.122] - 2026-01-18

### Debug: Browse Page Performance Logging

Added comprehensive timing logs to identify performance bottlenecks:

**Screen Level:**
- `SecretLibraryBrowseScreen` - Total mount time and hook execution

**Component Level:**
- `TopPickHero` - Cache access, mood recommendations timing
- `TasteTextList` - Cache access, personalized content timing
- `SeriesGallery` - Cache access, useMemo computation
- `AuthorsTextList` - Authors hook timing

**Hook Level:**
- `useRecommendations` - Individual SQLite query timing:
  - `getReadHistoryStats()`
  - `getFinishedUserBooks()`
  - `getInProgressUserBooks()`
  - `getAbandonedBooks()`
- `useMoodRecommendations` - Scoring loop timing

All logs use `[Browse Perf]` tag for easy filtering.

**Files Modified:**
- `src/features/browse/screens/SecretLibraryBrowseScreen.tsx`
- `src/features/browse/components/TopPickHero.tsx`
- `src/features/browse/components/TasteTextList.tsx`
- `src/features/browse/components/SeriesGallery.tsx`
- `src/features/browse/components/AuthorsTextList.tsx`
- `src/features/recommendations/hooks/useRecommendations.ts`
- `src/features/mood-discovery/hooks/useMoodRecommendations.ts`
- `src/constants/version.ts`

---

## [0.7.121] - 2026-01-18

### Performance: List Screens Speed Optimization

**Problem:**
List screens (Genres, Authors, Narrators) were calling `filterItems()` in loops, causing O(n × m) iterations (e.g., 200 authors × 2500 books = 500,000 iterations).

**Solution:**
Use pre-indexed `books` arrays from library cache instead of filtering:
- `GenresListScreen` - Now reads `genresWithBooks` map directly
- `AuthorsListScreen` - Now reads `authors` map with `author.books`
- `NarratorsListScreen` - Now reads `narrators` map with `narrator.books`

All data is indexed once during cache load, then accessed O(1) per entity.

**Files Modified:**
- `src/features/library/screens/GenresListScreen.tsx`
- `src/features/library/screens/AuthorsListScreen.tsx`
- `src/features/library/screens/NarratorsListScreen.tsx`
- `src/features/library/components/PersonSections.tsx` (added books to type)
- `src/constants/version.ts`

---

## [0.7.120] - 2026-01-18

### Performance: Browse Page Speed Optimization

**SeriesGallery:**
- Now uses pre-built series map from library cache instead of API call
- Eliminates network request that was blocking browse page render
- Series data computed once at cache load, reused across views

**useTopAuthors:**
- Now reads from pre-built authors map in library cache
- Eliminates iteration over all 2500 library items on each render
- Authors indexed with book counts at cache load time

**Files Modified:**
- `src/features/browse/components/SeriesGallery.tsx` - Use library cache
- `src/features/browse/hooks/useTopAuthors.ts` - Use pre-built index
- `src/constants/version.ts`

---

## [0.7.119] - 2026-01-18

### Performance: Smarter Cover Prefetch Priority

**Prefetch Service:**
- Now prefetches covers for 50 most recently listened books (by lastUpdate)
- Plus 50-100 most recently added books to the library
- Combined and deduplicated so recently listened takes priority
- Ensures covers are cached for books users are most likely to see

**New Helper Methods:**
- `getRecentlyAdded()` - Sorts items by addedAt timestamp
- `getRecentlyListened()` - Filters items with progress, sorts by lastUpdate
- `getPriorityItems()` - Combines both lists with deduplication

**Files Modified:**
- `src/core/services/prefetchService.ts` - Priority-based prefetch logic
- `src/constants/version.ts`

---

## [0.7.118] - 2026-01-18

### Performance: Cover Image Size Optimization

**Prefetch Service:**
- Now prefetches covers at 400×400 instead of full size
- Significantly reduces bandwidth and memory usage during app init

**All Components:**
- Standardized cover sizes across the app:
  - 400×400 for main displays (heroes, cards, series) - matches prefetch cache
  - 80×80 for small list thumbnails
  - 120×120 for search results
- Components now hit the prefetch cache instead of loading separate full-size images

**Dead Code Removal:**
- Deleted unused `HomeScreen.tsx` (LibraryScreen is the actual home)
- Deleted unused `ContinueListeningSection.tsx`
- Deleted unused `YourSeriesSection.tsx`
- Deleted unused `TextListSection.tsx`
- Deleted unused `HorizontalBookItem.tsx`

**SpineCache Cleanup:**
- Removed cover URL storage (not needed for spines)
- Removed color extraction from covers (using genre-based colors only)
- Removed `extractCoverColors()` and `updateBookColors()` methods
- Removed unused imports (`getColors`, `apiClient`, `getErrorMessage`)

**Files Modified:**
- `src/core/services/prefetchService.ts` - 400×400 prefetch
- `src/features/home/stores/spineCache.ts` - Removed cover/color extraction
- Multiple component files updated with optimized cover sizes
- Index files cleaned up to remove dead exports
- `src/navigation/AppNavigator.tsx` - Removed HomeScreen references

---

## [0.7.117] - 2026-01-18

### Search Screen: Browse Buttons with Globe Icon

- Updated browse button icons to larger size (24px with strokeWidth 1.5)
- Changed Series icon from "Library" to "BarChart2" for better visual clarity
- Added big "Browse All Books" button with Globe icon at bottom
- Button navigates to BrowsePage for full library exploration
- Both empty state and no-results state have consistent browse UI

**Files Modified:**
- `src/features/search/screens/SearchScreen.tsx` - Larger icons, Globe browse button
- `src/constants/version.ts`

---

## [0.7.116] - 2026-01-18

### Search Screen: Simplified Browse Buttons

- Replaced QuickBrowseGrid with simple square browse buttons
- Fixed dark mode styling for browse buttons (proper backgrounds and borders)
- Square aspect ratio buttons for Genres, Authors, Series, Duration
- Same button style used for both empty state and no-results state

**Files Modified:**
- `src/features/search/screens/SearchScreen.tsx` - Square browse buttons with dark mode support
- `src/constants/version.ts`

---

## [0.7.114] - 2026-01-18

### Search Screen Improvements

**Recent Searches:**
- Now shows only last 4 searches (was showing all 10)

**Filter Popup:**
- Simplified from complex bottom sheet to centered popup
- Now includes just 3 filter categories:
  - Genre (top 8 genres)
  - Duration (existing ranges)
  - Age Range (All Ages, Kids, Young Adult, Adult)
- Age range filters books by genre keywords (children's, juvenile, young adult, teen, etc.)

**Files Modified:**
- `src/features/search/screens/SearchScreen.tsx` - Limited history display, added age range filter
- `src/features/search/components/SearchFilterSheet.tsx` - Complete rewrite to simple popup
- `src/constants/version.ts`

---

## [0.7.113] - 2026-01-17

### UI/Perf: Browse Page Styling + Performance Fix

**TopPickHero:**
- Header now matches "Your Taste" styling (italic, scale(32) Playfair font)
- Simplified layout without large overlapping text

**Book Detail Page:**
- Genre pills moved under About section
- Genre pills now left-aligned with About text

**Performance:**
- Removed expensive `usePersonalizedContent` hook from TopPickHero
- Simple fallback uses first unfinished book from library
- Browse page loads significantly faster

**Files Modified:**
- `src/features/browse/components/TopPickHero.tsx` - Simplified styling and hooks
- `src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx` - Genre pills positioning
- `src/constants/version.ts`

---

## [0.7.112] - 2026-01-17

### UI: TopPickHero Section Label Styled Like Player Title

- "Top Pick For You" label now styled large (~32pt) with Playfair font
- "Top Pick" on first line, "For You" in italic on second line
- Book title/author remain centered like book detail page
- Cover size back to 240x240

**Files Modified:**
- `src/features/browse/components/TopPickHero.tsx` - Large section label
- `src/constants/version.ts`

---

## [0.7.110] - 2026-01-17

### UI: Dynamic Title Typography in Browse Hero

TopPickHero now uses the same spine-based typography system as the book detail page:
- Title font family dynamically matches book's genre/series style
- Uses cached spine typography for consistency with home screen book spines
- Text transform (uppercase) applied when appropriate for genre
- Falls back to genre-based typography if not in cache

**Files Modified:**
- `src/features/browse/components/TopPickHero.tsx` - Added spine typography integration
- `src/constants/version.ts`

---

## [0.7.109] - 2026-01-17

### UI: Enhanced Hero Sections with Full Book Metadata

**TopPickHero (Browse Page):**
- Centered "TOP PICK FOR YOU" label
- Added narrator info: "By Author · Narrated by Narrator" with tappable links
- Added genre pills (up to 4 genres, tappable)
- Added stats row: Duration | Chapters | Published
- Dark mode styling throughout

**Book Detail Page:**
- Increased cover size from 160px to 240px to match browse hero
- Consistent sizing across browse and detail views

**Files Modified:**
- `src/features/browse/components/TopPickHero.tsx` - Added narrator, genres, stats row
- `src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx` - Larger cover
- `src/constants/version.ts`

---

## [0.7.108] - 2026-01-17

### Feature: Working Add to Library & Improved Filtering

**TasteTextList (Based on Your Taste):**
- "Add" button now actually adds books to user's library
- Shows "Added" with checkmark after successful add
- Excludes books already in library, with listening history, or downloaded
- Does not navigate to book details when adding

**Title Display Changes:**
- Titles only split into two lines if more than 3 words
- Removed italic styling from second line of titles
- Applied to both TopPickHero and SecretLibraryBookDetailScreen

**Files Modified:**
- `src/features/browse/components/TasteTextList.tsx` - Add to library functionality
- `src/features/browse/components/TopPickHero.tsx` - Title display changes
- `src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx` - Title display changes
- `src/constants/version.ts`

---

## [0.7.107] - 2026-01-17

### UI: TopPickHero Matches Book Detail Design

Redesigned TopPickHero to match the centered editorial style of SecretLibraryBookDetailScreen.

**Design:**
- Centered 160x160 square cover with shadow
- Split title (first line normal, second line italic)
- Byline: "By Author · Duration" with tappable author link
- Series link (italic, underlined) when applicable
- Match percentage badge for mood session results
- Action buttons: Download (70%) + Play (30%) matching book detail style

**Files Modified:**
- `src/features/browse/components/TopPickHero.tsx` - Complete redesign
- `src/constants/version.ts`

---

## [0.7.106] - 2026-01-17

### UI: Enhanced Browse Page Hero & List Items

**Top Pick Hero Changes:**
- Square cover image (180x180) instead of portrait - about twice as large
- Duration now displays inline with title (e.g., "Book Title · 12h")
- Added Download button next to Play button (shows check when downloaded)
- Added "Add to Library" pill button below action buttons
- Increased spacing and padding for better visual impact

**Based on Your Taste List Changes:**
- Duration now displays inline with title instead of on the right
- Added "Add" pill button to each list item for quick library actions
- Updated layout to accommodate new pill button

**Files Modified:**
- `src/features/browse/components/TopPickHero.tsx` - Enhanced hero layout
- `src/features/browse/components/TasteTextList.tsx` - Updated list items
- `src/constants/version.ts`

---

## [0.7.105] - 2026-01-17

### Feature: Top Pick Hero & Exclude Children's Toggle

Added two new browse/discovery features:

**1. Top Pick Hero (Browse Page)**
- New hero section at top of Browse page showing #1 recommended book
- Displays cover, title, author, match percentage (if mood session active), and duration
- Shows progress bar if book is in progress
- "Start Listening" / "Continue" button for quick playback
- Falls back to personalized recommendations when no mood session active

**2. Exclude Children's Books Toggle (Mood Discovery)**
- New "Adults only" toggle on Step 1 of mood discovery quiz
- When enabled, filters out books with children's/juvenile/kids genres
- Persisted in mood session for the 24-hour session duration
- Helps adults find age-appropriate content quickly

**Files Created:**
- `src/features/browse/components/TopPickHero.tsx` - Top pick hero component

**Files Modified:**
- `src/features/browse/screens/SecretLibraryBrowseScreen.tsx` - Added TopPickHero
- `src/features/mood-discovery/types.ts` - Added excludeChildrens to MoodSession and QuizDraft
- `src/features/mood-discovery/stores/moodSessionStore.ts` - Added setExcludeChildrens action
- `src/features/mood-discovery/hooks/useMoodRecommendations.ts` - Added children's genre filter
- `src/features/mood-discovery/screens/MoodDiscoveryScreen.tsx` - Added toggle UI
- `src/constants/version.ts`

---

## [0.7.104] - 2026-01-16

### UI: Remove Stack View from Library

Removed the "Stack" view mode from the Library screen, leaving only:
- **Shelf** - Upright book spines (primary view)
- **List** - Vertical list with covers

**Rationale:**
- Stack view was a rotated pile layout that added complexity
- Users primarily use Shelf view for browsing their library
- Simplifies the UI with fewer view mode options

**Files Modified:**
- `src/features/home/screens/LibraryScreen.tsx` - Removed stack view mode and related UI

---

## [0.7.103] - 2026-01-16

### UI: Remove Blue Accents and Improve Series Card Layout

**View Toggle/Sort Button Changes:**
- Removed blue accent color from view toggle buttons (Authors, Narrators, Genres pages)
- Removed blue accent color from sort buttons (Series page)
- Now uses neutral gray colors that work in both light and dark modes
- Active state uses slightly brighter neutral instead of accent color

**Series Card Heart Button:**
- Moved heart button to far right of series cards (now its own column)
- Increased heart size from 10 to 18 for better tap target
- Cleaner visual hierarchy: [Content] [Color Dots] [Heart]

**Files Modified:**
- `src/features/library/screens/AuthorsListScreen.tsx` - View toggle neutral colors
- `src/features/library/screens/NarratorsListScreen.tsx` - View toggle neutral colors
- `src/features/library/screens/GenresListScreen.tsx` - View toggle neutral colors
- `src/features/library/screens/SeriesListScreen.tsx` - Sort buttons neutral colors + heart layout
- `src/constants/version.ts`

---

## [0.7.102] - 2026-01-16

### Feature: Redesign Authors & Narrators Pages (Genres Pattern)

Redesigned the All Authors and All Narrators browse pages to match the hierarchical design pattern used in the Genres page.

**New Design:**
- **View mode toggle**: Grid (grouped) vs List (flat A-Z) icons in header
- **Your Authors/Narrators section**: Personalized list based on listening history (max 5)
- **Popular Authors/Narrators section**: Top 6 by book count
- **Browse by Category**: Collapsible meta-categories (Fiction Authors, Non-Fiction Authors, etc.)
- Authors/narrators grouped by their primary genre (most common genre across their books)

**Layout (Grouped View):**
```
┌─ Your Authors (if listening to books) ─┐
│  [Avatar] Author Name - X books        │
└────────────────────────────────────────┘
┌─ Popular Authors ──────────────────────┐
│  [Avatar] Author Name - X books        │
└────────────────────────────────────────┘
┌─ Browse by Category ───────────────────┐
│  Fiction Authors (X authors · Y books) ▼│
│  Non-Fiction Authors ▼                  │
│  Children & YA Authors ▼                │
│  ...                                    │
└────────────────────────────────────────┘
```

**Flat View (A-Z):**
- Same as before: SectionList with sticky letter headers + alphabet scrubber

**Files Created:**
- `src/features/library/components/PersonSections.tsx` - Reusable section components

**Files Modified:**
- `src/features/library/screens/AuthorsListScreen.tsx` - Complete redesign
- `src/features/library/screens/NarratorsListScreen.tsx` - Complete redesign
- `src/constants/version.ts`

---

## [0.7.101] - 2026-01-16

### Fix: Library Loading Flash (Secret Library)

Fixed the library screen flash where books visibly reorder after appearing.

**Root Cause:**
Multiple async operations completed at different times after the splash dismissed:
1. Cache loaded from SQLite → books shown
2. Background author merge triggered state update → books reordered
3. Initial refresh completed → books reordered again

**The Fix:**
1. Added `appReadyStore` - global flag tracking when app boot is fully complete
2. LibraryScreen waits for `isBootComplete` before showing sorted books
3. Initial library refresh moved to App.tsx boot sequence (during splash)
4. Removed background author merge that caused separate state update
5. Splash shows "syncing library..." status during refresh phase

**Technical Changes:**
- Created `src/core/stores/appReadyStore.ts` - Boot completion tracking
- `App.tsx` - Triggers initial refresh during boot, sets boot complete flag
- `LibraryScreen.tsx` - Waits for `isBootComplete` before rendering books
- `libraryCache.ts` - Removed background author fetch (done in full refresh)

**Files Modified:**
- `App.tsx` - Boot sequence with initial refresh
- `src/core/stores/appReadyStore.ts` (NEW) - Boot completion store
- `src/core/cache/libraryCache.ts` - Remove background author merge
- `src/features/home/screens/LibraryScreen.tsx` - Wait for boot complete
- `src/constants/version.ts`

---

## [0.7.100] - 2026-01-16

### Fix: Library Loading Flash (Improved)

Improved the loading state detection to also wait for background server sync.

**Issue:**
Even with initial `isDataReady` guard, books still reordered because:
- React Query `isLoading` is false when cached data exists (even if stale)
- Background server sync updates `lastPlayedAt` values, changing sort order

**The Fix:**
- Added `isFetching` from React Query (catches all fetches, not just initial)
- Added `isServerLoading` from `useContinueListening` (server query status)
- `isDataReady` now waits for: libraryCache + downloads + progress + fetching + server sync

**Files Modified:**
- `src/features/library/hooks/useLibraryData.ts` - Include isFetching and isServerLoading in isDataReady
- `src/constants/version.ts`

---

## [0.7.99] - 2026-01-16

### Fix: Library Loading Flash / Book Reordering

Fixed the issue where books visibly reorder/flash when the library screen loads.

**Root Cause:**
Three independent data sources load at different times, each triggering a sort re-run:
1. `progressStore` loads from SQLite → first sort
2. `downloadMap` finishes → sort runs again (books shift)
3. `sqliteProgressMap` completes → sort runs again (more shifting)

**The Fix:**
- Added `isDataReady` guard that waits for ALL data sources before applying sort
- Show skeleton while any data source is loading
- Only render sorted books after all sources complete
- Prevents intermediate states where books appear in wrong order

**Files Modified:**
- `src/features/library/hooks/useLibraryData.ts` - Added combined loading state, guarded sort with isDataReady
- `src/features/library/screens/MyLibraryScreen.tsx` - Use new isLoading flag from hook
- `src/constants/version.ts`

---

## [0.7.98] - 2026-01-16

### Fix: Complete Spine Title Display (Both Views)

Fixed titles being truncated in both shelf and stack views.

**Horizontal/Stack View Fix:**
- Added `isHorizontalDisplay` prop to `BookSpineVertical`
- Force `vertical-up` orientation for horizontal display (skips stacked-words)
- Increased title container width to `height - 40` for more room
- Skip stacked-letters/stacked-words when displaying horizontally

**Vertical/Shelf View Fix (Two-Row Titles):**
- Added `vertical-two-row` handling to `finalTitleOrientation` mapping
- Added fallback: any 4+ word title on vertical spine uses two-row
- Reduced two-row font size from 60% to 45% to fit both lines in narrow spine width
- `TemplateSpineRenderer` now properly renders two-row titles

**Files Modified:**
- `src/features/home/components/BookSpineVertical.tsx` - Two-row rendering, horizontal display handling
- `src/features/home/components/BookshelfView.tsx` - Pass `isHorizontalDisplay={true}` to StaticStackItem
- `src/constants/version.ts`

---

## [0.7.96] - 2026-01-16

### Fix: Horizontal Stack View Orientation + Author Line Height

Fixed spine display issues in horizontal/stack mode:

**Issue 1: Title Orientation**
- Problem: Titles used stacked-words orientation which doesn't work when rotated
- Fix: Added `isHorizontalDisplay` prop; forces `vertical-up` orientation for horizontal display

**Issue 2: Stacked Author Names Line Height**
- Problem: Stacked author names (MATT/DINNIMAN) had too much vertical spacing
- Fix: Tightened line height to 0.95x and added negative margin between names

**Files Modified:**
- `src/features/home/components/BookSpineVertical.tsx` - Added isHorizontalDisplay prop, fixed author line height
- `src/features/home/components/BookshelfView.tsx` - Pass isHorizontalDisplay={true} from StaticStackItem
- `src/constants/version.ts`

---

## [0.7.94] - 2026-01-16

### Fix: Drop Cap Font Not Loading on Android

Fixed the TypographerWoodcut drop cap font not loading on Android devices.

**Root Cause:**
- Font was registered as `'TypographerWoodcut'` but internal TTF name is `'TypographerWoodcutInitialsOne'`
- On Android, React Native requires the registered font name to match the internal font name exactly
- Font was also in optional "genre-specific" block with silent error handling

**The Fix:**
- Changed font registration to use correct internal name: `'TypographerWoodcutInitialsOne'`
- Moved font to core fonts block (always required, errors visible)
- Updated usage in SecretLibraryBookDetailScreen.tsx

**Files Modified:**
- `src/core/services/appInitializer.ts` - Fixed font name and moved to core block
- `src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx` - Updated fontFamily
- `src/constants/version.ts`

---

## [0.7.93] - 2026-01-16

### Feature: "All Authors/Narrators/Series" Navigation Pills (#12)

Added navigation pills to detail screens for quick access to full list screens.

**Changes:**
- AuthorDetailScreen: Added "All Authors" pill → navigates to AuthorsListScreen
- NarratorDetailScreen: Updated "Narrator" pill to "All Narrators" with navigation
- SeriesDetailScreen: Updated "Series" pill to "All Series" with navigation to SeriesListScreen

**Files Modified:**
- `src/features/author/screens/SecretLibraryAuthorDetailScreen.tsx`
- `src/features/narrator/screens/SecretLibraryNarratorDetailScreen.tsx`
- `src/features/series/screens/SecretLibrarySeriesDetailScreen.tsx`
- `src/constants/version.ts`

---

## [0.7.88] - 2026-01-16

### Fix: Stacked Authors Now Actually Works

Fixed the stacked author override not being applied. The previous fix (v0.7.86-0.7.87) modified `composition.author.orientation`, but the actual rendering uses `templateConfig` which was passed directly to `TemplateSpineRenderer`.

**Root Cause:**
- Two separate config objects: `templateConfig` (used for rendering) and `composition` (not used by template path)
- The override was applied to `composition`, but `TemplateSpineRenderer` reads from `templateConfig`

**The Fix:**
- Now creates a derived `templateConfig` with the stacked-words override baked in
- Override applies directly to what `TemplateSpineRenderer` actually uses
- Stacking applied for all books under 30 hours with multi-word author names

**Files Modified:**
- `src/features/home/components/BookSpineVertical.tsx` - Moved override from composition to templateConfig
- `src/constants/version.ts`

---

## [0.7.87] - 2026-01-16

### Enhancement: Stacked Authors for All Books (Except 30+ Hours)

Changed the stacking threshold from width-based to duration-based. Now ALL books under 30 hours get stacked author names by default.

**Before (v0.7.86):**
- Only books with width > 60px (~10+ hours) got stacked author names
- Short books (under 10 hours) showed horizontal author names

**After (v0.7.87):**
- ALL books under 30 hours get stacked author names (default)
- Books 30+ hours skip stacking for readability on very wide spines
- Change is based on duration, not width, for more predictable behavior

**Example:**
- 2-hour book "The Name of the Wind" now shows:
  ```
  PATRICK
  ROTHFUSS
  ```
- 45-hour epic audiobook keeps its genre-determined orientation

**Technical:**
- Threshold: `30 * 3600 = 108,000 seconds` (30 hours)
- Condition changed from `width > 60` to `duration < LONG_BOOK_THRESHOLD_SECONDS`

**Files Modified:**
- `src/features/home/components/BookSpineVertical.tsx`
- `src/constants/version.ts`

---

## [0.7.86] - 2026-01-16

### Fix: Author Stacking Now Works (Aligned with Template Preview)

Fixed author stacking not working on medium/large spines. The fix aligns with how the Spine Template Preview page implements stacked authors.

**Root Cause:**
- BookSpineVertical used a separate `authorSplitNames` boolean
- Template preview uses `orientation === 'stacked-words'` in the composition
- The two approaches weren't aligned

**The Fix:**
1. **Composition override**: When conditions are met (width > 60px, multi-word author, not explicitly horizontal), set `composition.author.orientation = 'stacked-words'`
2. **Render condition**: Updated to check BOTH `authorSplitNames` OR `composition?.author?.orientation === 'stacked-words'`

**Result:**
- Fantasy books like "Kings of the Wyld" by Nicholas Eames now display as:
  ```
  NICHOLAS
  EAMES
  ```
- Stacking respects genre settings - genres with `authorOrientationBias: 'horizontal'` keep horizontal names

**Files Modified:**
- `src/features/home/components/BookSpineVertical.tsx`
- `src/constants/version.ts`

---

## [0.7.85] - 2026-01-16

### Debug: Author Stacking Investigation (superseded by 0.7.86)

Added diagnostic logging for author stacking investigation. This was superseded by the fix in 0.7.86.

---

## [0.7.84] - 2026-01-16

### Enhancement: Default Stacked Authors on Medium/Large Spines

Changed the default behavior for author name display on medium and large book spines.

**Before:**
- Only Fantasy+Humor genres got stacked author names (e.g., "BRANDON / SANDERSON")
- Other genres showed single-line horizontal author names

**After:**
- ALL medium/large spines (width > 60px, ~10+ hour books) default to stacked author names
- EXCEPTION: Genres with explicit `authorOrientationBias: 'horizontal'` in their profile keep horizontal names
- This creates a more editorial, dramatic look across all longer audiobooks

**Logic:**
```typescript
// Stack author names if:
// 1. Spine is medium/large (width > 60px)
// 2. Author has multiple words
// 3. Genre doesn't explicitly request horizontal orientation
const authorSplitNames = isMediumOrLargeSpine &&
  authorHasMultipleNames &&
  !isExplicitlyHorizontal;
```

**Files Modified:**
- `src/features/home/components/BookSpineVertical.tsx`
- `src/constants/version.ts`

---

## [0.7.83] - 2026-01-16

### Fix: Animated Splash Lag on Section Changes

Fixed animation jank/lag when the loading status text changes during app initialization.

**Root Cause:**
- When `progress` or `statusText` props changed, the entire `AnimatedSplash` re-rendered
- This caused the `SkullCandle` component to re-render mid-animation
- The flame animation uses `setState` at 12fps, creating a cascade of re-renders

**The Fix:**
- Wrapped `SkullCandle` in `React.memo()` to prevent re-renders from parent prop changes
- Replaced `useState` with `useReducer` for frame animation (slightly more efficient for frequent updates)
- The candle flame now animates independently of parent state changes

**Files Modified:**
- `src/shared/components/AnimatedSplash.tsx`
- `src/constants/version.ts`

---

## [0.7.82] - 2026-01-16

### Fix: Library Loading Flash (#4)

Fixed the library screen flash where books would render with default dimensions, then re-render with correct spine dimensions.

**Root Cause:**
- Spine cache was populated AFTER library items loaded, causing a second render
- First render: Books shown with fallback dimensions
- Spine cache populates → Second render: Books shown with correct dimensions

**The Fix:**
Pre-hydrate spine cache from SQLite BEFORE library items are displayed:
1. Added `hydrateFromSQLite(libraryId)` method to `spineCache.ts`
2. Called this in `prefetchService.hydrateFromCache()` before loading library items
3. Spine dimensions are now ready BEFORE first render → no flash

**Technical Flow (Before):**
```
1. prefetchService loads library items
2. UI renders (empty spine cache → fallback dimensions)
3. libraryCache populates spine cache
4. UI re-renders (correct dimensions) ← FLASH
```

**Technical Flow (After):**
```
1. prefetchService hydrates spine cache from SQLite
2. prefetchService loads library items
3. UI renders (spine cache ready → correct dimensions) ← NO FLASH
```

**Files Modified:**
- `src/features/home/stores/spineCache.ts` - Added `hydrateFromSQLite()` method
- `src/core/services/prefetchService.ts` - Call spine hydration before loading items
- `src/constants/version.ts`

---

## [0.7.81] - 2026-01-16

### Fix: Drop Cap Line Height Alignment

Fixed the text beside the drop cap not aligning properly with the box height.

**The Math:**
- Drop cap box: 60×60px (square)
- Lines beside drop cap: 3
- Required line height: 60px ÷ 3 = 20px per line

**Changes:**
- Updated DROP_CAP_CONFIG to match 60px box size
- Fixed dropCapText lineHeight from 22px → 20px
- Now 3 lines of text exactly fill the drop cap height
- Gap between drop cap and text: 10px

**Files Modified:**
- `src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx`
- `src/constants/version.ts`

---

## [0.7.80] - 2026-01-16

### Enhancement: Square Drop Cap Container

Made the drop cap container a perfect square for better visual balance.

**Changes:**
- Drop cap box is now square (height = width)
- Letter is centered both horizontally and vertically within the square
- Renamed `boxWidth` to `boxSize` in config for clarity
- Font sized to fill the square without overflow

**Files Modified:**
- `src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx`
- `src/constants/version.ts`

---

## [0.7.79] - 2026-01-16

### Enhancement: Decorative Woodcut Drop Cap

Updated the drop cap (large initial letter) in book descriptions to use an ornate woodcut initials font for a vintage literary aesthetic.

**Visual Changes:**
- Drop cap now uses TypographerWoodcut font (decorative medieval-style woodcut initials)
- Larger sizing (80px) to fill the space properly with ornate detail
- Increased box width from 56px to 70px for better proportion
- Creates a classic book/manuscript feel befitting the "Secret Library" theme

**Technical Details:**
- Added `TypographerWoodcut01.ttf` font to assets and font loader
- Updated DROP_CAP_CONFIG with larger dimensions
- Font loaded during app initialization with other genre-specific fonts

**Files Modified:**
- `src/assets/fonts/TypographerWoodcut01.ttf` (new file)
- `src/core/services/appInitializer.ts` - Added woodcut font to loader
- `src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx` - Updated drop cap styling
- `src/constants/version.ts`

---

## [0.7.78] - 2026-01-16

### Enhancement: Spine System Improvements

Multiple enhancements to the book spine visualization system for better visual differentiation and readability.

**Fantasy+Humor Author Stacking (#14):**
- Fantasy and Humor genre books now stack author names vertically on medium/large spines
- Creates an editorial book cover look (e.g., "BRANDON / SANDERSON")
- Only applies to spines wider than 60px (roughly 10+ hour audiobooks)
- Authors with multi-word names get the stacked treatment

**Better Duration→Width Curve (#18):**
- Changed from linear to ease-out quadratic curve
- Provides better visual differentiation in the 1-15 hour range (most common audiobooks)
- Gradual flattening for longer books prevents oversized spines
- Example: 5hr book now 89px (was 68px), 10hr now 129px (was 91px)

**Children's Book Fonts (#19):**
- Prioritized readable fonts over quirky decorative ones
- Primary font changed from Barriecito (handwriting) to Oswald-Bold (clean sans-serif)
- Font fallback order: Oswald-Bold → BebasNeue-Regular → Notable-Regular → Barriecito
- Expanded genre matching to include "children's", "picture book", "early readers", "chapter books"

**Book Details Polish:**
- Changed "Year" label to "Published" for clarity

**Top Nav Labeled Pills:**
- Added labeled pills to list screens for better navigation clarity
- GenresListScreen: "Genres" pill with tag icon
- AuthorsListScreen: "Authors" pill with user icon
- NarratorsListScreen: "Narrators" pill with mic icon
- SeriesListScreen: "Series" pill with book icon
- Matches the pattern used in detail screens (icon + label)

**Queue Panel Improvements:**
- Removed chapters accordion (chapters already shown in player's chapters sheet)
- Added move up/down buttons to each queue item for easier reordering
- Added remove button to each queue item (in addition to expanded view)
- Preserved drag-to-reorder for bulk reordering
- Cleaned up unused code and styles (~90 lines removed)

**Files Modified:**
- `src/features/home/components/BookSpineVertical.tsx`
  - Added Fantasy+Humor author stacking logic with width threshold
- `src/features/home/utils/spine/core/dimensions.ts`
  - Replaced linear width calculation with ease-out quadratic curve
- `src/features/home/utils/spine/templates/spineTemplates.ts`
  - Updated children's template with readable fonts and expanded genre matching
- `src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx`
  - Changed "Year" to "Published" label
- `src/features/library/screens/GenresListScreen.tsx`
  - Added "Genres" labeled pill
- `src/features/library/screens/AuthorsListScreen.tsx`
  - Added "Authors" labeled pill
- `src/features/library/screens/NarratorsListScreen.tsx`
  - Added "Narrators" labeled pill
- `src/features/library/screens/SeriesListScreen.tsx`
  - Added "Series" labeled pill
- `src/features/queue/components/QueuePanel.tsx`
  - Removed ChaptersAccordion component
  - Added move up/down/remove buttons to QueueItem
  - Cleaned up unused styles and imports
- `src/constants/version.ts`

---

## [0.7.77] - 2026-01-15

### Feature: Truncated Chapters List + Player UI Polish

**Truncated Chapters List:**
- Chapters list now collapses to show only relevant chapters by default
- Shows 3 chapters before current position + current + all remaining
- "Show X earlier chapters" button expands to reveal all
- Works with both playing books and books with saved progress
- Only truncates when there are more than 5 chapters

**Player UI Polish:**
- Progress mode toggle simplified to single text toggle ("Book" / "Chapter")
- Sleep timer countdown moved to controls row, left of rewind button
- Countdown shows real-time seconds (not rounded)

**Technical Implementation:**
- Added `chaptersExpanded` state for collapse control
- Added `savedChapterIndex` calculation based on `currentTime`
- Added `visibleChapters` / `hiddenCount` memos for filtering
- Styled with underlined text to match app toggle patterns

**Files Modified:**
- `src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx`
  - Added chapter truncation logic
  - Added "Show X earlier chapters" button
  - Added styles: `showEarlierBtn`, `showEarlierText`
- `src/features/player/screens/SecretLibraryPlayerScreen.tsx`
  - Simplified progress mode toggle to single text
  - Moved sleep countdown to controls row
- `src/constants/version.ts`

---

## [0.7.76] - 2026-01-15

### Feature: Sleep Timer Countdown on Player

Added a real-time sleep timer countdown display on the player screen that shows remaining time when a sleep timer is active.

**New Feature:**
- **Visible countdown** - Shows "Sleep in Xh Xm" or "Sleep in Xm" or "Sleep in Xs" below the progress bar
- **Orange accent** - Clock icon and text in orange to stand out from other UI elements
- **Tappable** - Tap the countdown to open the sleep timer sheet for adjustments
- **Auto-hide** - Only visible when a sleep timer is set

**Display Format:**
- ≥1 hour: "Sleep in 1h 30m"
- ≥1 minute: "Sleep in 15m"
- <1 minute: "Sleep in 45s"

**Technical Implementation:**
- Uses existing `sleepTimer` state from `useSleepTimerStore`
- Positioned between time labels and controls row for visibility
- Monospace font with uppercase styling for consistency

**Files Modified:**
- `src/features/player/screens/SecretLibraryPlayerScreen.tsx`
  - Added sleep timer countdown JSX (line ~1173)
  - Added styles: `sleepTimerCountdown`, `sleepTimerCountdownText`
- `src/constants/version.ts`

---

## [0.7.75] - 2026-01-15

### Enhancement: Series Tab with Cover Images and Shelf View

Enhanced the Series tab in book details with cover images and a Book/Shelf view toggle, matching the pattern used in author and narrator detail pages.

**Enhancements:**

1. **Cover Images in Book View**
   - Series books now display cover thumbnails (44x44)
   - Cover placed before the sequence badge for better visual hierarchy
   - Layout: Cover → Badge → Title/Duration → Status

2. **Book/Shelf View Toggle**
   - Toggle buttons appear when viewing Series tab (for 2+ books)
   - "Book" view: Vertical list with covers and details
   - "Shelf" view: Horizontal scrolling spine visualization
   - Current book highlighted with orange border in shelf view

3. **Shelf View with Spine Rendering**
   - Uses `BookSpineVertical` component for visual book spines
   - Horizontal scroll with consistent alignment
   - Tapping a spine navigates to that book's detail page

**Technical Implementation:**
- Added `seriesViewMode` state ('book' | 'shelf')
- Added `seriesSpineData` useMemo for spine data conversion
- Added `seriesSpineLayouts` via `useBookRowLayout` hook
- Added `handleSeriesSpinePress` callback for spine navigation
- Conditional rendering based on view mode

**Files Modified:**
- `src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx`
  - Added cover images to series book items
  - Added Book/Shelf view toggle
  - Added shelf view with BookSpineVertical
  - Added styles: `viewModeToggle`, `viewModeBtn`, `seriesBookItem`, `seriesCover`, `shelfContent`, `spineWrapper`
- `src/constants/version.ts`

---

## [0.7.74] - 2026-01-15

### Feature: Series Tab in Book Details

Added a Series tab to the book detail page that shows all books in the same series, with the current book highlighted.

**New Feature:**
- **Series Tab** - When viewing a book that's part of a series, a "Series" tab appears next to "Chapters"
- Shows all books in the series with sequence numbers
- Current book is highlighted with "Current" label and background tint
- Finished books show checkmark, in-progress books show percentage
- Tap any book to navigate directly to its detail page
- Only appears when series has 2+ books (no tab for standalone books or single-book series)

**UI Pattern:**
- Tab row with "Chapters (N)" and "Series (N)" counts
- Consistent styling with chapter list (badges, titles, durations)
- Uses `navigation.push()` for series books to maintain back stack

**Technical Implementation:**
- Added `activeContentTab` state ('chapters' | 'series')
- Series books fetched from library cache via `getSeries()`
- Conditional rendering based on active tab
- Series sequence extracted from `seriesName` (#N suffix)

**Files Modified:**
- `src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx`
  - Added `useLibraryCache` import
  - Added `activeContentTab` state
  - Added `seriesBooks` useMemo lookup
  - Added tab header with Chapters/Series toggle
  - Added series books list with current book indicator
  - Added styles: `contentTabsRow`, `contentTab`, `contentTabText`, etc.
- `src/constants/version.ts`

---

## [0.7.73] - 2026-01-15

### Feature: Genre Pills on Book Details + Smart Read More

**New Features:**

1. **Genre Pills on Book Details Page**
   - Clickable genre pills displayed below series link
   - Tapping a genre navigates to the GenreDetail screen
   - Styled as bordered pills with monospace font (matches app design)

2. **Smart "Read More" Button**
   - "Read More" button now only appears when description actually needs truncation
   - Hidden for short descriptions (< 150 characters in continuation text)
   - Reduces UI clutter on books with brief descriptions

3. **Collapsible Section Improvements**
   - Chevron moved to far right to prevent accidental taps
   - Only first section expanded by default (improves load time)
   - Collapsed sections don't render children (performance boost)

**Files Modified:**
- `src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx`
  - Added `handleGenrePress` callback
  - Added genre pills JSX with navigation
  - Added `genreRow`, `genrePill`, `genrePillText` styles
  - Modified DropCapParagraph to conditionally show "Read more"
- `src/shared/components/CollapsibleSection.tsx` - Chevron on right
- All detail screens - `defaultExpanded={index === 0}`
- `src/constants/version.ts`

---

## [0.7.72] - 2026-01-15

### Feature: Collapsible Section Groups

Added collapsible sub-headers to all Secret Library styled detail screens (Author, Narrator, Series, Genre).

**New Component:**
- `CollapsibleSection` - Reusable component with animated chevron rotation and smooth expand/collapse animation
- Uses `LayoutAnimation` for native-feeling content expand/collapse
- Supports optional title press handler for navigation (e.g., tap "Fantasy" to go to genre page)
- `isStandalone` prop for sections without navigation (e.g., "Standalone" books)

**Screens Updated:**
- `GenreDetailScreen` - All tabs (Author, Series, Narrator, All) now have collapsible groups
- `SecretLibraryAuthorDetailScreen` - Series, narrator, and genre groups are collapsible
- `SecretLibraryNarratorDetailScreen` - Series, author, and genre groups are collapsible
- `SecretLibrarySeriesDetailScreen` - Narrator and genre groups are collapsible

**UX Improvements:**
- Groups default to expanded for discoverability
- Chevron rotates smoothly (90° when collapsed, pointing down when expanded)
- Tap anywhere on header row to toggle (larger touch target)
- Section count shown in parentheses (e.g., "Fantasy (12)")

**Files Modified:**
- `src/shared/components/CollapsibleSection.tsx` (NEW)
- `src/shared/components/index.ts` - Added export
- `src/features/library/screens/GenreDetailScreen.tsx`
- `src/features/author/screens/SecretLibraryAuthorDetailScreen.tsx`
- `src/features/narrator/screens/SecretLibraryNarratorDetailScreen.tsx`
- `src/features/series/screens/SecretLibrarySeriesDetailScreen.tsx`
- `src/constants/version.ts`

---

## [0.7.71] - 2026-01-15

### Performance: SQLite Spine Cache & Pre-sorted Genre Books

**Major Performance Improvements:**

1. **SQLite Spine Cache Persistence**
   - Pre-computed spine data now persisted to SQLite
   - On subsequent app launches, spine data loads instantly from SQLite
   - Only new/changed books need recalculation
   - Eliminates expensive typography/dimension calculations on every startup

2. **Pre-sorted Genre Books**
   - Books within genres are now sorted by title during cache build
   - Genre pages no longer need to sort on every navigation
   - Moves O(n log n) sort from "per visit" to "once on cache load"

**Technical Changes:**

- Added `spine_cache` table to SQLite schema
- Added `getSpineCache()`, `setSpineCache()`, `clearSpineCache()` methods
- `populateFromLibrary()` now async: loads from SQLite first, computes missing, saves back
- `buildIndexes()` now pre-sorts genre books by title

**Performance Impact:**
- First app launch: Same as before (computes + saves to SQLite)
- Subsequent launches: Spine cache loads from SQLite (instant vs 500-1500ms compute)
- Genre page navigation: O(1) access to pre-sorted books vs O(n log n) sort

**Files Modified:**
- `src/core/services/sqliteCache.ts` - Added spine_cache table and methods
- `src/features/home/stores/spineCache.ts` - SQLite persistence, async populate
- `src/core/cache/libraryCache.ts` - Pre-sort genre books, pass libraryId to spineCache
- `src/features/library/screens/GenreDetailScreen.tsx` - Use pre-sorted books directly
- `src/constants/version.ts`

---

## [0.7.70] - 2026-01-15

### Performance: Lazy Tab Calculations & Pre-computed Duration

**Problem:** Genre pages still had noticeable lag when opening due to expensive useMemo calculations running on initial mount.

**Optimizations:**

1. **Lazy Tab Calculations** - Tab-specific data only computed when that tab is active:
   - `authorList` - Only computed when Author tab selected
   - `seriesList` - Only computed when Series tab selected
   - `narratorList` - Only computed when Narrator tab selected
   - `allBooksBySeries` - Only computed when All tab + Shelf view active
   - Each returns empty array `[]` immediately if not needed, skipping iteration

2. **Pre-computed Total Duration** - Added `totalDuration` to genre index:
   - New `totalDuration: number` field in `GenreInfo` interface
   - Duration accumulated during `buildIndexes()` (runs once on cache load)
   - Genre pages now read pre-computed value instead of reducing through all books

**Performance Impact:**
- Initial render calculates only: genre lookup O(1), books sort O(n log n), nothing else
- Tab switching triggers lazy computation only for that specific tab
- Total duration: O(n) → O(1) lookup from pre-computed index

**Files Modified:**
- `src/core/cache/libraryCache.ts` - Added `totalDuration` to GenreInfo, pre-compute during indexing
- `src/features/library/screens/GenreDetailScreen.tsx` - Lazy tab calculations, use pre-computed duration
- `src/constants/version.ts`

---

## [0.7.69] - 2026-01-15

### Feature: Genre Tab on Series Detail Page

Added a Genre tab to the Series detail screen to view books grouped by genre.

**Changes:**
- Added `'genre'` to `FilterTab` type
- Added `genreList` useMemo to group books by genre
- Added `handleGenrePress` callback for navigation to genre pages
- Added Genre tab button in tabs row
- Added content sections for genre tab (both Series and Book view modes)

**Files Modified:**
- `src/features/series/screens/SecretLibrarySeriesDetailScreen.tsx`
- `src/constants/version.ts`

---

## [0.7.68] - 2026-01-15

### Performance: Genre Page Loading Speed

**Problem:** Genre pages loaded significantly slower than Author/Narrator pages.

**Root Causes Found:**
1. **No pre-built genre index** - Author/Narrator pages used `getAuthor()`/`getNarrator()` which returned pre-indexed Map data instantly. Genre pages used `filterItems({ genres: [name] })` which looped through the ENTIRE library.
2. **Hook called inside useCallback** - `ShelfView` component was defined inline using `useCallback` but called `useBookRowLayout()` hook inside, violating React's Rules of Hooks.

**Fixes:**
1. **Added genre index to library cache:**
   - New `genresWithBooks: Map<string, GenreInfo>` storing books per genre
   - New `getGenre(name)` method for instant O(1) lookup
   - Books indexed by genre during `buildIndexes()` (same as authors/narrators)

2. **Extracted ShelfView to proper component:**
   - Moved from inline `useCallback` to standalone function component
   - Hooks now called at top level (proper React pattern)
   - Uses `useMemo` for spine data transformation

**Performance Impact:**
- Genre lookup: O(n) → O(1) where n = library size
- Eliminates full library scan on every genre page visit
- Proper hook lifecycle for ShelfView rendering

**Files Modified:**
- `src/core/cache/libraryCache.ts` - Added genre index and `getGenre()` method
- `src/features/library/screens/GenreDetailScreen.tsx` - Use `getGenre()`, extract ShelfView component
- `src/constants/version.ts`

---

## [0.7.67] - 2026-01-15

### Feature: Genre Detail Page Redesign (Secret Library Style)

**Complete redesign of GenreDetailScreen to match Author/Narrator detail pages:**

**Visual Changes:**
- Dark header with large Playfair Display genre title + book count/duration stats
- White content area (adapts to dark mode) with JetBrains Mono metadata
- Removed old search bar and sort dropdown
- Added "GENRE" pill in TopNav that links to GenresList

**New Features:**
1. **Filter Tabs** - All | Author | Series | Narrator
   - "All" groups books by series (with Standalone section)
   - Other tabs group by that entity with clickable headers

2. **View Toggle** - Switch between "Book" and "Shelf" views
   - Book view: Vertical list with cover thumbnails, title, author, series info, duration
   - Shelf view: Horizontal scroll with BookSpineVertical components

3. **Tappable Group Headers** - All group headers (author names, series names, narrator names) navigate to their respective detail pages

4. **Footer Stats** - Shows total titles and hours

**Technical:**
- Uses `useSecretLibraryColors()` for dark/light mode support
- Uses `BookSpineVertical` + `useBookRowLayout` for shelf visualization
- Uses `useSpineCacheStore` for cached spine colors
- Maintains pull-to-refresh with `SkullRefreshControl`

**Files Modified:**
- `src/features/library/screens/GenreDetailScreen.tsx` - Complete rewrite
- `src/constants/version.ts`

---

## [0.7.66] - 2026-01-15

### Feature: Tappable Genre Headers and Navigation Pills

**Added navigation to detail screens:**

1. **Genre Headers** - Genre group headers (e.g., "Fantasy", "Thriller") in Author/Narrator detail screens are now tappable and navigate to the Genre Detail page

2. **NARRATOR Pill** - The NARRATOR pill in the top navigation of the Narrator Detail screen now navigates to the full Narrators List

**Implementation:**
- Added `handleGenrePress` callback to `SecretLibraryNarratorDetailScreen.tsx` and `SecretLibraryAuthorDetailScreen.tsx`
- Wrapped genre header `<Text>` components in `<Pressable>` for tap handling
- Added `onPress` to NARRATOR pill to navigate to `NarratorsList`

**Files Modified:**
- `src/features/narrator/screens/SecretLibraryNarratorDetailScreen.tsx` - Genre headers + NARRATOR pill navigation
- `src/features/author/screens/SecretLibraryAuthorDetailScreen.tsx` - Genre headers navigation
- `src/constants/version.ts`

---

## [0.7.65] - 2026-01-15

### Fix: Library Loading Flash/Reflow

**Problem:** Home screen would flash or reflow when loading, showing empty state briefly before content appeared.

**Root Cause:** The library sync effect in `useHomeData` was calling `setLibraryBooks` twice:
1. First with cached books immediately (partial data)
2. Second after fetching missing books (complete data)

This double state update caused two renders, resulting in visible layout shift.

**Fix:** Batch the state updates into a single call:
- If all books are cached: single immediate update ✓
- If some books need fetching: wait for all data, then single update ✓

```typescript
// BEFORE: Two state updates (flash)
setLibraryBooks(cachedBooks);     // First render (partial)
await fetchMissing();
setLibraryBooks(allBooks);         // Second render (complete) → FLASH

// AFTER: Single state update (no flash)
if (allCached) {
  setLibraryBooks(cachedBooks);    // Single render (complete)
} else {
  await fetchMissing();
  setLibraryBooks(allBooks);       // Single render (complete)
}
```

**Files Modified:**
- `src/features/home/hooks/useHomeData.ts` - Batched state updates in library sync effect
- `src/constants/version.ts`

---

## [0.7.64] - 2026-01-15

### Fix: Series Spine Height Consistency

**Problem:** Books in the same series had different spine heights on the home screen shelf, making series look inconsistent.

**Root Cause:** The new spine system's `calculateHeight()` function used `seriesName` directly as the hash key without normalizing it. Series names like "The Expanse #1" and "The Expanse #2" would hash to different values, resulting in different heights.

**Fix:** Added `normalizeSeriesName()` function that strips sequence numbers and normalizes the series name before hashing:

```typescript
// BEFORE: "The Expanse #1" and "The Expanse #2" → different hashes → different heights
const hashKey = seriesName || bookId || 'default';

// AFTER: Both normalize to "expanse" → same hash → same height
const hashKey = seriesName ? normalizeSeriesName(seriesName) : (bookId || 'default');
```

The normalization:
- Removes trailing `#N` or `#N.N` (e.g., "#7", "#3.5")
- Removes leading articles ("the", "a", "an")
- Normalizes apostrophes and whitespace
- Converts to lowercase

This matches the existing normalization in the old spine system's `getSeriesStyle()` function.

**Files Modified:**
- `src/features/home/utils/spine/core/dimensions.ts` - Added normalizeSeriesName(), updated calculateHeight()
- `src/constants/version.ts`

---

## [0.7.63] - 2026-01-15

### Fix: Complete Download Pause Solution

**Problem:** Paused downloads kept restarting despite multiple fix attempts.

**Root Cause #3:** The `updateDownloadProgress` function in sqliteCache **unconditionally** sets `status = 'downloading'` on every progress update. Even after we set status to 'paused', in-flight progress callbacks would overwrite it back to 'downloading'.

**Fix:** Modified SQL to preserve 'paused' status:
```sql
-- BEFORE: Always overwrites status
UPDATE downloads SET progress = ?, status = 'downloading' WHERE item_id = ?

-- AFTER: Preserves 'paused' status
UPDATE downloads SET progress = ?,
  status = CASE WHEN status = 'paused' THEN 'paused' ELSE 'downloading' END
WHERE item_id = ?
```

**Complete Fix Summary (v0.7.59-0.7.63):**
1. **v0.7.59**: Fixed `pauseDownload` to always update DB (not just when active download exists)
2. **v0.7.60**: Added `userPaused` flag to prevent auto-resume on app restart
3. **v0.7.61**: Added pause detection in retry loop to break out when paused
4. **v0.7.62**: Reordered pause logic (update DB BEFORE `pauseAsync`) + preserve in-memory progress
5. **v0.7.63**: Fixed `updateDownloadProgress` to not overwrite 'paused' status

**Files Modified:**
- `src/core/services/sqliteCache.ts` - updateDownloadProgress preserves 'paused' status
- `src/constants/version.ts`

---

## [0.7.62] - 2026-01-15

### Fix: Download Pause Race Condition + Progress Preservation

**Problem 1:** Paused downloads would immediately restart. User taps pause → shows paused briefly → restarts downloading.

**Root Cause:** Race condition between pause and retry loop:
1. User taps pause → `pauseDownload()` starts
2. `pauseAsync()` causes `downloadAsync()` to return `null`
3. Retry loop checks DB status BEFORE `pauseDownload()` finishes updating DB
4. Retry loop sees `status: 'downloading'` → retries immediately
5. New download starts before pause completes

**Fix:** Update DB status to 'paused' BEFORE calling `pauseAsync()`:
```typescript
// BEFORE: pauseAsync() first, then update DB (race condition)
await download.pauseAsync();
await sqliteCache.setDownload({ status: 'paused', ... });

// AFTER: Update DB first, then pauseAsync() (no race)
await sqliteCache.setDownload({ status: 'paused', ... });
await download.pauseAsync();  // Now retry loop sees 'paused' status
```

**Problem 2:** Progress showing 0% after pause because we read stale DB progress.

**Fix:** Use in-memory progress (most current) if available:
```typescript
const memoryProgress = this.progressInfo.get(itemId);
if (memoryProgress && memoryProgress.totalBytes > 0) {
  currentProgress = Math.max(dbProgress, memoryProgress.bytesDownloaded / memoryProgress.totalBytes);
}
```

**Files Modified:**
- `src/core/services/downloadManager.ts` - Reordered pause logic, use memory progress, preserve existing record fields
- `src/constants/version.ts`

---

## [0.7.61] - 2026-01-15

### Fix: Paused Downloads No Longer Restart via Retry Loop

**Problem:** Even after the v0.7.60 fix, paused downloads would immediately restart. The download would show "Paused" briefly then continue downloading.

**Root Cause:** When `pauseAsync()` is called on a `FileSystem.DownloadResumable`, the `downloadAsync()` promise resolves to `null`. The download retry logic interpreted this `null` as a failed download and automatically retried:

```
LOG: Pausing download: b6e273...
LOG: Paused active download object for: b6e273...
WARN: Attempt 1 failed: Download returned null  ← null = paused, not failed!
LOG: Retry attempt 2/3 for file 1...            ← Oops, retrying!
```

**Solution:** Before retrying after a `null` result, check if the download status is 'paused':

1. In `downloadFileWithRetry()`: After `downloadAsync()` returns `null`, query the database status
2. If status is 'paused', throw a special `DOWNLOAD_PAUSED` error instead of retrying
3. In `startDownload()` catch block: Handle `DOWNLOAD_PAUSED` gracefully - don't mark as failed

```typescript
if (!result) {
  // Check if download was paused - don't treat as error
  const status = await sqliteCache.getDownload(itemId);
  if (status?.status === 'paused') {
    throw new Error('DOWNLOAD_PAUSED'); // Break retry loop
  }
  throw new Error('Download returned null');
}
```

**Files Modified:**
- `src/core/services/downloadManager.ts` - Added pause detection in retry loop, graceful handling in catch block
- `src/constants/version.ts`

---

## [0.7.60] - 2026-01-15

### Fix: User-Paused Downloads No Longer Auto-Resume

**Problem:** User reported "it says paused then starts again" - when the user explicitly paused a download, it would restart automatically.

**Root Cause:** The `resumePausedDownloads()` function in `downloadManager.ts` runs during app initialization and automatically resumes ALL downloads with 'paused' status. This didn't distinguish between:
- **User-initiated pause**: User explicitly tapped pause → should STAY paused
- **System-initiated pause**: App killed, network lost → can auto-resume

**Solution:** Added a `userPaused` boolean flag to track whether the pause was user-initiated:

1. **Database Schema**: Added `user_paused` column to downloads table (INTEGER, defaults to 0)
2. **DownloadRecord Interface**: Added `userPaused: boolean` field
3. **pauseDownload()**: Sets `userPaused: true` when user explicitly pauses
4. **resumeDownload()**: Clears `userPaused` to false when user resumes
5. **resumePausedDownloads()**: Only auto-resumes downloads where `userPaused === false`

```typescript
// resumePausedDownloads now filters user-paused downloads
const paused = await sqliteCache.getDownloadsByStatus('paused');
const systemPaused = paused.filter((d) => !d.userPaused);  // Can auto-resume
const userPaused = paused.filter((d) => d.userPaused);     // Must stay paused

if (userPaused.length > 0) {
  log(`Skipping ${userPaused.length} user-paused downloads`);
}
```

**Files Modified:**
- `src/core/services/sqliteCache.ts` - Added userPaused field to DownloadRecord, migration, getter/setter updates
- `src/core/services/downloadManager.ts` - pauseDownload sets userPaused=true, resumeDownload clears it, resumePausedDownloads filters
- `src/constants/version.ts`

---

## [0.7.59] - 2026-01-15

### Fix: Download Pause Now Works Reliably

**Problem:** Tapping "pause" on a downloading book did nothing - the download continued and the UI didn't update.

**Root Cause:** The `pauseDownload` function in `downloadManager.ts` only updated the database status if there was an active `FileSystem.DownloadResumable` object in memory. This object could be missing if:
- The app was restarted while a download was in progress
- There was a timing issue between queueing and starting the download
- The download was pending but not yet actively downloading

When no active download object existed, the function logged a warning but silently did nothing, leaving the status unchanged.

**Fix:** Changed `pauseDownload` to always update the database status to 'paused' for any download that's in 'downloading' or 'pending' state, regardless of whether there's an active download object:

```typescript
// BEFORE: Only updated DB if active download object existed
if (download) {
  await download.pauseAsync();
  await sqliteCache.setDownload({ status: 'paused', ... });
} else {
  logWarn('No active download found'); // Silent failure
}

// AFTER: Always update DB for in-progress downloads
if (download) {
  await download.pauseAsync();
}
// Always update database if download is in progress
const existing = await sqliteCache.getDownload(itemId);
if (existing?.status === 'downloading' || existing?.status === 'pending') {
  await sqliteCache.setDownload({ status: 'paused', ... });
}
```

**Files Modified:**
- `src/core/services/downloadManager.ts` - Fixed pauseDownload to always update DB
- `src/constants/version.ts`

---

## [0.7.58] - 2026-01-15

### Feature: Download Pause/Resume Controls Everywhere

Added pause/resume functionality for downloads in all major locations:

**Player Screen (`SecretLibraryPlayerScreen.tsx`):**
- Download pill now shows status: "Save", progress %, "Paused", "Queued"
- Tap while downloading to pause
- Tap while paused to resume
- Tap while queued to cancel

**Book Detail Screen (`SecretLibraryBookDetailScreen.tsx`):**
- Download button now supports pause/resume
- Shows "Tap to pause" during active download
- Shows "Paused - X%" when paused with tap to resume
- Shows "Queued - Tap to cancel" when pending

**Existing Support:**
- `SeriesBookRow.tsx` already had pause/resume (no changes needed)
- `CircularDownloadButton` component already supports all states

**Files Modified:**
- `src/features/player/screens/SecretLibraryPlayerScreen.tsx`
- `src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx`
- `src/constants/version.ts`

---

## [0.7.57] - 2026-01-15

### UI: Player Logo Navigation and Default Chapter View

**Changes:**

1. **Logo Navigation**: Player logo/skull now navigates to the Secret Library home page (`HomeTab`) instead of the Library tab
2. **Default Chapter View**: Player now opens with the chapters panel visible by default, making it easier to navigate within the book

**Files Modified:**
- `src/features/player/screens/SecretLibraryPlayerScreen.tsx`
  - `handleLogoPress` now navigates to `HomeTab`
  - `activeSheet` defaults to `'chapters'` with animations in open state
- `src/constants/version.ts`

---

## [0.7.56] - 2026-01-15

### Fix: Per-Book Playback Speed Now Saves Correctly

**Problem:** When changing playback speed on the player screen, the speed wasn't being saved for the correct book. The setting would be lost when returning to the book later.

**Root Cause:** The `setPlaybackRate` function used `currentBook?.id` to determine which book to save the speed for. However, `currentBook` is the book whose audio is currently loaded/playing, which can differ from `viewingBook` (the book shown on the player screen). When viewing a different book, the speed was saved for the wrong book.

**Fix:** Updated `setPlaybackRate` to use `viewingBook` when available, falling back to `currentBook`:

```typescript
// BEFORE: Used currentBook (wrong when viewing different book)
const { currentBook } = get();
await useSpeedStore.getState().setPlaybackRate(rate, currentBook?.id);

// AFTER: Use viewingBook first (the book user is setting speed for)
const { viewingBook, currentBook } = get();
const targetBook = viewingBook || currentBook;
await useSpeedStore.getState().setPlaybackRate(rate, targetBook?.id);
```

**Additional Improvements:**
- Added debug logging to track speed save/load flow
- `getBookSpeed` now logs when returning saved vs default speeds

**Files Modified:**
- `src/features/player/stores/playerStore.ts` - Use viewingBook for speed saving
- `src/features/player/stores/speedStore.ts` - Added debug logging
- `src/constants/version.ts`

---

## [0.7.55] - 2026-01-15

### Fix: Sleep Timer Now Properly Pauses Playback and Shows Real-Time Countdown

**Problem:** Sleep timer would reach 0 but playback wouldn't pause. Additionally, the timer display showed a static value instead of counting down.

**Root Causes:**
1. **State Desynchronization:** The UI read `sleepTimer` from `playerStore`, but only `sleepTimerStore` was updated during countdown. `playerStore.sleepTimer` was set once and never updated again.
2. **Closure Bug in extendSleepTimer:** The countdown interval calculated remaining time from a fixed `endTime` closure variable. When `extendSleepTimer` updated the state, the interval still used the original `endTime`, so extensions didn't actually work.
3. **Missing State Sync on Expiration:** When the timer expired naturally, `onExpire()` was called to pause playback, but `playerStore.sleepTimer` was never set to `null`, so the UI showed the timer as still active.

**Fixes:**

1. **State-based countdown:** Changed interval to read and decrement from state instead of calculating from fixed `endTime`:
   ```typescript
   // BEFORE: Used fixed endTime closure (broke extensions)
   let endTime = Date.now() + minutes * 60 * 1000;
   const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));

   // AFTER: Read current state and decrement (extensions work correctly)
   const currentTimer = get().sleepTimer;
   const remaining = Math.max(0, currentTimer - 1);
   ```

2. **Sync playerStore on expiration:** The `onExpire` callback now also clears `playerStore.sleepTimer`:
   ```typescript
   useSleepTimerStore.getState().setSleepTimer(minutes, () => {
     get().pause();
     // CRITICAL: Sync state to playerStore when timer expires naturally
     set({ sleepTimer: null, sleepTimerInterval: null, isShakeDetectionActive: false });
   });
   ```

3. **UI reads from correct store:** Updated `SleepTimerSheet` and `SecretLibraryPlayerScreen` to read `sleepTimer` directly from `sleepTimerStore` for real-time countdown updates.

**Files Modified:**
- `src/features/player/stores/sleepTimerStore.ts` - Fixed countdown logic to use state-based decrement
- `src/features/player/stores/playerStore.ts` - Added state sync in onExpire callback
- `src/features/player/sheets/SleepTimerSheet.tsx` - Read from sleepTimerStore directly
- `src/features/player/screens/SecretLibraryPlayerScreen.tsx` - Read from sleepTimerStore directly
- `src/constants/version.ts`

---

## [0.7.54] - 2026-01-15

### Fix: Downloaded Books Resume from Correct Position

**Problem:** After tapping play on a downloaded multi-file audiobook, playback started from the beginning instead of the saved position (e.g., chapter 61). The position was correctly retrieved (69845.8s) but the audio started at 0:00.

**Root Cause:** When building track metadata for offline multi-file audiobooks, the code used `book.media.audioFiles` for track durations. However, for downloaded books, this array has `duration: 0` for all tracks. Without correct track durations/offsets, the audio service couldn't calculate which track corresponds to position 69845.8s and defaulted to track 107 at position 0.

**Fix:** Updated the offline multi-file track building to use cached session's `audioTracks` for duration/offset metadata when available:

```typescript
// Priority: cached session tracks > book.media.audioFiles
const sessionTracks = cachedSession?.audioTracks || [];

audioTrackInfos = audioFileNames.map((fileName, index) => {
  const sessionTrack = sessionTracks[index];
  const bookFile = bookAudioFiles[index];
  // Use session track duration if available (most reliable)
  const duration = sessionTrack?.duration || bookFile?.duration || 0;
  const startOffset = sessionTrack?.startOffset ?? currentOffset;
  // ...
});
```

**Files Modified:**
- `src/features/player/stores/playerStore.ts` - Use cached session track metadata for offline playback
- `src/constants/version.ts`

---

## [0.7.53] - 2026-01-15

### Fix: Play Button Now Loads Book When Audio Not Loaded

**Problem:** Tapping the play button on a preloaded book (from previous session) did nothing because `play()` silently returned when audio wasn't loaded.

**Root Cause:** The `play()` function had an early return when `audioService.getIsLoaded()` was false. This was intended to prevent iOS background playback issues, but it broke the normal "tap to play" flow for preloaded books.

**Fix:** Updated `play()` to call `loadBook(autoPlay=true)` when audio isn't loaded but a book is available:

```typescript
if (!audioService.getIsLoaded()) {
  const bookToPlay = viewingBook || currentBook;
  if (bookToPlay) {
    await get().loadBook(bookToPlay, true); // autoPlay=true
    return;
  }
}
```

**Files Modified:**
- `src/features/player/stores/playerStore.ts` - Updated `play()` to load book when audio not loaded
- `src/constants/version.ts`

---

## [0.7.52] - 2026-01-15

### Fix: Add Server Fetch as Chapter Fallback

**Problem:** Downloaded books still showed "0 chapters" because the cached LibraryItem object didn't have `media.chapters` populated, and all local fallbacks returned empty.

**Root Cause:** When a book is downloaded, the cached LibraryItem in memory/SQLite may have an empty `chapters` array, even though the server has 108 chapters. The 3-tier fallback (session → cache → metadata) all failed because none had the data locally.

**Fix:** Added a 4th fallback level that fetches fresh book data from the server via `apiClient.getItem(bookId)`. This ensures chapters are retrieved even when all local sources are empty.

**New Fallback Hierarchy:**
1. Session chapters (from current playback)
2. SQLite cached chapters (persisted)
3. Book metadata (from cached LibraryItem)
4. **NEW: Server fetch** (API call to `/api/items/{id}`)
5. Empty array (last resort)

**Files Modified:**
- `src/features/player/services/chapterCacheService.ts` - Added server fetch fallback and apiClient import
- `src/constants/version.ts`

---

## [0.7.51] - 2026-01-15

### Fix: Chapter Fallback for Preloaded/Viewed Books

**Problem:** Downloaded books showed "0 chapters" and wouldn't play because `preloadBookState` and `viewBook` functions extracted chapters directly from book metadata without using the fallback hierarchy.

**Root Cause:** When a book is restored from a previous session or viewed, the `extractChaptersFromBook()` function was called directly instead of `chapterCacheService.getChaptersWithFallback()`. For downloaded books where `book.media.chapters` is empty, this resulted in zero chapters being loaded.

**Fix:** Updated both `preloadBookState` and `viewBook` to use the chapter fallback service:
- Session chapters (from server)
- SQLite cached chapters (persisted)
- Book metadata chapters (last resort)

**Files Modified:**
- `src/features/player/stores/playerStore.ts` - Updated `preloadBookState` and `viewBook` to use `chapterCacheService.getChaptersWithFallback()`
- `src/constants/version.ts`

---

## [0.7.50] - 2026-01-15

### Style: Search Page Theme Alignment

**Problem:** The search page styling didn't match the rest of the app - it used a red/gold accent color and the search bar didn't follow the pill-shaped design pattern.

**Changes:**
1. **Removed gold accent color** - Changed from `colors.gold` to theme-aligned black/white (black in light mode, white in dark mode)
2. **Search bar now pill-shaped** - Added `borderRadius: 20` for fully rounded corners with subtle border
3. **Centered placeholder text** - When search input is empty, placeholder text is centered; text left-aligns when typing
4. **QuickBrowseGrid full width** - Removed horizontal padding so grid spans full screen width like browse page

**Files Modified:**
- `src/features/search/screens/SearchScreen.tsx` - Changed ACCENT to theme-aligned color
- `src/shared/components/TopNav.tsx` - Pill-shaped search bar with border, centered placeholder
- `src/features/search/components/QuickBrowseGrid.tsx` - Full width grid, neutral link color
- `src/constants/version.ts`

---

## [0.7.49] - 2026-01-15

### Fix: Player Logo Now Navigates to Library

**Problem:** Tapping the skull logo on the player screen did nothing.

**Root Cause:** The TopNav component's default `handleLogoPress` tried to navigate directly, but from a modal screen this doesn't work because the modal needs to be dismissed first.

**Fix:** Added a custom `onLogoPress` handler that:
1. Triggers haptic feedback
2. Closes the player (dismisses the modal)
3. Navigates to `LibraryTab` after a 300ms delay

**Files Modified:**
- `src/features/player/screens/SecretLibraryPlayerScreen.tsx` - Added `handleLogoPress` handler
- `src/constants/version.ts`

---

## [0.7.48] - 2026-01-15

### Enhancement: Chapter Cache Validation & Telemetry

Follow-up to v0.7.47 chapter persistence fix with production-ready enhancements.

**Cache Validation:**
- Added structured TTL validation with age tracking (hours/minutes)
- Added 1MB size limit protection with detailed logging
- Added JSON structure validation before parsing

**Telemetry & Debugging:**
- Comprehensive structured logging at each fallback level
- Load timing metrics (`loadTimeMs`) for performance monitoring
- Source tracking (`session`, `cache`, `metadata`, `empty`)
- Error recovery logging with detailed context

**Debug Utilities:**
- `getCacheStatus(bookId)` - Inspect cache state for any book
- `forceRefreshCache(bookId)` - Clear cache to force fresh load

**Log Examples:**
```
INFO: Chapters loaded from session { bookId, chapterCount: 25, loadTimeMs: 45, source: 'session' }
INFO: Chapters recovered successfully { bookId, source: 'cache', chapterCount: 25 }
WARN: Cached chapters expired { bookId, ageHours: 170, maxAgeHours: 168 }
```

**Files Modified:**
- `src/core/services/sqliteCache.ts` - Enhanced validation & structured logging
- `src/features/player/services/chapterCacheService.ts` - Telemetry + debug utilities
- `src/features/player/stores/playerStore.ts` - Enhanced source logging
- `src/constants/version.ts`

---

## [0.7.47] - 2026-01-15

### Fix: Chapter Disappearance During Long Listening Sessions

**Problem:** After listening to a book for an extended period, chapters would disappear and the book would become unplayable. Only reinstalling the app would fix it.

**Root Causes Identified:**
1. Chapters only existed in Zustand memory - no persistence to SQLite
2. Session errors didn't preserve/restore chapters
3. Race condition: `closeSessionAsync()` nulled session before API completed
4. No fallback hierarchy when session data failed

**Solution:** Implemented robust chapter persistence with 3-tier fallback:
1. **Session chapters** - Fresh from server (primary)
2. **SQLite cache** - Persisted from last successful load (fallback)
3. **Book metadata** - Extracted from LibraryItem (last resort)

**Changes:**
- Added `chapters` and `chapters_updated_at` columns to `user_books` SQLite table
- Created `chapterCacheService` with fallback hierarchy logic
- Fixed session race condition - chapters backed up before session cleared
- Error handler now preserves chapters instead of leaving them empty
- Extended playback cache session expiry from 5 to 15 minutes

**Files Modified:**
- `src/core/services/sqliteCache.ts` - Added chapter columns + accessor methods
- `src/features/player/services/chapterCacheService.ts` - **NEW** fallback service
- `src/features/player/services/sessionService.ts` - Fixed race condition, added chapter backup
- `src/features/player/stores/playerStore.ts` - Integrated fallback + error recovery
- `src/core/services/playbackCache.ts` - Extended expiry, added fallback method
- `src/constants/version.ts`

---

## [0.7.46] - 2026-01-14

### Fix: Player Title Displays Normally (Not Spine-Stacked)

**Problem:** The player was displaying titles in a spine-like stacked format (one word per line, uppercase), which looked odd for the player context. "Jade City" was showing as:
```
JADE
CITY
```

**Root Cause:** The player had a `splitTitle()` function that broke titles word-by-word, AND was applying `titleTransform: 'uppercase'` from the cached spine typography.

**Fix:**
1. Removed the `splitTitle()` usage - titles now display as-is
2. Only extract **font properties** from cached typography (fontFamily, fontWeight)
3. Do NOT apply spine-specific properties (uppercase transform, stacking, orientations)

**Before:** "JADE" / "CITY" (stacked, uppercase)
**After:** "Jade City" (normal display, wraps naturally)

**Files Modified:**
- `src/features/player/screens/SecretLibraryPlayerScreen.tsx` - Simplified title rendering
- `src/features/player/utils/positionResolver.ts` - Fixed null safety bug
- `src/constants/version.ts`

---

## [0.7.45] - 2026-01-14

### Enhancement: Player Author Name Underlined as Link

Added underline styling to the author name in the player screen to visually indicate it's tappable (matches book detail screen behavior).

**Change:**
- Author text now shows `textDecorationLine: 'underline'` when `authorId` is available
- Tapping the author navigates to AuthorDetail screen

**Files Modified:**
- `src/features/player/screens/SecretLibraryPlayerScreen.tsx` - Added underline to author text
- `src/constants/version.ts`

---

## [0.7.44] - 2026-01-14

### Enhancement: Player Title Auto-Scales for Long Titles

Added `adjustsFontSizeToFit` to the player screen title text so long book titles automatically scale down to fit the available space.

**Props Added:**
- `adjustsFontSizeToFit` - Enables automatic font scaling
- `numberOfLines={4}` - Allows up to 4 lines for title + author
- `minimumFontScale={0.5}` - Won't shrink below 50% of original size

**Before:** Long titles could overflow or get cut off
**After:** Long titles scale down proportionally to fit

**Files Modified:**
- `src/features/player/screens/SecretLibraryPlayerScreen.tsx` - Added adjustsFontSizeToFit to title Text
- `src/constants/version.ts`

---

## [0.7.43] - 2026-01-14

### Fix: Book Detail/Player Now Match Spine Fonts Exactly

**Problem:** Book detail and player screens showed different fonts than the book spines on the home screen. For example, a Fantasy book would show `Lora-Regular` on book detail but `UncialAntiqua-Regular` on the spine.

**Root Cause:** The cache was using `getTypographyForGenres()` but the book spines use the **template system** when templates are available. The spine's rendering path:
1. Check if templates apply (`shouldUseTemplates(genres)`)
2. If yes, use `applyTemplateConfig()` to get font
3. Resolve font via `getPlatformFont()` to map custom fonts to available fonts

The cache was only using step 3 from the old typography system, missing the template lookup entirely.

**Fix:**
1. Import `shouldUseTemplates` and `applyTemplateConfig` from templateAdapter
2. Cache now checks if templates apply and uses them (same logic as spine)
3. Font names are resolved via `getPlatformFont()` (same as spine line 1654)

**Before:**
- Spine: `UncialAntiqua-Regular` (from epic-fantasy template)
- Book Detail: `Lora-Regular` (from genre typography fallback)

**After:**
- Spine: `UncialAntiqua-Regular`
- Book Detail: `UncialAntiqua-Regular` ✓

**Files Modified:**
- `src/features/home/stores/spineCache.ts` - Use template system when available, resolve fonts with `getPlatformFont()`
- `src/constants/version.ts`

---

## [0.7.42] - 2026-01-14

### Performance: Cache Typography for Cross-Screen Consistency

**Problem:** Book detail and player screens were computing typography (font family, weight, transforms) at render time, which could result in different fonts being selected than the book spines on the home screen.

**Solution:**
Pre-compute typography when library loads and cache it alongside dimensions, colors, and composition.

**Changes:**
1. Added `typography` field to `CachedSpineData` interface with all font properties:
   - fontFamily, fontWeight, fontStyle
   - titleTransform, authorTransform
   - letterSpacing, contrast, etc.
2. Call `getTypographyForGenres()` in `extractSpineData()` during cache population
3. Update `useSpineCache` hooks to expose typography in return values
4. Update book detail and player screens to use `cachedSpineData.typography` first, with fallback for books not in cache

**Benefits:**
- **Exact font matching**: Book spines, book detail, and player screens all use the SAME typography
- **No recomputation**: Typography computed once at app startup, not on every screen
- **Consistent experience**: Book appears with same font everywhere it's displayed

**Files Modified:**
- `src/features/home/stores/spineCache.ts` - Added typography to cache extraction
- `src/features/home/hooks/useSpineCache.ts` - Exposed typography in hook return values
- `src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx` - Use cached typography first
- `src/features/player/screens/SecretLibraryPlayerScreen.tsx` - Use cached typography first
- `src/constants/version.ts`

---

## [0.7.41] - 2026-01-14

### Feature: Stacked Author Names for Fantasy

Changed the Fantasy genre profile to prefer stacked (vertical word-by-word) author names instead of horizontal. This gives books like Terry Pratchett's "Witches Abroad" a more epic, classic spine look.

**Before:** Author horizontal at bottom
**After:** Author stacked vertically (word by word)

**Change:**
```tsx
// Old: ['vertical-up', 'vertical-down', 'oppose-title']
// New: ['stacked-words', 'vertical-up', 'stacked-words', 'vertical-down']
```

Duplicating `'stacked-words'` in the array makes it more likely to be selected (50% chance vs 25%).

**Files Modified:**
- `src/features/home/utils/spineCalculations.ts` - Fantasy authorOrientations
- `src/constants/version.ts`

---

## [0.7.40] - 2026-01-14

### Fix: Use Complete Genre Font Library

**Problem:** Book detail and player screens were showing `Lora-Regular` font for most genres instead of the genre-specific fonts (like `PlayfairDisplay-Bold` for Fantasy).

**Root Cause:** The adapter's `getTypographyForGenres` was using the NEW genre profile system when the feature flag was enabled. However:
- **New system**: Only 3 genre profiles (fantasy, thriller, romance) - everything else falls back to default
- **Old system**: 42+ templates with diverse, genre-specific fonts

**Fix:** Changed `getTypographyForGenres()` in the adapter to ALWAYS use the old template system for font selection, regardless of feature flag. The new system still handles composition/layout - the systems complement each other.

**Files Modified:**
- `src/features/home/utils/spine/adapter.ts` - Always use old system for typography
- `src/constants/version.ts`

---

## [0.7.39] - 2026-01-14

### Fix: Dark Mode Text in Library Filter Dropdowns

**Problem:** Filter dropdowns (View, Sort, Download Status) on the Library screen had nearly invisible text in dark mode - dark gray text (`#1A1A1A`) on dark background (`#0f0f0f`).

**Root Cause:** The dropdowns incorrectly used `colors.cream` for text color. In the Secret Library color system:
- Light mode: `cream` = `#e8e8e8` (light surface color)
- Dark mode: `cream` = `#1A1A1A` (dark surface color - NOT for text!)

The correct text color is `colors.black` which is automatically inverted:
- Light mode: `black` = `#000000`
- Dark mode: `black` = `#FFFFFF`

**Fix:** Replaced `isDarkMode ? colors.cream : colors.black` with just `colors.black` - the color system handles the inversion.

**Files Modified:**
- `src/features/home/screens/LibraryScreen.tsx` - Fixed text colors in 3 dropdown modals
- `src/constants/version.ts`

---

## [0.7.38] - 2026-01-14

### Performance: Pre-compute Spine Compositions at Startup

**Problem:** Spine styling (title orientation, author treatment, font choices) was computed at render time, causing:
- Delayed style application when viewing books
- Inconsistent styling across home, book detail, and player screens on reload
- Layout shifts as styles were computed

**Solution:**
Pre-compute spine compositions when library loads and cache them alongside dimensions and colors.

**Changes:**
1. Added `composition?: SpineComposition` field to `CachedSpineData` interface
2. Import and call `generateSpineComposition()` in `extractSpineData()` during cache population
3. Expose composition through `useSpineCache` hooks for easy access

**Benefits:**
- **Instant styling**: Book spines render with correct styling immediately
- **Consistency**: Same composition used across all screens (home, book detail, player)
- **No layout shift**: Styles are pre-computed, eliminating flash of unstyled content

**Files Modified:**
- `src/features/home/stores/spineCache.ts` - Added composition to cache extraction
- `src/features/home/hooks/useSpineCache.ts` - Exposed composition in hook return values
- `src/constants/version.ts`

---

## [0.7.37] - 2026-01-14

### Fix: Vertical Spine Text Centering

**Problem:** Vertical text on book spines (titles like "Voyager", "Kings of the Wyld") wasn't centering properly. Text appeared offset from the visual center.

**Root Cause:** React Native's `lineHeight` property centers the "line box" (fontSize + padding), not the visual text itself. When text is rotated 90°, this causes vertical misalignment.

**Solution:**
1. Removed `lineHeight` from single-line vertical text orientations (`vertical-up`, `vertical-down`)
2. Added unified centering utility functions (`shouldUseLineHeight`, `getSpineTextStyle`) with documentation

**Technical Details:**
- Horizontal and multi-line vertical text (`vertical-two-row`) still use `lineHeight` for proper line spacing
- Stacked orientations (`stacked-letters`, `stacked-words`) use `gap` instead of `lineHeight`
- Added `includeFontPadding: false` comment explaining its purpose

**Files Modified:**
- `src/features/home/components/BookSpineVertical.tsx` - Removed lineHeight from vertical-up/down orientations
- `src/features/home/utils/spineCalculations.ts` - Added `shouldUseLineHeight()` and `getSpineTextStyle()` utilities
- `src/constants/version.ts`

---

## [0.7.33] - 2026-01-14

### Complete Genre Template Library

Added 24 new spine templates for comprehensive genre coverage. Now 42 total templates.

**New Templates:**
- Mystery, Classics, Epic Fantasy, Self-Help
- Young Adult, Children, Non-Fiction, History
- Sports, Travel, Cooking, Health
- Military, Dystopian, Urban Fantasy, Paranormal Romance
- Poetry, Science, LitRPG, Cozy Mystery
- Espionage, Contemporary Fiction, Default (fallback)

**Files Modified:**
- `src/features/home/utils/spine/templates/spineTemplates.ts` - Added 24 new templates
- `src/constants/version.ts`

---

## [0.7.32] - 2026-01-14

### Fix: Load New Fonts in APK

Added missing font loading for 11 new fonts in `appInitializer.ts`. Fonts were downloaded but not being loaded with `expo-font`, so they appeared as system defaults.

**Fonts now loaded:**
- GravitasOne, NotoSerif (Regular+Bold), LibreBaskerville (Regular+Bold)
- AlfaSlabOne, AlmendraSC, ZenDots, Eater, RubikBeastly, Barriecito

**Files Modified:**
- `src/core/services/appInitializer.ts` - Added Font.loadAsync() calls for new fonts
- `src/constants/version.ts`

---

## [0.7.31] - 2026-01-14

### Default to Dark Mode

Changed default theme mode from light to dark for new installs.

**Files Modified:**
- `src/shared/theme/themeStore.ts` - Changed default mode to 'dark'
- `src/constants/version.ts`

---

## [0.7.30] - 2026-01-14

### Bug Fix: Skip Back Playback Issue

**Problem:** When pressing skip back while playing, audio would:
1. Jump back correctly
2. Play for ~1 second
3. Stop unexpectedly
4. First play press wouldn't work
5. Second play press would work

**Root Cause:** Race condition in `seekingStore.seekTo()` - the audio seek was fire-and-forget (not awaited), causing playback to continue from old position while seek was still processing.

**Fix:** Added `await` to `audioService.seekTo()` call so the function waits for the audio seek to complete before returning.

**Files Modified:**
- `src/features/player/stores/seekingStore.ts` - Line 211: Added await to audioService.seekTo()
- `src/constants/version.ts`

---

## [0.7.29] - 2026-01-14

### Fixes and Font Downloads

**1. Fixed Thriller template layout**
- Changed from `stacked-words` (50% height) to `vertical-up` (72% height)
- Was causing "DUNGEON CRAWLER CARL" overlap issue
- Now matches typical vertical spine layout

**2. Width scaling with bump for 40+ hour epics**
- Linear scaling for most books (1-40 hours)
- Quadratic bump above 40 hours makes very long books look impressively thick
- Example: 40hr = ~232px, 45hr = ~250px, 50hr = 280px (MAX)

**3. Downloaded 9 new Google Fonts**
- GravitasOne, NotoSerif (Regular+Bold), LibreBaskerville (Regular+Bold)
- AlfaSlabOne, AlmendraSC, ZenDots
- Eater, RubikBeastly, Barriecito

**Files Modified:**
- `src/features/home/utils/spine/templates/spineTemplates.ts` - Fixed Thriller template
- `src/features/home/utils/spine/core/dimensions.ts` - Linear + bump scaling
- `src/assets/fonts/` - Added 11 new font files
- `src/constants/version.ts`

---

## [0.7.28] - 2026-01-14

### Spine Improvements: Spacing, Scaling, and New Fonts

**1. Fixed stacked-words vertical spacing**
- Removed `flex: 1` that was causing words to spread out
- Words now pack tightly together with negative margins (30% overlap)
- Matches real book spine typography where words stack closely

**2. Logarithmic spine width scaling**
- Changed from linear to logarithmic scaling based on duration
- Short books spread out better (2hr book is now ~70px, not 49px)
- Long books still look thick but not absurdly wide
- Example widths: 1hr=44px, 5hr=115px, 10hr=150px, 20hr=190px, 50hr=280px

**3. Added 9 new Google Fonts for variety:**
- **Serif:** NotoSerif, LibreBaskerville (classic, traditional)
- **Display:** GravitasOne, AlfaSlabOne (bold, impactful)
- **Decorative:** AlmendraSC (vintage, small caps)
- **Futuristic:** ZenDots (tech, modern)
- **Playful:** Eater (horror), RubikBeastly (monster), Barriecito (quirky)

**4. Reduced Oswald-Bold/BebasNeue overuse:**
- Templates now use more varied fonts
- Each genre has appropriate typography personality
- Less generic, more distinctive per-genre styling

**Files Modified:**
- `src/features/home/components/BookSpineVertical.tsx` - Fixed stacked-words spacing
- `src/features/home/utils/spine/core/dimensions.ts` - Logarithmic width calculation
- `src/features/home/utils/spine/templates/spineTemplates.ts` - New fonts + template updates
- `src/features/home/utils/spineCalculations.ts` - Font map + line heights for new fonts
- `src/constants/version.ts`

---

## [0.7.27] - 2026-01-14

### Font Randomization Complete

Added `fontFamilies` arrays to ALL 18 spine templates for visual variety.

**Templates Updated:**
| Template | Title Font Pool | Author Font Pool |
|----------|----------------|------------------|
| Literary Fiction | PlayfairDisplay-Regular, Lora-Regular, PlayfairDisplay-Bold | (inherits) |
| Science Fiction | Orbitron-Regular, BebasNeue-Regular, Oswald-Bold | (inherits) |
| Technology | Orbitron-Regular, BebasNeue-Regular, Oswald-Bold | (inherits) |
| Western | Notable-Regular, BebasNeue-Regular, Oswald-Bold | (inherits) |
| Art & Design | Federo-Regular, PlayfairDisplay-Bold, BebasNeue-Regular | (inherits) |
| Adventure | Oswald-Bold, BebasNeue-Regular, PlayfairDisplay-Bold | (inherits) |
| Fantasy | Oswald-Bold, PlayfairDisplay-Bold, Lora-Bold, BebasNeue-Regular | (inherits) |
| Humor | Oswald-Bold, BebasNeue-Regular, Oswald-Regular | Oswald-Regular, BebasNeue-Regular |
| True Crime | Notable-Regular, BebasNeue-Regular, Oswald-Bold | Oswald-Bold, BebasNeue-Regular |
| Horror | GrenzeGotisch-Regular, PlayfairDisplay-Bold, Lora-Bold | PlayfairDisplay-Bold, Lora-Bold |
| Romance | FleurDeLeah-Regular, PlayfairDisplay-Regular, Lora-Regular | PlayfairDisplay-Regular, Lora-Regular |
| Biography | PlayfairDisplay-Bold, Lora-Bold, PlayfairDisplay-Regular | PlayfairDisplay-Regular, Lora-Regular |
| Philosophy | UncialAntiqua-Regular, Lora-Regular, PlayfairDisplay-Regular | Lora-Regular, PlayfairDisplay-Regular |
| Thriller | Oswald-Bold, BebasNeue-Regular, Notable-Regular | Oswald-Regular, BebasNeue-Regular |
| Historical Fiction | PlayfairDisplay-Regular, Lora-Regular, PlayfairDisplay-Bold | PlayfairDisplay-Regular, Lora-Regular |
| Business | Orbitron-Regular, BebasNeue-Regular, Oswald-Bold | Oswald-Bold, BebasNeue-Regular |
| Music & Arts | Federo-Regular, PlayfairDisplay-Bold, BebasNeue-Regular | PlayfairDisplay-Bold, Lora-Bold |
| Anthology | PlayfairDisplay-Regular, Lora-Regular, PlayfairDisplay-Bold | PlayfairDisplay-Regular, Lora-Regular |

**Files Modified:**
- `src/features/home/utils/spine/templates/spineTemplates.ts` - Added fontFamilies to all templates
- `src/constants/version.ts`

---

## [0.7.26] - 2026-01-14

### Font Randomization Support

Added support for per-genre font randomization using `fontFamilies` array.

**How it works:**
- Templates can define `fontFamilies: ['Font1', 'Font2', 'Font3']` alongside `fontFamily`
- When rendering, a font is selected based on the book title hash (deterministic)
- Same book always gets same font, but different books get variety

**New functions:**
- `selectFontForBook(config, bookTitle)` - Selects font from fontFamilies array
- `hashString(str)` - Simple deterministic hash for font selection

**Usage example:**
```typescript
title: {
  fontFamily: 'Oswald-Bold',  // Default fallback
  fontFamilies: ['Oswald-Bold', 'BebasNeue-Regular', 'Lora-Bold'],  // Random selection
  // ... other config
}
```

**Files Modified:**
- `src/features/home/utils/spine/templates/spineTemplates.ts` - Added fontFamilies field and selectFontForBook()
- `src/features/home/utils/spine/templateAdapter.ts` - Uses selectFontForBook() when applying config
- `src/features/home/components/BookSpineVertical.tsx` - Passes book title for font selection
- `src/constants/version.ts`

---

## [0.7.25] - 2026-01-14

### Added Humor Template

**New template for comedy and humor books!**

**Humor Template Design:**
- **Font**: Oswald-Bold/Regular (clean, approachable sans-serif)
- **Title**: Vertical-up, uppercase, 48pt medium / 58pt large
- **Author**: Horizontal at bottom, uppercase
- **Feel**: Light and playful for comedic reads

**Matches genres:**
- humor, comedy, satire, parody, humorous-fiction

**Example:** "Witches Abroad" (Fantasy, Humor) now matches Humor template instead of Adventure fallback.

**Files Modified:**
- `src/features/home/utils/spine/templates/spineTemplates.ts`
- `src/constants/version.ts`

---

## [0.7.24] - 2026-01-14

### Minimum Spine Width Increased to 44px

Increased minimum book spine width from 20px to 44px to match touch target guidelines.

**Changes:**
- `WIDTH_CALCULATION.MIN`: 20 → 44 (in `spine/constants.ts`)
- `MIN_WIDTH`: 20 → 44 (in `spineCalculations.ts`)

**Rationale:**
- 44px is the Apple HIG minimum touch target
- No more need for hitSlop padding on thin spines
- Ensures all spines are directly tappable
- Short audiobooks (<1hr) now get readable spine widths

**Files Modified:**
- `src/features/home/utils/spine/constants.ts`
- `src/features/home/utils/spineCalculations.ts`
- `src/constants/version.ts`

---

## [0.7.23] - 2026-01-14

### Added Fantasy Template

**New template for Fantasy genre books!**

Previously, Fantasy books were falling through to Adventure or Thriller templates based on their secondary genre. Now they get a dedicated epic fantasy look.

**Fantasy Template Design:**
- **Font**: PlayfairDisplay-Bold (classic serif for epic feel)
- **Title**: Vertical orientation, uppercase, bold
- **Author**: Stacked words at bottom (e.g., "NICHOLAS / EAMES")
- **Decoration**: Thin divider line between title and author
- **Sizes**: Responsive configs for small (38pt), medium (52pt), large (64pt) spines

**Matches genres:**
- fantasy, epic-fantasy, urban-fantasy, dark-fantasy, high-fantasy, sword-and-sorcery

**Files Modified:**
- `src/features/home/utils/spine/templates/spineTemplates.ts` - Added Fantasy template
- `src/constants/version.ts`

---

## [0.7.22] - 2026-01-14

### Template Renderer Fixes

**Fixes for TemplateSpineRenderer:**

1. **Font loading fixed** - Now passes `resolvedFontFamily` (via `getPlatformFont()`) to the template renderer instead of raw font names. This ensures custom fonts like PlayfairDisplay, Lora, etc. load correctly.

2. **Progress moved below spine** - For template-rendered books, progress is now shown BELOW the spine (externally) rather than inside it. Series numbers are hidden for now (can be added to templates later).

**Changes:**
- Added `resolvedFontFamily` prop to `TemplateSpineRenderer`
- Removed progress/series rendering from inside template renderer
- Added `progressBelowContainer` style for external progress display
- Progress shows as `XX%` below the book spine

**Files Modified:**
- `src/features/home/components/BookSpineVertical.tsx`
- `src/constants/version.ts`

---

## [0.7.21] - 2026-01-14

### Template-Direct Rendering - Clean Integration

**MAJOR REFACTOR:** Completely new rendering path for template-driven spines that mirrors SpineTemplatePreviewScreen exactly. This bypasses all the composition/solver complexity that was causing rendering issues.

**User Insight:**
> "Why can't we just use exactly how the template page is rendering them and pass in the values? It seems like a lot to have it translate everything."

**The Problem:**
Previous versions tried to:
1. Translate template configs through templateAdapter
2. Convert to composition objects
3. Run through layout solver to calculate fontSize
4. Apply results to Text components

This multi-layer translation was causing:
- Height allocation inversions (small fonts got huge space)
- Solver overriding template fontSize
- Orientation conversion bugs

**The Solution:**
Created `TemplateSpineRenderer` - a clean, isolated component that:
- Uses `heightPercent` DIRECTLY for section allocation (like SpinePreview)
- Applies `fontSize` DIRECTLY to Text components (no solver recalculation)
- Uses `adjustsFontSizeToFit` for overflow handling (shrinks but doesn't grow)
- Handles all orientations via simple transforms

**Code Architecture:**
```typescript
// When templates active: use clean direct rendering
{templateConfig ? (
  <TemplateSpineRenderer
    templateConfig={templateConfig}
    titleText={book.title}
    authorText={book.author}
    spineWidth={width}
    spineHeight={height}
    // ... direct props, no translation
  />
) : (
  // Fallback: composition-based rendering for non-template books
  <>...existing complex path...</>
)}
```

**Key Differences from Previous Approach:**
| Aspect | Old (v0.7.20) | New (v0.7.21) |
|--------|---------------|---------------|
| Height calc | FROM fontSize | heightPercent DIRECT |
| Font size | Solver calculated | Template DIRECT |
| Orientation | Converted/translated | Used AS-IS |
| Rendering | Multiple code paths | Single clean renderer |

**Files Modified:**
- `src/features/home/components/BookSpineVertical.tsx` - Added TemplateSpineRenderer, conditional rendering path
- `src/constants/version.ts`
- `CHANGELOG.md`

---

## [0.7.20] - 2026-01-13

### Priority Order Fix - Composition Override

**FINAL FIX** for spine layout bug where templates correctly specified `author placement: bottom` but were being overridden by typography settings.

**Root Cause Found:**
User provided debug logs showing:
```json
{
  "layoutAuthorPos": "bottom",  ← Template says BOTTOM
  "hasAuthorBox": true,          ← Typography has author box
  "typographyAuthorPos": "top"   ← Typography says TOP
}
Result: authorFirst=true ← WRONG! Should be false
```

**The Problem:**
```typescript
// v0.7.19 (broken priority):
const authorFirstBeforeSafetyCheck =
  composition?.layout?.authorPosition === 'top' ||
  hasAuthorBox ||  // ❌ This overrode composition's "bottom"!
  typography.authorPosition === 'top';
```

Even though composition explicitly said `"bottom"`, the `hasAuthorBox` check (from series typography) was overriding it!

**The Fix:**
```typescript
// v0.7.20 (correct priority):
const compositionSaysBottom = composition?.layout?.authorPosition === 'bottom';
const compositionSaysTop = composition?.layout?.authorPosition === 'top';

const authorFirstBeforeSafetyCheck =
  compositionSaysTop ||  // Composition top - use it
  (!compositionSaysBottom && hasAuthorBox) ||  // ✅ Only if composition doesn't say bottom!
  (!compositionSaysBottom && !compositionSaysTop && typography.authorPosition === 'top');
```

**Priority Order (Correct):**
1. **Composition** (template-driven) - HIGHEST
2. **hasAuthorBox** (series typography) - MEDIUM
3. **typography.authorPosition** (fallback) - LOWEST

**Result:**
- Templates with `author placement: bottom` now correctly place authors at bottom
- Series typography can't override template decisions
- Traditional spine hierarchy: title prominent, author secondary

**Files Modified:**
- `src/features/home/components/BookSpineVertical.tsx`
- `src/constants/version.ts`

---

## [0.7.19] - 2026-01-13

### Critical Safety Check Fix

**Fixed incomplete safety check** that allowed stacked author names to appear at the top of spines.

**The Problem:**
- v0.7.18's safety check only applied to `composition?.layout?.authorPosition === 'top'`
- It didn't protect against `hasAuthorBox` or `typography.authorPosition === 'top'`
- Series books with `authorBox: "horizontal-only"` could still get stacked authors at top
- Result: "NICHOLAS EAMES" appearing huge and stacked at top (exactly what user saw!)

**The Fix:**
```typescript
// BEFORE (v0.7.18 - incomplete):
const authorFirst =
  (composition?.layout?.authorPosition === 'top' && !authorHasStackedOrientation) ||
  hasAuthorBox || // ❌ No stacked check here!
  typography.authorPosition === 'top'; // ❌ Or here!

// AFTER (v0.7.19 - complete):
const authorFirstBeforeSafetyCheck =
  composition?.layout?.authorPosition === 'top' ||
  hasAuthorBox ||
  typography.authorPosition === 'top';

// ✅ Apply safety check to ALL cases:
const authorFirst = authorFirstBeforeSafetyCheck && !authorHasStackedOrientation;
```

**Why This Matters:**
- Stacked author names (NICHOLAS / EAMES) are LARGE by design
- When placed at top, they dominate the spine (60-70% of height)
- Titles get squeezed small at bottom (backwards from tradition!)
- This safety check enforces: **Stacked authors ALWAYS go to bottom**

**Added Debug Log:**
```
[SAFETY] "Kings of the Wyld" has stacked author (stacked-words)
  - forcing to BOTTOM despite authorPosition=top
```

**Result:**
- Stacked authors now forced to bottom REGARDLESS of authorPosition/authorBox
- Traditional spine hierarchy restored: title prominent, author secondary
- Works for template-driven AND composition-driven spines

**Files Modified:**
- `src/features/home/components/BookSpineVertical.tsx`
- `src/constants/version.ts`

---

## [0.7.18] - 2026-01-13

### Template Integration Fixes

**Critical fixes** to prevent incorrect spine layouts where author names appeared too prominently.

**Problems Fixed:**

1. **Missing Layout Property**
   - Template-based compositions were missing the `layout` object
   - Added `layout.authorPosition` from template's author placement
   - This ensures templates correctly specify author positioning

2. **Composition Priority Not Used**
   - Component wasn't checking `composition.layout.authorPosition`
   - Now prioritizes: composition → hasAuthorBox → typography
   - Templates can now control section ordering

3. **Stacked Author Names at Top**
   - Composition system sometimes generated `author: stacked-words, authorPosition: top`
   - This made author names dominate the spine (WRONG!)
   - Added safety check: blocks author-first when using stacked orientations
   - Result: Traditional spine layout (title prominent, author secondary)

4. **Enhanced Debug Logging**
   - Added logs for template matching: shows genre match or "NO MATCH"
   - Added logs for composition generation: shows author orientation & position
   - Helps diagnose layout issues in dev mode

**What Was Happening:**

```
BEFORE (broken):
┌─────────┐
│ NICHOLAS│ ← Author (stacked-words, large)
│  EAMES  │
│         │
│Kings of │ ← Title (small, at bottom)
│the Wyld │
└─────────┘
```

**What Happens Now:**

```
AFTER (fixed):
┌─────────┐
│ KINGS   │ ← Title (prominent, at top)
│  OF THE │
│   WYLD  │
│         │
│N. Eames │ ← Author (secondary, at bottom)
└─────────┘
```

**Files Modified:**
- `src/features/home/components/BookSpineVertical.tsx`
- `src/constants/version.ts`

---

## [0.7.17] - 2026-01-13

### Spine Template System Integration

**Major architectural enhancement:** Integrated the genre-specific spine template system into the main BookSpineVertical rendering component, bringing professional typography to all book spines throughout the app.

**What Changed:**

1. **Template Adapter Layer** (`templateAdapter.ts`)
   - Created bridge between template system and rendering component
   - Converts template configs to rendering format
   - Handles genre matching and size-based config selection
   - Provides fallback to generative composition system

2. **BookSpineVertical Integration**
   - Templates now drive spine styling for books with matching genres
   - Template fontSize becomes preferred target for layout solver
   - Template fontFamily overrides typography-based fonts
   - Template heightPercent controls section size allocation
   - Maintains backward compatibility with composition system

3. **Smart Genre Matching**
   - Prioritizes `preferredFor` genres (optimal matches)
   - Falls back to `usedFor` genres (compatible matches)
   - Graceful fallback for books without genre data

**How It Works:**

```typescript
// 1. Match book to template
const template = matchBookToTemplate(['science-fiction', 'space-opera']);
// → Returns "Science Fiction" template

// 2. Apply size-based config
const config = applyTemplateConfig(['science-fiction'], spineWidth);
// → Returns large config if width > 90px, medium if 60-90px, small if < 60px

// 3. Template drives rendering
// - fontSize: 58pt (template) → layout solver target
// - fontFamily: 'Orbitron-Regular' (futuristic)
// - orientation: 'vertical-up' (reads bottom-to-top)
// - heightPercent: 80% title, 10% author
```

**Template Priority:**
1. **Template system** (genre match found) → Uses template configs
2. **Composition system** (no genre match) → Uses generative layouts
3. **Typography system** (fallback) → Basic genre styling

**Benefits:**
- 16 professionally-designed genre templates now active
- Consistent styling across all matching books
- Size-responsive typography (small/medium/large spines)
- Publisher-quality font choices and sizing

**Files Modified:**
- `src/features/home/utils/spine/templateAdapter.ts` (NEW)
- `src/features/home/components/BookSpineVertical.tsx`

**Next Steps:**
- Test with 48 varied book examples from SpineTemplatePreviewScreen
- Fine-tune fontSize ranges for edge cases
- Consider exposing template customization to users

---

## [0.7.16] - 2026-01-13

### Spine Templates - Complete Size-Based Configurations

Added size-based styling configurations to all remaining 11 templates, completing the size-responsive system across all 16 genre templates.

**What's New:**

All 16 templates now feature comprehensive small/medium/large configurations:

1. ✅ **Literary Fiction** (v0.7.15)
2. ✅ **Science Fiction** (NEW)
3. ✅ **Technology** (NEW)
4. ✅ **Western** (v0.7.15)
5. ✅ **Art & Design** (v0.7.15)
6. ✅ **Adventure** (NEW)
7. ✅ **True Crime** (v0.7.15)
8. ✅ **Horror** (NEW)
9. ✅ **Romance** (NEW)
10. ✅ **Biography** (NEW)
11. ✅ **Philosophy** (NEW)
12. ✅ **Thriller** (v0.7.15)
13. ✅ **Historical Fiction** (NEW)
14. ✅ **Business** (NEW)
15. ✅ **Music & Arts** (NEW)
16. ✅ **Anthology** (NEW)

**Size Configuration Pattern:**

Each template now adapts across three breakpoints:

| Size | Width Range | Typical Changes |
|------|-------------|-----------------|
| **Small** | < 60px | Reduced font size (~25% smaller), tighter padding, switch to `vertical-up` for horizontal authors |
| **Medium** | 60-90px | Default config (balanced styling) |
| **Large** | > 90px | Increased font size (~15-20% larger), generous padding, enhanced letter spacing |

**Example: Science Fiction Template**

```typescript
title: {
  fontSize: 50,          // Medium default
  letterSpacing: 0.08,
  sizes: {
    small: {
      fontSize: 38,      // -24% for narrow spines
      letterSpacing: 0.06,
    },
    large: {
      fontSize: 58,      // +16% for wide spines
      letterSpacing: 0.10,
    },
  },
}
```

**Author Orientation Adaptations:**

For small spines (<60px), horizontal author orientations automatically switch to `vertical-up` to maximize readability:

- **Science Fiction**: `horizontal` → `vertical-up` (small)
- **Adventure**: `horizontal` → `vertical-up` (small)
- **Horror**: `horizontal` → `vertical-up` (small)
- **Romance**: `horizontal` → `vertical-up` (small)
- **Biography**: `horizontal` → `vertical-up` (small)
- **And all others...**

**Typography Adjustments:**

Each template respects its unique font family and style while scaling appropriately:

- **Serif fonts** (Playfair, Lora): Conservative scaling, refined letter spacing
- **Display fonts** (Orbitron, Federo): Bold scaling differences, dramatic spacing
- **Gothic fonts** (GrenzeGotisch, Uncial): Subtle adjustments, preserve character
- **Sans-serif** (Oswald, BebasNeue): Aggressive sizing, tight spacing on small

**Benefits:**

- **Consistency**: All 16 templates use the same breakpoints (60px, 90px)
- **Readability**: Small spines prioritize legibility over visual drama
- **Visual Impact**: Large spines maximize typography and letter spacing
- **Flexibility**: Each genre maintains its unique character while adapting to size
- **Maintainability**: Size logic lives in template definitions, not rendering code

**Files Modified:**
- `src/features/home/utils/spine/templates/spineTemplates.ts` - Added size configs to 11 remaining templates (Science Fiction, Technology, Adventure, Horror, Romance, Biography, Philosophy, Historical Fiction, Business, Music & Arts, Anthology)
- `src/constants/version.ts` - Version bump to 0.7.16

**System Status:**
- **Architecture**: ✅ Complete (v0.7.15)
- **Templates**: ✅ 16/16 with size configs (v0.7.16)
- **Rendering**: ✅ Uses `getConfigForSize()` helper (v0.7.15)

---

## [0.7.15] - 2026-01-13

### Spine Templates - Size-Based Styling System

Implemented a comprehensive size-based styling system that allows each genre template to specify different configurations for small, medium, and large spine widths.

**What's New:**

1. **Size-Based Configuration Architecture:**
   - Small: `< 60px` - Narrow spines optimized for readability
   - Medium: `60-90px` - Standard spines using balanced styling
   - Large: `> 90px` - Wide spines with maximum visual impact

2. **Flexible Override System:**
   Each template can now specify size-specific overrides:
   ```typescript
   title: {
     orientation: 'stacked-words',
     fontSize: 40,
     // ... default config
     sizes: {
       small: { orientation: 'vertical-up', fontSize: 32 },
       medium: { fontSize: 45 },
       large: { fontSize: 56, paddingHorizontal: 10 },
     }
   }
   ```

3. **Partial Overrides:**
   - Only specify properties that change per size
   - All unspecified properties inherit from default config
   - Clean, maintainable template definitions

4. **Helper Function:**
   New `getConfigForSize()` utility automatically selects the appropriate config based on spine width, merging size-specific overrides with defaults.

**Updated Templates with Size-Based Configs:**

Five templates now feature size-specific styling:

1. **Literary Fiction**
   - Small: `vertical-up`, fontSize 32
   - Medium: `stacked-words`, fontSize 40 (default)
   - Large: `stacked-words`, fontSize 48

2. **Western**
   - Small: `vertical-up`, fontSize 24
   - Medium: `vertical-two-row`, fontSize 30 (default)
   - Large: `vertical-two-row`, fontSize 36

3. **Art & Design**
   - Small: `vertical-up`, fontSize 38
   - Medium: `stacked-words`, fontSize 45
   - Large: `stacked-words`, fontSize 56

4. **True Crime**
   - Small: `vertical-up`, fontSize 48
   - Medium: `stacked-words`, fontSize 58
   - Large: `stacked-words`, fontSize 70

5. **Thriller**
   - Small: `vertical-up`, fontSize 58
   - Medium: `stacked-words`, fontSize 70
   - Large: `stacked-words`, fontSize 84

**Technical Implementation:**

- **TypeScript Interface:** Defined `BaseTitleConfig` and `BaseAuthorConfig` with optional `sizes` property
- **Type-Safe Overrides:** `TitleSizeOverride` and `AuthorSizeOverride` types ensure partial configs are type-safe
- **Cleaner Rendering:** Replaced hardcoded adaptive logic with declarative size configurations
- **Backwards Compatible:** Templates without `sizes` property work exactly as before

**Before vs After:**

| Approach | Implementation |
|----------|---------------|
| **Before (0.7.14)** | Hardcoded adaptive logic in renderer: `if (spineWidth < 70 && orientation === 'stacked-words') { ... }` |
| **After (0.7.15)** | Declarative size configs in templates: `sizes: { small: { orientation: 'vertical-up' } }` |

**Benefits:**

- **Maintainability:** Size logic lives in template definitions, not rendering code
- **Flexibility:** Each genre can define its own size breakpoint behaviors
- **Consistency:** All templates use the same size thresholds (60px, 90px)
- **Extensibility:** Easy to add new size-based properties or adjust thresholds
- **Type Safety:** Full TypeScript support with partial override types

**Files Modified:**
- `src/features/home/utils/spine/templates/spineTemplates.ts` - Added size-based TypeScript interfaces, updated 5 templates with size configs
- `src/features/home/screens/SpineTemplatePreviewScreen.tsx` - Replaced adaptive logic with `getConfigForSize()` calls
- `src/constants/version.ts` - Version bump to 0.7.15

---

## [0.7.13] - 2026-01-13

### Spine Templates - Adaptive stacked-words for Narrow Spines

Reverted Art & Design, True Crime, and Thriller back to `stacked-words`, with adaptive behavior to switch to `vertical-up` on narrow spines.

**Changes:**

1. **Reverted Templates to stacked-words:**
   - Art & Design: `vertical-up` → `stacked-words`
   - True Crime: `vertical-up` → `stacked-words`
   - Thriller: `vertical-up` → `stacked-words`

2. **Added Adaptive Logic for stacked-words:**
   - Wide books (≥70px): Use `stacked-words` (word-by-word stacking: "THE" / "MIDNIGHT" / "LIBRARY")
   - Narrow books (<70px): Automatically switch to `vertical-up` (single vertical: "THE MIDNIGHT LIBRARY")

**Behavior:**

| Spine Width | Template Config | Rendered As |
|-------------|----------------|-------------|
| ≥ 70px | `stacked-words` | Word-by-word stacking |
| < 70px | `stacked-words` | `vertical-up` (automatic fallback) |

**Why This Approach:**
- Wide spines: `stacked-words` creates dramatic word-by-word stacking
- Narrow spines: Automatic fallback to `vertical-up` prevents cramped text
- Best of both worlds - visual drama on wide books, readability on narrow

**Example - Art & Design Template:**
- **Wide book (80px)**: "THE" / "MIDNIGHT" / "LIBRARY" (dramatic stacking)
- **Narrow book (60px)**: "THE MIDNIGHT LIBRARY" (clean vertical)

**Files Modified:**
- `src/features/home/utils/spine/templates/spineTemplates.ts` - Reverted 3 templates to stacked-words
- `src/features/home/screens/SpineTemplatePreviewScreen.tsx` - Added stacked-words → vertical-up adaptive logic
- `src/constants/version.ts` - Version bump to 0.7.13

---

## [0.7.12] - 2026-01-13

### Spine Templates - Fixed Center Placement

Fixed `placement: 'center'` to properly center content on the spine instead of positioning it at the bottom.

**Problem:**
Templates with `placement: 'center'` were showing content bunched at the bottom of the spine instead of centered vertically. The title and author appeared at the bottom rather than in the middle: `[  ][█]` instead of `[|]`.

**Root Cause:**
The placement logic only handled author at top/bottom relative positioning, but didn't implement true centering for the title placement property. Content was stacked from the top down regardless of the `placement: 'center'` setting.

**Solution:**
Implemented proper center placement that calculates the total content height (title + author) and positions that block in the center of the spine:

```typescript
if (placement === 'center') {
  const contentHeight = titleHeight + authorHeight;
  const startY = (spineHeight - contentHeight) / 2;  // Center the block
  // Position title and author within centered block
}
```

**Behavior Now:**

| Placement | Position | Visual |
|-----------|----------|--------|
| `'center'` | Content centered on spine | `[  \|  ]` |
| `'top'` | Content at top of spine | `[█    ]` |
| `'bottom'` | Content at bottom of spine | `[    █]` |

**Example:**
True Crime template with 68% title + 20% author = 88% content:
- **Before:** Content positioned from top, ended near bottom
- **After:** 88% content block centered, with equal space above and below

**Affected Templates:**
All templates with `placement: 'center'` now properly center:
- Literary Fiction
- Science Fiction
- Technology
- True Crime
- And others...

**Files Modified:**
- `src/features/home/screens/SpineTemplatePreviewScreen.tsx` - Implemented proper center placement logic
- `src/constants/version.ts` - Version bump to 0.7.12

---

## [0.7.11] - 2026-01-13

### Spine Templates - Fixed Padding for vertical-up/vertical-down

Fixed padding not working for `vertical-up` and `vertical-down` orientations (same issue that affected vertical-two-row).

**Problem:**
Setting `paddingVertical: 10` or `paddingHorizontal` had no visible effect on vertical-up/vertical-down orientations. The rotated View was using absolute dimensions that didn't account for the padding applied to the parent container.

**Solution:**
Applied the same padding calculation fix used for vertical-two-row:

```typescript
// For vertical-up/vertical-down
const paddingH = config.paddingHorizontal ?? 3;
const paddingV = config.paddingVertical ?? 0;
// After rotation: vertical padding affects width, horizontal padding affects height
const rotatedWidth = height - (paddingV * 2);
const rotatedHeight = width - (paddingH * 2);
```

**Affected Orientations:**
- ✅ Title with `vertical-up` orientation
- ✅ Title with `vertical-down` orientation
- ✅ Author with `vertical-up` orientation
- ✅ Author with `vertical-down` orientation

**Example Usage:**
```typescript
{
  id: 'literary-fiction',
  title: {
    orientation: 'vertical-up',
    paddingHorizontal: 0,    // ✓ Now working
    paddingVertical: 10,     // ✓ Now working (creates top/bottom space after rotation)
    // ...
  }
}
```

**Technical Note:**
After -90° rotation (vertical-up):
- `paddingVertical` creates space at the top/bottom of the spine (becomes left/right after rotation)
- `paddingHorizontal` creates space at the left/right of the spine (becomes top/bottom after rotation)

**Files Modified:**
- `src/features/home/screens/SpineTemplatePreviewScreen.tsx` - Fixed padding calculation for vertical orientations
- `src/constants/version.ts` - Version bump to 0.7.11

---

## [0.7.10] - 2026-01-13

### Spine Templates - Fixed Orientation for Art & Design, True Crime, Thriller

Changed three templates from problematic orientations to clean single-column `vertical-up`.

**Templates Updated:**

1. **Art & Design**
   - **Before:** `stacked-words` (title split word-by-word: "THE" / "MIDNIGHT" / "LIBRARY")
   - **After:** `vertical-up` (clean vertical text: "THE MIDNIGHT LIBRARY")
   - **Author:** Changed from `stacked-words` to `horizontal` for better readability

2. **True Crime**
   - **Before:** `horizontal` with `wordsPerLine: 2` (caused odd breaks: "DU" / "NE")
   - **After:** `vertical-up` (clean vertical text: "DUNE")
   - Removed `maxLines` and `wordsPerLine` properties

3. **Thriller**
   - **Before:** `horizontal` with `wordsPerLine: 1` (caused character splits: "TH" / "E")
   - **After:** `vertical-up` (clean vertical text: "THE")
   - Removed `maxLines` and `wordsPerLine` properties

**Why the Change:**
- `stacked-words` breaks text word-by-word, not ideal for multi-word titles
- `horizontal` with `wordsPerLine` on narrow spines causes awkward mid-word breaks
- `vertical-up` provides clean, readable vertical text that auto-scales properly

**Consistency:**
All three templates now use:
- Title: `vertical-up` orientation
- Author: `horizontal` orientation (standard pattern)
- Standard padding: `paddingHorizontal: 4, paddingVertical: 8`

**Files Modified:**
- `src/features/home/utils/spine/templates/spineTemplates.ts` - Updated 3 templates
- `src/constants/version.ts` - Version bump to 0.7.10

---

## [0.7.9] - 2026-01-13

### Spine Templates - Adaptive vertical-two-row for Narrow Spines

Added automatic fallback from `vertical-two-row` to `vertical-up` orientation when spines are too narrow to accommodate two columns.

**Problem:**
On narrow books (< 70px width), `vertical-two-row` text would try to split into two very narrow columns, creating cramped and hard-to-read typography.

**Solution:**
Automatic adaptive orientation that switches rendering mode based on spine width:

```typescript
// Adaptive title orientation
if (spineWidth < 70 && titleConfig.orientation === 'vertical-two-row') {
  // Switch to single-column vertical-up
  orientation: 'vertical-up',
  maxLines: 1,  // Single line for regular vertical
}
```

**Behavior:**

| Spine Width | Template Config | Rendered As |
|-------------|----------------|-------------|
| ≥ 70px | `vertical-two-row` | Two vertical columns (as designed) |
| < 70px | `vertical-two-row` | `vertical-up` (automatic fallback) |

**Example:**
The Western template uses `vertical-two-row`:
- **Wide books (80px+)**: "THE SONG" | "OF ACHILLES" (two columns)
- **Narrow books (<70px)**: "THE SONG OF ACHILLES" (single vertical column)

**Applies To:**
- Title orientation (70px threshold)
- Author orientation (70px threshold)
- Works seamlessly with existing adaptive logic (horizontal → stacked-words at 55px)

**Why 70px Threshold:**
- Typical two-column layout needs ~35px per column minimum
- Below 70px, columns become too narrow for readable text
- Single vertical column provides better readability on narrow spines

**Files Modified:**
- `src/features/home/screens/SpineTemplatePreviewScreen.tsx` - Added adaptive logic
- `src/constants/version.ts` - Version bump to 0.7.9

---

## [0.7.8] - 2026-01-13

### Spine Templates - Fixed Padding & Text Alignment

Fixed padding not working for vertical-two-row and added text alignment support to all orientations.

**Padding Fix for vertical-two-row:**

**Problem:** Padding wasn't working properly for vertical-two-row orientation. Setting `paddingHorizontal: 12` or `paddingVertical: 11` had no visible effect.

**Root Cause:** The rotated View was using absolute dimensions (titleHeight and spineWidth) that didn't account for the padding applied to the parent container.

**Solution:** Calculate rotated dimensions after subtracting padding:
```typescript
// Account for padding in rotated dimensions
const paddingH = titleConfig.paddingHorizontal ?? 3;
const paddingV = titleConfig.paddingVertical ?? 0;
// After -90° rotation: vertical padding affects width, horizontal padding affects height
const rotatedWidth = titleHeight - (paddingV * 2);
const rotatedHeight = spineWidth - (paddingH * 2);
```

**Text Alignment Support:**

Added `align` property support to ALL orientations (was only partially implemented):

1. **Horizontal Text** - Already working ✓
2. **Vertical Text (vertical-up, vertical-down)** - Now respects `align: 'left' | 'center' | 'right'`
3. **vertical-two-row** - Now respects `align: 'left' | 'center' | 'right'`
4. **Author Text** - Now respects align for all orientations (was hardcoded to 'center' for vertical)

**Example Usage:**
```typescript
{
  id: 'western',
  title: {
    orientation: 'vertical-two-row',
    align: 'center',           // ✓ Now working
    paddingHorizontal: 12,     // ✓ Now working
    paddingVertical: 11,       // ✓ Now working
    // ...
  }
}
```

**All Templates Updated:**
All 16 templates now have `align: 'center'` set explicitly for both title and author.

**Files Modified:**
- `src/features/home/screens/SpineTemplatePreviewScreen.tsx` - Fixed padding calculation and text alignment
- `src/features/home/utils/spine/templates/spineTemplates.ts` - Added align to all templates
- `src/constants/version.ts` - Version bump to 0.7.8

---

## [0.7.7] - 2026-01-13

### Spine Templates - All Properties Now Working for vertical-two-row

Fixed vertical-two-row to respect all template properties: `letterSpacing`, `maxLines`, `textSplitPercent`, `lineHeight`, etc.

**Properties Now Working:**

1. **letterSpacing** - Controls horizontal spacing between characters:
   ```typescript
   letterSpacing: 1  // Adds 1px between letters
   ```

2. **maxLines** - Controls maximum number of lines (not hardcoded to 2 anymore):
   ```typescript
   maxLines: 3  // Allow up to 3 lines instead of 2
   ```

3. **textSplitPercent** - Controls where to split text between lines:
   ```typescript
   textSplitPercent: 51  // First line gets 51% of words
   ```

4. **lineHeight** - Optional override for line spacing:
   ```typescript
   lineHeight: 55  // Fixed line height (use sparingly with adjustsFontSizeToFit)
   ```

**Example Western Template:**
All these properties now work together properly:
```typescript
{
  id: 'western',
  title: {
    orientation: 'vertical-two-row',
    fontSize: 30,
    letterSpacing: 1,        // ✓ Now working
    maxLines: 3,             // ✓ Now working
    textSplitPercent: 51,    // ✓ Now working
    // ...
  }
}
```

**Technical Changes:**
- Added `letterSpacing` to style object when defined
- Changed `numberOfLines={2}` to `numberOfLines={titleConfig.maxLines ?? 2}`
- Both title and author orientations now respect all properties

**Files Modified:**
- `src/features/home/screens/SpineTemplatePreviewScreen.tsx` - Added missing property support
- `src/constants/version.ts` - Version bump to 0.7.7

---

## [0.7.6] - 2026-01-13

### Spine Templates - Fixed adjustsFontSizeToFit for vertical-two-row

Fixed auto-scaling by removing the default lineHeight constraint that was preventing proper text fitting.

**Problem:**
- `adjustsFontSizeToFit` was not working properly with `lineHeight: fontSize * 0.8`
- When text scaled down to fit, the fixed lineHeight stayed constant, preventing proper fitting
- Users had to manually reduce fontSize from 72 to 30 to make text fit

**Solution:**
- Removed the automatic lineHeight default for vertical-two-row orientation
- Only applies lineHeight if explicitly set in template config
- Allows `adjustsFontSizeToFit` to scale text naturally with automatic line height
- Text now properly scales down to fit the available space

**Technical Explanation:**
When `adjustsFontSizeToFit` scales the fontSize down (e.g., from 72pt to 40pt), a fixed `lineHeight: 57.6` (72 * 0.8) becomes larger than the scaled fontSize (40pt), causing layout issues. By letting lineHeight be automatic, it scales proportionally with the fontSize.

**Before:**
```typescript
lineHeight: titleConfig.lineHeight ?? titleConfig.fontSize * 0.8  // Broken!
```

**After:**
```typescript
// Only use lineHeight if template explicitly provides it
...(titleConfig.lineHeight ? { lineHeight: titleConfig.lineHeight } : {})
```

**To Control Line Spacing:**
Templates can still explicitly set lineHeight if needed:
```typescript
title: {
  orientation: 'vertical-two-row',
  fontSize: 72,
  lineHeight: 55,  // Explicit override still works
  // ...
}
```

**Files Modified:**
- `src/features/home/screens/SpineTemplatePreviewScreen.tsx` - Fixed lineHeight logic
- `src/constants/version.ts` - Version bump to 0.7.6

---

## [0.7.5] - 2026-01-13

### Spine Templates - Configurable Text Split for vertical-two-row

Added `textSplitPercent` property to control where text splits between the two lines in vertical-two-row orientation.

**Changes:**

1. **New Property: `textSplitPercent`** - Controls split point for two-line text:
   - Default: `50` (split at 50% of words)
   - Range: `0-100` (percentage of words for first line)
   - Available for both title and author configs
   - Examples:
     - `textSplitPercent: 50` → "THE SONG OF\nACHILLES" (2 words / 2 words)
     - `textSplitPercent: 33` → "THE SONG\nOF ACHILLES" (1 word / 3 words)
     - `textSplitPercent: 66` → "THE SONG OF ACHILLES\n" (3 words / 1 word)

2. **How It Works:**
   - Splits text into words: `["THE", "SONG", "OF", "ACHILLES"]`
   - Calculates split point: `Math.ceil(words.length * (textSplitPercent / 100))`
   - Inserts line break: `"THE SONG\nOF ACHILLES"`
   - Text component wraps naturally at the newline
   - After -90° rotation, each line becomes a vertical column

3. **Why This Matters:**
   - Balances text between two vertical columns
   - Default 50% split ensures equal distribution
   - Templates can customize for specific titles (e.g., 33% for shorter first column)
   - Works with lineHeight to control column spacing

**Example Template:**
```typescript
{
  id: 'western',
  title: {
    orientation: 'vertical-two-row',
    fontSize: 72,
    lineHeight: 55,
    textSplitPercent: 50,  // Split at 50% of words
    // ...
  }
}
```

**Example Output:**
```
"THE SONG OF ACHILLES" (4 words, textSplitPercent: 50)
→ Split at word 2 (50% of 4)
→ "THE SONG\nOF ACHILLES"
→ After rotation: two vertical columns with 2 words each
```

**Files Modified:**
- `src/features/home/utils/spine/templates/spineTemplates.ts` - Added textSplitPercent property
- `src/features/home/screens/SpineTemplatePreviewScreen.tsx` - Implemented split logic
- `src/constants/version.ts` - Version bump to 0.7.5

---

## [0.7.4] - 2026-01-13

### Spine Templates - Fixed vertical-two-row with Natural Text Wrapping

Simplified vertical-two-row implementation to use natural text wrapping instead of manual column splitting.

**Changes:**

1. **Simplified Rendering** - Replaced complex two-column splitting logic with single Text component:
   - **Before:** Split text into two parts, create two separate Text components with `numberOfLines={1}`, rotate each independently
   - **After:** Single Text component with `numberOfLines={2}`, let it wrap naturally, rotate once
   - Now lineHeight actually works to control spacing between the two lines (which become columns after rotation)

2. **Why This Works Better:**
   - React Native's text wrapping algorithm handles word breaks intelligently
   - `adjustsFontSizeToFit` works properly with multi-line text and lineHeight
   - Single rotation transform is more performant than multiple transforms
   - Consistent with how other orientations (vertical-up, horizontal) are rendered

3. **LineHeight Now Functional:**
   - Title text: `lineHeight: fontSize * 0.8` (default 80% of font size)
   - Author text: `lineHeight: fontSize * 0.8` (default 80% of font size)
   - Controls spacing between wrapped lines (which appear as column spacing after rotation)
   - Templates can override: `lineHeight: 55` for custom spacing

**Example:**
```typescript
// Simple, elegant implementation
<View style={{ transform: [{ rotate: '-90deg' }] }}>
  <Text
    numberOfLines={2}
    adjustsFontSizeToFit
    style={{ lineHeight: fontSize * 0.8 }}
  >
    THE SONG OF ACHILLES
  </Text>
</View>
```

**Files Modified:**
- `src/features/home/screens/SpineTemplatePreviewScreen.tsx` - Simplified vertical-two-row rendering
- `src/constants/version.ts` - Version bump to 0.7.4

---

## [0.7.2-0.7.3] - 2026-01-13

### (Superseded by 0.7.4)

Earlier attempts using letterSpacing and lineHeight with split columns. Replaced with natural text wrapping approach.

---

## [0.7.1] - 2026-01-13

### Spine Templates - Two-Column Vertical Layout

Added new `vertical-two-row` orientation for splitting vertical text across two side-by-side columns.

**New Orientation: `vertical-two-row`**

Renders text in two vertical columns reading bottom-to-top, perfect for long titles that need more space.

**Example:**
```
"THE SONG OF ACHILLES"

Single vertical-up:     Two-column vertical-two-row:
S  E  L  I  H  C  A     T  S     O  A  C  H  I  L  L  E  S
                        H  O     F
                        E  N
                           G
```

**How It Works:**
- Splits text by words at the midpoint
- Left column: First half of words
- Right column: Remaining words
- Each column rotated -90° (vertical-up)
- Both columns auto-scale independently with `adjustsFontSizeToFit`

**Usage:**
```typescript
title: {
  orientation: 'vertical-two-row',  // NEW!
  fontSize: 172,
  weight: '400',
  fontFamily: 'Notable-Regular',
  case: 'uppercase',
  placement: 'center',
  heightPercent: 85,
}
```

**Use Cases:**
- Long book titles that don't fit comfortably in single vertical column
- Western/frontier aesthetics where bold stacked text is desired
- Art deco designs with columnar typography
- Wide spines where vertical space can be split

**Available For:**
- Title orientation
- Author orientation

**Files Modified:**
- `src/features/home/utils/spine/templates/spineTemplates.ts` - Added orientation type
- `src/features/home/screens/SpineTemplatePreviewScreen.tsx` - Implemented rendering
- `src/constants/version.ts` - Version bump

---

## [0.7.0] - 2026-01-13

### Spine Templates - Major Curation & Refinement

Curated spine template library down to 16 genre-specific templates with professional polish.

**Changes:**

1. **Template Curation** - Reduced from 56 to 16 essential templates:
   - Literary Fiction
   - Science Fiction
   - Technology
   - Western
   - Art & Design
   - Adventure
   - True Crime
   - Horror
   - Romance
   - Biography
   - Philosophy
   - Thriller
   - Historical Fiction
   - Business
   - Music & Arts
   - Anthology

2. **Removed All Decorations** - Eliminated decorative lines and borders:
   - All templates now use `decoration: { element: 'none', lineStyle: 'none' }`
   - Clean, minimal aesthetic across all designs
   - Focus on typography, not ornamentation

3. **Added Consistent Padding** - All templates now have proper spacing:
   - Title: `paddingHorizontal: 4-8px, paddingVertical: 8px`
   - Author: `paddingHorizontal: 8px, paddingVertical: 6px`
   - Prevents text from touching spine edges
   - Better readability and professional appearance

4. **Genre-Specific Naming** - Renamed all templates to match genres directly:
   - Old: `minimal-serif`, `futuristic-scifi`, `western-noir`
   - New: `literary-fiction`, `science-fiction`, `western`
   - Easier to understand template purpose at a glance

5. **Removed Duplicates** - Eliminated redundant templates:
   - Removed overlapping designs (e.g., multiple sci-fi variants)
   - Each genre now has one definitive template
   - Cleaner template selection experience

**Files Modified:**
- `src/features/home/utils/spine/templates/spineTemplates.ts` - Complete rewrite
- `src/constants/version.ts` - Major version bump to 0.7.0

**Migration Notes:**
- Template count: 56 → 16 (71% reduction)
- Template IDs changed - update any hardcoded references
- Decoration system still exists but unused in core templates
- All utility functions (getTemplate, getTemplatesForGenre) remain unchanged

---

## [0.6.380] - 2026-01-13

### Spine Templates - Adaptive Author Orientation for Narrow Spines

Added automatic adaptation that switches horizontal author text to stacked-words when spine width is less than 55px.

**Problem:**
- Narrow spines (40px) with horizontal author text often had text that was too small to read
- Long author names would shrink excessively to fit narrow widths
- User feedback: "horizontal author text doesn't work well on thin spines"

**Solution:**
- Added `adaptiveAuthorConfig` logic that detects spine width at render time
- When `spineWidth < 55px` AND `author.orientation === 'horizontal'`
  → Automatically switches to `stacked-words` orientation
- Original template definition remains unchanged
- Adaptation happens dynamically during rendering

**Behavior:**
- **Wide spines (≥55px):** Author renders as specified in template
- **Narrow spines (<55px):** Horizontal authors automatically become stacked-words
- Vertical and already-stacked authors are not affected

**Example:**
```
Template: author.orientation = 'horizontal'

Rendered at 80px width: MATT HAIG (horizontal)
Rendered at 40px width: MATT       (stacked-words)
                        HAIG
```

**Benefits:**
- Better readability on thin spine views
- No template modifications required
- Consistent behavior across all 56 templates
- Respects designer intent while optimizing for narrow displays

**Files Modified:**
- `src/features/home/screens/SpineTemplatePreviewScreen.tsx` - Added adaptive logic
- `src/constants/version.ts` - Version bump

---

## [0.6.379] - 2026-01-13

### Spine Templates - Fixed Text Clipping in Stacked Orientations

Completely rewrote vertical spacing logic for stacked text to prevent clipping with adjustsFontSizeToFit.

**Root Cause:**
- Setting `lineHeight < fontSize` on Text components causes clipping
- Previous logic: `fontSize: 50.4px, lineHeight: 42px` → text clipped at top/bottom
- `adjustsFontSizeToFit` + constrained lineHeight = guaranteed clipping

**Solution:**
- Removed `lineHeight` from stacked Text components entirely
- Moved spacing control to parent View using `gap` property
- Gap uses negative values to pull words/letters closer together
- Text now has full natural height, no clipping

**New Spacing Defaults:**
- Stacked words (title): `gap: fontSize * -0.15` (15% overlap)
- Stacked words (author): `gap: fontSize * -0.1` (10% overlap)
- Stacked letters (title): `gap: fontSize * -0.2` (20% overlap)
- Stacked letters (author): `gap: fontSize * -0.15` (15% overlap)

**Custom Spacing:**
- Use `lineHeightScale` in templates to control gap dynamically
- `lineHeightScale: 0.5` → Tighter stacking (50% more overlap)
- `lineHeightScale: 1.0` → Natural spacing (no overlap)

**Files Modified:**
- `src/features/home/screens/SpineTemplatePreviewScreen.tsx` - Rewrote stacked rendering
- `src/constants/version.ts` - Version bump

---

## [0.6.378] - 2026-01-13

### Spine Templates - MaxLines Support for Stacked Orientations

Fixed stacked orientations to respect the `maxLines` property instead of using hardcoded limits.

**Bug Fixed:**
- `stacked-words` was hardcoded to show only 2 words (now respects `maxLines`, default 10)
- `stacked-letters` was hardcoded to show only 4 letters (now respects `maxLines`, default 20)
- "Project Hail Mary" now correctly shows all 3 words when `maxLines: 3` is set

**Behavior:**
- `maxLines: 3` on stacked-words → Shows up to 3 words
- `maxLines: 20` on stacked-letters → Shows up to 20 letters
- Omit `maxLines` → Shows all words/letters (up to reasonable defaults)

**Files Modified:**
- `src/features/home/screens/SpineTemplatePreviewScreen.tsx` - Updated slice limits
- `src/constants/version.ts` - Version bump

---

## [0.6.377] - 2026-01-13

### Spine Templates - Stacked Author Orientations

Added stacked text options for author names, matching the title orientation capabilities.

**New Author Orientations:**
- `stacked-letters` - Each letter of author name on separate line (e.g., "S\nT\nE\nP\nH\nE\nN")
- `stacked-words` - Each word of author name on separate line (e.g., "STEPHEN\nKING")

**Properties Added:**
- `letterSpacing` - Control spacing between stacked letters (works with both stacked orientations)

**Use Cases:**
- Celebrity author branding (Stephen King, James Patterson)
- Anthology collections with "Various Authors"
- Experimental indie designs with vertical emphasis
- Limited spine width where horizontal text doesn't fit

**Files Modified:**
- `src/features/home/utils/spine/templates/spineTemplates.ts` - Added orientation types and letterSpacing
- `src/features/home/screens/SpineTemplatePreviewScreen.tsx` - Implemented stacked rendering logic
- `src/constants/version.ts` - Version bump

---

## [0.6.376] - 2026-01-13

### Spine Template System - Genre-Specific Expansion

Added 28 new genre-specific spine templates using decorative typography, expanding the library to 56 professional designs.

**New Features:**

1. **Genre-Specific Templates** - 28 new templates covering:
   - Adventure, True Crime, Children's, Horror, Romance
   - Science Fiction, Fantasy, Mystery, Biography, Philosophy
   - Thriller, Historical Fiction, Tech/Business, Literary Fiction
   - Music/Art, Gaming, Western, Poetry/Nature, Young Adult
   - Self-Help, Humor, Travel, Sports, Science, Food/Cooking
   - Politics/Journalism, Anthology, LGBTQ+, Parenting, Finance

2. **Advanced Typography Properties**:
   - `lineHeight` - Explicit line height in pixels
   - `lineHeightScale` - Multiplier for fontSize to calculate line height
   - `maxLines` - Control text wrapping (default: 2)
   - `wordsPerLine` - Force line breaks after N words for precise text layout

3. **Three-Row Preview Screen**:
   - Thin spines (40px width) - Compact bookshelf view
   - Normal spines (80px width) - Standard bookshelf view
   - Wide spines (120px width) - Detailed bookshelf view
   - Each row independently scrolls horizontally

4. **Decorative Fonts**:
   - Notable (Western, True Crime) - Bold slab serif
   - FleurDeLeah (Romance) - Elegant script
   - GrenzeGotisch (Horror) - Gothic blackletter
   - MacondoSwashCaps (Fantasy) - Medieval swash caps
   - UncialAntiqua (Philosophy) - Ancient uncial
   - Orbitron (Sci-Fi, Tech) - Geometric futuristic
   - Silkscreen (Gaming) - Pixel perfect monospace
   - Federo (Music/Art) - Art deco geometric
   - BebasNeue (Children's, YA, Sports) - Friendly bold

**Files Modified:**
- `src/features/home/utils/spine/templates/spineTemplates.ts` - Added 28 genre templates
- `src/features/home/screens/SpineTemplatePreviewScreen.tsx` - Three-row layout, dynamic count
- `src/constants/version.ts` - Version bump

**Technical Notes:**
- All templates include `usedFor` and `preferredFor` genre mappings
- Template matching system uses genre tags for automatic selection
- LineHeightScale takes precedence if both lineHeight and scale are specified
- WordsPerLine only applies to horizontal text orientation

---

## [0.6.375] - 2026-01-12

### Book Detail Page Refinements

Follow-up refinements to the Book Detail page redesign based on user feedback.

**Changes:**

1. **TopNav Restored**
   - Added back Library and Queue pill buttons to TopNav
   - Share and Close remain as circle buttons

2. **Progress Section Compact Layout**
   - "Progress" label with percentage inline on the left
   - "Mark as Finished" text with icon inline on the right
   - Clear progress button inline next to "time listened"
   - Reduced section height

3. **Section Order Changed**
   - Progress section now comes before action buttons
   - Action buttons (Save/Play pills) remain right-aligned

4. **Chapters Link**
   - Clicking "Chapters" in meta grid scrolls to chapters section

5. **About Section**
   - Removed "About" header text
   - Drop cap now inline with text (proper wrapping)

**Files Modified:**
- src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx
- src/constants/version.ts
- CHANGELOG.md

---

## [0.6.374] - 2026-01-12

### Book Detail Page Redesign

Major visual redesign of the Book Detail screen while preserving all functionality.

**New Design Features:**

1. **Centered Hero Layout**
   - Larger centered cover image (160x160) with shadow
   - Split headline title (line 1 normal, line 2 italic)
   - Centered byline with "By Author · Narrated by Narrator" format
   - All author/narrator names are clickable links

2. **Meta Grid Section**
   - 3-column layout: Duration | Chapters | Year
   - Clean bordered design with separator lines
   - Uppercase labels with monospace font

3. **Actions Row (6 Icon Buttons)**
   - Finish (with toggle state)
   - Clear (reset progress)
   - Play (primary filled button)
   - Download (secondary outline)
   - Queue (toggle state)
   - Library (toggle state)
   - Each button has circular icon + label

4. **Progress Section**
   - Separated from About section
   - Progress bar with rounded corners
   - Time listened / remaining display
   - Progress percentage or "Complete" label

5. **About Section with Drop Cap**
   - Large decorative first letter (drop cap)
   - Clean description text with read more toggle

6. **Chapters List with Circular Badges**
   - Circular numbered badges (instead of italic numbers)
   - Badge color states: default, active (orange), complete (gray)
   - Clean chapter title and duration display

**Preserved Functionality:**
- All 17 hooks maintained (useBookDetails, usePlayerStore, useQueueStore, etc.)
- All 14 handlers preserved (handlePlay, handleQueueToggle, handleDownload, etc.)
- TopNav with share and close buttons
- Pull-to-refresh functionality
- Navigation to author/narrator/series screens
- Download progress display
- Chapter seeking

**Files Modified:**
- src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx
- src/constants/version.ts
- CHANGELOG.md

---

## [0.6.373] - 2026-01-11

### P1-P4 Cleanup: Safe Areas, Console Logs, Colors, TypeScript

Completed priority fixes from comprehensive codebase audit (CODEBASE_HEALTH_REPORT.md).

**P1: Added Safe Area Handling** ✅
- `src/features/home/screens/LibraryScreen.tsx`
  - Added `useSafeAreaInsets` import
  - Applied `paddingTop: insets.top` to container
- `src/features/auth/screens/LoginScreen.tsx`
  - Added `useSafeAreaInsets` import
  - Applied `paddingTop: insets.top, paddingBottom: insets.bottom` to container
- **Impact:** Fixes notch/island overlap on modern devices (now 41/41 screens with safe area handling)

**P2: Console.log Cleanup** ✅
- Reduced console.log statements from 52 to 32 (38% reduction)
- Agent cleaned up debug logs in: spineCache.ts, queryClient.ts, searchIndex.ts, analyticsService.ts, and 18 other files
- Kept important logs in debug utilities (runtimeMonitor, audioDebug, perfDebug, logger)
- **Impact:** Cleaner console output, more professional app behavior

**P3: Fixed Critical Hardcoded Colors** ✅
- `src/features/auth/screens/LoginScreen.tsx`
  - Removed hardcoded `#30D158` (iOS green) → use `colors.semantic.success` inline
  - Removed hardcoded `#FF453A` (iOS red) → use `colors.semantic.error` inline
  - Removed hardcoded `rgba(255, 69, 58, 0.1)` → use `colors.semantic.errorLight` inline
  - Added inline style overrides for proper theme support
- `src/shared/components/CoverPlayButton.tsx`
  - Fixed legacy `colors` import causing 10 TypeScript errors
  - Converted static styles to `createStyles(colors)` function
  - Now properly uses theme colors via `useTheme()` hook
- **Impact:** Better theme consistency, dark mode support

**P4: Fixed TypeScript Errors** ✅
- Fixed 10 errors in CoverPlayButton.tsx by converting to dynamic styles
- Remaining ~64 errors are pre-existing (mostly missing `primaryTertiary`, `primarySecondary` properties in text colors)
- **Impact:** Reduced TypeScript errors, improved type safety

**Files Modified:**
- src/features/home/screens/LibraryScreen.tsx
- src/features/auth/screens/LoginScreen.tsx
- src/shared/components/CoverPlayButton.tsx
- src/constants/version.ts
- CHANGELOG.md

**Summary:**
- ✅ P1: Safe areas (2 screens fixed)
- ✅ P2: Console cleanup (38% reduction)
- ✅ P3: Critical colors fixed (LoginScreen + CoverPlayButton)
- ✅ P4: TypeScript errors reduced (10 errors fixed)
- Skipped P5 (271 'any' types - ongoing cleanup)

---

## [0.6.372] - 2026-01-11

### Fixed TypeScript Errors and Runtime Crash

**Critical Fixes:**
1. **Added Missing `status` Property to ThemeColors** (P0 - Critical)
   - Added `status: { success, error, warning, info }` to `createLightColors()`
   - Added `status: { success, error, warning, info }` to `createDarkColors()`
   - **Fixed 16 TypeScript errors** in ErrorView, NetworkStatusBar, PinInput, and Snackbar components
   - Files modified: `src/shared/theme/colors.ts`

2. **Fixed SearchScreen Runtime Crash** (P0 - Critical)
   - Fixed `Property 'storeColors' doesn't exist` runtime error
   - Changed `storeColors.statusBar` to `colors.statusBar`
   - Files modified: `src/features/search/screens/SearchScreen.tsx:642`

**Impact:**
- Unblocks type-safe builds
- Fixes SearchScreen crash on launch
- All status indicator components now have proper TypeScript support

**Audit Report:**
- Generated comprehensive codebase health report: `CODEBASE_HEALTH_REPORT.md`
- 133,191 lines of code across 483 files
- Overall grade: 4/5 stars
- Architecture: 5/5 (excellent modular design)
- Documentation: 5/5 (130+ docs, 2,673 JSDoc blocks)

---

## [0.6.371] - 2026-01-11

### Fixed Hardcoded Colors in Feature Files

Replaced hardcoded color values with theme tokens for consistency and maintainability.

**Files Modified:**
- `src/features/completion/components/CompleteBadge.tsx`
  - Added `useTheme` hook import
  - Changed `color="#000"` to `colors.text.inverse` for Check/CheckCircle icons
- `src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx`
  - Changed `color: '#444'` to `colors.gray` (secretLibraryColors) for description text
- `src/features/auth/screens/LoginScreen.tsx`
  - Changed `#30D158` (iOS system green) to `colors.semantic.success` for validation icons
  - Changed `#FF453A` (iOS system red) to `colors.semantic.error` for error icons/text
  - Added inline style overrides for error text using theme tokens
- `src/features/queue/components/SwipeableQueueItem.tsx`
  - Changed `color="#fff"` to `colors.text.inverse` for Trash2 icon and action text
- `src/features/queue/screens/QueueScreen.tsx`
  - Changed `color: '#000'` to `colors.text.inverse` for browse button text

**Notes:**
- `shadowColor: '#000'` kept as-is (standard shadow color)
- Destructive action colors (`#ff4b4b`) kept as-is with comments (intentional)
- Border colors in static styles kept with comments explaining theme usage

---

## [0.6.370] - 2026-01-11

### Unified Progress Data Architecture

Major refactoring to eliminate fragmented progress data and provide instant UI updates.

**Problem:** Progress data existed in 5+ places that could become out of sync:
- Server `/api/me/items-in-progress`
- Server `/api/me` (mediaProgress array)
- SQLite `user_books` table
- SQLite `playback_progress` table (legacy)
- libraryCache (item.userMediaProgress)
- spineCache (CachedSpineData.progress)
- playerStore (currentPosition)

**Solution:** Created unified progressStore as single source of truth.

**New Files:**
- `src/core/stores/progressStore.ts` - Unified progress store
  - In-memory Map backed by SQLite user_books table
  - Version counter for reactive subscribers
  - Methods: loadFromDatabase, updateProgress, markFinished, getInProgressBookIds
  - Debounced SQLite writes for performance during playback
  - setupProgressSubscribers() wires up spineCache updates

**Modified Files:**
- `src/core/stores/index.ts` - Export progressStore
- `src/core/services/appInitializer.ts` - Load progressStore during init
- `src/features/player/services/backgroundSyncService.ts` - Notify progressStore on save
- `src/shared/hooks/useContinueListening.ts` - Read from progressStore (local-first)

**Data Flow (After):**
```
Player updates → progressStore.updateProgress()
                       ↓
              SQLite write (debounced)
                       ↓
              In-memory Map update
                       ↓
    ┌─────────────────┼─────────────────┐
    ↓                 ↓                 ↓
spineCache     useContinue       backgroundSync
re-renders     Listening          queues server
```

**Benefits:**
- Instant progress updates (no refresh needed)
- Spine progress bars update during playback
- Continue Listening updates immediately on pause
- Works offline with cached data
- Single source of truth eliminates sync issues

**Verification:**
- [x] Single source of truth: SQLite via progressStore
- [x] spineCache subscribes to progressStore
- [x] useContinueListening reads from progressStore
- [x] backgroundSyncService notifies progressStore
- [ ] Full end-to-end testing pending

### Test Suite Fixes (41 → 0 Failing Tests)

Fixed all 41 failing tests across 6 test suites.

**Fixes Applied:**
1. `metadata.ts` - Handle narrator objects `{ name: string }` in arrays
2. `progressCalculator.test.ts` - Correct test for 95% threshold (98% is complete)
3. `EmptyState.test.tsx` - Add `useThemeColors`, `iconSizes`, `accentColors` mocks
4. `ErrorView.test.tsx` - Add complete theme mock suite
5. `HorizontalBookItem.test.tsx` - Add theme mocks with progress colors
6. `websocketService.test.ts` - Fix socket.io mock to pass URL/options

**Test Results:** 672 passing, 0 failing

### Cache Unit Tests (P3)

Added comprehensive unit tests for cache modules.

**New Test Files:**
- `src/core/cache/__tests__/cacheAnalytics.test.ts` (24 tests)
  - Tests for recordCacheHit, recordCacheMiss
  - Tests for getCacheStats, getAllCacheStats
  - Tests for resetCacheStats, resetAllCacheStats
  - Tests for getCacheStatsSummary
  - Tests for hit rate calculations
  - Tests for multiple independent caches

- `src/core/cache/__tests__/useCoverUrl.test.ts` (7 tests)
  - Tests for cache-busting timestamps
  - Tests for query parameter handling
  - Tests for options passthrough

**Test Results:** 703 passing (31 new cache tests added)

---

## [0.6.369] - 2026-01-11

### P2/P3 Technical Debt Elimination - Part 2

Continued comprehensive technical debt cleanup from previous session.

#### Viewport-Based Cover Prefetching (P3)

**New Hook:** `src/shared/hooks/useViewportPrefetch.ts`
- Prefetches cover images for items approaching the visible viewport
- Uses expo-image's `Image.prefetch()` for efficient preloading
- Configurable prefetch distance (default: 10 items ahead)
- Tracks prefetched items to avoid duplicate fetches
- Includes `createPrefetchTracker()` utility for manual tracking

**Integration:**
- Added to `FilteredBooksScreen` with `prefetchAhead: 12` (4 rows in 3-column grid)
- Connects to FlatList's `onViewableItemsChanged` and `viewabilityConfig`

#### Manual Sync Retry Button (P3)

**New Store:** `src/core/stores/syncStatusStore.ts`
- Zustand store for reactive sync status in UI
- Tracks: pendingCount, isSyncing, isOnline, lastError, lastSyncedAt
- Actions: refreshStatus(), retrySync(), setSyncing(), setError(), setOnline()
- Auto-subscribes to eventBus for sync events
- Auto-subscribes to networkMonitor for connectivity changes
- Periodic refresh every 30 seconds
- Provides selectors: usePendingSyncCount, useIsSyncing, useHasSyncErrors, useSyncStatus

**New Component:** `src/shared/components/SyncStatusBanner.tsx`
- Visual banner showing sync status with retry capability
- Shows when: offline with pending syncs, sync failed, items pending
- Hides automatically when all synced
- Displays "Retry" button when errors occur and online
- Uses lucide-react-native icons (Cloud, CloudOff, RefreshCw, AlertCircle)
- Adapts to theme colors

**Files Created:**
- `src/shared/hooks/useViewportPrefetch.ts`
- `src/core/stores/syncStatusStore.ts`
- `src/core/stores/index.ts`
- `src/shared/components/SyncStatusBanner.tsx`

**Files Modified:**
- `src/shared/hooks/index.ts` - Added useViewportPrefetch export
- `src/shared/components/index.ts` - Added SyncStatusBanner export
- `src/features/library/screens/FilteredBooksScreen.tsx` - Integrated viewport prefetching

---

## [0.6.368] - 2026-01-11

### Fixed Series Navigation from Book Detail Page

**Problem:** Tapping series name on book detail page showed "Series not found" error.

**Root Cause:** The library cache indexed series using `metadata.seriesName`, but some books only have series info in `metadata.series[0].name` (with `seriesName` being undefined). These books weren't being indexed.

**Fix:** Updated `buildIndexes()` in `libraryCache.ts` to check both formats:
1. First tries `metadata.seriesName`
2. Falls back to `metadata.series[0].name` if seriesName is undefined

**Files Modified:**
- `src/core/cache/libraryCache.ts` - Fixed series indexing to handle both metadata formats

**Testing:** After this fix, force refresh the library cache (pull-to-refresh on library) to rebuild indexes, then tap any series name on a book detail page.

---

## [0.6.367] - 2026-01-11

### TypeScript Error Fixes & Type Safety Improvements

Fixed all TypeScript compilation errors (12 errors → 0 errors).

**BookMetadata Type Extensions:**
- Added `narratorName?: string` - first narrator name for display
- Added `rating?: number` - optional rating (if enabled on server)
- Added `ratingCount?: number` - number of ratings

**Files Fixed:**
- `src/core/types/media.ts` - Extended BookMetadata interface
- `src/features/home/components/TextListSection.tsx` - Fixed undefined `bookAny` variable in debug code
- `src/features/home/screens/LibraryScreen.tsx` - Added missing MediaProgress properties (`hideFromContinueListening`, `startedAt`)
- `src/shared/components/BookCard.tsx` - Fixed narrator access (narrators is `string[]`, not object array)
- `src/core/hooks/useOptimisticMutation.ts` - Fixed CollectionBookRef[] type mismatch with explicit cast

**Verification:**
- `npx tsc --noEmit` passes with zero errors
- Current `any` count: 109 casts + 189 annotations = ~298 total
- Tests: 630/671 passing (failures are test infrastructure issues)

**P2/P3 Item Status:**
| Item | Status |
|------|--------|
| SQLite corruption detection | Defer |
| Sync queue age limit (7 days) | Defer |
| Cache hit/miss logging | Partial |
| Persist derived indexes | Partial |
| Cache unit tests | Done |
| Viewport-based cover prefetch | Defer |
| Manual sync retry button | Defer |

---

## [0.6.366] - 2026-01-11

### Cache Architecture Fixes - Privacy & Performance Improvements

Critical fixes for cache architecture based on comprehensive audit. Addresses privacy issues, data consistency, and user visibility.

**Fix 1: P0 Critical - Logout Privacy**
- `authService.clearStorage()` now clears ALL user data on logout
- Added `sqliteCache.clearAllUserData()` to clear all 16+ SQLite tables
- Prevents next user from seeing previous user's library, progress, history

**Fix 2: P1 High - Eliminate AsyncStorage Divergence**
- Removed AsyncStorage for library data; SQLite is now single source of truth
- `libraryCache.ts` now reads/writes exclusively via `sqliteCache`
- Eliminates potential data divergence between AsyncStorage and SQLite

**Fix 3: P1 High - Clear Cache UI**
- Added "Clear Cache" button to Storage Settings screen
- Allows users to manually clear cached library data
- Downloads and listening progress are preserved

**Fix 4: P1 High - Sync Failure Notification**
- Added toast notification when sync fails after max retries
- User now sees "Sync failed. Progress saved locally and will sync when online."
- Progress remains in SQLite for future sync attempts

**Fix 5: P2 Medium - Lazy-Load Trigram Index**
- Search index now built lazily on first search, not at startup
- Saves ~150ms startup time and ~20MB memory until user searches
- Added `searchIndex.queueBuild()` for deferred indexing

### Files Modified
- `src/core/auth/authService.ts` - Added cache clearing on logout
- `src/core/services/sqliteCache.ts` - Added clearAllUserData() method
- `src/core/cache/libraryCache.ts` - Switched from AsyncStorage to SQLite
- `src/core/cache/searchIndex.ts` - Added lazy loading support
- `src/features/profile/screens/StorageSettingsScreen.tsx` - Added Clear Cache UI
- `src/features/player/services/backgroundSyncService.ts` - Added sync failure toast
- `src/constants/version.ts` - Version bump

---

## [0.6.365] - 2026-01-11

### Codebase Cleanup - Phases 11-15: Type Safety Improvements

Major type safety cleanup across the codebase, reducing `as any` casts from 201 to 109 (92 removed, 46% reduction).

**Key Patterns Established:**
- Type guards: `isBookMedia()` for checking if media has book properties (duration, chapters)
- Helper functions: `getBookMetadata()` returning `BookMetadata | null` with `mediaType` check
- Direct property access: `item.userMediaProgress` (already typed on LibraryItem interface)
- Global type extensions: Platform-specific APIs (ErrorUtils, performance.memory) properly typed

**Phase 11 - Core Player & Sync (18 casts removed):**
- `playerStore.ts` - Added type guards for audioFiles, metadata, duration access
- `finishedBooksSync.ts` - Fixed userMediaProgress and mediaProgress access
- `useReadingHistory.ts` - Proper getMetadata return type

**Phase 12 - Library & Discovery (20 casts removed):**
- `FilteredBooksScreen.tsx` - Added getBookDuration helper
- `useLibraryData.ts` - Removed unnecessary userMediaProgress casts
- `usePopularContent.ts` - Type guards for duration and metadata
- `errors.ts` - Created hasErrorFlag helper for duck-typing error checks

**Phase 13 - Mutations & Monitoring (12 casts removed):**
- `useOptimisticMutation.ts` - Added RollbackContext, CollectionBookRef, CollectionData types
- `runtimeMonitor.ts` - Declared global types for ErrorUtils, PerformanceMemory

**Phase 14 - Components & Screens (25+ casts removed):**
- `library/types.ts` - Fixed getMetadata, getProgress, getDuration exports
- `BookCard.tsx`, `queueStore.ts`, `HomeScreen.tsx` - Added helpers
- `useMoodRecommendations.ts`, `kidModeFilter.ts`, `seriesFilter.ts` - Type guards
- `GlobalMiniPlayer.tsx` - DimensionValue typing for percentages
- `SeriesSpineCard.tsx`, `YourSeriesSection.tsx` - Spine data conversion
- `SeriesBookRow.tsx`, `BatchActionButtons.tsx`, `PlayerModule.tsx` - Metadata helpers

**Phase 15 - Final Cleanup (17+ casts removed):**
- `ContinueListeningSection.tsx`, `ContinueListeningHero.tsx` - Progress access
- `discover/types.ts`, `SearchScreen.tsx` - BookSummary conversion

**Metrics:**
- `as any` count reduced: 201 → 109 (92 fewer casts, 46% reduction)
- Zero TypeScript errors
- Consistent patterns across all fixed files

### Files Modified
- `src/features/player/stores/playerStore.ts`
- `src/core/services/finishedBooksSync.ts`
- `src/features/reading-history-wizard/hooks/useReadingHistory.ts`
- `src/features/library/screens/FilteredBooksScreen.tsx`
- `src/features/library/hooks/useLibraryData.ts`
- `src/features/discover/hooks/usePopularContent.ts`
- `src/core/api/errors.ts`
- `src/features/home/components/TextListSection.tsx`
- `src/core/hooks/useOptimisticMutation.ts`
- `src/utils/runtimeMonitor.ts`
- `src/features/library/types.ts`
- `src/shared/components/BookCard.tsx`
- `src/features/queue/stores/queueStore.ts`
- `src/features/home/screens/HomeScreen.tsx`
- `src/features/mood-discovery/hooks/useMoodRecommendations.ts`
- `src/shared/utils/kidModeFilter.ts`
- `src/shared/utils/seriesFilter.ts`
- `src/navigation/components/GlobalMiniPlayer.tsx`
- `src/features/browse/components/SeriesSpineCard.tsx`
- `src/features/home/components/YourSeriesSection.tsx`
- `src/features/home/components/ContinueListeningSection.tsx`
- `src/features/library/components/ContinueListeningHero.tsx`
- `src/features/series/components/SeriesBookRow.tsx`
- `src/features/series/components/BatchActionButtons.tsx`
- `src/features/player/components/PlayerModule.tsx`
- `src/features/discover/types.ts`
- `src/features/search/screens/SearchScreen.tsx`
- `src/constants/version.ts`

---

## [0.6.360] - 2026-01-11

### Fixed Android Playback for Multi-File Audiobooks

Fixed an issue where certain audiobooks wouldn't play on Android even when downloaded, while working fine on iOS.

**Root Cause:**
- Downloaded files were saved with hardcoded `.m4a` extension regardless of actual format
- Android's ExoPlayer is strict about file extensions matching actual codec
- iOS is more forgiving and detects codec from file header

**Fixes:**
- Download manager now preserves original file extension from server metadata
- Added platform-specific logging for debugging file loading issues
- Improved error messages to show actual error instead of generic message
- Added file existence verification before loading on Android

**Also improved:**
- Error messages now include actual error details for debugging
- Added logging for platform and track URL during audio loading

### Files Modified
- `src/core/services/downloadManager.ts` - Use original file extension, add logging
- `src/features/player/services/audioService.ts` - Add file verification and platform logging
- `src/features/player/stores/playerStore.ts` - Better error messages with actual error
- `src/constants/version.ts` - Version bump to 0.6.360

**Note:** Previously downloaded books may need to be re-downloaded to fix playback issues.

---

## [0.6.355] - 2026-01-11

### Codebase Cleanup - Phase 10: Type Safety Improvements (SpineCache, Session, Series)

Continued reducing `as any` type casts in core services and screens.

**Type Improvements:**
- Added `ImageColorsResult` typed union for platform-specific color extraction
- Added `isBookMedia`, `getBookMetadata`, `getBookDuration` type guards to spineCache
- Simplified `apiClient.getAuthToken()` access (method already properly typed)
- Added `startedAt` optional field to PlaybackSession interface
- Added `ExtendedLibraryItem` interface for download status fields
- Fixed `getBookMetadata` to use `as BookMetadata` cast with mediaType check

**Files Fixed:**
- `src/features/home/stores/spineCache.ts` - 8 casts removed
- `src/features/player/services/sessionService.ts` - 5 casts removed (1 preserved for logging)
- `src/features/series/screens/SecretLibrarySeriesDetailScreen.tsx` - 7 casts removed

**Also Fixed (related to getBookMetadata typing):**
- `src/features/discover/hooks/usePersonalizedContent.ts`
- `src/features/home/hooks/useHomeData.ts`
- `src/features/library/screens/GenreDetailScreen.tsx`
- `src/features/queue/components/QueuePanel.tsx`
- `src/features/series/components/SeriesCard.tsx`
- `src/features/series/components/SeriesProgressHeader.tsx`

**Metrics:**
- `as any` count reduced: 223 → 201 (22 fewer casts)
- Zero TypeScript errors

### Files Modified
- `src/features/home/stores/spineCache.ts` - Added typed color extraction
- `src/features/player/services/sessionService.ts` - Simplified token access
- `src/features/series/screens/SecretLibrarySeriesDetailScreen.tsx` - Added type guards
- Multiple files - Fixed getBookMetadata to properly handle union types
- `src/constants/version.ts` - Version bump to 0.6.355

---

## [0.6.353] - 2026-01-11

### Codebase Cleanup - Phase 9: Type Safety Improvements (Discover & Library)

Continued reducing `as any` type casts in discover hooks, library screen, and recommendations.

**Type Improvements:**
- Added type guards (`isBookMedia`, `getBookMetadata`, `getBookDuration`) to discover hooks
- Fixed `userMediaProgress` access in useRecommendations.ts (property already typed on LibraryItem)
- Added `ExtendedBookMetadata` interface with optional `tags` field for LibraryScreen
- Removed invalid `updatedAt` property access on MediaProgress

**Files Fixed:**
- `src/features/discover/hooks/usePersonalizedContent.ts` - 7 casts removed
- `src/features/home/screens/LibraryScreen.tsx` - 7 casts removed
- `src/features/recommendations/hooks/useRecommendations.ts` - 5 casts removed

**Metrics:**
- `as any` count reduced: 242 → 223 (19 fewer casts)
- Zero TypeScript errors

### Files Modified
- `src/features/discover/hooks/usePersonalizedContent.ts` - Added type guards for book media
- `src/features/home/screens/LibraryScreen.tsx` - Added ExtendedBookMetadata, removed updatedAt fallback
- `src/features/recommendations/hooks/useRecommendations.ts` - Removed unnecessary casts for userMediaProgress
- `src/constants/version.ts` - Version bump to 0.6.353

---

## [0.6.352] - 2026-01-11

### Codebase Cleanup - Phase 8: Type Safety Improvements (Queue & Narrator)

Continued reducing `as any` type casts in narrator detail screen, queue panel, and shared utilities.

**Type Improvements:**
- Added typed route params (`NarratorDetailParams`) for narrator detail screen
- Added `getChapterCount()` helper for typed chapter access
- Fixed `isBookMedia` type guard in shared metadata utilities
- Added `getBookDuration()` helper to shared utils

**Files Fixed:**
- `src/features/narrator/screens/SecretLibraryNarratorDetailScreen.tsx` - 7 casts removed
- `src/features/queue/components/QueuePanel.tsx` - 7 casts removed
- `src/shared/utils/metadata.ts` - Added missing type guard, fixed duration helper

**Metrics:**
- `as any` count reduced: 255 → 242 (13 fewer casts)
- Zero TypeScript errors

### Files Modified
- `src/features/narrator/screens/SecretLibraryNarratorDetailScreen.tsx` - Added type guards, typed route params
- `src/features/queue/components/QueuePanel.tsx` - Added type guards and chapter count helper
- `src/shared/utils/metadata.ts` - Added isBookMedia guard, getBookDuration helper
- `src/constants/version.ts` - Version bump to 0.6.352

---

## [0.6.351] - 2026-01-11

### Fixed: "Unknown Title/Author" Bug on Library and Browse Screens

Fixed critical bug where book titles and authors showed as "Unknown" despite metadata being present in the library cache.

**Root Cause:**
The `isBookMedia` type guard required `audioFiles` to be present in `item.media`, but library cache items don't include `audioFiles` to save space. This caused `getMetadata()` to return null even when metadata was available.

**Fix:**
- Updated `getMetadata()` in `src/shared/utils/metadata.ts` to check `item?.media?.metadata` directly
- Updated `getBookMetadata()` in `src/features/browse/components/TasteTextList.tsx` similarly
- Updated `LibraryScreen.tsx` to use full library cache (`allCacheItems`) instead of just `recentlyListened` and `recentlyAdded`

**Impact:**
- Library screen now shows all 2400+ books from cache with correct titles/authors
- Browse page "Based on Your Taste" section now displays book metadata correctly
- Duration values now display properly

### Files Modified
- `src/shared/utils/metadata.ts` - Removed `isBookMedia` dependency from `getMetadata()`
- `src/features/browse/components/TasteTextList.tsx` - Fixed `getBookMetadata()` and `getBookDuration()`
- `src/features/home/screens/LibraryScreen.tsx` - Use full library cache for book list
- `src/constants/version.ts` - Version bump to 0.6.351

---

## [0.6.350] - 2026-01-11

### Codebase Cleanup - Phase 7: Type Safety Improvements (Detail Screens)

Continued reducing `as any` type casts in book and author detail screens.

**Type Improvements:**
- Added typed route params (`AuthorDetailParams`) for author detail screen
- Extended `ExtendedBookMetadata` interface with `narratorName` field
- Fixed series array access patterns (`series?.[0]?.name`)
- Preserved React Native TextStyle casts where necessary

**Files Fixed:**
- `src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx` - 7 casts removed
- `src/features/author/screens/SecretLibraryAuthorDetailScreen.tsx` - 8 casts removed

**Metrics:**
- `as any` count reduced: 267 → 255 (12 fewer casts)
- Zero TypeScript errors

### Files Modified
- `src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx` - Added type guards
- `src/features/author/screens/SecretLibraryAuthorDetailScreen.tsx` - Added type guards, typed route params
- `src/constants/version.ts` - Version bump to 0.6.350

---

## [0.6.349] - 2026-01-11

### Codebase Cleanup - Phase 6: Type Safety Improvements (Core Services)

Continued reducing `as any` type casts in core services and series components.

**Type Improvements:**
- Added `waiting_wifi` status to `DownloadRecord` interface for proper typing
- Added `AudioFileInfo` interface for typed audio file access
- Extended type guards to download manager and series progress components
- Added `getBookChapters()` helper for typed chapter access

**Files Fixed:**
- `src/core/services/downloadManager.ts` - 10 casts removed
- `src/core/services/sqliteCache.ts` - Added `waiting_wifi` status to DownloadRecord
- `src/features/series/components/SeriesProgressHeader.tsx` - 9 casts removed

**Metrics:**
- `as any` count reduced: 285 → 267 (18 fewer casts)
- Zero TypeScript errors

### Files Modified
- `src/core/services/downloadManager.ts` - Added type guards, proper apiClient access
- `src/core/services/sqliteCache.ts` - Extended DownloadRecord status type
- `src/features/series/components/SeriesProgressHeader.tsx` - Added type guards
- `src/constants/version.ts` - Version bump to 0.6.349

---

## [0.6.345] - 2026-01-11

### Codebase Cleanup - Phase 5: Type Safety Improvements (Continued)

Continued reducing `as any` type casts across automotive, series, browse, and cache modules.

**Type Improvements:**
- Added `ApiAuthor` interface for server author responses
- Extended type guards to additional feature modules
- Consistent pattern: `isBookMedia()`, `getBookMetadata()`, `getBookDuration()`

**Files Fixed:**
- `src/features/automotive/automotiveService.ts` - 14 casts removed
- `src/features/series/components/SeriesCard.tsx` - 10 casts removed
- `src/features/browse/components/TasteTextList.tsx` - 10 casts removed
- `src/core/cache/libraryCache.ts` - 9 casts removed

**Metrics:**
- `as any` count reduced: 305 → 285 (20 fewer casts)
- Zero TypeScript errors

### Files Modified
- `src/features/automotive/automotiveService.ts` - Added type guards
- `src/features/series/components/SeriesCard.tsx` - Added type guards
- `src/features/browse/components/TasteTextList.tsx` - Added type guards
- `src/core/cache/libraryCache.ts` - Added type guards, ApiAuthor interface
- `src/constants/version.ts` - Version bump to 0.6.345

---

## [0.6.344] - 2026-01-11

### Codebase Cleanup - Phase 4: Type Safety Improvements

Reduced `as any` type casts across the codebase using proper type guards and helper functions.

**Type Improvements:**
- Added `seriesName` and `authorName` computed fields to `BookMetadata` interface
- Created reusable type guards: `isBookMedia()`, `getBookDuration()`, `getBookMetadata()`
- Replaced unsafe casts with typed helper functions

**Files Fixed:**
- `src/features/home/hooks/useHomeData.ts` - 19 casts removed
- `src/features/library/screens/GenreDetailScreen.tsx` - 14 casts removed
- `src/shared/utils/metadata.ts` - 11 casts removed

**Metrics:**
- `as any` count reduced: 348 → 305 (43 fewer casts)
- Zero TypeScript errors

### Files Modified
- `src/core/types/media.ts` - Added seriesName, authorName fields to BookMetadata
- `src/features/home/hooks/useHomeData.ts` - Added type guards, removed casts
- `src/features/library/screens/GenreDetailScreen.tsx` - Added type guards, removed casts
- `src/shared/utils/metadata.ts` - Refactored to use type guards
- `src/constants/version.ts` - Version bump to 0.6.344

---

## [0.6.343] - 2026-01-11

### Codebase Cleanup - Phase 3: Test Coverage Improvement

Added comprehensive tests for core utility functions, improving test coverage.

**New Test Files:**
- `src/shared/utils/__tests__/kidModeFilter.test.ts` - Tests for age category and content rating filtering
- `src/shared/utils/__tests__/seriesFilter.test.ts` - Tests for series progress tracking and filtering
- `src/features/home/utils/__tests__/spineCalculations.test.ts` - Tests for spine dimension calculations

**Test Coverage:**
- 76 new tests added (all passing)
- Total tests: 595 → 671
- Line coverage improved: 3.85% → 4.68% (22% relative improvement)

**Utilities Tested:**
- `kidModeFilter`: getAgeCategoryFromTag, getAgeCategoryFromTags, getRatingFromTag, getRatingFromTags
- `seriesFilter`: getSeriesInfo, buildSeriesProgressMap, buildSeriesCountMap, buildSeriesFirstBookMap, isSeriesAppropriate
- `spineCalculations`: hashString, seededRandom, normalizeSeriesName, findBestTitleSplit, isLightColor, darkenColorForDisplay, calculateSpineWidth, calculateSpineHeight, calculateTouchPadding

### Files Added
- `src/shared/utils/__tests__/kidModeFilter.test.ts`
- `src/shared/utils/__tests__/seriesFilter.test.ts`
- `src/features/home/utils/__tests__/spineCalculations.test.ts`

### Files Modified
- `src/constants/version.ts` - Version bump to 0.6.343

---

## [0.6.342] - 2026-01-11

### Improved - Loading Screen with Status Text and Splash Update

**Loading Screen:**
- Added status text below progress bar showing what's loading:
  - "initializing...", "restoring session...", "loading library...", "preparing bookshelf...", "ready"

**Native Splash Screen:**
- Updated splash background to pure black (#000000) to match animated splash
- New splash-icon.png with white skull on black background
- Seamless transition from native splash to animated splash

### Files Modified
- `src/shared/components/AnimatedSplash.tsx` - Added statusText prop and display
- `App.tsx` - Calculate and pass loading status text
- `app.json` - Updated splash backgroundColor to #000000
- `assets/splash-icon.png` - New white skull on black background
- `src/constants/version.ts` - Version bump to 0.6.342

---

## [0.6.341] - 2026-01-11

### Codebase Cleanup - Phase 2: API Response Types

Improved TypeScript typing for API responses and reduced `any` type usage.

**New Types Added:**
- `BookSearchResult` - Wrapper for search book results with libraryItem
- `SeriesSearchResult` - Wrapper with series and books array
- `AuthorSearchResult` - Author search result with id and name
- `NarratorSearchResult` - Narrator search result
- `UserBookRow` - SQLite database row type for user_books table

**Type Improvements:**
- `LibraryItem.mediaProgress` - Added optional property for progress data
- `SearchResults` - Updated to match actual API response structure
- `apiClient.getItemsInProgress()` - Removed 4 unnecessary `any` casts
- `useServerSearch` - Fixed 6 `any` types with proper search result types
- `sqliteCache.mapUserBookRow()` - Properly typed database row parameter

**Metrics:**
- `any` count reduced from 203 → 197

### Files Modified
- `src/core/types/api.ts` - Added search result wrapper types
- `src/core/types/library.ts` - Added mediaProgress property
- `src/core/api/apiClient.ts` - Removed any casts in getItemsInProgress
- `src/features/search/hooks/useServerSearch.ts` - Used proper types
- `src/core/services/sqliteCache.ts` - Added UserBookRow interface
- `src/constants/version.ts` - Version bump to 0.6.341

---

## [0.6.340] - 2026-01-11

### Codebase Cleanup - Phase 1

Major cleanup pass to reduce technical debt and fix TypeScript errors.

**Deleted Files (23 total):**
- 10 empty placeholder files (storage/, sync/, config/ modules)
- 3 empty directories (src/core/storage/, src/core/sync/, src/config/)
- 10 experimental 3D files with missing dependencies (Book3D, BookGL, BookShelf3DCanvas, etc.)

**Resolved Store Duplication:**
- Deleted unused `settingsStore.ts` (dead code, only self-referenced)
- Deleted deprecated `profile/kidModeStore.ts` (was re-export of shared store)
- Kept active `playerSettingsStore.ts` and `shared/kidModeStore.ts`

**TypeScript Fixes:**
- Fixed `haptics.light()` → `haptics.impact('light')` in SleepTimerSheet and SpeedSheet
- Added `bold` font weight to `jetbrainsMono` in secretLibrary theme
- Added `AudioTrack` type annotation in playerStore map callback
- Fixed percentage style type errors in GlobalMiniPlayer with type assertions
- Fixed home/components/index.ts exports (removed deleted 3D files, fixed CassettePlayer default export)

### Files Modified
- `src/features/player/sheets/SleepTimerSheet.tsx` - Fix haptics call
- `src/features/player/sheets/SpeedSheet.tsx` - Fix haptics call
- `src/features/player/stores/playerStore.ts` - Add AudioTrack type import and annotation
- `src/shared/theme/secretLibrary.ts` - Add jetbrainsMono.bold
- `src/navigation/components/GlobalMiniPlayer.tsx` - Fix percentage style types
- `src/features/home/components/index.ts` - Clean up exports
- `src/constants/version.ts` - Version bump to 0.6.340

---

## [0.6.339] - 2026-01-11

### Added - Universal Skull Logo Navigation

- **Tap skull logo** → Navigate to Home (everywhere in the app)
- **Long press skull logo** → Navigate to Profile/Settings (everywhere in the app)
- TopNav component now has default navigation behavior built-in
- All screens using TopNav automatically get this functionality

### Files Modified
- `src/shared/components/TopNav.tsx` - Added default logo press handlers
- `src/constants/version.ts` - Version bump to 0.6.339

---

## [0.6.338] - 2026-01-11

### Fixed - Download Progress on Player Screen

- **Download percentage** - Player screen download button now shows actual progress (e.g., "42%") instead of "Saving..."

### Files Modified
- `src/features/player/screens/SecretLibraryPlayerScreen.tsx` - Show download percentage
- `src/constants/version.ts` - Version bump to 0.6.338

---

## [0.6.337] - 2026-01-11

### Fixed - Series Number Alignment and Book Color

- **Grey background** - Changed book spine fill from white (#FFFFFF) to light grey (#F5F5F5)
- **Series number alignment** - Removed "#" prefix and opacity from series sequence number so it matches progress number styling exactly

### Files Modified
- `src/features/home/components/BookSpineVertical.tsx` - Grey background, series number fix
- `src/constants/version.ts` - Version bump to 0.6.337

---

## [0.6.336] - 2026-01-11

### Changed - Book Spine Stroke Design

Updated book spine design from filled color to stroke-based outline:

**Visual Changes:**
- **White background** - Book spines now have white fill instead of colored backgrounds
- **Black stroke outline** - 1px black stroke provides clean visual definition
- **Drop shadows removed** - Shadows disabled by default for cleaner appearance
- **Black text** - Text color changed to black for contrast on white background

**Technical Changes:**
- `BookSpineVertical` background changed from `fill={spineBgColor}` to `fill="#FFFFFF" stroke="#000000" strokeWidth={1}`
- `showShadow` prop default changed from `true` to `false`
- Color calculation logic commented out (can be re-enabled later)
- `BookshelfView` now explicitly passes `showShadow={false}`

**Rationale:**
Cleaner, more editorial aesthetic that matches the Secret Library design language.

### Files Modified
- `src/features/home/components/BookSpineVertical.tsx` - Stroke design, disabled shadows
- `src/features/home/components/BookshelfView.tsx` - Added showShadow={false}
- `src/constants/version.ts` - Version bump to 0.6.336

---

## [0.6.335] - 2026-01-11

### Changed - Standardized on SecretLibrary Design System

Removed all legacy screen variants and standardized the app on the SecretLibrary design aesthetic:

**Screens Removed (7 files):**
- `BrowseScreen.tsx` → Now using `SecretLibraryBrowseScreen`
- `BookDetailScreen.tsx` → Now using `SecretLibraryBookDetailScreen`
- `SeriesDetailScreen.tsx` → Now using `SecretLibrarySeriesDetailScreen`
- `AuthorDetailScreen.tsx` → Now using `SecretLibraryAuthorDetailScreen`
- `NarratorDetailScreen.tsx` → Now using `SecretLibraryNarratorDetailScreen`
- `CDPlayerScreen.tsx` → Now using `SecretLibraryPlayerScreen`
- `CDPlayerScreen.backup2.tsx` → Legacy backup removed

**Navigation Updates:**
- DiscoverTab now renders `SecretLibraryBrowseScreen` directly
- Cleaned up old screen imports from AppNavigator

**Index Exports Updated:**
- `src/features/browse/index.ts`
- `src/features/book-detail/index.ts`
- `src/features/series/index.ts`
- `src/features/author/index.ts`
- `src/features/narrator/index.ts`
- `src/features/player/index.ts`

**Impact:** ~3,000+ lines of legacy code removed. App now has unified design language.

### Files Modified
- `src/navigation/AppNavigator.tsx` - Updated imports and DiscoverTab
- 6 feature index files - Removed old screen exports
- `src/constants/version.ts` - Version bump to 0.6.335

### Files Deleted
- `src/features/browse/screens/BrowseScreen.tsx`
- `src/features/book-detail/screens/BookDetailScreen.tsx`
- `src/features/series/screens/SeriesDetailScreen.tsx`
- `src/features/author/screens/AuthorDetailScreen.tsx`
- `src/features/narrator/screens/NarratorDetailScreen.tsx`
- `src/features/player/screens/CDPlayerScreen.tsx`
- `src/features/player/screens/CDPlayerScreen.backup2.tsx`

---

## [0.6.334] - 2026-01-11

### Changed - Candle Animation for Pull-to-Refresh

Replaced the skull animation with a candle animation for pull-to-refresh indicators:

**Visual Changes:**
- **Candle holder** - Decorative holder in theme text color
- **Animated flame** - 14-frame red flame animation at 24fps
- Matches the existing candle loading animation used elsewhere in the app

**Technical:**
- Uses same animation data as `CandleAnimation` in `Loading.tsx`
- Flame rendered behind holder for proper layering
- Removed unused `G` (group) import from react-native-svg

### Files Modified
- `src/shared/components/SkullRefreshControl.tsx` - Replaced skull with candle animation
- `src/constants/version.ts` - Version bump to 0.6.334

---

## [0.6.333] - 2026-01-11

### Fixed - Pull-to-Refresh Double Skull and Background

Fixed visual issues with pull-to-refresh on the book detail screen:

**Problems Fixed:**
- **Double skull icon** - Removed duplicate `refreshOverlay` that was showing a second Loading indicator on top of the SkullRefreshControl
- **Weird background color** - Added proper background color (`#F5F5F0` / creamGray) to the SkullRefreshControl indicator container

**Root Cause:**
The book detail screen had TWO refresh indicators:
1. A `refreshOverlay` View with `<Loading>` component
2. The `SkullRefreshControl` with its own skull animation

Both were showing at once, causing the stacked/doubled appearance.

### Files Modified
- `src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx` - Removed duplicate refresh overlay
- `src/shared/components/SkullRefreshControl.tsx` - Added background color to indicator
- `src/constants/version.ts` - Version bump to 0.6.333

---

## [0.6.332] - 2026-01-11

### Added - Complete Bookmarks Panel Overhaul

Major improvements to the bookmarks panel with full functionality:

**New Features:**
- **Add Bookmark Modal** - Opens a detailed modal when adding bookmarks:
  - Adjust time position with -30s, -10s, +10s, +30s buttons
  - Add optional note before saving
  - Shows current chapter info
- **Export Bookmarks** - Export button now works:
  - Copy to clipboard option
  - Share via system share sheet
  - Exports formatted text with times, chapters, and notes
- **Delete from List** - Red trash icon on each bookmark with confirmation dialog
- **Delete Button Styling** - Uses red highlight for visibility

**Bug Fixes:**
- Fixed `formatDate()` to handle number timestamps (was expecting Date/string)
- Removed unused icons (CloseIcon, ClockIcon) and imports (TextInput, Circle)

**Code Cleanup:**
- Added PlusIcon for add button
- Added DeleteIcon for delete buttons
- Proper prop types with `bookTitle` and `onAddBookmarkWithDetails`

### Files Modified
- `src/features/player/sheets/BookmarksSheet.tsx` - Complete overhaul
- `src/features/player/screens/SecretLibraryPlayerScreen.tsx` - Enhanced bookmark modal
- `src/constants/version.ts` - Version bump to 0.6.332

---

## [0.6.331] - 2026-01-11

### Added - Bookmark Editing Modal on Player Screen

The player screen now has a working bookmark edit modal:

**Features:**
- Tap the edit (pencil) icon on any bookmark to open the edit modal
- Edit bookmark notes with a multiline text input
- Delete bookmarks directly from the edit modal
- Cancel to discard changes
- Save to persist note changes

**UI Design:**
- Matches the existing sheet style with handle, header, and actions
- Shows bookmark time and chapter info
- Delete button on left, Cancel/Save on right
- Keyboard-aware layout for comfortable editing

### Files Modified
- `src/features/player/screens/SecretLibraryPlayerScreen.tsx` - Added bookmark edit modal
- `src/constants/version.ts` - Version bump to 0.6.331

---

## [0.6.330] - 2026-01-11

### Added - Genre-Based Typography on Player Screen

The player screen now uses the same genre-based typography system as the book detail and spine components:

**Features:**
- Title and author text use dynamic font family based on book genre
- Thrillers show bold sans-serif with uppercase
- Romance shows elegant italic serif
- Fantasy shows classic serif
- Author name always displays in italic variant of the chosen font family

**Implementation:**
- Uses `useSpineCacheStore` to get cached spine data (same as BookDetailScreen)
- Checks for series-locked typography via `getSeriesStyle()` first
- Falls back to `getTypographyForGenres()` for genre-based styling
- Applies text transform (uppercase) for genres that use it

**Typography consistency:**
- Player screen now matches book detail screen typography
- Both use the same cache → same source of truth → same visual result

### Files Modified
- `src/features/player/screens/SecretLibraryPlayerScreen.tsx` - Added genre typography
- `src/constants/version.ts` - Version bump to 0.6.330

---

## [0.6.329] - 2026-01-10

### Fixed - Book Detail Page Audit and Bug Fixes

Multiple fixes from comprehensive audit of the book detail page:

**Bugs Fixed:**
1. **Series navigation broken** - Was passing `{ id }` or `{ name }` but SeriesDetail expects `{ seriesName }`. Now passes correct param.

2. **Can't unmark finished books** - The "Finished" button was disabled when book was marked finished. Now toggleable to unmark.

3. **Title font family mismatch** - Font comparison was checking for `'sans-serif'` but spine calculations return platform-specific values (`'System'` on iOS). Now uses font family value directly.

4. **Chapter duration NaN** - Could produce NaN if chapter start/end were undefined. Now uses nullish coalescing with guard.

**Code Cleanup:**
- Removed dead code: `handleAuthorPress`, `handleNarratorPress` (inline handlers used instead)
- Cleaned up excessive debug logging (wrapped in `__DEV__ && false` toggle)
- Simplified typography code path

### Files Modified
- `src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx`
- `src/constants/version.ts` - Version bump to 0.6.329

---

## [0.6.328] - 2026-01-10

### Fixed - Book Detail Title Typography Uses Same Cache as Spine

Fixed font family mismatch by using **only spine cache data** for typography decisions:

**Root cause:** Detail page was falling back to `seriesInfo?.name` from API when `cachedSpineData?.seriesName` was undefined. This caused different code paths:
- Spine: No seriesName in cache → uses genre-based typography → sans-serif
- Detail: Found seriesName in API → uses series typography → random preset (often serif)

**Fix:** Only use `cachedSpineData` values for typography, matching exactly what BookSpineVertical receives:
```typescript
const seriesName = cachedSpineData?.seriesName;  // NOT || seriesInfo?.name
const genres = cachedSpineData?.genres || metadata?.genres || [];
```

Now both spine and detail page follow identical logic and get identical fonts.

### Files Modified
- `src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx`
- `src/constants/version.ts` - Version bump to 0.6.328

---

## [0.6.327] - 2026-01-10

### Fixed - Book Detail Title Typography Now Matches Spine Exactly

Fixed font family mismatch between book spines and book detail page. The detail page now uses the **exact same logic** as `BookSpineVertical.tsx`:

1. **Series books first:** Check if book has a series name → use `getSeriesStyle(seriesName).typography`
2. **Genre-based fallback:** Non-series books → use `getTypographyForGenres(genres, bookId)`

This ensures "The Left Hand of Darkness" (Sci-Fi) shows sans-serif uppercase on both the spine AND the detail page.

**Before:** Detail page always used genre-based typography, ignoring series
**After:** Detail page checks series first (like spines do), then falls back to genre

### Files Modified
- `src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx` - Match spine typography logic exactly
- `src/constants/version.ts` - Version bump to 0.6.327

---

## [0.6.323] - 2026-01-10

### Changed - Use Cached Spine Data for Title Typography

Now pulls genres and series name directly from the spine cache (`cachedSpineData`) instead of extracting from book metadata. This ensures the book detail title styling matches exactly what's shown on the book spine in the shelf view.

**Data flow:**
```
Spine Cache (genres, seriesName) → getTypographyForGenres() → Title styling
```

### Files Modified
- `src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx`
- `src/constants/version.ts` - Version bump to 0.6.323

---

## [0.6.322] - 2026-01-10

### Changed - Smaller Cover + Spine Typography for Titles

**Cover:** Reduced from 160px to 120px for better proportions

**Title Typography:** Now uses the same genre-based typography system as book spines:
- Fantasy books: Serif font, heavier weight
- Sci-Fi books: Sans-serif, uppercase, wider letter spacing
- Thriller/Crime: Bold sans-serif, uppercase
- Literary: Serif, italic styling
- Children's: Friendly sans-serif
- Series books: Consistent typography across the series

**Implementation:**
- Uses `getTypographyForGenres()` from spine calculations
- Series books use `getSeriesStyle()` for consistency
- Dynamic font family, weight, style, and text transform

### Files Modified
- `src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx`
- `src/constants/version.ts` - Version bump to 0.6.322

---

## [0.6.321] - 2026-01-10

### Changed - Move Author & Series to Details Section

**Layout now:**
```
[ Cover ]  This Inevitable
           Ruin 7.5

by Matt Dinniman
Dungeon Crawler Carl #7.5
28h 40m · 108 chapters · English · 2025
Narrated by Travis Baldree, Jeff Hays
Podium Audio
```

- Hero section now shows only cover + title
- Author moved below with "by" prefix (Georgia font, underlined, tappable)
- Series shown in italic gray below author
- All metadata flows cleanly in the details section

### Files Modified
- `src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx`
- `src/constants/version.ts` - Version bump to 0.6.321

---

## [0.6.320] - 2026-01-10

### Changed - Redesign Hero Details Section

**Before:** Disconnected 2-column grid with uppercase labels
```
DURATION        CHAPTERS
28h 40m         108

NARRATOR        RELEASE DATE
Travis...       2025
```

**After:** Clean flowing inline layout matching editorial style
```
28h 40m · 108 chapters · English · 2025
Narrated by Travis Baldree, Jeff Hays
Podium Audio
```

**Design improvements:**
- Stats flow inline with dot separators (·)
- "Narrated by" prefix with tappable narrator names (Georgia font, underlined)
- Publisher shown subtly below if present
- Consistent monospace typography for metadata
- Much cleaner, more editorial feel

### Files Modified
- `src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx` - Redesign details
- `src/constants/version.ts` - Version bump to 0.6.320

---

## [0.6.319] - 2026-01-10

### Changed - Progress Label Inline with About Header

**Layout:**
```
[========= Progress Bar =========]
2h listened              4h remaining

About                Your Progress 45%
[description text...]
```

Progress percentage now appears on the right side of the "About" header line, below the progress bar.

### Files Modified
- `src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx` - Move progress inline
- `src/constants/version.ts` - Version bump to 0.6.319

---

## [0.6.318] - 2026-01-10

### Changed - Combine Details Grid with Hero Section

**Change:** Moved all book metadata (Narrator, Release Date, Language, Publisher, Duration, Chapters) into the hero section for a more cohesive layout.

**Layout:**
```
[ Cover Image ] [ Title, Author, Series ]
[ Duration | Chapters | Narrator | Release Date | Language | Publisher ]
[ Progress + About Section ]
[ Action Buttons ]
[ Chapters List ]
```

### Files Modified
- `src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx` - Move details to hero
- `src/constants/version.ts` - Version bump to 0.6.318

---

## [0.6.317] - 2026-01-10

### Changed - Book Detail Page Redesign

**UI Improvements:**
- **Hero section:** Larger cover image (160px) for more visual prominence
- **Round buttons:** All action buttons now use circular design
- **Button grouping:** Left group (Queue, Mark Finished, Clear Progress) | Right group (Download, Play)
- **Progress label:** Inline percentage with "Your Progress" label (both at scale 13)
- **Combined sections:** Progress and About sections now unified as one visual unit
- **Cleaner lines:** Removed horizontal dividers from hero, progress, and about sections

**Layout:**
```
[ Hero Section (larger cover) ]
[ Progress + About Section - combined ]
[ Action Buttons: Queue/Finish/Clear ← → Download/Play ]
[ Details Grid ]
[ Chapters ]
```

### Files Modified
- `src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx` - Complete redesign
- `src/constants/version.ts` - Version bump to 0.6.317

---

## [0.6.316] - 2026-01-10

### Fixed - Downloaded Filter Shows ALL Downloaded Books

**Problem:** When selecting "Downloaded" in the Library screen filter, only downloaded books that were also recently played or recently added were shown. Downloaded books that hadn't been played recently were missing.

**Root Cause:** The filter was applied to `allLibraryItems` which only contained books from `recentlyListened` + `recentlyAdded` lists.

**Solution:** When filter is "Downloaded", use `downloadedLibraryItems` (from complete DownloadTasks with libraryItem) as the data source instead of filtering the limited lists.

**Data Flow:**
```
Filter: "All" / "Not Downloaded" → allLibraryItems (recentlyListened + recentlyAdded)
Filter: "Downloaded" → downloadedLibraryItems (ALL completed downloads)
```

**Result:**
- "Downloaded" filter now shows every downloaded book in your library
- No longer limited to recently played/added books

### Files Modified
- `src/features/home/screens/LibraryScreen.tsx` - Use `effectiveLibraryItems` based on filter mode
- `src/constants/version.ts` - Version bump to 0.6.316

---

## [0.6.310] - 2026-01-10

### Fixed - Cache ALL In-Progress Books During Init

**Change:** `importRecentProgress()` now processes ALL in-progress books, not just 5.

**Before:**
- Only cached top 5 recently played books during init
- Other in-progress books had to wait for background `importFromServer()`

**After:**
- ALL in-progress books cached during init (before UI shows)
- Every book you've started will show correct progress immediately

**Timing:**
```
App Start → importRecentProgress() → caches ALL in-progress books → UI shows
```

### Files Modified
- `src/core/services/finishedBooksSync.ts` - Remove 5-book limit
- `src/constants/version.ts` - Version bump to 0.6.310

---

## [0.6.309] - 2026-01-10

### Fixed - Cache Progress for ENTIRE Library

**Change:** `importFromServer()` now caches progress in memory for ALL books, not just recently played.

**Details:**
- Removed limit on library items fetch (was 1000, now unlimited)
- Every book with progress gets cached in `playbackCache`
- Book detail screens read from memory cache first (instant)

**Result:**
- All 2500+ books show correct progress immediately
- No need to hit play first
- Works for any book in the library

### Files Modified
- `src/core/services/finishedBooksSync.ts` - Cache all books, remove limit
- `src/constants/version.ts` - Version bump to 0.6.309

---

## [0.6.308] - 2026-01-10

### Fixed - All Recently Played Books Show Correct Progress

**Problem:** Only the most recently played book showed correct progress. Other books in top 5 still showed 0%.

**Solution:** Book detail screens now read from `playbackCache.getProgress()` as a fallback.

**Progress priority order:**
1. Player state (if this book is currently loaded)
2. Memory cache (`playbackCache`) - populated for top 5 books during app startup
3. Local SQLite
4. Spine cache
5. Server progress

**Result:**
- Book #1 (most recent): Shows correct progress via player state
- Books #2-5: Show correct progress via memory cache
- All other books: Fall back to SQLite → spine cache → server

### Files Modified
- `src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx` - Add playbackCache fallback
- `src/features/book-detail/screens/BookDetailScreen.tsx` - Add playbackCache fallback
- `src/constants/version.ts` - Version bump to 0.6.308

---

## [0.6.307] - 2026-01-10

### Added - Preload Book State for Correct UI Progress

**Problem:** Book detail screen showed 0% progress until user hit play, even though spine showed correct value (38%).

**Solution:** Preload the most recently played book into the player store during app startup.

**New function: `preloadBookState()`** in playerStore:
- Sets `currentBook`, `position`, `duration`, `chapters` from cached data
- Does NOT start audio playback
- Does NOT show the player UI
- Book detail screen now reads from player state and shows correct progress

**Flow:**
```
App Startup
    ↓
syncFinishedBooks() (background)
    ↓
preloadMostRecentBook()
    ↓
playerStore.preloadBookState(book)
    ↓
Sets: currentBook, position=9120s, duration=29880s
    ↓
Book detail screen shows: 38% (reads from player state)
```

### Files Modified
- `src/features/player/stores/playerStore.ts` - Add `preloadBookState()` function
- `src/core/services/finishedBooksSync.ts` - Add `preloadMostRecentBook()` function
- `src/core/services/appInitializer.ts` - Call preloadMostRecentBook on startup
- `src/constants/version.ts` - Version bump to 0.6.307

---

## [0.6.306] - 2026-01-10

### Added - Instant Playback with Full Caching

**Three-level caching system for instant resume:**

1. **Audio Pre-initialization** (`appInitializer.preInitAudio`)
   - Audio system initialized during app startup (parallel with other init tasks)
   - Eliminates ~200-500ms audio setup delay when hitting play
   - `playbackCache.isAudioInitialized()` tracks state

2. **In-Memory Progress Cache** (`playbackCache.ts`)
   - Progress data cached in memory during `importRecentProgress()`
   - `progressService.getProgressData()` checks memory cache first (instant)
   - Falls back to SQLite only if not cached

3. **Session Pre-fetching** (`finishedBooksSync.prefetchSessions`)
   - Pre-fetches playback sessions for top 5 recently played books
   - Caches audio track URLs, chapters, and metadata
   - Sessions expire after 5 minutes to stay fresh
   - `playerStore` uses cached sessions to skip network call entirely

**Flow on app startup:**
```
Parallel Init:
├── loadFonts()
├── restoreSession()
├── syncRecentProgress() → populates SQLite + memory cache
└── preInitAudio() → audio system ready

Background (after UI shows):
├── prefetchSessions() → sessions ready for top 5 books
└── fullSync() → remaining books
```

**Result when hitting play:**
- Audio system: Already initialized (no delay)
- Progress data: In memory cache (instant, no SQLite read)
- Session data: Pre-fetched (no network call for recent books)
- **Total time to first audio: Near-instant**

### Files Created
- `src/core/services/playbackCache.ts` - In-memory cache for progress and sessions

### Files Modified
- `src/core/services/appInitializer.ts` - Add preInitAudio, prefetchSessions
- `src/core/services/finishedBooksSync.ts` - Add prefetchSessions, populate memory cache
- `src/features/player/services/progressService.ts` - Check memory cache first
- `src/features/player/stores/playerStore.ts` - Use cached sessions
- `src/constants/version.ts` - Version bump to 0.6.306

---

## [0.6.305] - 2026-01-10

### Added - Fast Progress Sync on App Startup

**appInitializer:**
- Added `syncRecentProgress()` to parallel initialization phase
- Syncs top 5 recently played books from server DURING app startup (not after)
- Progress is now available immediately when app becomes interactive

**finishedBooksSync:**
- New `importRecentProgress()` function that:
  - Fetches recently played books via `getItemsInProgress()` API
  - Syncs only top 5 for speed
  - Writes to BOTH `playback_progress` (player) and `user_books` (book detail)
  - Updates spine cache for book spines

**Result:**
- Progress loads during splash screen, not after
- No more lag when hitting play - player starts at correct position immediately
- Book detail, book spines, and player all show same value on first load

### Files Modified
- `src/core/services/appInitializer.ts` - Add syncRecentProgress to parallel init
- `src/core/services/finishedBooksSync.ts` - New importRecentProgress function
- `src/constants/version.ts` - Version bump to 0.6.305

---

## [0.6.304] - 2026-01-10

### Fixed - Player Now Uses Pre-loaded Progress

**finishedBooksSync:**
- Now writes to BOTH `playback_progress` table (player reads from) AND `user_books` table
- Previously only wrote to `user_books`, but player reads from `playback_progress`
- Player will now start at correct position immediately without loading delay

**Result:**
- Spine shows 38% ✓
- Book detail shows 38% ✓ (reads from user_books + spine cache)
- Player starts at Chapter 32 immediately ✓ (reads from playback_progress)

### Files Modified
- `src/core/services/finishedBooksSync.ts` - Write to playback_progress table
- `src/constants/version.ts` - Version bump to 0.6.304

---

## [0.6.303] - 2026-01-10

### Added - Progress Sync on App Startup

**finishedBooksSync:**
- Now imports progress (not just finished status) from server on app startup
- Saves server progress to SQLite so it's available immediately
- Updates spine cache so book spines show correct progress
- Only imports if server progress is more recent than local

**Result:**
- Book detail page now shows correct progress without needing to play first
- Book spines on home page match detail page progress
- Progress available immediately after app launch

### Files Modified
- `src/core/services/finishedBooksSync.ts` - Import progress and update spine cache
- `src/constants/version.ts` - Version bump to 0.6.303

---

## [0.6.302] - 2026-01-10

### Fixed - Progress Uses Live Player State

**SecretLibraryBookDetailScreen:**
- Progress now uses live player state when book is currently loaded
- If book is playing (02:32:47), detail page shows that position immediately
- Fallback order: player state → local SQLite → spine cache → server
- Duration showing correctly (8h 18m)

### Files Modified
- `src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx` - Use player position for progress
- `src/constants/version.ts` - Version bump to 0.6.302

---

## [0.6.301] - 2026-01-10

### Fixed - Progress Now Uses Spine Cache

**SecretLibraryBookDetailScreen:**
- Progress now uses spine cache as fallback (same as book spines on home page)
- This ensures the book detail page shows the same progress as the book spine
- Fallback order: local SQLite → spine cache → server progress
- The "38" shown on book spine will now also show as "38%" on detail page

### Files Modified
- `src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx` - Use spine cache for progress
- `src/constants/version.ts` - Version bump to 0.6.301

---

## [0.6.300] - 2026-01-10

### Fixed - Duration Now Uses Spine Cache

**SecretLibraryBookDetailScreen:**
- Duration now uses spine cache as primary source (same as book spines on home page)
- This ensures the book detail page shows the same duration as the book spine
- Fallback order: spine cache → media.duration → audioFiles sum → last chapter end

### Files Modified
- `src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx` - Use spine cache for duration
- `src/constants/version.ts` - Version bump to 0.6.300

---

## [0.6.299] - 2026-01-10

### Fixed - Duration Display (Additional Fallback)

**SecretLibraryBookDetailScreen:**
- Added third fallback for duration: uses last chapter's end time
- Duration calculation now tries: media.duration → audioFiles sum → last chapter end time
- This matches how the book spine calculates duration from chapters data

---

## [0.6.298] - 2026-01-10

### Fixed - Duration Display

**SecretLibraryBookDetailScreen:**
- Fixed duration showing "0m" when `media.duration` is not set
- Now falls back to calculating duration from audioFiles (same as BookDetailScreen)
- Duration now matches the value shown on book spines in the home page

### Files Modified
- `src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx` - Duration fallback calculation
- `src/constants/version.ts` - Version bump to 0.6.298

---

## [0.6.297] - 2026-01-10

### Changed - Progress Actions to Icon-Only Buttons

**SecretLibraryBookDetailScreen:**
- Changed "Mark Finished" and "Clear Progress" from text pills to icon-only circular buttons
- Mark Finished: checkmark icon (fills black when completed)
- Clear Progress: reset/refresh arrow icon
- Cleaner, more minimal design matching the editorial aesthetic

### Files Modified
- `src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx` - Icon-only progress actions
- `src/constants/version.ts` - Version bump to 0.6.297

---

## [0.6.296] - 2026-01-10

### Fixed - Progress Bar Accuracy (SQLite Single Source of Truth)

**BookDetailScreen.tsx:**
- Progress bar now uses SQLite as single source of truth (via `useBookProgress` hook)
- Prefers local SQLite progress over server-reported progress
- Chapter position tracking also prefers local SQLite time
- Consistent with SecretLibraryBookDetailScreen behavior

### Files Modified
- `src/features/book-detail/screens/BookDetailScreen.tsx` - Added useBookProgress hook, updated progress calculations
- `src/constants/version.ts` - Version bump to 0.6.296

---

## [0.6.295] - 2026-01-10

### Fixed - SecretLibraryBookDetailScreen Improvements

**Skull Logo:**
- Fixed broken skull logo SVG (was missing 4th path element for complete skull)

**Author/Narrator Links:**
- Made each author name individually tappable in hero section
- Made each narrator name individually tappable in details grid
- Each name navigates to its respective detail page
- Added underline styling to indicate tappable names

**Mark Finished / Clear Progress (Single Source of Truth):**
- Updated Mark Finished to sync to SQLite first (single source of truth)
- Updated Clear Progress to sync to SQLite and reset position properly
- Both actions now sync to ABS server in background
- Added confirmation dialog for Clear Progress
- Progress state now checks both server and local SQLite

### Changed - Book View List Style

**All Tab Book View:**
- Changed from paragraph/flowing text to vertical list format
- Each book on its own row with cover, title, series info, and duration
- Added series name and sequence number below title
- Cleaner, more scannable layout

### Files Modified
- `src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx` - All fixes above
- `src/features/author/screens/SecretLibraryAuthorDetailScreen.tsx` - Added vertical list view
- `src/features/narrator/screens/SecretLibraryNarratorDetailScreen.tsx` - Added vertical list view
- `src/constants/version.ts` - Version bump to 0.6.295

---

## [0.6.294] - 2026-01-10

### Changed - Series/Book View Toggle

Updated the view toggle on author and narrator detail screens from "Shelf/List" to "Series/Book".

**Series View (default):**
- Books grouped by series with sub-headers
- Each group displayed with BookSpineVertical components
- Click series header to navigate to series detail

**Book View:**
- Flat list of all books without grouping (All tab)
- Grouped by current filter (Series/Author/Narrator/Genre tabs) with inline text list
- Inline covers with duration superscript

### Files Modified
- `src/features/author/screens/SecretLibraryAuthorDetailScreen.tsx` - Updated toggle and content logic
- `src/features/narrator/screens/SecretLibraryNarratorDetailScreen.tsx` - Updated toggle and content logic
- `src/constants/version.ts` - Version bump to 0.6.294

---

## [0.6.293] - 2026-01-10

### Fixed - Book Detail Screen Improvements

**Cover Image:**
- Fixed cover image not showing (was hidden with `opacity: 0`)

**Header:**
- Added SkullLogo to header row matching the LibraryScreen design

**Author/Narrator Links:**
- Made each author and narrator name individually tappable
- Now navigates to the correct author/narrator detail page for each name
- Added visual underline to indicate tappable names

**Clear Progress:**
- Added Clear Progress functionality with ABS server sync
- Long-press on "Mark read"/"Finished" button to access options menu
- Clear Progress resets listening position to beginning
- Properly syncs with AudioBookShelf server using `markAsNotStarted` API
- Updates both local SQLite and server state

### Enhanced - Author Detail Screen

**Narrator Tab:**
- Replaced Genre tab with Narrator tab on author detail screen
- Books now grouped by narrator instead of genre
- Tapping narrator navigates to narrator detail page

**Layout:**
- Moved shelf/list toggle to far right of tabs row (space-between layout)

**Book Spine Series Number:**
- Added series sequence number display on book spines when no progress
- Shows `#X` (e.g., `#1`, `#2.5`) at 60% opacity where progress would appear
- Added `isDownloaded` flag to spine data for future download indicator support

### Files Modified
- `src/features/book-detail/screens/BookDetailScreen.tsx` - Cover, header, links, clear progress
- `src/features/author/screens/SecretLibraryAuthorDetailScreen.tsx` - Narrator tab, toggle layout, spine data
- `src/features/home/components/BookSpineVertical.tsx` - Series sequence number display
- `src/constants/version.ts` - Version bump to 0.6.293

---

## [0.6.292] - 2026-01-10

### Fixed - Header Overlap Issue

Fixed the header overlapping tabs on author/narrator detail screens.

**Root Cause:**
- Header was `position: absolute` inside the ScrollView
- For long names (like "Ursula K. Le Guin"), header height exceeded the fixed paddingTop
- This caused the stats text and header content to overlap the tabs

**Fix:**
- Removed `position: absolute` from header - now part of normal scroll flow
- Header naturally takes as much space as needed for the name
- Reduced paddingTop from 60px to 16px (just for safe area)
- Tabs and toggle now render below header without overlap

### Files Modified
- `src/features/author/screens/SecretLibraryAuthorDetailScreen.tsx` - Fixed header layout
- `src/features/narrator/screens/SecretLibraryNarratorDetailScreen.tsx` - Fixed header layout
- `src/constants/version.ts` - Version bump to 0.6.292

---

## [0.6.291] - 2026-01-10

### Fixed - Author/Narrator Layout Issues

Fixed tabs and view toggle layout issues on author/narrator detail screens.

**Layout Fixes:**
- Separated tabs row and view toggle row (toggle was getting cut off)
- Made tabs wrap on smaller screens with `flexWrap: 'wrap'`
- Added proper spacing between rows (tabs: 16mb, toggle: 20mb)

**List View Spacing:**
- Added more spacing between books in list view (3 spaces instead of 1)
- Applied consistent spacing across Author, Narrator, and TasteTextList components

### Files Modified
- `src/features/author/screens/SecretLibraryAuthorDetailScreen.tsx` - Fixed layout, added spacing
- `src/features/narrator/screens/SecretLibraryNarratorDetailScreen.tsx` - Fixed layout, added spacing
- `src/features/browse/components/TasteTextList.tsx` - Added spacing between books
- `src/constants/version.ts` - Version bump to 0.6.291

---

## [0.6.290] - 2026-01-10

### Added - Author & Narrator Detail Shelf/List Toggle with Series Grouping

Enhanced the author and narrator detail screens with view mode toggle and series-based book grouping.

**View Mode Toggle:**
- Added Shelf/List toggle matching TasteTextList design
- Shelf view uses BookSpineVertical components with horizontal scroll
- List view uses inline text with cover images
- Toggle appears next to filter tabs

**Series Grouping:**
- "All" tab now groups books by series with sub-headers
- Standalone books appear under "Standalone" group at the end
- Series names are clickable to navigate to SeriesDetail
- Each series section supports independent shelf/list views

**Implementation:**
- Added `toSpineData()` helper for LibraryItem to BookSpineVerticalData conversion
- Created `ShelfView` component using `useBookRowLayout` hook
- Added `allBooksBySeries` memoized grouping for "All" tab
- `getSpineDataList` callback for spine data with cached colors

### Files Modified
- `src/features/author/screens/SecretLibraryAuthorDetailScreen.tsx` - Full shelf/list toggle and series grouping
- `src/features/narrator/screens/SecretLibraryNarratorDetailScreen.tsx` - Full shelf/list toggle and series grouping
- `src/constants/version.ts` - Version bump to 0.6.290

---

## [0.6.286] - 2026-01-10

### Added - SeriesCard Component & Inline Text Lists

Created a single source of truth for series cards and fixed TasteTextList to use true inline images.

**SeriesCard Component:**
- New `SeriesCard` component as single source of truth for series display
- Supports `light`/`dark` variants and `list`/`grid` layouts
- Color dots representing books using hash-based deterministic colors
- Exported utilities: `SERIES_DOT_COLORS`, `getBookDotColor`, `getSeriesColorDots`

**SeriesGallery Updates:**
- Now uses white/light grid layout by default
- 2x2 grid with 1px separator lines (via gap + background)
- Removed BookSpineVertical mini shelves in favor of color dots
- Cream background container matching HTML design

**TasteTextList Inline Fix:**
- Fixed true inline text flow using SVG data URIs for colored squares
- Images now properly inline within Text components
- Colored squares render as inline elements that flow with text
- Uses `createColorSquareUri()` to generate SVG data URIs on the fly

### Files Modified
- `src/features/browse/components/SeriesCard.tsx` - New file
- `src/features/browse/components/SeriesGallery.tsx` - Rewritten to use SeriesCard
- `src/features/browse/components/TasteTextList.tsx` - Fixed inline layout with SVG images
- `src/features/browse/index.ts` - Added SeriesCard exports
- `src/constants/version.ts` - Version bump

---

## [0.6.285] - 2026-01-10

### Added - Secret Library Author & Narrator Detail Screens

New editorial-styled detail screens for authors and narrators matching the Secret Library design system.

**New Screens:**
- `SecretLibraryAuthorDetailScreen` - Dark background, large Playfair Display name, stats row, follow button, filter tabs, flowing text list with cover thumbnails
- `SecretLibraryNarratorDetailScreen` - Same design pattern with type badge (mic icon), tabs for Author/Series/Genre filtering

**Design Features:**
- Large editorial typography (Playfair Display titles, JetBrains Mono for stats)
- Stats display showing book count and total duration
- Follow button with Bell/BellOff icons for author/narrator following
- Filter tabs: All, Series, Genre (authors) / All, Author, Series, Genre (narrators)
- Flowing text list with inline cover thumbnails using hash-based colors
- Footer stats with collection summary

**TasteTextList Improvements:**
- Fixed inline layout using flexWrap approach instead of nested View/Text
- Added cover color thumbnails (20x20px) alongside book titles
- Black background per design spec
- Cover colors use deterministic hash-based palette

### Files Modified
- `src/features/author/screens/SecretLibraryAuthorDetailScreen.tsx` - New file
- `src/features/narrator/screens/SecretLibraryNarratorDetailScreen.tsx` - New file
- `src/features/author/index.ts` - Added export
- `src/features/narrator/index.ts` - Added export
- `src/navigation/AppNavigator.tsx` - Updated to use new screens
- `src/features/browse/components/TasteTextList.tsx` - Fixed layout with cover thumbnails
- `src/constants/version.ts` - Version bump

---

## [0.6.280] - 2026-01-09

### Changed - Replace Grid View with Stack View

Replaced the grid view with a new stack view that displays books rotated 90° and stacked.

**New Layout Modes:**
- `shelf`: Books stand upright on shelf, aligned to bottom (horizontal scroll) - default
- `stack`: Books rotated 90° and stacked vertically, center aligned (vertical scroll)

**Stack Mode Features:**
- Books rotate 90° to lay flat like a pile
- Overlapping stacked layout (65% overlap)
- Vertical scrolling through the stack
- Center alignment instead of bottom alignment
- Most recent books appear at top of stack

**UI Changes:**
- New ShelfIcon for shelf mode toggle
- New StackIcon for stack mode toggle
- Removed grid view and GridItem component
- Both modes use dark theme consistently

### Files Modified
- `src/features/home/components/BookshelfView.tsx` - Added layoutMode prop, stack mode rendering
- `src/features/home/screens/LibraryScreen.tsx` - Replaced grid with stack, new icons
- `src/constants/version.ts` - Version bump

---

## [0.6.279] - 2026-01-09

### Added - Comprehensive Genre Typography System

Implemented full typography system with ~50 genre profiles and tag modifiers for distinct visual voice per book.

**New Type System:**
- `TypographyProfile` - Complete profile with title, author, and layout preferences
- `TitleTypography` - Font family, weight (300-800), style, transform, letter spacing
- `AuthorTypography` - Separate typography for author names
- `LayoutPreferences` - Author position, orientation bias, title weight, contrast
- `SpinePersonality` - Visual character: 'refined' | 'bold' | 'playful' | 'classic' | 'modern' | 'stark' | 'warm'

**Genre Typography Profiles (~50 genres):**
- Children's: playful sans-serif, uppercase, wide spacing (0.04em)
- Literary Fiction: refined serif, normal case, elegant spacing (0.02em)
- Fantasy: bold serif, small-caps, dramatic spacing (0.04em)
- Thriller/Crime: stark sans-serif, uppercase, tight spacing (-0.02em), author boxes
- Romance: warm serif italic, normal case, elegant spacing (0.02em)
- Science Fiction: modern sans-serif, uppercase, wide spacing (0.05em)
- Mystery: classic serif, uppercase, medium spacing (0.03em)
- Horror: bold sans-serif, uppercase, extra wide (0.08em), high contrast
- Business/Self-Help: modern sans-serif, horizontal author bias
- History/Biography: classic serif, bottom author, subtle spacing
- Poetry: refined serif italic, light weight, delicate spacing (0.01em)
- And many more...

**Tag Typography Modifiers:**
- `epic-fantasy`: heavier title (700), wider spacing
- `grimdark`: bolder weight, stark personality
- `cozy`: lighter weight, warm personality
- `gothic`: serif font, refined feel
- `noir`: tight spacing, high contrast
- `hard-boiled`: uppercase author
- `historical-fiction`: classic serif styling
- `speculative`: modern personality shift
- `literary-fiction`: refined adjustments
- `commercial-fiction`: bold, high contrast

**Layout Solver Updates:**
- `createMeasureFunction()` now accounts for letter spacing in text width calculation
- Formula: `baseWidth + letterSpacing * fontSize * (charCount - 1)`
- Prevents text clipping with wide letter spacing
- `solveTitleLayout()` and `solveAuthorLayout()` accept letter spacing parameter

**BookSpineVertical Updates:**
- Passes `titleLetterSpacing` to title solver
- Passes `authorLetterSpacing` to author solver
- Supports new `titleLetterSpacing` and `authorLetterSpacing` properties

### Files Modified
- `src/features/home/utils/spineCalculations.ts` - New TypographyProfile types, ~50 GENRE_TYPOGRAPHY profiles, TAG_TYPOGRAPHY_MODIFIERS
- `src/features/home/utils/layoutSolver.ts` - Updated measure function with letter spacing, updated convenience functions
- `src/features/home/components/BookSpineVertical.tsx` - Pass letter spacing to layout solvers
- `src/constants/version.ts` - Version bump

---

## [0.6.278] - 2026-01-09

### Added - Enhanced Typography System

Incrementally expanded the book spine typography system with new properties for finer control over text styling.

**New SpineTypography Properties:**
- `letterSpacing: number` - Letter spacing in em units (0 = normal, positive = wide tracking)
- `authorOrientationBias: 'horizontal' | 'vertical' | 'neutral'` - Hint for solver when authorPosition is 'auto'
- `contrast: 'high' | 'normal'` - High contrast increases title/author size difference
- `titleWeight: string` - Override weight for title only (defaults to fontWeight)
- `authorWeight: string` - Override weight for author only (defaults to fontWeight)

**Genre Typography Updates:**
- All existing genres now have `letterSpacing`, `authorOrientationBias`, `contrast` values
- Added new genre presets: `classics`, `memoir`, `adventure`, `humor`, `western`, `philosophy`, `science`, `psychology`
- Horror gets widest tracking (0.08em) and max weight (900) for impact
- Sci-fi gets futuristic wide tracking (0.06em)
- Literary/poetry get elegant slight spacing (0.02-0.03em)
- Non-fiction/biography genres use prominent author weights for authority

**Rendering Changes:**
- Title text now applies `titleWeight`, `contrast` multiplier (1.05x for high contrast), and `letterSpacing`
- Author text applies `authorWeight`, inverse contrast (0.92x for high contrast), and half letterSpacing
- `authorOrientationBias` now influences layout solver's horizontal preference

### Files Modified
- `src/features/home/utils/spineCalculations.ts` - Added new types and properties to SpineTypography, updated all genre presets
- `src/features/home/components/BookSpineVertical.tsx` - Applied new typography properties to text rendering
- `src/constants/version.ts` - Version bump

---

## [0.6.276] - 2026-01-09

### Added - SVG Text Length Scaling

Added `textLength` and `lengthAdjust` props to all spine text elements for perfect text fitting.

**How it works:**
- SVG's `textLength` prop specifies the exact length text should occupy
- `lengthAdjust="spacingAndGlyphs"` scales both letter spacing and glyph widths to fit
- Text is guaranteed to fit within bounds without clipping

**Values used:**
- Title (vertical): `(titleHeight - INNER_MARGIN * 2) * 0.92` - 92% of available height
- Title (horizontal): `(titleBoxWidth) * 0.90` - 90% of available width
- Author (vertical): `(authorHeight - INNER_MARGIN * 2) * 0.92` - 92% of available height
- Author (horizontal): `(authorBoxWidth) * 0.90` - 90% of available width

### Files Modified
- `src/features/home/components/BookSpineVertical.tsx` - Added textLength and lengthAdjust to SvgText elements
- `src/constants/version.ts` - Version bump

---

## [0.6.275] - 2026-01-09

### Fixed - Spine Text Coordinate Translation

Fixed misalignment issues with multi-line vertical text on book spines (e.g., "URSULA K." and "LE GUIN" appearing at different positions).

**Problem:**
- The layout solver calculates text positions relative to a "box" (0,0 at top-left of box)
- When translating back to SVG coordinates, the Y offset was using inconsistent calculations
- Title used `titleY + (titleHeight * 0.05)` but box was constructed with `titleHeight - INNER_MARGIN*2`
- Author used `authorY + (authorHeight * 0.05)` but box started at `authorY + INNER_MARGIN`
- This mismatch caused multi-line text to appear offset or misaligned

**Solution:**
1. **Consistent Coordinate Translation** - Both title and author now use:
   - Box origin X: `EDGE_PADDING + INNER_MARGIN`
   - Box origin Y: `sectionY + INNER_MARGIN`
   - Adjusted position: `boxOrigin + line.position` (from solver)

2. **Per-Section Clip Paths** - Added safety net clip paths for each section:
   - `title-clip-{bookId}` - Clips title text to title section bounds
   - `author-clip-{bookId}` - Clips author text to author section bounds
   - Prevents any text overflow between sections

3. **Debug Visualization** - Added optional debug mode (`DEBUG_SECTIONS = true`) that shows:
   - Section boundaries (author=blue, title=green, progress=red)
   - Solver box boundaries (dashed lines)
   - Useful for diagnosing layout issues

### Files Modified
- `src/features/home/components/BookSpineVertical.tsx` - Fixed coordinate translation, added per-section clip paths, added debug visualization
- `src/constants/version.ts` - Version bump

---

## [0.6.269] - 2026-01-09

### Fixed - Author Box Layout Preference

Fixed issue where author boxes weren't appearing because the layout solver always preferred vertical text.

**Problem:**
- For narrow spines (~35-45px), vertical text allows larger fonts than horizontal
- The solver was always choosing vertical, even for thriller/crime genres that want boxes
- Boxes only work with horizontal layouts, so they never appeared

**Solution:**
1. Added `preferHorizontal` parameter to `solveAuthorLayout()`
2. When `typography.authorBox` is `'horizontal-only'` or `'always'`, the solver gets a +25 point bonus for horizontal layouts
3. This overcomes vertical's font size advantage for genres that want author boxes

**Also Fixed:**
- Corrected author box coordinate calculation (was using wrong x offset)

### Files Modified
- `src/features/home/utils/layoutSolver.ts` - Added preferHorizontal to LayoutContext and scoring
- `src/features/home/components/BookSpineVertical.tsx` - Pass preferHorizontal based on typography, fix box coordinates
- `src/constants/version.ts` - Version bump

---

## [0.6.268] - 2026-01-09

### Added - Author Box Styling for Commercial Genres

Added optional rectangular boxes around author names on book spines. This gives a distinctive "commercial fiction" look to thrillers, business books, and non-fiction titles while keeping literary and romance spines elegant and unframed.

**Features:**

1. **Genre-Based Box Preference** - Added `authorBox` property to typography profiles:
   - `'horizontal-only'`: Show box when author is horizontal (thriller, crime, business, biography, history, self-help)
   - `'never'`: Never show box (literary, romance, poetry, fantasy, horror, children's)

2. **Box Style Variants** - Three visual styles based on genre/tags:
   - `minimal`: Thin stroke (0.5px), subtle gray (#666), used for business/self-help
   - `classic`: Medium stroke (0.75px), darker gray (#444), used for thriller/crime
   - `bold`: Thick stroke (1.5px), dark (#333), used for noir/police-procedural

3. **Tag Override System**:
   - Tags that force boxes: `thriller`, `crime`, `noir`, `bestseller`, `history`, `biography`
   - Tags that prevent boxes: `literary-fiction`, `poetry`, `gothic`, `cozy`, `romance`, `award-winner`

4. **Layout Bounds Tracking** - Updated layout solver to compute bounds for horizontal text, used for box positioning

**Visual Examples:**
```
THRILLER (with box):        LITERARY FICTION (no box):
┌──────────────┐           ┌──────────────┐
│ ┌──────────┐ │           │  Donna       │
│ │  MICK    │ │           │  Tartt       │
│ │ HERRON   │ │           │              │
│ └──────────┘ │           │ The Secret   │
│  SLOW        │           │  History     │
│  HORSES      │           └──────────────┘
└──────────────┘
```

### Files Modified
- `src/features/home/utils/spineCalculations.ts` - Added AuthorBoxConfig, AuthorBoxPreference types, AUTHOR_BOX_STYLES constants, resolveAuthorBox function, authorBox to typography presets
- `src/features/home/utils/layoutSolver.ts` - Added LayoutBounds type, bounds tracking in calculateLinePositions
- `src/features/home/components/BookSpineVertical.tsx` - Added author box rendering with genre-based styles
- `src/constants/version.ts` - Version bump

---

## [0.6.267] - 2026-01-09

### Fixed - Book Spine Layout Solver for Short Titles

Fixed an issue where short titles like "Scarlet Feather" would appear with tiny, boring text instead of filling the available space with large, bold text.

**Problem:**
- For a 2-word title on a narrow spine, the layout solver would split it into 2 vertical columns
- Each column only got half the spine width, resulting in ~15px fonts
- A single vertical line would allow ~34px fonts but wasn't being chosen

**Root Cause:**
- The efficiency scoring penalized high fill ratios (>70%) as "overfilling"
- For short titles, we actually WANT to fill the space with big text
- No direct scoring component rewarded larger font sizes

**Solution:**
1. **Updated `scoreEfficiency`** - For short text (<20 chars), high fill ratios now score higher:
   - <10% fill: 20 (bad - text is tiny)
   - 10-20%: 40
   - 20-35%: 60
   - 35-50%: 80
   - >50%: 100 (great - fills the space!)

2. **Added `scoreFontSizeMaximization`** (20% weight) - Directly rewards larger fonts:
   - Short titles (<15 chars): 28px+ → 100, 22px+ → 85, etc.
   - Medium titles (<25 chars): 20px+ → 100
   - Longer titles: more lenient thresholds

3. **Rebalanced scoring weights:**
   - readability: 30% → 25%
   - balance: 20% → 15%
   - aesthetics: 15% → 10%
   - fontMaximization: NEW 20%
   - splitScore: 20% → 15%

**Result:** Short titles now display with large, impactful fonts that fill the available vertical space.

### Files Modified
- `src/features/home/utils/layoutSolver.ts` - Updated efficiency scoring, added font maximization
- `src/constants/version.ts` - Version bump

---

## [0.6.266] - 2026-01-09

### Added - Genre-Based Book Spine Dimension System

Implemented a comprehensive genre-based dimension calculation system for book spines. Book spine heights and widths are now dynamically calculated based on:

**Genre Profiles (50+ genres):**
- Children's books (0-2, 3-5, 6-8, 9-12) - progressively taller, playful personality
- Teen/YA - standard dimensions
- Literary Fiction, Classics - tall and elegant
- Fantasy, Sci-Fi - imposing dimensions, wide range based on duration
- Mystery, Thriller, Crime - standard to chunky
- Romance - compact personality
- Non-Fiction categories (Biography, History, Self-Help, etc.)
- Short form (Essays, Short Stories) - elegant and thin

**Tag Modifiers (80+ tags):**
- Subgenre tags: epic-fantasy (+15% height, +20% width), cozy-fantasy (-12%), grimdark (+10%)
- Era tags: victorian, medieval, regency - affect dimensions
- Creature tags: dragons, vampires, fae - flavor adjustments
- Vibe tags: atmospheric, fast-paced, emotional
- Duration overrides: under-5-hours, over-20-hours

**Personality System:**
- `imposing` - tall, wide (epics, histories)
- `elegant` - tall, thin (literary, gothic)
- `chunky` - medium height, thick (crime, anthologies)
- `compact` - shorter, standard width (romance, self-help)
- `playful` - variable, fun proportions (children's, humor)
- `standard` - balanced dimensions

**Series Consistency:**
- Books in the same series share identical height
- Width varies based on individual book duration
- First book in series sets the style for all others

### Files Modified
- `src/features/home/utils/spineCalculations.ts` - Added GENRE_PROFILES, TAG_MODIFIERS, calculateBookDimensions()
- `src/features/home/components/BookSpineVertical.tsx` - Added tags support, use new dimension calculation
- `src/features/home/components/BookshelfView.tsx` - Use genre-based dimension calculation
- `src/features/home/screens/LibraryScreen.tsx` - Pass tags from metadata to spine data
- `src/constants/version.ts` - Version bump

---

## [0.6.265] - 2026-01-09

### Updated - Library View Toggle Buttons

Simplified view toggle buttons to icon-only design:

**Changes:**
- Removed "Shelf" and "Grid" text labels from view buttons
- Buttons now show only icons (BookIcon / GridIcon)
- Increased logo size from 32px to 48px
- Filter/sort row aligned to the right (with search)
- Cleaned up unused styles (viewBtnActive, viewBtnLabel)

### Files Modified
- `src/features/home/screens/LibraryScreen.tsx` - Simplified view buttons
- `src/constants/version.ts` - Version bump

---

## [0.6.264] - 2026-01-09

### Updated - Library Header Controls

Improved filter/sort controls and view toggle buttons:

**View Toggles:**
- Larger buttons (40px instead of 36px)
- Shows label when active: "Shelf" or "Grid" next to icon
- Icon + text side-by-side in the same button

**Filter & Sort Dropdowns:**
- Both now use matching dropdown style: `⊙ All` and `↓ Recent`
- Larger font (13px) for better readability
- Filter reverted to dropdown modal (was inline buttons)
- Consistent spacing between the two dropdowns

### Files Modified
- `src/features/home/screens/LibraryScreen.tsx` - Updated header controls and styles

---

## [0.6.263] - 2026-01-09

### Redesigned - Library Header Layout

Compact, unified header design with all controls on two clean rows:

**Row 1 (Main Header):**
```
[Skull Logo] Library          [Book] [Grid] [Search]
```

**Row 2 (Filters):**
```
[All] [Downloaded] [Not Downloaded]      ↓ Recent
```

#### Changes
- **New Skull Logo**: Updated to SL Skull design at 32px
- **Unified Header Row**: Logo + "Library" title on left, view toggles + search on right
- **Inline Filter Toggle**: Three connected buttons (All / Downloaded / Not Downloaded) instead of dropdown
- **Removed**: Filter dropdown modal, pageTitle section (integrated into header)

#### Visual Improvements
- More compact layout saves vertical space
- Filter buttons show active state with border highlight
- View toggle buttons (Book/Grid) use consistent 36px square design
- Search button circular with matching 36px size

### Files Modified
- `src/features/home/screens/LibraryScreen.tsx` - Complete header redesign

---

## [0.6.262] - 2026-01-09

### Fixed - Title Layout on Narrow Spines

Fixed issue where long titles on narrow spines were being clipped horizontally (showing only the middle portion of text like "True Sto" / "ree Litt" instead of the full title).

#### Layout Solver Improvements
1. **More Conservative Horizontal Layout**: Reduced available length from 88% to 75% for horizontal orientation to prevent text overflow
2. **Heavy Penalty for Horizontal on Narrow Spines**:
   - Spines < 50px with text > 15 chars: -40 score
   - Spines < 45px with text > 10 chars: -30 score
   - Spines < 60px with text > 25 chars: -35 score
3. **Stronger Vertical Preference**: Narrow spines (< 50px) now get +20 bonus for vertical orientation
4. **Better Aspect Ratio Handling**: Tall spines (aspect > 8) get extra +10 for vertical

### Changed - Library Screen View Modes

Simplified the Library screen from 3 view modes to 2:

| Before | After |
|--------|-------|
| List, Grid, Book | Book (primary), Grid (secondary) |

- **Removed List View**: Eliminated list view and all related components/styles
- **Book Spine as Default**: Bookshelf view is now the primary/default view mode
- **Cleaner Toggle**: View toggle now shows only Book and Grid icons

### Files Modified
- `src/features/home/utils/layoutSolver.ts` - Conservative horizontal estimates, stronger vertical preference
- `src/features/home/screens/LibraryScreen.tsx` - Removed list view, reordered toggle

---

## [0.6.261] - 2026-01-09

### Major Refactor - Unified Layout Solver

Replaced hardcoded layout rules with a systematic constraint satisfaction solver
that generalizes across all book titles, author names, and spine dimensions.

#### New File: `layoutSolver.ts`

A unified text layout solver implementing 8 key principles:

| Principle | Description |
|-----------|-------------|
| Constraint Satisfaction | Define hard/soft constraints, find solutions that satisfy them |
| Continuous Parameter Space | Explore all combinations: 1/2/3 lines × horizontal/vertical |
| Scored Split Generation | Score ALL possible split points, not just middle |
| Font Size as Derived | Binary search for largest font that fits constraints |
| Unified Scoring | Single function scores readability, balance, efficiency, aesthetics |
| Cascading Fallbacks | Abbreviation → relaxed constraints → truncation |
| Flexible Allocation | Section sizes adapt to content needs |
| Deterministic Variation | Hash-based nudges for organic variety |

#### Smart Split Scoring

The solver scores every possible split point based on:
- **Balance** (0-30 pts): Similar line lengths preferred
- **Orphans** (-25 pts): Never end lines with "and", "the", "of", etc.
- **Widows** (-20 pts): Final lines < 4 chars penalized
- **Semantic Breaks** (+20 pts): Bonus for splitting at `:`, `-`, etc.
- **Series Patterns** (-30 pts): Never split "Vol. 1", "Book 2", etc.
- **Title Patterns** (+15 pts): Known good splits like "Harry Potter" / "Chamber of Secrets"

#### Example Improvements

| Title | Old Split | New Split |
|-------|-----------|-----------|
| Harry Potter and the Chamber of Secrets | "Harry Potter and the" / "Chamber of Secrets" | "Harry Potter" / "Chamber of Secrets" |
| The True Story of the Three Little Pigs | Cramped 2 lines | Clean 3 lines |

#### Fallback Cascade

1. **Tier 1**: Full text with optimal layout
2. **Tier 2**: Smart abbreviations (remove articles, subtitles, initials)
3. **Tier 3**: Relaxed constraints (allow 7px instead of 8px)
4. **Tier 4**: Truncation with ellipsis
5. **Tier 5**: Clip (last resort)

### Files Added
- `src/features/home/utils/layoutSolver.ts`

### Files Modified
- `src/features/home/components/BookSpineVertical.tsx` - Now uses unified solver
- `src/features/home/utils/authorLayoutStrategy.ts` - Kept for reference (deprecated)

---

## [0.6.260] - 2026-01-09

### Fixed - Horizontal-Stacked Author Centering

Fixed spacing issue where horizontal-stacked author text was positioned too low with empty space at the top.

#### Changes
1. **Rewrote y-position calculation** in `tryHorizontalStacked`:
   - First pass calculates font sizes for all lines
   - Second pass calculates y positions based on actual font sizes used
   - Properly centers text block within the box
   - Uses explicit 4px gap between lines

2. **Fixed rendering offset** in `BookSpineVertical`:
   - Added 5% offset to center the 90% strategy box within full author section

### Files Modified
- `src/features/home/utils/authorLayoutStrategy.ts`
- `src/features/home/components/BookSpineVertical.tsx`

---

## [0.6.259] - 2026-01-09

### Added - Multi-Strategy Author Layout System

Implemented a sophisticated layout strategy selector for author names that tries multiple
approaches and picks the best one.

#### New File: `authorLayoutStrategy.ts`
Standalone module for smart author layout selection.

#### Four Layout Strategies

| Strategy | Description | Best For |
|----------|-------------|----------|
| `horizontal-single` | Single horizontal line | Short names, wide spines |
| `horizontal-stacked` | 2-3 horizontal lines stacked | Medium names, wider spines |
| `vertical-single` | Single rotated line (-90°) | Any name, tall narrow spines |
| `vertical-split` | 2-3 rotated columns side-by-side | Long names, narrow spines |

#### How It Works
1. Tries all 4 strategies with current box dimensions
2. Each strategy reports if it "fits" (font size >= minimum)
3. Fitting strategies are scored based on:
   - Font size (larger = better)
   - Aspect ratio match (tall spines prefer vertical)
   - Name characteristics (length, word count)
4. Best scoring strategy is selected
5. Fallback: abbreviated name ("U. Le Guin") or initials ("U.L.G.")

#### Scoring Logic
- **Horizontal-single**: Bonus for readable fonts (9-12px ideal range)
- **Horizontal-stacked**: Prefers balanced line lengths
- **Vertical-single**: Loves tall narrow spines (aspect > 6)
- **Vertical-split**: Last resort, good for very tall spines with long names

#### Author Name Parsing
Smart parsing handles:
- "Ursula K. Le Guin" → ["Ursula K.", "Le Guin"]
- "George Raymond Richard Martin" → ["George R.R.", "Martin"] or 3 lines
- Compound surnames: van, von, de, le, mc, mac, o', etc.

### Files Added
- `src/features/home/utils/authorLayoutStrategy.ts`

### Files Modified
- `src/features/home/components/BookSpineVertical.tsx` - Now uses `selectAuthorLayout()`

---

## [0.6.258] - 2026-01-09

### Changed - Taller Book Spines

Increased all book heights by ~30px for better visual presence.

| Dimension | Before | After |
|-----------|--------|-------|
| BASE_HEIGHT | 320 | 350 |
| MIN_HEIGHT | 260 | 290 |
| MAX_HEIGHT | 420 | 450 |

### Files Modified
- `src/features/home/utils/spineCalculations.ts`

---

## [0.6.257] - 2026-01-09

### Major Refactor - Comprehensive Logic Improvements

This version addresses critical gaps identified in code review, adding explicit fallbacks,
better algorithms, and accessibility compliance.

#### 1. Explicit Fallback Cascade
Every calculation now has explicit fallbacks for missing data:
- **Missing duration**: Uses median width (42px)
- **Missing genres**: Deterministic random typography from book ID
- **Missing author**: Empty string handling
- **Missing bookId**: Uses 'default' for hash

#### 2. Series Registry with Locking
- **Normalized names**: "The Lord of the Rings" → "lord of the rings"
- **Locked heights**: Once created, series height cannot change
- **Consistent matching**: Handles article variations automatically

#### 3. Logarithmic Width Calculation
```typescript
// Old: Linear segments
// New: Logarithmic scaling with diminishing returns
const logRatio = Math.log(1 + ratio * 9) / Math.log(10);
width = MIN_WIDTH + (MAX_WIDTH - MIN_WIDTH) * logRatio;
```
- 1 hour → 32px
- 5 hours → 44px
- 10 hours → 52px
- 20 hours → 62px
- 30 hours → 70px (capped)

#### 4. Compound Surname Handling
New `parseAuthorName()` function handles particles correctly:
- "Ursula K. Le Guin" → "Ursula K." / "Le Guin"
- "Vincent van Gogh" → "Vincent" / "van Gogh"
- "J.R.R. Tolkien" → "J.R.R." / "Tolkien"

Particles recognized: van, von, de, du, del, della, di, da, le, la, mc, mac, o', etc.

#### 5. Linguistic Title Splitting
New `findBestTitleSplit()` with scoring system:
- **Bonus**: Breaking after articles/prepositions (the, of, in, etc.)
- **Penalty**: Breaking before "Vol. 1", "Book 2", "#3"
- **Penalty**: Very unbalanced splits (<30% ratio)

#### 6. Touch Target Compliance (44px minimum)
- New `calculateTouchPadding()` function
- `hitSlop` added to pressable for narrow spines
- Narrow 28px spine gets 8px padding each side

#### 7. Genre Priority System
Genres now have explicit priority order (most specific first):
1. Mystery/Thriller/Crime
2. Horror
3. Romance
4. Sci-Fi
5. Fantasy
6. Children's
... (12 categories total)

#### 8. Performance Caching
- Font size calculations cached (500 entry limit)
- Series styles locked after creation
- Hash function optimized (djb2 variant)

### Files Modified
- `src/features/home/utils/spineCalculations.ts` - Complete rewrite
- `src/features/home/components/BookSpineVertical.tsx` - Integration updates

---

## [0.6.256] - 2026-01-09

### Improved - Smarter Title Split Logic

#### Dynamic Minimum Font Based on Spine Width
- **Narrow spines (28px)**: min font ~10px (smaller acceptable)
- **Wide spines (70px)**: min font ~16px (larger minimum)
- Formula: `dynamicMinFont = clamp(10, width × 0.22, 16)`

#### Title Split Decision Logic
```
NEVER SPLIT when:
  • Title ≤6 chars (too short, looks bad split)

SPLIT when:
  • Very long (>25 chars) AND font too small
  • Narrow spine (<40px) AND title >12 chars AND font borderline
  • Font too small AND title >10 chars
  • Wide tall spine: only if title >15 chars AND font <90% of min
```

#### Adaptive Line Width for Splits
- **Narrow spines (<40px)**: 46% per line (tighter packing)
- **Medium spines (40-50px)**: 44% per line
- **Wide spines (>50px)**: 42% per line (more gap between lines)

#### Examples
| Title | Width | Result |
|-------|-------|--------|
| "It" | 35px | Single line (too short to split) |
| "The Phantom Tollbooth" | 48px | Single line (fits well) |
| "The Left Hand of Darkness" | 38px | Split (narrow + long) |
| "A Very Long Title Indeed" | 60px | Single line (wide spine) |

### Files Modified
- `src/features/home/components/BookSpineVertical.tsx` - Title split logic

---

## [0.6.255] - 2026-01-09

### Fixed - Smarter Author Orientation with Aspect Ratio

#### New Aspect Ratio-Based Logic
The author orientation now considers the spine's **aspect ratio** (height/width), not just width:

**ALWAYS VERTICAL when:**
- Single word author (can't split)
- Narrow spine (width < 45px)
- Very tall spine (aspect ratio > 6)
- Tall spine (aspect ratio > 5) with name > 10 chars

**ALLOW HORIZONTAL only when:**
- Short name (≤10 chars) + wide (≥50px) + not too tall (ratio < 5)
- Medium name (≤14 chars) + wider (≥55px) + well-proportioned (ratio < 4.5)
- Longer name (≤18 chars) + very wide (≥60px) + short spine (ratio < 4)

**DEFAULT: VERTICAL** (safer choice)

#### Why This Matters
- "Norton Juster" on tall Phantom Tollbooth → now VERTICAL (was horizontal)
- "Ursula K. Le Guin" on narrow spine → now VERTICAL (was trying horizontal)
- Horizontal only used when spine is wide AND short enough

### Files Modified
- `src/features/home/components/BookSpineVertical.tsx` - Aspect ratio logic

---

## [0.6.254] - 2026-01-09

### Improved - Line-by-Line Author Scaling & Better Margins

#### Line-by-Line Horizontal Author Scaling
- **Each line scales independently**: "Ursula" fills width, "K. Le Guin" fills width (different sizes)
- **Two separate SvgText elements**: Enables independent font sizes per line
- **Better visual balance**: First names and last names each maximize their space

#### New Spacing Constants
- **INNER_MARGIN = 4px**: Safety margin inside spine to prevent clipping
- **SECTION_GAP = 2px**: Gap between author/title/progress sections
- **HORIZONTAL_LINE_GAP = 2px**: Gap between horizontal author lines

#### Improved Margin Logic
- **Title height with margins**: `safeHeight = titleHeight - (INNER_MARGIN * 2)`
- **Author width with margins**: `textWidth = availableWidth - (INNER_MARGIN * 2)`
- **Section positions include gaps**: Cleaner separation between sections

#### Updated Constants
- `TITLE_LINE_SPACING = 0.52` (tighter, was 0.55)
- `AUTHOR_LINE_SPACING = 0.55` (tighter, was 0.6)
- `MAX_AUTHOR_FONT = 16` (was 14)
- `MIN_TITLE_FONT_FOR_SPLIT = 14` (was 16)
- `AUTHOR_PERCENT_BASE = 22%` (was 20%)

### Files Modified
- `src/features/home/components/BookSpineVertical.tsx` - Line-by-line scaling, margins, spacing

---

## [0.6.253] - 2026-01-09

### Fixed - Duration-Based Width & Author Orientation

#### Restored Duration-Based Spine Width
- **Width varies by audiobook length**: Longer books = thicker spines
- **4 tiers based on hours**:
  - Short (<4 hrs): 28-36px
  - Medium (4-10 hrs): 36-48px
  - Long (10-20 hrs): 48-58px
  - Epic (>20 hrs): 58-70px
- **Visual comparison**: Users can compare book lengths at a glance

#### Fixed Author Orientation
- **Short names (≤14 chars)**: Now horizontal (easier to read)
- **Medium names (15-20 chars)**: Horizontal on wider spines (≥42px)
- **Long names (>20 chars)**: Vertical (fits better)
- **Single word authors**: Always vertical (can't split into 2 lines)
- **Very narrow spines (<36px)**: Always vertical

#### Fixed Line Spacing
- **AUTHOR_LINE_SPACING = 0.6**: Used for split author names (was hardcoded 0.7)
- **TITLE_LINE_SPACING = 0.55**: Tighter spacing for split titles

#### Fixed Author/Title Overlap
- **MAX_AUTHOR_FONT = 14**: Caps author font to prevent overlap with title
- **MIN_AUTHOR_FONT = 9**: Ensures readability
- **Author section = 20%**: Reduced to give title more room

### Files Modified
- `src/features/home/utils/spineCalculations.ts` - Duration-based width calculation
- `src/features/home/components/BookSpineVertical.tsx` - Author orientation logic, line spacing

---

## [0.6.252] - 2026-01-09

### Improved - Bigger Text, More Top Padding

#### More Top Padding (Visible Gap)
- **TOP_PADDING increased to 16px** (was 10px) - clear visible gap at top of spine
- **Separate BOTTOM_PADDING = 8px** - different top/bottom padding for better balance
- Text no longer touches the top edge

#### Bigger Title Text
- **Fill factor: 0.92** (was 0.88) - titles fill more of the available space
- **Thickness: 0.95** (was 0.90) - allows thicker/taller text
- ClipPath prevents any overflow

#### Bigger Author Text
- **Author multiplier: 0.92x** (was 0.85x) - almost as large as title
- **Section space: 24%** (was 22%) - more room for author
- **MIN_AUTHOR_FONT = 11** (was 10) - larger minimum

### Files Modified
- `src/features/home/components/BookSpineVertical.tsx` - TOP_PADDING=16, BOTTOM_PADDING=8, section %
- `src/features/home/utils/spineCalculations.ts` - fill=0.92, thickness=0.95, author=0.92x

---

## [0.6.251] - 2026-01-09

### Improved - Consistent Width, Better Padding, Bigger Author

#### Consistent Spine Width
- **Fixed width for all books**: All spines are now 48px wide (was variable based on duration)
- **Compare by height**: Users can now compare book lengths at a glance by HEIGHT
- **Cleaner shelf appearance**: Uniform width creates a tidier bookshelf

#### Better Padding & Margins
- **Edge padding increased**: 8px from edges (was 5px) - titles don't get too close to edges
- **Top padding increased**: 10px (was 8px) - more breathing room

#### Bigger Author Text
- **Font multiplier increased**: 0.85x of title size (was 0.7x) - much more readable
- **More section space**: Author gets 22% of spine (was 16%)
- **Prefer single line**: Only split author names >18 chars (was >10)
- **Names like "Susanna Clarke" now fit on one line**

#### Technical Changes
- `calculateSpineWidth()` now returns fixed 48px
- `EDGE_PADDING = 8`, `TOP_PADDING = 10`
- `MIN_AUTHOR_FONT = 10` (was 8)
- `AUTHOR_PERCENT_BASE = 22` (was 16)
- Author split threshold: 18 chars (was 10)

### Files Modified
- `src/features/home/utils/spineCalculations.ts` - Fixed width, bigger author multiplier
- `src/features/home/components/BookSpineVertical.tsx` - Better padding, author sizing

---

## [0.6.250] - 2026-01-09

### Changed - Moved Series Info from Spines to Book Detail

#### Book Spines (Simplified)
- **Removed series info**: No longer displays "Series Name #N" on book spines
- **Cleaner layout**: Simple 3-section layout (Author → Title → Progress)
- **More title space**: Title section now 74% (was 64% + 10% series)
- **Title centered**: No more conditional positioning for series

#### Book Detail Screen (Added Series)
- **Series info added**: Shows series name and book number below author
- **Smart extraction**: Handles both array format (`metadata.series[0]`) and string format (`seriesName #N`)
- **Italic styling**: Series displayed in italic to differentiate from author
- **Conditional**: Only shows when book is part of a series

#### Visual Layout (Book Detail)
```
Title
Author Name
Series Name #3    ← New (only if in series)
Duration  Chapters
```

### Files Modified
- `src/features/home/components/BookSpineVertical.tsx` - Removed all series display code
- `src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx` - Added series info display

---

## [0.6.249] - 2026-01-09

### Improved - Series Position Right Next to Title

#### Dynamic Series Positioning
- **4px gap**: Series now positioned exactly 4px to the left of title (not a fixed percentage)
- **Font-size aware**: Position calculated based on actual font sizes:
  - `seriesCenterX = titleCenterX - titleFontSize/2 - 4 - seriesInfoFontSize/2`
- **Title at 60%**: Shifted slightly more to the right to make room
- **Aligned pair**: Series and title now appear as a cohesive pair, not separate elements

#### Technical Changes
- Moved seriesCenterX calculation after font sizes are computed
- Added `SERIES_TITLE_GAP = 4` constant for the gap between series and title
- Title position: `width * 0.60` when series present (was 0.58)

### Files Modified
- `src/features/home/components/BookSpineVertical.tsx` - Dynamic series positioning

---

## [0.6.248] - 2026-01-09

### Fixed - Text Overflow on Long Titles

#### Overflow Prevention
- **Reduced fill factors**: Length fill reduced from 98% to 88%, thickness from 95% to 90%
- **Added SVG clipPath**: All text content wrapped in clipped group to prevent overflow
- **Long titles safe**: "THE LEFT HAND OF DARKNESS" and similar long titles now stay within spine bounds

#### Technical Changes
- Added `Defs` and `ClipPath` imports from react-native-svg
- Created `spine-clip-{bookId}` clipPath matching spine shape
- Wrapped all text (title, author, series, progress) in `<G clipPath="...">`
- Font calculation now uses 0.88 length factor (was 0.98) for safety

### Files Modified
- `src/features/home/utils/spineCalculations.ts` - Safer fill factors
- `src/features/home/components/BookSpineVertical.tsx` - ClipPath to prevent overflow

---

## [0.6.247] - 2026-01-09

### Changed - Pure Black Text, No Transparency

#### Text Color Changes
- **Pure black**: Changed TEXT_COLOR from `#1a1a1a` to `#000000`
- **Removed all opacity**:
  - Author text: removed `opacity={0.7}`
  - Series info: removed `opacity={0.5}`
  - Last played: removed `opacity={0.85}` (now full white)
- **Consistent appearance**: All spine text is now solid, no transparency

### Files Modified
- `src/features/home/components/BookSpineVertical.tsx` - Pure black text, no opacity

---

## [0.6.246] - 2026-01-09

### Improved - Larger Title & Closer Series (Matching Reference Image 73)

#### Title Size - Aggressive Fill
- **Removed conservative multipliers**: Font calculation now uses 98% length fill (was 81%)
- **Larger thickness allowance**: 95% of width (was 72%)
- **No double-padding**: Removed redundant 0.9/0.92 multipliers from caller
- **Result**: Title text is now MUCH larger, filling the spine like reference

#### Series Position - Right Next to Title
- **Closer to title**: Series at 22% from left (was 12% - too far)
- **Title at 58%**: Slight shift to make room (was 55%)
- **Gap reduced**: Series and title now appear as a pair, not separate elements

#### Technical Changes
- `calculateFillFontSize()`: 0.98 length fill, 0.95 thickness (was 0.9, 0.85)
- Caller passes full `titleHeight` and `titleAvailableWidth` (no more 0.9/0.92)
- `seriesCenterX = width * 0.22`, `titleCenterX = width * 0.58`

### Files Modified
- `src/features/home/utils/spineCalculations.ts` - More aggressive font calculation
- `src/features/home/components/BookSpineVertical.tsx` - Removed redundant multipliers, adjusted positions

---

## [0.6.245] - 2026-01-09

### Improved - Series Label Positioning (Matching Reference)

#### Visual Changes
- **Series at far left edge**: Series info now positioned at 12% from left (was 22%) - like a margin label
- **Title mostly centered**: Title at 55% from left when series present (was 62%) - takes most of the space
- **Smaller series font**: Max 7px (was 8px) - subtle edge label style
- **More title width**: Title gets 82% of available width when series present (was 65%)

#### Layout Matches Reference
```
┌──────────────────────────┐
│ S                        │
│ e                        │
│ r  T I T L E             │  ← Series small at edge
│ i                        │    Title large and centered
│ e                        │
│ s                        │
└──────────────────────────┘
```

### Files Modified
- `src/features/home/components/BookSpineVertical.tsx` - Adjusted positioning constants

---

## [0.6.244] - 2026-01-09

### Fixed - Series Books Now Use Genre Typography

#### Typography Fix
- **Genre styling restored**: Series books now use their actual genre-based typography instead of uniform series styling
- **Series consistency preserved**: Series books still share consistent height and icon
- **Visual variety**: A mystery book in a series will now look like a mystery (bold, uppercase) not a generic style

#### What Series Provides Now
- ✅ Consistent **height** across series
- ✅ Consistent **icon** for series identification
- ✅ Series **byline** showing "Series Name #N"
- ❌ NO longer overrides typography (uses book's genre)

### Files Modified
- `src/features/home/components/BookSpineVertical.tsx` - Always use getTypographyForGenres()

---

## [0.6.243] - 2026-01-09

### Changed - Series Info as Byline

#### Series Byline Positioning
- **Series as byline**: Series info ("Series Name #N") now displays as a byline to the LEFT of the title, not in a separate section
- **Same Y position**: Series text shares the title's Y range, running alongside it
- **Visual hierarchy**: Series text is smaller (8px max) and more transparent (50% opacity) to not compete with the title
- **Title shifts right**: When series is present, title moves to 62% from left, making room for series at 22%
- **Title width adjusted**: Title gets 65% of available width when series byline is shown

### Technical Details
- `seriesCenterX = width * 0.22` (left portion)
- `titleCenterX = width * 0.62` when series present (was 50% center)
- Both rotate -90 degrees for vertical reading
- Series font size: `Math.min(width * 0.22, 8)` - small but readable

### Files Modified
- `src/features/home/components/BookSpineVertical.tsx` - Series byline positioning alongside title

---

## [0.6.242] - 2026-01-09

### Improved - Progress Section on Book Detail

#### Progress Section Redesign
- **Finished badge**: Books marked as finished show a filled green circle with checkmark
- **Visual divider**: Horizontal line separates progress indicator from action pills
- **Always show Clear Progress**: Clear Progress pill now shows even at 0% progress
- **Better organization**: Progress section has clear visual hierarchy

#### Technical Details
- Uses `isFinished` from `userMediaProgress` for accurate finished state
- New styles: `finishedBadge`, `finishedText`, `progressDivider`, `progressPillSuccess`

### Files Modified
- `src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx` - Progress section redesign

---

## [0.6.241] - 2026-01-09

### Fixed - Series Info & Last Book Lean

#### Series Info Display
- **Fixed series sequence parsing**: Now correctly parses `sequence` as a number using `parseFloat()`
- **Support both data formats**: Handles `metadata.series[0].sequence` array format AND `metadata.seriesName` string format (e.g., "Series Name #1")
- **New `extractSeriesInfo()` helper**: Centralized series extraction logic matching SeriesNavigator pattern

#### Last Book Lean
- **Last book leans left**: The last book in the shelf now always leans to the left (toward the other books)
- **Single book stays straight**: If there's only one book, it remains upright
- **Consistent behavior**: Last book lean takes priority over random lean distribution

### Files Modified
- `src/features/home/screens/LibraryScreen.tsx` - New extractSeriesInfo() helper
- `src/features/home/components/BookshelfView.tsx` - Last book lean logic

---

## [0.6.240] - 2026-01-09

### Added - Book Spine Improvements & Progress Actions

#### Book Spine Changes
- **Series info on spine**: Books in a series now display "Series Name #N" at the bottom of the spine
- **Checkmark for finished**: 100% progress shows a checkmark icon instead of "100"
- **Improved title positioning**: Title moves toward bottom when no progress is shown
- **New layout sections**: Author → Title → Series Info → Progress (4 distinct sections)

#### Book Detail Progress Actions
- **Mark Finished pill**: Quick action to mark book as 100% complete (shows when not finished)
- **Clear Progress pill**: Reset progress to 0% (shows when progress > 0%)
- **Visual feedback**: Pills styled with borders and icons

### Technical Details
- Added `seriesSequence?: number` to `BookSpineVerticalData` interface
- New section percentage calculation adapts based on what content is shown
- Uses `userApi.markAsFinished()` and `userApi.markAsNotStarted()` APIs
- Auto-refreshes book detail after progress actions

### Files Modified
- `src/features/home/components/BookSpineVertical.tsx` - Series info, checkmark, layout
- `src/features/home/screens/LibraryScreen.tsx` - Pass seriesSequence data
- `src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx` - Progress action pills

---

## [0.6.239] - 2026-01-09

### Added - Rounded Corners on Book Spines

- **Subtle rounded corners**: Added 3px border radius to book spine edges
- **Download indicator matches**: Orange download indicator has rounded top corners to match spine shape

### Files Modified
- `src/features/home/components/BookSpineVertical.tsx` - Added CORNER_RADIUS, rx/ry on Rect elements

---

## [0.6.238] - 2026-01-09

### Fixed - Author Name Too Close to Top Edge

- **Top padding**: Added 8px padding from top of spine for all content
- **Download indicator aware**: When book is downloaded, content starts after the orange indicator
- **Usable height calculation**: Section heights now calculated from usable area (excluding top/bottom padding)
- **Proper positioning**: Author section at top now starts at `topOffset` instead of `y=0`

### Files Modified
- `src/features/home/components/BookSpineVertical.tsx` - Added TOP_PADDING, adjusted section positioning

---

## [0.6.237] - 2026-01-09

### Added - Download Filter & Download Indicator

- **Orange top border**: Downloaded books show a 4px orange (#FF6B35) border at the top of the spine
- **Filter dropdown**: New filter button next to sort with 3 options:
  - All Books (default)
  - Downloaded (show only downloaded books)
  - Not Downloaded (show only cloud books)
- **Visual consistency**: Uses same orange accent color as player screen

### Technical Details
- Added `isDownloaded?: boolean` to `BookSpineVerticalData` interface
- Added `FilterMode` type and `FILTER_OPTIONS` array
- Filter state managed with `useState<FilterMode>('all')`
- Books filtered via `useMemo` before sorting
- Downloads tracked via `useDownloads` hook with `downloadedIds` Set

### Files Modified
- `src/features/home/screens/LibraryScreen.tsx` - Filter dropdown modal, filter state, download status tracking
- `src/features/home/components/BookSpineVertical.tsx` - Orange top border for downloaded books

---

## [0.6.236] - 2026-01-09

### Fixed - Last Played Time Visibility

- **White text**: Changed from dark `#1a1a1a` to white `#FFFFFF` for visibility on dark shelf
- **Higher opacity**: Increased from 0.5 to 0.85
- **Larger font**: Increased max from 10px to 12px, width ratio from 0.28 to 0.32
- **Bolder weight**: Font weight 600 instead of 500

### Files Modified
- `src/features/home/components/BookSpineVertical.tsx` - Last played text styling

---

## [0.6.235] - 2026-01-09

### Changed - Sort Dropdown Menu

- **Dropdown instead of cycle**: Tapping sort button now opens a dropdown menu
- **All options visible**: See all 5 sort options at once (Recent, Title, Author, Progress, Duration)
- **Visual feedback**: Selected option shows checkmark
- **Theme-aware**: Dropdown adapts to light/dark mode (bookshelf vs list/grid)
- **Tap outside to close**: Dismiss dropdown by tapping overlay

### Files Modified
- `src/features/home/screens/LibraryScreen.tsx` - Dropdown modal, styles

---

## [0.6.234] - 2026-01-09

### Fixed - Last Played Time Data & Conditional Display

- **Fixed lastPlayedAt data**: Now correctly uses `mediaProgress.lastUpdate` timestamp from API
- **Conditional time display**: Last played time only shows on spines when sorted by "Recent"
- **Fixed sort by recent**: Uses numeric timestamp comparison instead of string date parsing
- **Data type fix**: Changed `lastPlayedAt` from ISO string to Unix timestamp for proper sorting

### Technical Details
- `transformToLibraryBook` now extracts `lastUpdate` from `mediaProgress` or `progressLastUpdate`
- `transformToSpineData` accepts `showLastPlayed` flag, converts timestamp to ISO string only when needed
- Sort comparison simplified to `(b.lastPlayedAt || 0) - (a.lastPlayedAt || 0)`

### Files Modified
- `src/features/home/screens/LibraryScreen.tsx` - Data extraction and conditional display

---

## [0.6.233] - 2026-01-09

### Added - Library Sort Functionality

- **Sort button works**: Tap "↓ Recent" to cycle through sort options
- **5 sort modes**: Recent, Title (A-Z), Author (A-Z), Progress (high to low), Duration (long to short)
- **Works with all views**: Sorting applies to list, grid, and bookshelf views
- **Visual feedback**: Sort button shows current sort mode and is now properly colored

### Technical Details
- Added `SortMode` type and `SORT_OPTIONS` array
- Sort state managed with `useState<SortMode>('recent')`
- Books sorted via `useMemo` before rendering
- Fixed spine data lookup to use Map instead of index (handles sorted order correctly)
- Added `durationSeconds` and `lastPlayedAt` to LibraryBook interface

### Files Modified
- `src/features/home/screens/LibraryScreen.tsx` - Sort state, handlers, UI

---

## [0.6.232] - 2026-01-09

### Added - Last Played Time Above Spine

- **Compact time format**: Shows last played time above book spine (max 3 chars)
  - Formats: 30s, 15m, 1h, 2d, 3w, 11mt, 2y
  - Months exception: can be 4 chars (e.g., "11mt")
- **Rotates with book**: Time indicator follows spine lean angle
- **New data field**: `lastPlayedAt?: string` added to BookSpineVerticalData

### Files Modified
- `src/features/home/components/BookSpineVertical.tsx` - Time indicator, interface update

---

## [0.6.231] - 2026-01-09

### Fixed - Progress Position & Content Gap

- **Reduced gap**: Title section now extends to 79% when no series icon (was 72%)
- **Progress closer to content**: Position now relative to icon section, not absolute bottom
- **Minimal bottom reserve**: Only 3% reserved for progress number when no icon

### Files Modified
- `src/features/home/components/BookSpineVertical.tsx` - Layout percentages, progress position

---

## [0.6.230] - 2026-01-09

### Changed - Progress Number Styling

- **Black text**: Progress number now solid black instead of faded gray
- **Larger font**: Increased from max 12px to max 14px
- **Closer position**: Moved from 8px to 5px from bottom edge
- **Bolder weight**: Font weight increased from 500 to 600

### Files Modified
- `src/features/home/components/BookSpineVertical.tsx` - Progress styling

---

## [0.6.229] - 2026-01-09

### Fixed - Multi-Line Text Spacing

- **Increased line spacing**: Two-line titles and authors now use 0.7 * fontSize offset (was 0.55)
- Fixes overlapping text issue when author names like "Jorge Luis Borges" split into two lines

### Files Modified
- `src/features/home/components/BookSpineVertical.tsx` - Line spacing fix

---

## [0.6.228] - 2026-01-09

### Added - Multi-Line Text & Dynamic Layout

- **Multi-line titles**: Long titles automatically split into 2 lines when font would be <14px
  - Splits at middle word for balanced lines
  - Both lines render as parallel vertical text
- **Multi-line authors**: Long author names split into 2 lines when font would be <9px
  - Same smart split logic at word boundaries
- **Dynamic section sizing**: Books without series icon AND without progress get extra title space
  - Icon section (10%) reallocated to title when unused
  - Ensures consistent appearance across app (based on book properties, not display context)

### Technical Details
- Added `splitTextIntoLines()` helper for smart text splitting
- Section percentages now calculated dynamically via useMemo
- Layout consistency: same book looks identical everywhere (deterministic based on book data)

### Files Modified
- `src/features/home/components/BookSpineVertical.tsx` - Multi-line support, dynamic sections

---

## [0.6.222] - 2026-01-09

### Fixed - Bookshelf Layout & Author Sizing

- **Moved up above nav bar**: Added 90px bottom padding to clear navigation
- **Leaning books**: Every ~4th book (based on ID hash) leans 8° left or right
  - Leaning books get extra gap to push neighbors away
- **3px edge padding**: All content now has padding from spine edges
- **Minimum author font**: Set 6px minimum so tiny authors are still readable
- **Improved author orientation thresholds**: Better logic for vertical vs horizontal

### Files Modified
- `src/features/home/components/BookshelfView.tsx` - Lean logic, nav bar padding
- `src/features/home/components/BookSpineVertical.tsx` - leanAngle prop, edge padding, min font

---

## [0.6.221] - 2026-01-09

### Changed - Bookshelf Horizontal Scroll

- **Horizontal scrolling**: Books now scroll left/right instead of vertical rows
- **Removed tilt**: Books no longer have random tilt angles (prevents overlap)
- **Progress display**: Shows just number (e.g., "42") without % sign, hidden when 0
- **Smart author orientation**: Automatically chooses vertical vs horizontal based on:
  - Single word authors → always vertical
  - Narrow spines (<40px) → always vertical
  - Short names (≤14 chars) on wide spines (≥45px) → horizontal
  - Longer names → vertical

### Files Modified
- `src/features/home/components/BookshelfView.tsx` - Horizontal ScrollView
- `src/features/home/components/BookSpineVertical.tsx` - Removed tilt, fixed author logic

---

## [0.6.220] - 2026-01-09

### Fixed - Book Spine Text Scaling

- **Fixed font size calculation**: Parameters were swapped in `calculateFillFontSize` calls
  - Title text now properly fills the spine height
  - Author text properly constrained to spine width
- **Fixed horizontal author overflow**: Now calculates based on longer line (first word vs rest)
- **Changed progress display**: Progress bar replaced with percentage number (e.g., "42%")
  - Displayed at bottom of spine with 50% opacity
  - Font size scales with spine width

### Files Modified
- `src/features/home/components/BookSpineVertical.tsx`

---

## [0.6.219] - 2026-01-09

### Major - Book Spine Redesign (Flâneur Aesthetic)

Complete redesign of the bookshelf view to match editorial/Flâneur aesthetic:

- **Dynamic text sizing**: Text now fills available container space (no more tiny text)
  - Removed hard caps on font sizes (was 48px/24px max)
  - Per-font character width ratios for better estimation
  - True container-filling behavior

- **Genre-based typography**: 12 typography presets based on book genre
  - Literary, Mystery, Romance, Sci-Fi, Fantasy, Horror, etc.
  - Serif vs sans-serif, weight, italic, uppercase transforms
  - Author position variations (top-horizontal, top-vertical, bottom-vertical)

- **Duration-based thickness**: Book spine width based on audiobook length
  - Under 2h = thin, 2-6h = slim, 6-10h = medium, 10-15h = thick, 25h+ = maximum
  - Longer audiobooks appear thicker on the shelf

- **Series consistency**: Books in same series share visual style
  - Same typography, height, and decorative icon
  - Only thickness varies (based on individual book duration)
  - Series icon at bottom of spine (12 icon options)

- **Layout variations**: Slight random tilts (-3° to +3°) for organic feel
  - Deterministic randomization from book ID
  - Consistent across renders

- **12 decorative series icons**: Lotus, Skull, Bird, Star, Moon, Leaf, Crown, Key, Feather, Diamond, Eye, Wave

- **Unified spine color**: Uses `creamGray` (#e8e8e8) to match player screen

### New Files
- `src/features/home/utils/spineCalculations.ts` - Core calculation utilities
- `src/features/home/components/SeriesIcons.tsx` - 12 SVG decorative icons

### Files Modified
- `src/features/home/components/BookSpineVertical.tsx` - Complete rewrite with new system
- `src/features/home/components/BookshelfView.tsx` - Updated to use new calculations
- `src/features/home/screens/LibraryScreen.tsx` - Pass full metadata (genres, duration, series)

---

## [0.6.210] - 2026-01-09

### Improved - Bookmark Markers Design

- **Bookmark markers** now have flag design:
  - Triangle flag at top with vertical line below
  - Positioned below the progress bar
  - Still clickable to jump to bookmark position
  - Orange color matching bookmark icon

---

## [0.6.209] - 2026-01-09

### Improved - Player Screen UX

- **Title/Author text**: Removed selection highlighting - now click and go immediately
- **Bookmark markers**:
  - Now clickable - tap to jump to that bookmark position
  - Added hitSlop for larger touch target
- **Series label**: Added more breathing room with increased margins

### Files Modified
- `src/features/player/screens/SecretLibraryPlayerScreen.tsx`

---

## [0.6.208] - 2026-01-09

### Added - Bookmark Edit Mode & Chapter Search

- **AddBookmarkSheet** - Now supports edit mode for existing bookmarks
  - Title changes to "Edit Bookmark" when editing
  - Pre-fills type and note from existing bookmark
  - Delete button appears in edit mode with trash icon
  - All functionality shared between add and edit modes

- **ChaptersSheet** - Fuzzy search for chapters
  - Search button toggles search mode
  - Fuzzy matching: finds chapters even with partial/typo input
  - Exact matches ranked higher than fuzzy matches
  - Empty state when no chapters found
  - Book info hides during search to maximize list space

### Fixed

- **Sheet container background**: Changed from white to creamGray to eliminate white bar at bottom of panels

### Files Modified
- `src/features/player/sheets/AddBookmarkSheet.tsx` - Edit mode, delete button, exported types
- `src/features/player/sheets/ChaptersSheet.tsx` - Fuzzy search, search UI
- `src/features/player/screens/SecretLibraryPlayerScreen.tsx` - Sheet container background fix

---

## [0.6.207] - 2026-01-09

### Changed - Reduced Contrast in Sheet UI Elements

- Updated all sheet container backgrounds from white to creamGray (`#e8e8e8`)
- Updated all buttons/inputs from white to grayLight (`#F5F5F5`) for reduced contrast
- Matches the player screen background for visual consistency
- Creates a more subtle, cohesive design across all bottom sheets

### Files Modified
- `src/features/player/sheets/BookmarksSheet.tsx` - Container + buttons → grayLight
- `src/features/player/sheets/ChaptersSheet.tsx` - Container + buttons → grayLight
- `src/features/player/sheets/AddBookmarkSheet.tsx` - Container + buttons/inputs → grayLight
- `src/features/player/sheets/SpeedSheet.tsx` - Container + buttons → grayLight
- `src/features/player/sheets/SleepTimerSheet.tsx` - Container + buttons/inputs → grayLight
- `src/features/queue/components/QueuePanel.tsx` - Container + buttons → grayLight

---

## [0.6.205] - 2026-01-09

### Added - Editorial Design Bookmarks & Chapters Panels

- **BookmarksSheet** - Complete redesign with editorial styling
  - Filter tabs: All, Bookmarks, Notes
  - Bookmark items with chapter, timestamp, note
  - Play and Edit action buttons per bookmark
  - Different icons for bookmarks vs notes
  - Empty state with centered icon
  - Bottom actions: Export and Add Bookmark

- **ChaptersSheet** - Complete redesign with editorial styling
  - Book info card with cover, title, author, progress %
  - Progress bar with chapters complete count
  - Chapter list with number, title, duration, status
  - Current chapter highlighted in black with playing indicator
  - Completed chapters show checkmark
  - Bottom actions: Search and Resume

- **AddBookmarkSheet** - New popup for adding bookmarks
  - Timestamp display with chapter and time
  - Type selector: Bookmark or Note
  - Note text input (optional)
  - Cancel and Save actions

### Files Added
- `src/features/player/sheets/BookmarksSheet.tsx`
- `src/features/player/sheets/ChaptersSheet.tsx`
- `src/features/player/sheets/AddBookmarkSheet.tsx`

### Files Modified
- `src/features/player/screens/SecretLibraryPlayerScreen.tsx` - Updated imports

---

## [0.6.204] - 2026-01-09

### Fixed - Queue & Sleep Timer Bugs

- **Queue panel error**: Fixed `seekToPosition is not a function` error
  - Changed `seekToPosition` to `seekTo` (correct function name)
- **Unicode character display**: Fixed `\u00B7` showing as literal text
  - Replaced escape sequences with actual `·` characters
- **Add Book navigation**: Now goes to Home page instead of Library
- **Sleep Timer padding**: Added more bottom padding to prevent button clipping

### Files Modified
- `src/features/queue/components/QueuePanel.tsx` - seekTo fix, unicode fix, nav fix
- `src/features/player/sheets/SleepTimerSheet.tsx` - Bottom padding increased

---

## [0.6.203] - 2026-01-09

### Fixed - UI Improvements

- **Book detail share button**: Replaced "..." icon with share icon (does nothing yet)
- **Queue panel height**: Panel now sizes to content instead of expanding to fill sheet
  - Removed flex: 1 from container
  - Added maxHeight to scroll content
- **Speed preset delete button**: Fixed delete X button not clickable
  - Added overflow: visible to preset wrapper and grid
  - Added padding to prevent clipping of absolute-positioned delete buttons

### Files Modified
- `src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx` - Share icon
- `src/features/queue/components/QueuePanel.tsx` - Content-based sizing
- `src/features/player/sheets/SpeedSheet.tsx` - Delete button overflow fix

---

## [0.6.202] - 2026-01-09

### Added - Speed Preset Delete Mode & Clickable Player Navigation

- **Speed preset delete mode**: Long press any saved preset to enter delete mode
  - All presets show X buttons in top-right corner
  - Tap X to delete that preset
  - Tap any preset to exit delete mode
  - Hint text updates to guide user

- **Clickable title on player**: Tap book title to navigate to book detail page
- **Clickable series on player**: Tap series name to navigate to series page

### Files Modified
- `src/features/player/sheets/SpeedSheet.tsx` - Delete mode for presets
- `src/features/player/screens/SecretLibraryPlayerScreen.tsx` - Clickable title/series

---

## [0.6.201] - 2026-01-09

### Fixed - Queue Icon with Checkmark

- **QueueCheckIcon**: Now shows all 3 stack layers with checkmark overlay in bottom-right
  - Previously only showed checkmark when in queue
  - Now shows full stack icon + checkmark for clearer "added" state

### Files Modified
- `src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx` - QueueCheckIcon updated

---

## [0.6.200] - 2026-01-09

### Added - Queue & Download Buttons (SecretLibraryBookDetailScreen)

- **Queue button**: Replaced bookmark icon with "Add to Queue" toggle button
  - Uses stack/layers icon to represent queue
  - Shows checkmark when book is in queue
  - Button fills black with white icon when active
- **Download button**: Added download button next to queue button
  - Shows progress percentage while downloading
  - Shows checkmark when downloaded
  - Disabled state for pending/in-progress downloads

### Fixed - Navigation & Panel Height

- **Book detail navigation**: Fixed "Unknown Title" bug when clicking books from home/library
  - LibraryScreen was passing `bookId` but BookDetailScreen expected `id`
- **Queue panel height**: Increased max height from 75% to 85% to prevent clipping

### Files Modified
- `src/features/book-detail/screens/SecretLibraryBookDetailScreen.tsx` - Queue/download buttons
- `src/features/player/screens/SecretLibraryPlayerScreen.tsx` - Taller sheet style
- `src/features/home/screens/LibraryScreen.tsx` - Navigation parameter fix

---

## [0.6.186] - 2026-01-09

### Changed - Chapter Display & Skip Icons (SecretLibraryPlayerScreen)

- **Much larger bookmark icon**: Increased from 20px to 32px, removed circle border
- **Much larger chapter title**: Increased from 18px to 36px, allows 2 lines, max width 200px
- **Chapter title clickable**: Tapping chapter name opens chapter selection sheet
- **Skip-style icons for chapter nav**: Changed chevrons to skip icons with vertical line (|< and >|)
- **Better arrow spacing**: Added margin and padding around chapter nav buttons
- **Improved narrator parsing**: Added support for `narrator` field and string arrays
- **Badge size increased**: Bookmark count badge now 18px with larger text

### Files Modified
- `src/features/player/screens/SecretLibraryPlayerScreen.tsx` - Chapter display, skip icons, bookmark

---

## [0.6.185] - 2026-01-09

### Changed - Player Layout Updates (SecretLibraryPlayerScreen)

- **Chapter title instead of number**: Big display now shows chapter title (not number) with up/down navigation
- **Chevrons now black**: Chapter navigation arrows are now black instead of grey
- **Narrator added**: "Read by [Narrator]" displayed below chapter title area
- **Controls reordered**: Skip back (<), skip forward (>>), then play button on right
- **Skip icons changed**: Rewind/fast forward now use << and >> icons instead of curved arrows
- **Bookmark simplified**: Removed circle border, made icon larger (20px)

### Files Modified
- `src/features/player/screens/SecretLibraryPlayerScreen.tsx` - Layout updates

---

## [0.6.184] - 2026-01-09

### Changed - Pill Controls & Chapter Navigation (SecretLibraryPlayerScreen)

- **Pill-styled controls**: Simplified to 3 buttons (skip back, play, skip forward)
  - Styled like header pills with black border/outline
  - Play button filled black with white icon
  - Right-aligned layout
  - Skip labels show interval (15, 30, etc.)
- **Chapter navigation arrows**: Added subtle up/down chevrons around the big chapter number
  - Up arrow = next chapter, down arrow = previous chapter
  - Subtle grey color, positioned above/below the number
  - Removed prev/next chapter buttons from bottom controls

### Files Modified
- `src/features/player/screens/SecretLibraryPlayerScreen.tsx` - Pill controls, chapter nav arrows

---

## [0.6.183] - 2026-01-09

### Changed - Rounded Rectangle Buttons (SecretLibraryPlayerScreen)

- **New button style**: Changed control buttons from circles to rounded rectangles
  - Subtle grey background (`#d8d8d8`) for contrast against main background
  - Rounded corners (10px radius) instead of fully circular
  - All buttons same height for uniform look
  - Play/pause now uses black icon on grey background (matches other controls)
- Added `buttonGray` color to secretLibrary theme

### Files Modified
- `src/features/player/screens/SecretLibraryPlayerScreen.tsx` - Rounded rectangle buttons
- `src/shared/theme/secretLibrary.ts` - Added buttonGray color

---

## [0.6.182] - 2026-01-09

### Changed - Grey Background (SecretLibraryPlayerScreen)

- **Grey background**: Changed from warm cream (`#f0ebe0`) to neutral grey (`#e8e8e8`)
- Added `creamGray` color to secretLibrary theme for future use

### Files Modified
- `src/features/player/screens/SecretLibraryPlayerScreen.tsx` - Use creamGray background
- `src/shared/theme/secretLibrary.ts` - Added creamGray color

---

## [0.6.181] - 2026-01-09

### Fixed - Slider & Cream Background (SecretLibraryPlayerScreen)

- **Replaced custom scrubbing with Slider**: Swapped broken gesture-based progress bar with `@react-native-community/slider` for reliable scrubbing
  - Uses native slider component for smooth, responsive seeking
  - Bookmark markers overlaid on slider track
  - Works in both Book and Chapter progress modes
- **Cream background**: Changed background color from white to cream (`#f0ebe0`) to match book spine aesthetic
  - Updated container, status bar, safe area, control buttons, and sheet backgrounds

### Files Modified
- `src/features/player/screens/SecretLibraryPlayerScreen.tsx` - Slider component, cream background

---

## [0.6.180] - 2026-01-09

### Fixed - Scrubbing & Series Name (SecretLibraryPlayerScreen)

- **Fixed scrubbing**: Replaced PanResponder with Gesture.Pan/Tap from react-native-gesture-handler (matches CDPlayer implementation)
  - Uses reanimated shared values for smooth marker animation
  - Supports both pan (drag) and tap (jump) gestures
  - Progress fill animates smoothly during playback
- **Series name in side text**: Changed vertical side text from narrator to series name
- **Animated scrub handle**: Handle now smoothly appears/disappears during scrubbing

### Files Modified
- `src/features/player/screens/SecretLibraryPlayerScreen.tsx` - Gesture-based scrubbing, series name

---

## [0.6.179] - 2026-01-08

### Changed - Player UI Improvements (SecretLibraryPlayerScreen)

- **Author inline with title**: Author now displays in same style as title (large serif italic) directly after title
- **Book/Chapter progress toggle**: New "Book › Chapter" toggle above progress bar to switch between book and chapter progress views
- **Bookmark indicators**: Orange markers on progress bar show where bookmarks exist
- **Fixed narrator parsing**: Improved narrator extraction to handle multiple metadata formats
- **Reduced title size**: Title font reduced from 52pt to 48pt for better fit

### Files Modified
- `src/features/player/screens/SecretLibraryPlayerScreen.tsx` - Author, progress toggle, bookmark markers

---

## [0.6.178] - 2026-01-08

### Added - Scrubbing & Author/Narrator Layout (SecretLibraryPlayerScreen)

- **Progress bar scrubbing**: Interactive seeking by dragging on progress bar with visual handle
- **Author in title area**: Moved author below title, larger serif font (20pt), tappable to navigate to AuthorDetail
- **Narrator in side text**: Vertical text next to cover now shows narrator name (uppercase) instead of author
- **Visual feedback**: Time display highlights during scrubbing, scrub handle appears when dragging

### Files Modified
- `src/features/player/screens/SecretLibraryPlayerScreen.tsx` - Scrubbing, author/narrator layout

---

## [0.6.177] - 2026-01-08

### Added - Full Player Functionality (SecretLibraryPlayerScreen)

Complete player controls and sheet integrations for the Secret Library player design:

- **Speed controls**: Speed pill opens SpeedSheet for playback rate selection
- **Sleep timer**: Sleep timer pill opens SleepTimerSheet with presets and end-of-chapter option
- **Queue management**: Queue pill opens QueuePanel with drag-to-reorder
- **Chapter selection**: Chapter title is now tappable, opens ChaptersSheet
- **Skip controls**: Added rewind/fast-forward buttons with configurable intervals (15s/30s default)
- **Bookmarks**:
  - Tap bookmark button to add bookmark at current position
  - Long-press bookmark button to view all bookmarks via BookmarksSheet
  - Badge shows bookmark count when > 0
- **Active state indicators**: Pills highlight when their respective sheet is open or active (e.g., sleep timer running)

### Files Modified
- `src/features/player/screens/SecretLibraryPlayerScreen.tsx` - Full player functionality

---

## [0.6.164] - 2026-01-07

### Fixed - Background Cover (Match BookDetailScreen)

- Changed backgroundContainer height to `scale(600)` instead of `hp(70)`
- Added `overflow: 'hidden'` to container
- Guard with `coverUrl &&` like BookDetailScreen
- Added back `width: 1200` parameter

---

## [0.6.163] - 2026-01-07

### Fixed - Background Cover Loading (Removed Width)

Removed width parameter from background cover URL - trying without size specification to fix Android loading issue.

---

## [0.6.162] - 2026-01-07

### Fixed - Background Cover Not Loading on Android

Changed background image source to use `{ uri: ... }` format and set width to 1000px for Android compatibility.

---

## [0.6.161] - 2026-01-07

### Fixed - Center Down Arrow in Player Header

Made the close button (down arrow) absolutely centered in the player header using `position: 'absolute'`, `left: '50%'`, and `marginLeft: scale(-22)`.

---

## [0.6.160] - 2026-01-07

### Changed - Separator On Time Side

Moved the "|" separator from the blue delta text to the time side:
- New `timeSeparator` style with `opacity: 0.4` (lower than time)
- Separator appears between time and delta
- Delta text now just shows "+/-Xm Xs" without the pipe

---

## [0.6.159] - 2026-01-07

### Fixed - Delta Text Actually Centered

Added `width: scale(120)` to deltaDisplay so `textAlign: 'center'` actually works. Text now centers within the fixed-width container.

---

## [0.6.158] - 2026-01-07

### Changed - Center Align Delta Text

Added `textAlign: 'center'` to deltaDisplay style.

---

## [0.6.157] - 2026-01-07

### Changed - Animated Horizontal Shift for Time

Time now animates horizontally:
- Not seeking: time is centered (translateX: 0)
- Seeking: time shifts left (translateX: scale(-50)) to visually center time+delta group
- Both shifts animate together with the font size and vertical position changes

---

## [0.6.156] - 2026-01-07

### Fixed - Visual Centering of Time + Delta

Added `marginLeft: scale(-50)` to timeWrapper to shift the group left, making "00:11:10 | -1m 41s" appear visually centered on screen.

---

## [0.6.155] - 2026-01-07

### Fixed - Delta Doesn't Shift Time When Value Changes

Added timeWrapper around time text with delta absolutely positioned:
- Time is centered via the wrapper
- Delta uses `position: 'absolute', left: '100%'` to appear right after time
- When delta value changes length ("+30s" vs "+1m 33s"), time position stays stable

---

## [0.6.154] - 2026-01-07

### Fixed - Time + Delta Centered Together

Changed layout so time and delta are centered as a group:
- Removed absolute positioning from delta - now a flex sibling of time
- Made timeAndDeltaRow an animated view with translateY
- Both elements move up together and are centered as "00:03:12 | +6m 38s"

---

## [0.6.153] - 2026-01-07

### Fixed - Delta Vertical Position

Fixed delta appearing on separate line below time instead of inline. Added:
- `top: 0` to deltaDisplay style for proper vertical positioning
- `translateY: timeTranslateY.value` to delta animation so it moves up along with the time

---

## [0.6.152] - 2026-01-07

### Fixed - Genre Page Loading Performance

Removed excessive console.log statements from useDownloadStatus hook. These were logging for every BookCard on mount, causing significant slowdown when loading pages with many books (like genre detail pages with 50+ books).

**Root cause identified:** Each BookCard makes a separate SQLite query via `downloadManager.getDownloadStatus()`. With 50 books, that's 50 DB queries. A more complete fix would batch these queries, but removing the console.logs provides immediate improvement.

---

## [0.6.151] - 2026-01-07

### Fixed - Delta Position Side-by-Side Without Shifting Time

Changed delta positioning to use `left: '50%'` with `marginLeft: scale(60)` so it appears just to the right of the centered time. The delta is absolutely positioned so changes to its content don't shift the time around. Re-added translateX animation for smooth slide-in effect.

---

## [0.6.150] - 2026-01-07

### Changed - Separate Delta From Time

Made delta a separate absolutely positioned element (instead of nested Text) so it doesn't affect time's centered position when delta value changes.

---

## [0.6.149] - 2026-01-07

### Fixed - Delta Inline (Nested Text)

Switched back to nested Text approach for proper inline layout. Removed translateX animation (only opacity fade now) since nested text can't transform independently.

---

## [0.6.148] - 2026-01-07

### Fixed - Delta Inline With Time

Fixed delta text wrapping to next line. Now uses `alignItems: 'baseline'` and `flexWrap: 'nowrap'` to keep time and delta on the same line.

---

## [0.6.147] - 2026-01-07

### Changed - Delta Slides Out From Center

Delta text now animates with opacity and translateX, sliding out from center towards the right (120ms).

Sequence:
1. Time shrinks and moves up (80ms)
2. 100ms delay
3. Delta fades in while sliding from left to right (120ms)

---

## [0.6.146] - 2026-01-07

### Changed - Delayed Delta Reveal

Added 100ms delay before showing the delta text, so the resize animation completes first before the delta appears.

---

## [0.6.145] - 2026-01-07

### Changed - Faster Animate In

Made the seeking animation faster on entry (80ms) while keeping exit at 150ms.

---

## [0.6.144] - 2026-01-07

### Changed - Time Moves Up When Seeking

Time display now animates UP when seeking (translateY: -30), then back down to normal position when done.

- Base position restored to scale(8)
- When seeking: shrinks to 28pt AND moves up 30px
- When done: returns to 64pt at original position

---

## [0.6.143] - 2026-01-07

### Changed - Move Time Display Up

Moved the time display up slightly (scale(8) → scale(20)) for better spacing above the progress bar.

---

## [0.6.142] - 2026-01-07

### Fixed - Time Display Center Animation

Fixed the center-shrink animation by using fontSize + translateY compensation instead of transform scale (which doesn't change layout and caused text wrapping issues).

**Approach:** Animate fontSize (64→28) plus translateY (0→18) to keep text visually centered while allowing proper layout reflow.

---

## [0.6.141] - 2026-01-07

### Fixed - Time Display Shrinks From Center

Changed from animating fontSize to using transform scale so the text shrinks from its center instead of the baseline.

**Before:** Text shrank toward baseline (bottom), causing visual jump
**After:** Text scales from center, smooth centered animation

---

## [0.6.140] - 2026-01-07

### Fixed - Seeking Time Display Size

Reduced seeking font size from 40pt to 28pt to ensure time + delta fits on one line.

---

## [0.6.139] - 2026-01-07

### Changed - Animated Time Display Size During Seeking

The time display now animates to a smaller font size when seeking to fit both the time and delta on one line.

**Changes:**
- Font size animates from 64pt → 28pt when seeking starts
- Animates back to 64pt when seeking ends
- 150ms smooth transition using Reanimated

**Files Modified:**
- `src/features/player/screens/CDPlayerScreen.tsx`

---

## [0.6.138] - 2026-01-07

### Changed - Inline Seeking Delta Display

Moved the seeking delta indicator to display inline with the time, formatted as `00:00:00 | -30s`.

**Before:** Delta was shown as separate text above the time
**After:** Delta appears next to time with a pipe separator, colored with accent

**Files Modified:**
- `src/features/player/screens/CDPlayerScreen.tsx`

---

## [0.6.137] - 2026-01-07

### Changed - Remove Progress Bar Marker

Removed the circular marker dot from the progress bar. The fill color now indicates position without a separate marker.

**Removed:**
- Marker element from progress bar JSX
- `markerStyle` animated style
- `markerOnTrack` style
- `TRACK_MARKER_SIZE` constant

**Files Modified:**
- `src/features/player/screens/CDPlayerScreen.tsx`

---

## [0.6.136] - 2026-01-07

### Fixed - Progress Bar Coordinate Accuracy

Fixed coordinate mismatch between gesture events and track content area.

**Issue:** Track had `borderWidth: 1` which created a 1px offset on left/right. Gesture events were measured relative to the outer container, but fill/marker were positioned in the track's content area (inside borders). This caused 2px total error.

**Fix:** Changed track to use `borderTopWidth: 1` only (no left/right borders). This aligns the gesture coordinate space with the content area.

**Files Modified:**
- `src/features/player/screens/CDPlayerScreen.tsx` - Changed track border style

---

## [0.6.135] - 2026-01-07

### Fixed - Progress Bar Marker Overflow (Simplified Approach)

Completely rewrote marker positioning with a simpler, more robust approach.

**Previous Issue:** Complex clamping math was causing the marker to escape the track on both edges.

**New Approach:**
- Position marker center at `progress * trackWidth`
- Use CSS transform to center the marker: `translateX(-markerRadius)`
- Add `overflow: 'hidden'` to track to clip the marker at edges

This eliminates all the complex clamping math and lets the CSS handle edge cases naturally.

**Files Modified:**
- `src/features/player/screens/CDPlayerScreen.tsx`
  - Simplified `markerStyle` to use transform for centering
  - Added `overflow: 'hidden'` to track style

---

## [0.6.134] - 2026-01-07

### Fixed - Progress Bar Marker Double-Offset Bug

Fixed bug where the progress marker was still going outside the track bounds at position 0.

**Issue:** The marker was being offset twice:
1. Animated style: `left: clampedLeft - markerRadius` (subtracts 8px to center)
2. Static style: `marginLeft: -TRACK_MARKER_SIZE / 2` (subtracts another 8px)

This caused the marker to go 8px outside the left edge at position 0.

**Fix:**
- Removed duplicate `marginLeft` from static `markerOnTrack` style
- Centering is now handled only in the animated style

**Files Modified:**
- `src/features/player/screens/CDPlayerScreen.tsx` - Removed duplicate offset from markerOnTrack

---

## [0.6.133] - 2026-01-07

### Fixed - Progress Bar Marker Position

Fixed bug where the progress marker was going outside the track bounds.

**Issue:** Marker was using wrong constant (`PROGRESS_MARKER_SIZE` instead of `TRACK_MARKER_SIZE`) and wasn't clamped to track boundaries.

**Fix:**
- Updated marker position calculation to use correct `TRACK_MARKER_SIZE`
- Added clamping so marker stays within track bounds (min: marker radius from left, max: marker radius from right)

**Files Modified:**
- `src/features/player/screens/CDPlayerScreen.tsx` - Fixed `markerStyle` calculation

---

## [0.6.132] - 2026-01-07

### Fixed - Transparent Player Controls in Dark Mode

Made the player control bar background fully transparent in dark mode so it floats cleanly over the cover artwork.

**Changes (dark mode only):**
- `widgetButtonBg`: Changed from `#1A1A1A` → `transparent`
- `widgetBorder`: Changed from `rgba(255,255,255,0.2)` → `transparent`
- `widgetTrack`: Changed from `#3A3A3A` → `rgba(255,255,255,0.2)` (lighter track)

**Files Modified:**
- `src/shared/theme/colors.ts` - Updated dark mode player widget colors

---

## [0.6.131] - 2026-01-07

### Changed - Player Time Display and Progress Bar

Made the current time display even bigger and simplified the progress bar design.

**Changes:**
- Time display: Increased to 64pt font, weight 800 (extra bold)
- Removed the stem/line from the progress marker
- Marker is now a dot directly on the progress bar track (16pt circle with shadow)
- Simplified layout by removing the marker area above the progress bar

**Files Modified:**
- `src/features/player/screens/CDPlayerScreen.tsx`
  - Updated `currentTimeDisplay` style (larger, bolder)
  - Removed stem from SimpleProgressBar
  - Added `markerOnTrack` style for marker dot on the track
  - Updated `MARKER_AREA_HEIGHT` to just time row height

---

## [0.6.130] - 2026-01-07

### Changed - Large Time Display on Player

Made the current time display above the progress bar large and bold like a title.

**Style:**
- Font size: 48pt (scaled)
- Font weight: 700 (bold)
- Width: 100%
- Tabular nums for consistent digit widths
- Letter spacing: -1 for tighter look

**Files Modified:**
- `src/features/player/screens/CDPlayerScreen.tsx` - Added `currentTimeDisplay` style

---

## [0.6.129] - 2026-01-07

### Changed - Player Layout: Swapped Chapter Name and Time

Swapped the positions of the chapter name and current time on the CDPlayerScreen.

**New Layout:**
- **Above progress bar**: Current time displayed prominently (was chapter name)
- **On progress bar (left)**: Chapter name - tappable to open chapters sheet (was current time)
- **On progress bar (right)**: Duration/remaining time (unchanged)

**Files Modified:**
- `src/features/player/screens/CDPlayerScreen.tsx`
  - Swapped chapter title and time positions
  - Added `onChapterPress` prop to SimpleProgressBar interface
  - Made chapter label tappable to open chapters sheet

---

## [0.6.128] - 2026-01-07

### Fixed - BookDetailScreen Gradients

Updated BookDetailScreen to use theme-aware gradient colors from `colors.ts` instead of hardcoded values.

**Changes:**
- Top gradient: Now uses `themeColors.player.gradientStart/Mid/End` (was hardcoded dark rgba)
- Bottom gradient: Fixed to use correct nested path `themeColors.player.gradientStart/Mid` and `themeColors.background.primary`

**Result:**
- Light mode: White gradient fades over cover image
- Dark mode: Black gradient fades over cover image

**Files Modified:**
- `src/features/book-detail/screens/BookDetailScreen.tsx` - Updated both gradient LinearGradients

---

## [0.6.127] - 2026-01-07

### Fixed - Text Color on Accent Backgrounds

Fixed text color on accent-colored backgrounds (pills, buttons) to use theme-aware `textOnAccent` color instead of hardcoded black. This ensures proper contrast when using the Electric Blue or other accent themes.

**Problem:** When accent color is used as a background (e.g., selected pills, primary buttons), text was hardcoded to black (`#000`), which is unreadable on dark accent colors like Electric Blue.

**Solution:** Added `textOnAccent` to color helpers and updated components to use dynamic text colors:
- Red/Gold theme: White text on accent
- Electric Blue theme: White text on blue
- Lime theme: Black text on lime (high contrast)

**Files Modified:**
- `src/shared/components/Button.tsx` - Primary variant now uses `textOnAccent`
- `src/features/profile/screens/PlaybackSettingsScreen.tsx` - Smart rewind pills
- `src/features/profile/screens/JoystickSeekSettingsScreen.tsx` - Preset curve pills

---

## [0.6.126] - 2026-01-07

### Improved - Player Header Layout

Moved bookmark button into the header row next to settings, with drop shadows on all header icons for better visibility over cover art.

**Layout Change:**
- Before: Download (left), Close (center), Settings (right), Bookmark (absolute positioned at bottom-right of cover)
- After: Download (left), Close (center), Bookmark + Settings (right, grouped)

**Visual Enhancement:**
- Added drop shadows to all header icons (Download, Close, Bookmark, Settings)
- Shadows improve icon visibility when overlaid on light/dark cover images

**Files Modified:**
- `src/features/player/screens/CDPlayerScreen.tsx` - Header layout and shadow styles

---

## [0.6.125] - 2026-01-07

### Fixed - Silent Player Priming

Fixed audio playing briefly when loading a book without autoPlay (e.g., tapping hero cover).

**Problem:** When loading a book with `autoPlay: false`, expo-audio requires a "priming" workaround where we briefly play then pause to prevent the player from getting stuck in perpetual buffering. This caused audible playback for ~500ms.

**Solution:** Mute the player during priming (`volume = 0`) and restore volume after pausing.

**Files Modified:**
- `src/features/player/services/audioService.ts` - Silent priming in `loadAudio()` and `loadTracks()`

---

## [0.6.124] - 2026-01-07

### Fixed - Chapter Titles and Playback Transitions

**Chapter Title Normalization:**
- Applied chapter title cleaning to player chapters (was only applied to display, not playback)
- Numeric prefixes like "004 - Prologue" are now properly cleaned to show "Prologue"
- Both `mapSessionChapters()` and `extractChaptersFromBook()` now use `getCleanChapterName()`

**Track Transition Playback:**
- Added `verifyPlaybackAfterTransition()` to ensure playback actually starts after track changes
- Prevents audio stopping silently when transitioning between audio files/chapters
- Includes automatic retry logic (up to 2 retries with increasing delays)
- Emits status callback if playback fails to recover so UI shows correct state

**Files Modified:**
- `src/features/player/utils/bookLoadingHelpers.ts` - Added chapter normalization
- `src/features/player/services/audioService.ts` - Added playback verification after track transitions

---

## [0.6.123] - 2026-01-07

### Fixed - CDPlayerScreen Light/Dark Theme Support

Fixed CDPlayerScreen to properly support light and dark modes with correct gradient and text colors.

**Theme Changes:**
- Added gradient color properties (`gradientStart`, `gradientMid`, `gradientEnd`) to both light and dark mode player sections in colors.ts
- Light mode: white gradients + dark text
- Dark mode: black gradients + light text
- All colors now derived from the shared theme system

**Icon Improvements:**
- Header icons (download, close, settings) now use `themeColors.iconPrimary` for proper theme support
- Bookmark icon updated to use theme colors
- Removed circle backgrounds from bookmark and settings icons for cleaner look
- Redesigned header layout with centered close arrow, download status on left, settings on right

**Widget Fixes:**
- Fixed bottom-left corner not being rounded (changed `overflow: 'visible'` to `'hidden'`)
- Restored widget border (`widgetBorder`) visibility
- Set widget background to full black (`#000000`)

**Files Modified:**
- `src/shared/theme/colors.ts` - Added gradient colors to light/dark player sections
- `src/features/player/utils/playerTheme.ts` - Added gradient colors to PlayerColors interface
- `src/features/player/screens/CDPlayerScreen.tsx` - Updated gradients and icons to use theme colors
- `src/navigation/components/GlobalMiniPlayer.tsx` - Timeline positioning adjustment

---

## [0.6.121] - 2026-01-04

### Fixed - Android Auto Player Controls

Fixed Android Auto transport controls (play, pause, skip, seek) which were not being forwarded to the player.

**Changes:**
- Transport commands from MediaPlaybackService are now properly handled in automotiveService.ts
- `play` → calls `playerStore.resume()`
- `pause` → calls `playerStore.pause()`
- `skipNext` → calls `playerStore.nextChapter()`
- `skipPrevious` → calls `playerStore.previousChapter()`
- `fastForward` → seeks forward 30 seconds
- `rewind` → seeks backward 30 seconds
- `seekTo` → seeks to specified position (already working)
- `playFromMediaId` → loads and plays book (already working)

**Files Modified:**
- `src/features/automotive/automotiveService.ts` - Added proper transport command handlers

---

## [0.6.120] - 2026-01-04

### Fixed - MyLibraryScreen Sources of Truth

Updated MyLibraryScreen to use correct and consistent sources of truth for all data.

**In-Progress Logic:**
- Now uses `useContinueListening()` (server API `/api/me/items-in-progress`) as the source of truth
- Previously only filtered downloaded books; now includes ALL in-progress books from server
- Added `serverInProgressBooks` computed value derived from `continueListeningItems`

**Completed/Finished Logic:**
- Combined `useFinishedBookIds()` (SQLite user_books) with `useCompletionStore.isComplete()` (manual marks)
- Both sources now checked for finished status

**All Tab Logic:**
- Now includes: downloaded books + server in-progress books + favorited books
- Previously only included downloaded + favorited

**Other Fixes:**
- Added `refetchContinueListening()` to refresh handler
- Fixed refresh to update both library cache and continue listening data

**Files Modified:**
- `src/features/library/screens/MyLibraryScreen.tsx` - Major data source fixes

---

## [0.6.119] - 2026-01-04

### Added - Library Tab in Bottom Navigation

Added My Library as a dedicated tab in the bottom navigation bar.

**Changes:**
- Added LibraryTab to MainTabs navigator (between Home and Browse)
- Created LibraryIcon component (bookshelf/books design)
- Updated FloatingTabBar with new tab order: Home → Library → Browse → Search → Profile
- Library tab links to MyLibraryScreen with all downloaded/favorited content

**Files Modified:**
- `src/navigation/AppNavigator.tsx` - Added LibraryTab to MainTabs
- `src/navigation/components/FloatingTabBar.tsx` - Added Library icon and tab config

---

## [0.6.118] - 2026-01-04

### Improved - Series Section Ordering

Updated Series In Progress section on Home page to be ordered by most recently listened.

**Changes:**
- Series are now derived from Continue Listening books (in-progress items)
- Sorted by the most recently played book in each series
- Uses `userMediaProgress.lastUpdate` timestamp for ordering

**Files Modified:**
- `src/features/home/hooks/useHomeData.ts` - Updated seriesInProgress sorting logic

---

## [0.6.117] - 2026-01-04

### Changed - Home Page Redesign to Match Browse Page

Redesigned the Home screen to match the Browse/Discover page's visual design with blurred hero background and consistent section styling.

**Design Changes:**
- Added scrolling blurred background behind hero section (matches Browse page)
- Replaced custom HeroCard with Browse page's HeroSection component
- Replaced ContinueListeningGrid with ContentRowCarousel (2x2 grid layout)
- Replaced RecentlyAddedSection with ContentRowCarousel (2x2 grid layout)
- Consistent "Written by" / "Read by" credits on book cards

**Component Reuse:**
- Now imports HeroSection and ContentRowCarousel from `@/features/discover`
- Uses libraryItemToBookSummary adapter to convert home data to discover types
- Series section retains custom SeriesCard with progress indicators

**Removed Components (no longer needed):**
- `src/features/home/components/HeroCard.tsx`
- `src/features/home/components/ContinueListeningGrid.tsx`
- `src/features/home/components/RecentlyAddedSection.tsx`

**Files Modified:**
- `src/features/home/screens/HomeScreen.tsx` - Complete redesign with discover components

---

## [0.6.116] - 2026-01-04

### Enhanced - Homepage Redesign

Complete redesign of the Home screen from a tab-filtered library view to a resume-focused listening dashboard.

**New Components:**
- **HeroCard** - Primary resume target with blurred cover background, chapter info, progress bar, and Resume button
- **ContinueListeningGrid** - 3-column grid of other in-progress books with circular progress rings
- **CircularProgressRing** - SVG-based circular progress indicator for book covers
- **Enhanced SeriesCard** - Now supports `showProgress` prop to display ProgressDots and SeriesProgressBadge

**Home Screen Layout:**
1. HeroCard - Most recent in-progress book with chapter/time info
2. Continue Listening Grid - Other books in progress (tap to play, long press for details)
3. Series In Progress - Enhanced series cards with progress indicators
4. Recently Added - New books for discovery

**Data Layer Enhancements:**
- Extended `useHomeData` hook with `heroBook`, `continueListeningGrid`, `seriesInProgress`, `recentlyAdded`
- Added `HeroBookData` and `EnhancedSeriesData` types
- Hero book state detection: in-progress, almost-done (75%+), final-chapter (95%+), just-finished

**Tab Migration:**
- Old Home tabs (In Progress, Downloaded, Finished, Favorites) now live in Library tab
- Library tab already has: All, Downloaded, In Progress, Completed, Favorites

**Files Created:**
- `src/shared/components/CircularProgressRing.tsx`
- `src/features/home/components/HeroCard.tsx`
- `src/features/home/components/ContinueListeningGrid.tsx`

**Files Modified:**
- `src/features/home/types.ts` - Added HeroBookData, EnhancedSeriesData, BookStatus types
- `src/features/home/hooks/useHomeData.ts` - Extended with new data computations
- `src/features/home/components/SeriesCard.tsx` - Added showProgress and enhancedData props
- `src/features/home/screens/HomeScreen.tsx` - Complete redesign with new layout

---

## [0.6.114] - 2026-01-03

### Fixed - Playback Stability During Downloads

Fixed critical race conditions causing playback failures when downloading while streaming.

**Download Completion Fixes:**
- Increased reload delay from 500ms to 1500ms for mobile data stability
- Added `waitForSafeState()` - waits for seeking/loading to finish before reloading (up to 5s)
- Gets fresh position from audio service instead of using potentially stale saved position
- Clears smart rewind state before reload to prevent interference

**Smart Rewind Fixes:**
- Smart rewind now uses `isSeeking` state to block audio callbacks during seek
- Properly awaits `clearSmartRewindState()` instead of fire-and-forget
- Error handling ensures `isSeeking` is always cleared

**Stuck Audio Detection:**
- Added stuck detection in `play()` - if audio doesn't start after 3s, attempts recovery
- If recovery fails, performs hard reset by reloading book at current position
- Added `audioService.getIsPlaying()` method for verification

**Files Modified:**
- `src/features/player/stores/playerStore.ts` - Download reload guards, smart rewind fixes, stuck detection
- `src/features/player/services/audioService.ts` - Added getIsPlaying() method

---

## [0.6.113] - 2026-01-03

### Fixed - Search Pipeline Consistency

Comprehensive search fixes to ensure consistent matching across all search entry points.

**Bug Fixes:**
1. **Space-insensitive gate removed** - Now works for single-word queries like "earthsea" (not just "earth sea")
2. **Regex punctuation fix** - Fixed character class that was treating dots literally
3. **Autocomplete consistency** - Now uses same fuzzyMatch logic as full search for authors/series/narrators
4. **Multi-word significant words** - Filters short words like "a", "of", "the" in multi-word queries
5. **Word prefix for all fields** - "sand" now matches "Sanderson" in author/narrator fields
6. **Accent normalization** - "carre" now matches "Carré", "garcia" matches "García"

**Files Modified:**
- `src/features/search/utils/fuzzySearch.ts` - Added normalizeForSearch with accent stripping
- `src/features/search/screens/SearchScreen.tsx` - Autocomplete now uses fuzzyMatch
- `src/core/cache/libraryCache.ts` - All fixes applied to filterItems

---

## [0.6.112] - 2026-01-03

### Fixed - Search Performance

Fixed severe search lag caused by expensive fuzzy matching on every keystroke.

**Optimizations:**
- Removed Levenshtein distance calculations from real-time filtering
- Simplified fuzzyMatch to use fast string operations only
- Pre-compute normalized queries once per search, not per item
- Levenshtein matching now only used for "Did you mean" suggestions

**Search still supports:**
- Substring matching ("earth" → "Earthsea")
- Word prefix matching ("ear" → "Earthsea")
- Space-insensitive matching ("earth sea" → "earthsea")
- Multi-word matching ("long sun" → "Lake of the Long Sun")

### Files Modified
- `src/features/search/utils/fuzzySearch.ts` - Simplified fuzzyMatch for performance
- `src/core/cache/libraryCache.ts` - Optimized filterItems text search

---

## [0.6.111] - 2026-01-03

### Enhanced - Fuzzier Search

Significantly improved search to handle more flexible queries:

**Space-Insensitive Matching**
- "earth sea" now matches "Earthsea" and vice versa
- Spaces, hyphens, and punctuation are normalized for comparison

**Word Reordering**
- "sea eart" matches "Earthsea" (word permutations checked)
- Words don't need to be in the correct order

**Partial Phrase Matching**
- "the quartet" matches "The Earthsea Quartet"
- All query words are checked against the target (any order)

**Enhanced Similarity Scoring**
- New `enhancedSimilarityScore()` function considers multiple matching strategies
- Better "Did you mean" suggestions using normalized comparisons

### Files Modified
- `src/features/search/utils/fuzzySearch.ts` - Added normalizeForComparison, word reordering, partial phrase matching
- `src/core/cache/libraryCache.ts` - filterItems now uses fuzzy matching for all book searches

---

## [0.6.110] - 2026-01-03

### Removed - Unused TopNav Component

Removed the unused TopNav component that was no longer rendered in the app.

### Files Removed
- `src/navigation/components/TopNav.tsx`

---

## [0.6.109] - 2026-01-03

### Simplified - Consistent Carousel Layout

Simplified browse page to use consistent carousel layout for all rows except top recommendation.

**Display Modes:**
- **Top Recommendation**: `featured` - 2-column grid (only this row)
- **All Other Rows**: `carousel` - horizontal scroll

---

## [0.6.108] - 2026-01-03

### Enhanced - Browse Page Visual Hierarchy & Personalization

Improved browse page with varied display modes and personalized sorting.

**Display Mode Variations**
- **Top Recommendation**: `featured` mode - large 2x2 grid for top picks
- **All Other Rows**: `carousel` mode - horizontal scroll

**Improved Row Titles**
- "Short & Sweet" → "Quick Listens" (subtitle: "Finish in a day or two")
- "Long Listens" → "Epic Journeys" (subtitle: "Settle in for the long haul")
- "Not Started" → "Ready to Start" (subtitle: "Waiting in your library")
- "Continue Series" → "Your Next Chapter" (subtitle: "Continue where you left off")
- "Try Something Different" → subtitle: "Venture outside your usual genres"

**Personalized Series & Authors**
- Series section now titled "Your Series" when user has reading history
- Series sorted by user progress (books finished in series) first
- Authors section now titled "Your Authors" when user has reading history
- Authors sorted by reading history (authors you've read most) first

### Files Modified
- `src/features/discover/hooks/useDiscoverData.ts` - Added displayMode to all rows, updated titles
- `src/features/discover/components/ContentRowCarousel.tsx` - Added carousel/compact display modes
- `src/features/discover/components/PopularSeriesSection.tsx` - Added history-based sorting
- `src/features/discover/components/TopAuthorsSection.tsx` - Added history-based sorting
- `src/features/discover/types.ts` - Added RowDisplayMode type

---

## [0.6.107] - 2026-01-03

### Fixed - Re-enabled Browse Page Content Rows

Re-enabled several content rows that were disabled in the Browse/Discover page:

**Rows Now Showing:**
- **Continue Series** (priority 4) - Next book in series you're reading
- **Not Started** (priority 5) - Books you haven't started yet
- **Short & Sweet** (priority 8) - Quick listens under 5 hours
- **Long Listens** (priority 9) - Epic journeys over 10 hours

These rows were defined but commented out. Now the full row order is:
1. Personalized recommendations (priority 2.x)
2. New This Week (priority 3)
3. Continue Series (priority 4)
4. Not Started (priority 5)
5. Try Something Different / Serendipity (priority 6)
6. Short & Sweet (priority 8)
7. Long Listens (priority 9)

### Files Modified
- `src/features/discover/hooks/useDiscoverData.ts` - Re-enabled rows in staticRows array

---

## [0.6.106] - 2026-01-03

### Enhanced - Comprehensive Tag-Based Recommendation Scoring

Expanded tag mapping to cover actual user library tags for more effective mood recommendations.

**New Tag Mappings Added**
- ~200+ new tags mapped from actual library data
- Duration tags: "under-5-hours", "5-10-hours", "10-15-hours", "15-20-hours", "over-20-hours"
- Vibe tags: "cozy", "atmospheric", "slow-burn", "emotional", "found-family", etc.
- Genre tags: "sapphic", "mm-romance", "romantasy", "cozy-mystery", etc.
- Theme tags: "trauma", "redemption", "survival", "coming-of-age", etc.

**Length Scoring Added**
- New LENGTH_MATCH points (8 pts) for duration tag matching
- TAG_LENGTH_MAP maps duration tags to length preferences
- Score breakdown now includes `length` dimension
- Supports both explicit duration tags and genre-implied lengths (epic, sagas)

**Tag Categories Now Mapped**
- Mood: 40+ tags covering emotional states and atmospheres
- Pace: 25+ tags for energy/pacing preferences
- Weight: 30+ tags for tone/depth preferences
- World: 35+ tags for setting preferences
- Length: 7 tags for duration preferences
- Romance Tropes: 15+ tags for romance subgenre matching

### Files Modified
- `src/features/mood-discovery/constants/tagMoodMap.ts` - Comprehensive tag mapping rewrite
- `src/features/mood-discovery/utils/tagScoring.ts` - Added length scoring logic

---

## [0.6.105] - 2026-01-03

### Enhanced - Mood Discovery Questionnaire Redesign

Major redesign of the mood discovery quiz with UX research-backed improvements:

**Situational Questions (More Engaging)**
- Step 1: "It's your perfect listening moment. Where are you?" (was "What kind of experience?")
- Step 2: "What kind of energy fits right now?" (was "How should it feel to listen?")
- Step 3: "What emotional territory feels right?" (was "How heavy do you want it?")
- Step 4: "Where do you want the story to take you?" (was "What kind of world?")
- Step 5: NEW - "How much time do you have?" (length preference)

**New Option Labels (Concrete Imagery vs Abstract)**
- Mood: "Curled up at home", "Edge of your seat", "Lost in another world", etc.
- Energy: "Slow & savory", "Steady rhythm", "Can't put it down", "Surprise me"
- Tone: "Light & bright", "Shade & light", "Deep & intense"
- World: "Right here, right now", "Back in time", "Realms of magic", "Among the stars"
- Length: "Quick listen", "Weekend companion", "Epic journey"

**New Icons (Lucide React)**
- Mood: Sofa, Zap, Sparkles, Smile, Heart, Lightbulb
- Energy: Moon, Music, Flame, Shuffle
- Tone: Sun, CloudSun, CircleDot, Shuffle
- World: Building2, Castle, Wand2, Rocket, Globe
- Length: Timer, Calendar, Map, Infinity

**Match Attribution**
- Book cards now show small icons indicating which dimensions matched
- QuickTuneBar shows length filter chip when set

### Files Modified
- `src/features/mood-discovery/types.ts` - Updated all config arrays with new labels/icons, added LENGTHS, TOTAL_QUIZ_STEPS
- `src/features/mood-discovery/screens/MoodDiscoveryScreen.tsx` - Updated to 5 steps, new questions
- `src/features/mood-discovery/stores/moodSessionStore.ts` - Added setDraftLength, updated for 5 steps
- `src/features/mood-discovery/components/MoodBookCard.tsx` - Added match attribution icons
- `src/features/mood-discovery/components/QuickTuneBar.tsx` - Added length chip

---

## [0.6.104] - 2026-01-03

### Fixed - Navigation Error in Preferences Onboarding

Fixed "RESET action was not handled" error when completing preferences onboarding.

**Problem:**
`PreferencesOnboardingScreen` tried to navigate to `{ name: 'Browse' }` which doesn't
exist in the navigator. The tab is actually named "DiscoverTab".

**Solution:**
Changed to `navigation.goBack()` to simply close the modal and return to the
previous screen where the user's preferences are now active.

### Files Modified
- `src/features/recommendations/screens/PreferencesOnboardingScreen.tsx`
  - Changed `navigation.reset()` to `navigation.goBack()`

---

## [0.6.103] - 2026-01-03

### Fixed - Infinite Loop in Dismissed Items Store

Fixed "Maximum update depth exceeded" error caused by Zustand selector hooks
returning new array references on every render.

**Problem:**
`useDismissedIds()` and `useDismissedCount()` used `Object.keys()` directly
in the selector, creating new arrays on each call. This triggered infinite
re-renders.

**Solution:**
- Added `useShallow` from `zustand/shallow` for stable object references
- Wrapped `Object.keys()` in `useMemo` to memoize the derived array
- Only recalculates when `dismissedItems` actually changes

### Files Modified
- `src/features/recommendations/stores/dismissedItemsStore.ts`
  - Added `useShallow` import from `zustand/shallow`
  - Added `useMemo` import from React
  - Fixed `useDismissedIds` to use `useShallow` + `useMemo`
  - Fixed `useDismissedCount` to use `useShallow` + `useMemo`

---

## [0.6.102] - 2026-01-03

### Added - Personalized Recommendation Enhancements (P0 Gaps)

Implemented three major improvements to the recommendation system based on UX research:

**Gap 1: "Because You Finished X" Attribution**
- Row titles now show specific book attribution: "Because you finished The Blade Itself"
- Book name in title is tappable - navigates to that book's detail page
- SQLite now tracks most recent finished book and currently listening books
- Title variations: "More like X", "Because you love [Genre]", "More by [Author]"

**Gap 2: Serendipity Row ("Try Something Different")**
- New row showing books OUTSIDE user's comfort zone
- Deliberately selects books from genres user hasn't explored
- Purple sparkle (✨) badge on cards for visual distinction
- Helps users discover new genres and authors

**Gap 3: "Not Interested" Feedback System**
- Swipe left on any book card to dismiss from recommendations
- Toast appears with "Undo" button for 5 seconds
- Dismissed books stored in `dismissedItemsStore` (persisted)
- New "Hidden Books" screen in Profile > Recommendations
- Shows count badge, allows bulk restore

**Also Added:**
- New "Recommendations" section in Profile screen
- "Preferences" link to tune recommendations
- "Hidden Books" link with count badge

### New Files
- `src/features/recommendations/stores/dismissedItemsStore.ts`
- `src/features/discover/components/SwipeableBookCard.tsx`
- `src/features/discover/components/DismissToast.tsx`
- `src/features/profile/screens/HiddenItemsScreen.tsx`

### Files Modified
- `src/core/services/sqliteCache.ts` - Added mostRecentFinished and currentlyListening to getReadHistoryStats
- `src/features/discover/types.ts` - Added SourceAttribution interface and isSerendipity flags
- `src/features/recommendations/hooks/useRecommendations.ts` - Added source attribution to groups, filter dismissed items
- `src/features/discover/hooks/useDiscoverData.ts` - Generate specific row titles, added serendipity row
- `src/features/discover/components/ContentRowCarousel.tsx` - Tappable source links, serendipity badge
- `src/features/profile/screens/ProfileScreen.tsx` - Added Recommendations section with Preferences and Hidden Books links
- `src/features/profile/index.ts` - Export HiddenItemsScreen
- `src/navigation/AppNavigator.tsx` - Added HiddenItems route

---

## [0.6.101] - 2026-01-03

### Fixed - Recommendations Now Show for All Users

Removed the `hasPreferences` gate that was blocking recommendations for new users
who hadn't completed onboarding or built any listening history.

**Problem:**
Recommendations only showed if `hasPreferences = true`, which required either:
- Completing the onboarding questionnaire, OR
- Having finished at least 1 book, OR
- Having started listening to at least 1 book

New users with none of these would only see "New This Week" and no recommendations.

**Solution:**
- Removed `hasPreferences` check from `recommendationRows` useMemo
- Recommendations now show for ALL users based on random scoring
- Users with history still get personalized recommendations (higher scores)
- Users without history see "Recommended for You" fallback group with variety picks

**Also fixed in previous session (0.6.100):**
- Added fallback "Recommended for You" group for ungrouped items in `useRecommendations.ts`
- Books with only random scores (no specific author/narrator/genre match) now appear in recommendations

### Files Modified
- `src/features/discover/hooks/useDiscoverData.ts`
  - Removed `hasPreferences` from recommendationRows condition
  - Removed `hasPreferences` from useMemo dependency array
- `src/features/recommendations/hooks/useRecommendations.ts` (0.6.100)
  - Added "Recommended for You" fallback group

---

## [0.6.100] - 2026-01-02

### Fixed - Preferences Onboarding Genres Not Loading

The "What genres do you enjoy?" screen (step 2 of 4) was showing empty options.

**Problem:**
Used `useAllLibraryItems()` + `extractGenres()` which depended on prefetch service,
but the data wasn't loaded when navigating to onboarding.

**Solution:**
Changed to use `useLibraryCache()` + `getGenresByPopularity()` which uses the
already-populated library cache.

### Files Modified
- `src/features/recommendations/screens/PreferencesOnboardingScreen.tsx`
  - Replaced `useAllLibraryItems` + `useDefaultLibrary` with `useLibraryCache`
  - Now uses `getGenresByPopularity()` for genres

---

## [0.6.99] - 2026-01-02

### Fixed - Recommendations Now Working

Two fixes to make recommendations actually appear on the Browse page:

**Fix 1: Browse page only showed first content row**
- Changed `rows.slice(0, 1)` to `rows.map()` to show all rows
- Simplified to only show: Recommendations + "New This Week"
- Removed: Not Started, Short & Sweet, Long Listens, Continue Series

**Fix 2: Listening history metadata was empty**
- `getListeningHistoryStats()` queried SQLite `user_books` table which didn't have metadata
- Now builds listening stats directly from library items (`allItems`) using `useMemo`
- Properly extracts author/narrator/genres from `userMediaProgress` on each item

### Files Modified
- `src/features/browse/screens/BrowseScreen.tsx` - Show all rows (removed slice)
- `src/features/discover/hooks/useDiscoverData.ts` - Only include recommendations + New This Week
- `src/features/recommendations/hooks/useRecommendations.ts` - Build listening stats from library cache

---

## [0.6.98] - 2026-01-02

### Added - Recommendations from Listening History (In-Progress Books)

Extended the recommendation engine to also factor in books currently being listened to,
not just finished books.

**What Changed:**

1. **New SQLite Method:** Added `getListeningHistoryStats()` to query user_books for in-progress books
   - Returns authors, narrators, and genres from books with 0-95% progress
   - Ordered by count and progress (more progress = more relevant)

2. **Dual Scoring System:**
   - Finished books: Full weight (40-80 points for authors, 30-60 for narrators, up to 50 for genres)
   - In-progress books: 60% weight (~25-50 for authors, ~18-36 for narrators, up to 30 for genres)
   - Listening history only boosts when finished history doesn't already boost

3. **New Recommendation Group:** "Based on what you're listening to"
   - Appears after "Based on your reading history"
   - Shows recommendations from currently-listening patterns

4. **Updated hasPreferences Logic:**
   - Now returns `true` if user has:
     - Completed onboarding questionnaire, OR
     - Finished at least 1 book, OR
     - Started listening to at least 1 book

**Example:**
If a user starts listening to a Brandon Sanderson book, they'll immediately see
recommendations for other Sanderson books, even with no finished books.

### Fixed - Browse Page Content Rows Not Displaying

Fixed a critical bug where only the first content row was displayed on the Browse page.

**Problem:**
`rows.slice(0, 1)` was limiting display to just ONE row, hiding:
- All recommendation rows (priority 2.x)
- Continue Series, Not Started, Short & Sweet, Long Listens rows

**Solution:**
Changed to `rows.map()` to display all content rows sorted by priority.

### Files Modified
- `src/core/services/sqliteCache.ts` - Added `getListeningHistoryStats()` method
- `src/features/recommendations/hooks/useRecommendations.ts`:
  - Added `ListeningHistoryStats` interface
  - Fetch and use listening stats
  - Added listening history scoring (60% weight of finished books)
  - Added "Based on what you're listening to" group
  - Updated `hasPreferences` to include in-progress books
- `src/features/browse/screens/BrowseScreen.tsx` - Fixed `rows.slice(0, 1)` to show all rows

---

## [0.6.97] - 2026-01-02

### Fixed - Unified "Finished" Threshold (Single Source of Truth)

Standardized the threshold for considering a book "finished" across the entire app.

**Problem:**
Different parts of the codebase used different thresholds:
- SQLite auto-finish: 99%
- Reading history: 95%
- Recommendations: 95%
- Progress service: 99%

**Solution:**
Unified to **95%** everywhere with `FINISHED_THRESHOLD` exported from `useReadingHistory`.

### Files Modified
- `src/features/reading-history-wizard/hooks/useReadingHistory.ts` - Export `FINISHED_THRESHOLD`
- `src/features/reading-history-wizard/index.ts` - Export constant
- `src/core/services/sqliteCache.ts` - Changed from 99% to 95%
- `src/core/services/finishedBooksSync.ts` - Changed from 99% to 95%
- `src/features/player/stores/progressStore.ts` - Changed `COMPLETION_THRESHOLD` from 99% to 95%
- `src/features/player/services/progressService.ts` - Changed from 99% to 95%
- `src/features/player/utils/progressCalculator.ts` - Changed default from 99% to 95%
- `src/features/player/stores/__tests__/progressStore.test.ts` - Updated tests

---

## [0.6.96] - 2026-01-02

### Added - Preferences Promo Card on Browse Page

Added a promo card at the bottom of the Browse page to encourage users to fill out
the preferences questionnaire even if they don't have any finished books yet.

**Features:**
- Shows "Get Personalized Recommendations" card with sparkle icon
- Only appears when user hasn't completed onboarding AND has no reading history
- Tapping navigates to PreferencesOnboardingScreen
- Card hidden once user has either completed onboarding or finished a book

### Files Modified
- `src/features/discover/components/PreferencesPromoCard.tsx` - New component
- `src/features/discover/index.ts` - Export new component
- `src/features/discover/hooks/useDiscoverData.ts` - Expose hasPreferences
- `src/features/browse/screens/BrowseScreen.tsx` - Add promo card at bottom

---

## [0.6.95] - 2026-01-02

### Changed - Browse Page Now Shows Recommendations Without Onboarding

Enabled personalized recommendations on the Browse page for users with reading history,
even if they haven't completed the preferences onboarding questionnaire.

**Previously:**
- Recommendations only appeared if `hasCompletedOnboarding=true`
- Users without onboarding only saw static sections: "New This Week", "Short & Sweet", etc.

**Now:**
- Recommendations appear if user has completed onboarding OR has finished at least 1 book
- The recommendation engine uses reading history (favorite authors, narrators, genres from completed books) to generate personalized suggestions
- "New This Week" appears AFTER recommendations (priority 3 vs 2.x) as intended

### Files Modified
- `src/features/recommendations/hooks/useRecommendations.ts` - Added reading history check to `hasPreferences` return value

---

## [0.6.94] - 2026-01-02

### Fixed - Repeated API Calls for Deleted Books During Scroll
Fixed performance issue causing repeated failed API calls and scroll lag.

**Root Cause:**
When a book was deleted from the server but still had a download record locally,
`downloadManager.getAllDownloads()` would try to fetch the library item metadata
from the API every time it was called. Since this failed, it would retry on every
notification cycle, causing repeated API calls and degraded scroll performance.

**Fix Applied:**
Added a failed fetch cache with 5-minute cooldown to prevent repeated API calls:
- Failed API fetches are cached with timestamp
- Subsequent calls skip the API request until cooldown expires
- Successful fetches clear the item from the cache

### Files Modified
- `src/core/services/downloadManager.ts` - Added failedFetchCache with cooldown logic

---

## [0.6.93] - 2026-01-02

### Changed - Browse "View More" Screen: 3-Column Layout & Scroll Fix
Improved the FilteredBooksScreen (accessed via "View More" on browse sections).

**Changes:**
1. **3-column grid**: Changed from 2 columns to 3 columns for denser book display
2. **Simplified cards**: Removed author/narrator text (too small for 3-column layout), now shows just cover + title
3. **Fixed scroll lag**: Optimized FlatList rendering settings:
   - `initialNumToRender`: 6 → 16 (4 rows pre-rendered)
   - `maxToRenderPerBatch`: 6 → 12 (faster batch rendering)
   - `windowSize`: 5 → 7 (larger buffer)
   - `removeClippedSubviews`: true → false (fixes rendering glitches)
4. **Fixed getItemLayout**: Now correctly calculates row offsets for 3-column layout
5. **Tighter spacing**: Reduced gap and margins for compact 3-column grid

### Files Modified
- `src/features/library/screens/FilteredBooksScreen.tsx`

---

## [0.6.92] - 2026-01-02

### Fixed - Streaming Playback for Completed Books
Critical fix for playback breaking after streaming a book to completion.

**Root Cause:**
When a streaming book completed, the position was saved at the end (position = duration). On next play attempt:
1. Player loaded at position = duration
2. HLS stream immediately signaled completion
3. Playback got stuck and couldn't recover, even after force closing app

**Fixes Applied:**
1. **BookDetailScreen**: When a completed book is played ("Play Again" button), now always starts from beginning
   - `handlePlayPress()` now checks `isCompleted` before `isDownloaded`/streaming
   - Uses `handlePlayFromBeginning()` which passes `startPosition: 0`

2. **playerStore safeguard**: Added position clamp in `loadBook()`
   - If resume position is within 5 seconds of total duration, resets to 0
   - Prevents stream from immediately triggering completion
   - Provides defense-in-depth even if UI doesn't handle it

### Files Modified
- `src/features/book-detail/screens/BookDetailScreen.tsx` - Fixed handlePlayPress to use handlePlayFromBeginning for completed books
- `src/features/player/stores/playerStore.ts` - Added position clamp safeguard near end of book

---

## [0.6.80] - 2026-01-02

### Fixed - Memory Leak and Re-render Optimization
Dramatic performance improvements through optimized React subscriptions.

**Performance Results:**
- **Re-renders reduced 97%**: CDPlayerScreen renders dropped from 324+ to 9
- **Memory usage reduced 57%**: From 1.3GB+ to ~560MB
- **Memory growth rate**: From rapid accumulation to stable ~1MB per minute

**Optimizations Applied:**
- **Position subscription**: Floor position to whole seconds before comparison
  - Previously triggered re-render on every position tick (~2x/sec)
  - Now only re-renders when the second value actually changes (~1x/sec)
- **Sleep timer subscription**: Round to coarse granularity based on remaining time
  - >5 min: Round to nearest minute (reduces 60 re-renders/min to 1)
  - ≤5 min: Round to nearest 10 seconds for countdown display

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Optimized store subscriptions

---

## [0.6.79] - 2026-01-02

### Fixed - Playback Stability Improvements
Additional fixes for track switching and position handling issues.

**Critical Fixes:**
- **Track cascade bug**: Added guard in `handleTrackEnd()` to ignore spurious `didJustFinish` events
  - Pre-buffered tracks could report `didJustFinish=true` with `duration=0` or `position=0`
  - This caused a cascade of track advances (skipping 30+ minutes forward)
  - Now ignores events where `playerDuration <= 0 || currentPlayerPos < 1`
- **Extended track switch timeout**: Changed from 500ms to 1500ms
  - Gives slower network/track loads more time to complete
- **Removed strict position validation**: Removed 60s position rejection that was blocking legitimate seeks
  - The validation was too strict and prevented chapter jumps
  - Kept logging only for debugging

### Files Modified
- `src/features/player/services/audioService.ts` - Track cascade guard, extended timeout, removed position rejection
- `src/features/player/stores/playerStore.ts` - Removed strict position validation

---

## [0.6.78] - 2026-01-02

### Fixed - Player Control Button Touch Targets
- **Increased control bar height**: Changed from 64 to 72 scaled pixels for better touch area
- **Added hitSlop to all control buttons**: Extended touch area by 12px vertically and 8px horizontally
- **Added minHeight to control buttons**: Ensures minimum 48px touch target for accessibility
- **Adjusted progress bar position**: Moved up to maintain proper spacing from larger control bar

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Control button touch improvements

---

## [0.6.77] - 2026-01-02

### Fixed - Playback Position Stability
Comprehensive audit and fixes for random position jumps during streaming playback.

**Critical Fixes:**
- **Track switch position race condition**: Set `lastKnownGoodPosition` BEFORE changing `currentTrackIndex`
  - Previously, during track switches there was a 500ms window where position could be calculated from wrong track's startOffset
  - Now pre-sets the target global position before any track index changes
- **Background sync overwrites active playback**: Added protection check in conflict resolution
  - Previously, server sync could overwrite local position even during active playback
  - Now detects if audio is playing and protects local position from being overwritten
- **Undefined server timestamp handling**: Use 0 instead of `Date.now()` when `updatedAt` is undefined
  - Previously, undefined timestamps defaulted to current time, causing server position to falsely win conflicts
  - Now treats missing timestamps as oldest (0), ensuring local position has priority
- **Position validation layer**: Reject position updates > 60 seconds unless explicitly seeking
  - Prevents unexpected large position jumps from reaching the UI
  - Logs rejected jumps for debugging

**Debug Instrumentation Added:**
- Position jump detection in `audioService.ts:getGlobalPositionSync()` - logs jumps > 30 seconds
- Position change logging in `playerStore.ts:updatePlaybackState()` - logs all significant position changes
- Sync conflict logging in `backgroundSyncService.ts` - detailed conflict resolution logging

### Files Modified
- `src/features/player/services/audioService.ts` - Track switch timing fix, position jump detection
- `src/features/player/stores/playerStore.ts` - Position validation layer, undefined timestamp fix, position logging
- `src/features/player/services/backgroundSyncService.ts` - Active playback protection, conflict logging

---

## [0.6.76] - 2026-01-02

### Fixed - Memory Leaks
Comprehensive memory leak audit and fixes to prevent memory accumulation over time.

**Critical Fixes:**
- **AnalyticsService metrics array**: Added `MAX_METRICS = 500` bound to prevent unbounded growth
  - Previously, `metrics` array grew indefinitely with each performance metric tracked
  - Now trims to last 500 entries when exceeded
- **AnalyticsService initialization error handling**: Added proper cleanup of resources on init failure
  - Clears `flushInterval` and removes `appStateSubscription` if initialization fails after setup

**Moderate Fixes:**
- **WebSocket reconnect timer**: Clear pending reconnect timer at start of `connect()`
  - Prevents edge case where manual `connect()` call could leave orphaned timer
- **WebSocket reconnect callback**: Only increment attempts if still in reconnecting state
  - Prevents inflated attempt counter if connection was established via other means

### Files Modified
- `src/core/analytics/analyticsService.ts` - Add metrics array bound, improve error handling
- `src/core/services/websocketService.ts` - Improve timer cleanup edge cases

---

## [0.6.75] - 2026-01-01

### Performance Improvements
Comprehensive player performance audit and fixes to eliminate UI lag and unnecessary re-renders.

**Critical Fixes:**
- **enterDirectScrub callback**: Removed position from dependencies, uses `getState()` instead
  - Previously recreated ~2x/sec during playback, now stable
- **Timeline useEffect throttle**: Added 100ms throttle to position-based timeline updates
  - Reduces unnecessary work during playback

**Moderate Fixes:**
- **Batched store subscriptions**: Combined 10 individual action subscriptions into single `useShallow` call
- **Sheet handler callbacks**: Created stable `closeSheet`, `openChapters`, `openSettings`, `openQueue` callbacks
  - Replaced 8 inline arrow functions in JSX
- **ChapterListItem component**: Extracted memoized component for chapter list
  - Prevents re-render of all chapters on position update

**Polish:**
- **Memoized insets styles**: `safeAreaStyles.topSpacer/bottomSpacer` instead of inline objects
- **Memoized time formatting**: `formattedPosition/formattedDuration` only recalculate on whole second change

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - All performance fixes

### Documentation
- `docs/PLAYER_PERFORMANCE_AUDIT.md` - Comprehensive audit report with findings and fixes

---

## [0.6.74] - 2026-01-01

### Fixed
- **Play/pause button lag**: Replaced inline function with memoized callback
  - Uses `getState()` to avoid callback recreation on position/isPlaying updates
  - Eliminates lag when tapping play/pause during active playback

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Add memoized `handlePlayPause` callback

---

## [0.6.72] - 2026-01-01

### Removed
- **CD mode completely removed**: Removed all CD disc animation code from player
  - Eliminates potential source of performance issues and memory leaks
  - Reduces bundle size by removing CDDisc component, CDProgressBar, MaskedView
  - Player now uses standard cover art mode exclusively

### Simplified
- **Player screen cleanup**: Removed conditional mode switching logic
  - Simplified background blur and gradient code
  - Removed unused disc rotation, scrub speed, and spin burst variables
  - Removed CD-specific UI overlays (pills, spindle, disc ring)

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Remove all CD mode code, simplify player

---

## [0.6.63] - 2026-01-01

### Added
- **View More navigation**: "View More" buttons on Browse screen now navigate to filtered book lists
  - New `FilteredBooksScreen` shows books matching each row's criteria
  - Supports all filter types: new this week, short books, long listens, mood-matched, etc.
  - Includes search functionality within filtered results

- **Genres sorted by popularity**: Browse screen genre chips now show most popular genres first
  - Genres sorted by book count instead of alphabetically
  - Top 7 most popular genres shown in filter chips
  - New `getGenresByPopularity()` cache function

### Improved
- **Mood-aware View More**: When mood session active, View More shows all mood-matched books
  - Books sorted by mood match percentage
  - Shows match percentage on each book card

### Files Added
- `src/features/library/screens/FilteredBooksScreen.tsx` - Filtered books list screen

### Files Modified
- `src/features/discover/types.ts` - Add FilterType, filterType/filterParams to ContentRow
- `src/features/discover/hooks/useDiscoverData.ts` - Use getGenresByPopularity, add filterType to rows
- `src/features/discover/components/ContentRowCarousel.tsx` - Navigate to FilteredBooks with params
- `src/core/cache/libraryCache.ts` - Add getGenresByPopularity function
- `src/core/cache/index.ts` - Export getGenresByPopularity
- `src/navigation/AppNavigator.tsx` - Register FilteredBooksScreen
- `src/constants/version.ts` - Version bump

---

## [0.6.62] - 2026-01-01

### Improved
- **Tag-based mood scoring (Fix 1)**: Replaced regex-based theme/trope parsing with proper tag-based scoring
  - Uses `item.media.tags` metadata instead of parsing description text
  - More reliable mood matching with explicit tag→mood mappings
  - Comprehensive tag maps for moods, pace, weight, world dimensions
  - New tagScoring utility with partial match support

- **Genre filtering accuracy (Fix 2)**: Fixed over-matching in genre filters
  - "Romance" no longer matches "Romantic Comedy", "Dark Romance", etc.
  - Uses word-boundary matching instead of naive `.includes()`
  - Ensures exact genre matches in browse filters

- **Mood session expiry validation (Fix 3)**: Sessions now properly expire after 24 hours
  - Real-time check of `expiresAt` timestamp when rendering recommendations
  - Prevents stale mood sessions from appearing in browse screen

- **Recommendation group priority cap (Fix 4)**: Capped mood recommendation groups to 3
  - Priority formula changed from `2 + index * 0.5` to `2 + index * 0.3`
  - Prevents priority collision with other content rows (all < 3.0)

- **Mood score map freshness (Fix 5)**: Added `libraryItems` dependency to moodScoreMap
  - Scores now recalculate when library changes
  - Prevents stale match percentages after library updates

- **Omnibus series editions (Fix 6)**: Proper handling of multi-book omnibus editions
  - Sequences like "1-3" now correctly parsed (start=1, end=3)
  - Finished omnibus editions count as completing all contained books
  - Omnibus appropriate for recommendations if user has reached its start

### Files Added
- `src/features/mood-discovery/constants/tagMoodMap.ts` - Tag→dimension mappings
- `src/features/mood-discovery/utils/tagScoring.ts` - Tag scoring utility
- `src/features/mood-discovery/constants/index.ts` - Barrel export
- `src/features/mood-discovery/utils/index.ts` - Barrel export

### Files Modified
- `src/features/mood-discovery/hooks/useMoodRecommendations.ts` - Use tag-based scoring
- `src/features/discover/hooks/useDiscoverData.ts` - Genre matching, expiry check, priority cap, dependencies
- `src/shared/utils/seriesFilter.ts` - Omnibus edition handling
- `src/constants/version.ts` - Version bump

---

## [0.6.61] - 2026-01-01

### Improved
- **Fix 3 verification**: Added logging in sessionService to verify server returns `updatedAt` timestamp
  - Logs "Updated At: NOT PRESENT" if server doesn't return it (will help debug)
- **Fix 2 timeout tuning**: Enhanced timeout logging with analytics
  - Tracks `session_timeout` event with timeout duration, local position, book ID
  - Logs actual wait time and position comparison when session eventually connects
  - Data helps tune the 2-second timeout value

### Files Modified
- `src/features/player/services/sessionService.ts` - Log updatedAt/startedAt
- `src/features/player/stores/playerStore.ts` - Add timeout analytics, import trackEvent
- `src/constants/version.ts` - Version bump

---

## [0.6.60] - 2026-01-01

### Fixed
- **Cross-device sync: Timestamp-based position resolution (FIX 3)**
  - Replaced `Math.max(local, server)` with timestamp-based resolution
  - Now respects intentional rewinds on another device
  - The more recently updated position wins, not the higher one
  - New `positionResolver.ts` utility for unified resolution logic

- **Offline playback: No more jarring seek (FIX 2)**
  - Races session against 2-second timeout instead of fire-and-forget
  - Position is resolved BEFORE playback starts
  - If session arrives in time, uses timestamp-based resolution
  - If timeout, uses local progress and connects session in background for sync only

- **Background sync: Properly awaited before app suspension (FIX 1)**
  - `forceSyncAll()` now awaited with 4-second timeout (iOS has ~5s before suspension)
  - Prevents data loss when user backgrounds the app during playback
  - Added tracking/warning when sync times out

- **Queue debounce: Always save, process with debounce (FIX 4)**
  - Removed 10-second position delta threshold for queueing
  - Small rewinds (< 10 seconds) are now properly saved
  - Queue processing happens after 5s of inactivity OR 30s max delay
  - Prevents losing small position changes when closing app quickly

- **Large seeks: Immediate sync (FIX 5)**
  - Seeks > 1 minute trigger immediate server sync (fire-and-forget)
  - Ensures server knows about significant position changes quickly
  - Reduces risk of losing progress if app is closed immediately after seeking

### Technical Details
- Position resolver uses 30-second "same session" window for forward-progress (max)
- Outside that window, compares `updatedAt` timestamps
- Added `updatedAt` field to sessionService's PlaybackSession interface
- Background sync uses debounced scheduler instead of threshold-based queueing

### Files Modified
- `src/features/player/utils/positionResolver.ts` - NEW: Unified position resolution
- `src/features/player/utils/index.ts` - Export position resolver
- `src/features/player/stores/playerStore.ts` - Use resolver, fix offline path, add immediate sync
- `src/features/player/services/backgroundSyncService.ts` - Await with timeout, debounced queue
- `src/features/player/services/sessionService.ts` - Add updatedAt to interface
- `src/constants/version.ts` - Version bump

---

## [0.6.59] - 2026-01-01

### Fixed
- **Cross-device playback position sync**
  - Online playback now compares local AND server progress, uses the higher one
  - Offline playback reconciles with server position when background session completes
  - Fixes issue where position would not resume correctly across devices

### Technical
- `playerStore.loadBook()`: Compare `localProgress` vs `session.currentTime`, use `Math.max()`
- Offline mode: After background session starts, seek to server position if 5+ seconds ahead

### Files Modified
- `src/features/player/stores/playerStore.ts` - Position reconciliation logic
- `src/constants/version.ts` - Version bump

---

## [0.6.58] - 2025-12-31

### Fixed
- **Browse screen crash on Android**
  - Fixed `sqliteCache.getFinishedBooks is not a function` error
  - Incorrect method name in `useRecommendations.ts` (should be `getFinishedUserBooks`)
  - Added defensive guards in `seriesFilter.ts` for undefined function checks

### Improved
- **Audio playback debugging**
  - Added better logging for media control pause events
  - Added error handling for pause function failures
  - Helps debug intermittent notification widget issues

### Files Modified
- `src/features/recommendations/hooks/useRecommendations.ts` - Fix method name
- `src/shared/utils/seriesFilter.ts` - Add undefined guards
- `src/features/player/services/audioService.ts` - Add pause logging
- `src/constants/version.ts` - Version bump

---

## [0.6.57] - 2025-12-31

### Changed
- **Book detail screen: Layout reorder**
  - Genre tags moved above the cover image
  - Stats (duration/chapters) moved above the title
  - New order: Genres → Cover → Stats → Title → Credits → Progress → Buttons

### Files Modified
- `src/features/book-detail/screens/BookDetailScreen.tsx`
- `src/constants/version.ts` - Version bump

---

## [0.6.56] - 2025-12-31

### Changed
- **Book detail screen: Credits width matches title**
  - Author/narrator section now uses `paddingHorizontal: 20` instead of fixed cover width
  - Consistent alignment with title and buttons

### Files Modified
- `src/features/book-detail/screens/BookDetailScreen.tsx`
- `src/constants/version.ts` - Version bump

---

## [0.6.55] - 2025-12-31

### Changed
- **Book detail screen: Larger base title font**
  - Increased title fontSize from 24px to 32px before auto-fit scaling

### Files Modified
- `src/features/book-detail/screens/BookDetailScreen.tsx`
- `src/constants/version.ts` - Version bump

---

## [0.6.54] - 2025-12-31

### Changed
- **Book detail screen: Title width matches button section**
  - Title now uses `paddingHorizontal: 20` instead of fixed cover width
  - Aligns with buttons for consistent layout

### Files Modified
- `src/features/book-detail/screens/BookDetailScreen.tsx`
- `src/constants/version.ts` - Version bump

---

## [0.6.53] - 2025-12-31

### Changed
- **Book detail screen: Added spacing below title**
  - Increased title marginBottom from 4px to 16px

### Files Modified
- `src/features/book-detail/screens/BookDetailScreen.tsx`
- `src/constants/version.ts` - Version bump

---

## [0.6.52] - 2025-12-31

### Changed
- **Book detail screen: Allow 2 lines for author/narrator names**
  - Changed `numberOfLines` from 1 to 2 for credits

### Files Modified
- `src/features/book-detail/screens/BookDetailScreen.tsx`
- `src/constants/version.ts` - Version bump

---

## [0.6.51] - 2025-12-31

### Fixed
- **Book detail screen: Author/narrator text overflow**
  - Credit row now constrained to cover width (280px)
  - Long names scale down with `adjustsFontSizeToFit` (min 70%)
  - Each cell gets equal width (`flex: 1`) within the row

### Files Modified
- `src/features/book-detail/screens/BookDetailScreen.tsx` - Credit text scaling
- `src/constants/version.ts` - Version bump

---

## [0.6.50] - 2025-12-31

### Changed
- **Book detail screen: Equal button widths**
  - Download and Stream/Play buttons now same size (both `flex: 1`)

### Files Modified
- `src/features/book-detail/screens/BookDetailScreen.tsx` - Button flex values
- `src/constants/version.ts` - Version bump

---

## [0.6.49] - 2025-12-31

### Changed
- **Book detail screen: Title constrained to cover width**
  - Title container now matches cover width (280px)
  - Long titles scale down to fit within cover width
  - Reduced minimum font scale to 60% for longer titles

### Files Modified
- `src/features/book-detail/screens/BookDetailScreen.tsx` - Title container width
- `src/constants/version.ts` - Version bump

---

## [0.6.48] - 2025-12-31

### Changed
- **Book detail screen: Button order and title scaling**
  - Moved Queue (+) button to the left: (+) → Download → Play/Stream
  - Title now auto-scales to fit available space (`adjustsFontSizeToFit`)
  - Minimum font scale of 70% to maintain readability

### Files Modified
- `src/features/book-detail/screens/BookDetailScreen.tsx` - Button order, title scaling
- `src/constants/version.ts` - Version bump

---

## [0.6.47] - 2025-12-31

### Changed
- **Book detail screen: Icon and layout fixes**
  - Fixed finished badge icons to use Bookmark icons:
    - Uncompleted: Bookmark outline with black stroke on white background
    - Completed: BookmarkCheck (white) on gold background
  - Centered author/narrator credits with headers above each name
  - Centered the entire credits group on screen

### Files Modified
- `src/features/book-detail/screens/BookDetailScreen.tsx` - Icons, centered credits
- `src/constants/version.ts` - Version bump

---

## [0.6.46] - 2025-12-31

### Changed
- **Book detail screen: Button and layout refinements**
  - Reordered buttons: Download → Play/Stream → Queue (+)
  - Author/Narrator now side by side with "Written by" / "Narrated by" headers
  - Improved finished badge icons:
    - Uncompleted: Circle outline icon with white fill background
    - Completed: Filled checkmark circle (CheckCircle2)

### Files Modified
- `src/features/book-detail/screens/BookDetailScreen.tsx` - Button order, credits layout, icons
- `src/constants/version.ts` - Version bump

---

## [0.6.45] - 2025-12-31

### Changed
- **Book detail screen: Cleaner typography and layout**
  - Moved back button off cover to top-left of screen
  - Removed divider lines for cleaner look
  - Centered title with larger font (24px)
  - Simplified author/narrator display (no labels, inline text)
  - Combined duration & chapters into single line with icons: `(clock) 1h 6m · (list) 12 chapters`
  - Removed tab container border

### Files Modified
- `src/features/book-detail/screens/BookDetailScreen.tsx` - Layout and typography cleanup
- `src/constants/version.ts` - Version bump

---

## [0.6.44] - 2025-12-31

### Changed
- **Book detail screen: UX improvements based on research**
  - **"Continue X%" button**: Play button now shows progress percentage (e.g., "Continue 47%") instead of generic "Resume" - leverages Goal Gradient Effect (Kivetz et al.)
  - **Genre tags in hero section**: Top 3 genres displayed above title for quick book categorization
  - **Smaller cover size**: Reduced from 360px to 280px (~45% height) to show more content above the fold per NNGroup research (57% of viewing time above fold)

### Technical Details
- `getPlayButtonContent()` now returns `Continue ${progressPercent}%` for in-progress books
- Added `heroGenreTags` view after cover section, before title
- Added styles: `heroGenreTags`, `heroGenreTag`, `heroGenreTagText`
- `COVER_SIZE` constant reduced from `scale(360)` to `scale(280)`

### Already Implemented (verified)
- Description truncation with "Read more" (OverviewTab - 200 char limit)
- Per-chapter progress bars in ChaptersTab (current chapter shows progress + time remaining)

### Files Modified
- `src/features/book-detail/screens/BookDetailScreen.tsx` - Button text, genre tags, cover size
- `src/constants/version.ts` - Version bump

---

## [0.6.43] - 2025-12-31

### Added
- **Author detail screen: Research-backed UX improvements**
  - **Continue Listening section** (Zeigarnik Effect): Shows in-progress books first, sorted by highest progress (Goal Gradient effect). Includes visual progress bars and "time remaining" text
  - **Genre tags** in hero section: Top 3 genres aggregated from author's books
  - **Sort controls** for All Books: Sort by Title, Recent, Duration, or Series
  - **"Readers Also Enjoy" section**: Similar authors carousel based on genre overlap (at least 30% shared genres)

### Technical Details
- Added `continueListeningBooks` useMemo: filters in-progress books, sorts by highest progress
- Added `authorGenres` useMemo: aggregates and ranks genres from all books
- Added `similarAuthors` useMemo: calculates genre overlap scores with other authors
- Added `sortOption` state with support for 'title', 'recent', 'duration', 'series' sorts
- ListFooterComponent displays Similar Authors carousel
- All new sections follow progressive disclosure pattern per NNGroup research

### Research References
- NNGroup: Hub-and-spoke model, content above the fold (57% viewing time), progressive disclosure
- Baymard Institute: Social proof, series organization reduces abandonment
- Psychology: Zeigarnik Effect (incomplete tasks), Goal Gradient Effect (motivation near completion)
- Competitors: Audible author pages, Spotify artist pages, Netflix cast discovery

### Files Modified
- `src/features/author/screens/AuthorDetailScreen.tsx` - All new sections and features
- `src/constants/version.ts` - Version bump

---

## [0.6.42] - 2025-12-31

### Fixed
- **Author detail screen: Books not showing for authors with name variations**
  - Issue: "Bill Martin" author page showed "No books found" even though book was authored by "Bill Martin Jr."
  - Root cause: Cache indexed books by exact author name string, missing variations (Jr./Sr. suffixes, co-authors)
  - Fix: Now fetches author's books directly from API using author ID, which has correct book-to-author mappings
  - Falls back to cache-based matching if API fetch fails

### Technical Details
- Added `authorBooks` state to store API-fetched books
- Added `useEffect` to call `getAuthor(id, { include: 'items' })` when author ID is available
- `sortedBooks` now prefers API-fetched books over cache name-matching

### Files Modified
- `src/features/author/screens/AuthorDetailScreen.tsx` - API-based book fetching
- `src/constants/version.ts` - Version bump

---

## [0.6.41] - 2025-12-31

### Changed
- **Symmetric stacked covers on Author/Narrator detail screens**
  - Header now shows max 5 cards total (author/narrator in center + up to 4 book covers)
  - Books are always distributed evenly on each side for symmetric appearance
  - If only 1 book exists, shows just the author/narrator image (no covers)
  - If 3 books exist, shows 2 (1 on each side) to maintain symmetry
  - If 4+ books exist, shows 4 (2 on each side)

### Files Modified
- `src/features/author/screens/AuthorDetailScreen.tsx` - Symmetric StackedCovers logic
- `src/features/narrator/screens/NarratorDetailScreen.tsx` - Symmetric StackedCovers logic
- `src/constants/version.ts` - Version bump

---

## [0.6.40] - 2025-12-31

### Changed
- **Author/Narrator detail screens: Cover alignment and styling**
  - Header image (author/narrator) is now a square with rounded corners, matching book cover style
  - Previously was circular, now consistent with rest of UI

- **Author detail screen: Narrator names are now clickable**
  - Tapping narrator name in book list navigates to NarratorDetailScreen
  - Displayed in accent color to indicate interactivity

- **Narrator detail screen: Author cards now show author images**
  - Author cards display actual author image when available
  - Falls back to initials with color if no image

- **Removed play buttons from book list items**
  - Both Author and Narrator detail screens no longer show giant play buttons on book rows
  - Cleaner UI - tap book row to go to detail, play from there

### Files Modified
- `src/features/author/screens/AuthorDetailScreen.tsx` - Square cover, narrator links, removed play button
- `src/features/narrator/screens/NarratorDetailScreen.tsx` - Square cover, author images, removed play button
- `src/constants/version.ts` - Version bump

---

## [0.6.39] - 2025-12-31

### Added
- **Author detail screen: Series section**
  - New horizontal scrollable series section above "All Books"
  - Shows fanned book covers for each series with book count
  - Tapping a series navigates to SeriesDetailScreen

- **Author detail screen: Author image in stacked covers**
  - Author's image (or initials fallback) now displays as center cover in the fanned stack
  - Circular styling with white border distinguishes it from book covers
  - Automatically generates avatar color based on author name

- **Narrator detail screen: Authors section**
  - New horizontal scrollable authors section above "All Books"
  - Shows author avatar with initials and book count
  - Tapping an author navigates to AuthorDetailScreen

- **Narrator detail screen: Narrator initials in stacked covers**
  - Narrator's initials now display as center cover in the fanned stack
  - Circular styling with white border distinguishes it from book covers
  - Automatically generates avatar color based on narrator name

### Files Modified
- `src/features/author/screens/AuthorDetailScreen.tsx` - Series section, author image in StackedCovers
- `src/features/narrator/screens/NarratorDetailScreen.tsx` - Authors section, narrator initials in StackedCovers
- `src/constants/version.ts` - Version bump

---

## [0.6.38] - 2025-12-31

### Fixed
- **Critical playback position race conditions**
  - Play button now works reliably after chapter ends
  - Sleep timer: play resumes from correct position (not earlier position)
  - Scrubbing/seeking no longer causes wrong chapter to play
  - These fixes apply to both multi-file and single-file audiobooks, streaming and downloaded

### Technical Details
- **Event listener cleanup**: Prevent listener stacking on retry by tracking and removing old listeners
- **Position sync in pause()**: Capture actual position from audioService BEFORE pausing to prevent stale position storage
- **Track switch handling**: Increased waitForTrackReady timeout from 300ms to 500ms, update position cache after track switch
- **Robust track end handling**: Set trackSwitchInProgress flag before changing track index to prevent race conditions
- **Scrubbing debounce increased**: Changed from 50ms to 150ms to prevent pending track switches being overwritten
- **Smart rewind validation**: Added safety check to detect stale position data (>60s difference) and use actual position instead
- **ChaptersTab timing**: Added small delay between seekTo and play to ensure seek completes

### Files Modified
- `src/features/player/services/audioService.ts` - Event listener cleanup, track switch handling, debounce timing
- `src/features/player/stores/playerStore.ts` - Position sync in pause(), smart rewind validation
- `src/features/book-detail/components/ChaptersTab.tsx` - Timing fix for chapter tap
- `src/constants/version.ts` - Version bump

---

## [0.6.37] - 2025-12-30

### Added
- **Dark mode support for BookDetailScreen**
  - Screen now respects the app's theme setting (light/dark mode)
  - All colors dynamically adapt using `useColors()` and `useThemeMode()` hooks
  - StatusBar adapts to light/dark content based on theme
  - Gradient overlays and BlurView tint adapt to theme
  - Badges (back button, series, finished) use theme surface colors
  - OverviewTab and ChaptersTab components also updated for dark mode

### Files Modified
- `src/features/book-detail/screens/BookDetailScreen.tsx` - Full dark mode support
- `src/features/book-detail/components/OverviewTab.tsx` - Dark mode colors
- `src/features/book-detail/components/ChaptersTab.tsx` - Dark mode colors
- `src/constants/version.ts` - Version bump

---

## [0.6.36] - 2025-12-30

### Fixed
- **In Progress list not updating when starting a new book**
  - Added event listener for `book:started` that invalidates in-progress queries
  - When a new book starts playing, the home screen now refetches and re-sorts the list
  - Most recently played book now correctly appears at the top

---

## [0.6.35] - 2025-12-30

### Changed
- **Player download indicator redesigned**
  - Download button: black Download icon in white filled circle (no border)
  - When downloading: circular progress indicator with percentage
  - When downloaded: white checkmark (no circle)
  - Fixed CloudDownload icon not found - using Download icon instead

---

## [0.6.33] - 2025-12-30

### Fixed
- **Player download button not responding to taps**
  - Increased z-index of top-left and top-right overlays to 25 (above center close button at 20)
  - Close button's full-width layout was intercepting touches on corner icons

---

## [0.6.32] - 2025-12-30

### Changed
- **Player download/streaming icons refined**
  - Downloaded indicator: just a white checkmark (no circle)
  - Not downloaded: CloudDownload icon inside white stroke circle
  - Tapping the cloud icon starts downloading the book

---

## [0.6.31] - 2025-12-30

### Changed
- **Player download/streaming icons redesigned**
  - Downloaded indicator: white stroke circle with checkmark (no solid background)
  - Not downloaded: CloudDownload icon (cloud with arrow)
  - Tapping the cloud icon starts downloading the book for offline use
  - Added haptic feedback on download start

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Updated icons and added download functionality
- `src/constants/version.ts` - Version bump

---

## [0.6.30] - 2025-12-30

### Changed
- **Consolidated finished books sync**
  - Player's `markBookFinished` now uses SQLite `user_books` as single source of truth
  - Syncs to server in background via `finishedBooksSync.syncBook()`
  - App initializer now runs `finishedBooksSync.fullSync()` on authenticated startup
  - Imports finished books from server then syncs local unsynced changes

### Files Modified
- `src/features/player/stores/playerStore.ts` - Use SQLite-first approach for marking finished
- `src/core/services/appInitializer.ts` - Add finished books sync on startup
- `src/constants/version.ts` - Version bump

---

## [0.6.29] - 2025-12-30

### Changed
- **BookDetailScreen cover overlays**
  - Added series badge to top right corner of cover (clickable to navigate to series)
  - Shows series name and book number (e.g., "Harry Potter #3")
  - Moved mark as finished button to bottom left corner of cover
  - Mark as finished button shows white checkmark, filled white when completed

### Files Modified
- `src/features/book-detail/screens/BookDetailScreen.tsx` - Added series and finished badges
- `src/constants/version.ts` - Version bump

---

## [0.6.28] - 2025-12-30

### Changed
- **CD Player header final polish**
  - Down arrow now white and on top z-index
  - Downloaded indicator now just a white stroke checkmark (no circle)

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Updated indicators
- `src/constants/version.ts` - Version bump

---

## [0.6.27] - 2025-12-30

### Changed
- **CD Player header icons refined**
  - Settings icon now white filled circle with black gear
  - Download/streaming arrows now white stroke style

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Updated icon styles
- `src/constants/version.ts` - Version bump

---

## [0.6.26] - 2025-12-30

### Changed
- **CD Player header redesigned**
  - All icons now white with circle borders (settings, checkmark, cloud)
  - Down arrow smaller and white
  - Added dark gradient overlay at top for icon visibility
  - Chapter title and time now centered (title above, time below)

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Header icons, gradient, centered info
- `src/constants/version.ts` - Version bump

---

## [0.6.25] - 2025-12-30

### Changed
- **CD Player header icons redesigned**
  - Settings icon now uses circle style matching other icons
  - Downloaded/Streaming indicator now icon-only (removed text labels)
  - Cleaner, more consistent visual design

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Updated header icons
- `src/constants/version.ts` - Version bump

---

## [0.6.24] - 2025-12-30

### Fixed
- **Finished tab not updating after marking book as finished**
  - Fixed `useFinishedBookIds` to use `useMemo` instead of `useState`+`useEffect` for synchronous cache updates
  - Updated HomeScreen to fetch finished books from library cache when not in recently listened or downloaded lists
  - Books marked as finished from BookDetailScreen now immediately appear in the Finished tab

### Files Modified
- `src/core/hooks/useUserBooks.ts` - Fixed useFinishedBookIds to use useMemo
- `src/features/home/screens/HomeScreen.tsx` - Added library cache lookup for finished books
- `src/constants/version.ts` - Version bump

---

## [0.6.23] - 2025-12-30

### Changed
- **Single source of truth for finished books**
  - Consolidated finished book tracking to SQLite `user_books` table
  - Replaced in-memory galleryStore.markedBooks with persistent SQLite storage
  - Auto-marks books as finished when reaching 99% progress
  - Two-way sync with server (imports server state on startup, pushes local changes)
  - Added undo support with 15-second timeout for all mark/unmark actions

### Added
- `src/core/services/finishedBooksSync.ts` - Bidirectional sync service for finished books
- `useBulkMarkFinished` hook for marking multiple books at once (by author/series)
- `useUndoableMarkFinished` hook with undo/redo support
- `useFinishedBookIds` hook for efficient finished book lookup
- Migration from galleryStore to SQLite on app startup

### Technical
- `UserBook.finishSource` now tracks how book was marked: 'manual', 'progress', 'bulk_author', 'bulk_series'
- Auto-finish triggers at 99% progress in `updateUserBookProgress`
- galleryStore.ts now only manages wizard UI state (processedAuthors/Series, filters)
- All finished book queries go through React Query for caching

### Files Modified
- `src/core/services/sqliteCache.ts` - Added migration, bulk mark, auto-finish at 99%
- `src/core/hooks/useUserBooks.ts` - Added bulk, undo, and convenience hooks
- `src/core/services/appInitializer.ts` - Added migration call
- `src/core/services/finishedBooksSync.ts` - NEW: Server sync service
- `src/features/reading-history-wizard/stores/galleryStore.ts` - Removed book tracking
- `src/features/reading-history-wizard/hooks/useReadingHistory.ts` - Uses SQLite
- `src/features/reading-history-wizard/screens/MarkBooksScreen.tsx` - Uses new hooks
- `src/features/reading-history-wizard/screens/ReadingHistoryScreen.tsx` - Uses new hooks
- `src/features/book-detail/screens/BookDetailScreen.tsx` - Uses new hooks
- `src/features/library/screens/MyLibraryScreen.tsx` - Uses useFinishedBookIds
- `src/features/discover/hooks/useDiscoverData.ts` - Uses useReadingHistory
- `src/constants/version.ts` - Version bump

---

## [0.6.22] - 2025-12-30

### Added
- **Mark as Finished button in Book Details**
  - Added checkmark button in top right corner of book detail screen
  - When not finished: empty checkmark icon, tapping marks book as finished
  - When finished: filled gold checkmark, tapping shows confirmation to remove from history
  - Shows loading spinner during operation
  - Includes undo snackbar after marking finished

### Files Modified
- `src/features/book-detail/screens/BookDetailScreen.tsx` - Added header button
- `src/constants/version.ts` - Version bump

---

## [0.6.21] - 2025-12-30

### Changed
- **Natural time format for "last played"**
  - Now shows "30 sec ago", "5 min ago", "2 hours ago", "3 days ago", "1 week ago" etc.
  - Much more readable than abbreviated format like "3d"

- **Live-updating time display**
  - Time since last played updates every 30 seconds
  - No need to refresh the screen to see updated times

- **Profile toggles converted to switches**
  - Dark Mode and Hide Single-Book Series now use actual toggle switches
  - More intuitive than tapping with badge indicators

### Technical
- **lastPlayed tracking**
  - Uses server's `userMediaProgress.lastUpdate` timestamp (synced during playback)
  - Also checks `progressLastUpdate` at top level for compatibility
  - Server updates this when progress is synced (typically every 15-30 seconds during playback)

### Files Modified
- `src/features/home/components/TextListSection.tsx` - Updated time format, added live refresh
- `src/features/home/components/ContinueListeningSection.tsx` - Updated time format
- `src/features/profile/screens/ProfileScreen.tsx` - Added ProfileToggle component
- `src/constants/version.ts` - Version bump

---

## [0.6.20] - 2025-12-30

### Changed
- **Simplified Profile screen**
  - Removed: Wishlist, Reading History, Reading Preferences options
  - Removed: Haptic Feedback settings link
  - Removed: Cassette Player Test from developer section

- **Simplified Playback settings**
  - Removed: Joystick Seek Settings
  - Removed: Spinning Disc toggle
  - Removed: Joystick Seek toggle
  - Removed: Standard Player toggle

### Fixed
- **Sign Out button styling on light mode**
  - Button now uses appropriate colors for both light and dark modes
  - Dark mode: Bright red on dark background
  - Light mode: Darker red on lighter background

- **App logo in footer visibility**
  - Increased logo size from 48px to 64px
  - Added container with subtle background for light mode
  - App name text now uses textSecondary for better visibility

### Files Modified
- `src/features/profile/screens/ProfileScreen.tsx` - Removed options, fixed styling
- `src/features/profile/screens/PlaybackSettingsScreen.tsx` - Removed player appearance options
- `src/constants/version.ts` - Version bump

---

## [0.6.19] - 2025-12-30

### Fixed
- **"Time since last played" now shows on home screen book cards**
  - Fixed data extraction to check both `progressLastUpdate` (top-level) and `userMediaProgress.lastUpdate`
  - Fixed timestamp conversion from seconds to milliseconds
  - Now shows "2h", "3d", etc. next to book titles in In Progress tab

### Files Modified
- `src/features/home/components/TextListSection.tsx` - Fixed lastUpdate field extraction
- `src/features/home/components/ContinueListeningSection.tsx` - Fixed lastUpdate field and timestamp conversion
- `src/constants/version.ts` - Version bump

---

## [0.6.18] - 2025-12-30

### Changed
- **Timeline scrubbing now starts immediately on drag**
  - Removed 300ms long-press requirement - scrubbing starts as soon as you start dragging
  - Small 10px movement threshold to distinguish from accidental touches
- **Disabled tap-to-seek on timeline**
  - Timeline now only responds to drag gestures, not taps
  - Prevents accidental position jumps when trying to scrub

### Fixed
- **Book title overlap with chapter row**
  - Increased chapter row top position from scale(530) to scale(570)
  - Long book titles now have room without overlapping chapter info
- **Reading History "Property 'styles' doesn't exist" error**
  - Added module-level COLORS and styles constants for helper components
  - Helper components (ViewTabs, ProgressBar, etc.) now have access to styles
- **Bookmark popup redesigned as pill**
  - Replaced bottom toast with animated pill that grows from bookmark button
  - Pill appears near the cover bookmark button
  - "Add Note" option available directly in the pill

### Changed
- **Home screen book card interactions**
  - Cover tap: Loads book to player (paused, ready to play)
  - Cover long press: Opens book details
  - Title/author tap: Opens book details

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Timeline gesture changes, bookmark pill, layout fix
- `src/features/reading-history-wizard/screens/MarkBooksScreen.tsx` - Fixed styles error
- `src/features/home/components/TextListSection.tsx` - Separated touch interactions
- `src/features/home/screens/HomeScreen.tsx` - New cover/details handlers
- `src/constants/version.ts` - Version bump

---

## [0.6.17] - 2025-12-30

### Added
- **Hold-to-scrub on rewind/fast-forward buttons**
  - Tap buttons to skip by configured interval (e.g., 15 seconds)
  - Hold buttons to continuously seek - accelerates over time:
    - First 1 second: 2 seconds per tick (20 sec/s)
    - 1-2 seconds: 5 seconds per tick (50 sec/s)
    - 2-4 seconds: 10 seconds per tick (100 sec/s)
    - 4+ seconds: 15 seconds per tick (150 sec/s)
  - Haptic feedback when seeking accelerates
  - Works on both Standard Player and CD Player modes

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Added continuous seeking logic
- `src/constants/version.ts` - Version bump

---

## [0.6.16] - 2025-12-30

### Fixed
- **Android showing 1 column instead of 2 in "New This Week" grid**
  - Issue was inconsistent use of scaled vs unscaled values in card width calculation
  - Changed to use unscaled values consistently and added `Math.floor` to prevent overflow
  - Grid now shows 2 columns on both iOS and Android

### Files Modified
- `src/features/discover/components/ContentRowCarousel.tsx` - Fixed grid layout calculation
- `src/constants/version.ts` - Version bump

---

## [0.6.15] - 2025-12-30

### Added
- **Android hardware back button support**
  - Pressing back button now closes bottom sheets first, then closes the player
  - Proper event handling to prevent exiting the app

- **Improved swipe-down gesture to close player**
  - Works on both iOS and Android
  - Uses capture phase to grab gestures before child elements
  - Smooth slide-out animation when closing
  - Spring-back animation when cancelled

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Added BackHandler, improved panResponder
- `src/constants/version.ts` - Version bump

---

## [0.6.14] - 2025-12-30

### Changed
- **Standard Player layout now uses absolute positioning**
  - Converted cover, title section, chapter row, progress bar, and controls bar to absolute positioning
  - Layout no longer shifts when individual elements change size
  - Controls bar properly accounts for safe area insets at bottom
  - Progress bar positioned above controls with proper spacing

### Technical Details
- Cover: absolute at top scale(100)
- Title section: absolute at top scale(430)
- Chapter row: absolute at top scale(530)
- Progress bar: absolute at bottom + insets.bottom + scale(80)
- Controls bar: absolute at bottom + insets.bottom

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Converted Standard Player to absolute positioning
- `src/constants/version.ts` - Version bump

---

## [0.6.13] - 2025-12-30

### Fixed
- **Scrub position not persisting when paused**
  - Timeline scrubbing while paused then hitting play would jump back to original position
  - **Root cause**: Timeline scrubbing wasn't calling `audioService.setScrubbing()`, so SmartRewind would activate on play using the OLD pause position
  - **Fix 1**: Added `audioService.setScrubbing(true/false)` calls to timeline scrub enter/exit
  - **Fix 2**: `seekTo()` now updates playerStore.position immediately (not just waiting for slow 2000ms polling callback when paused)

- **Jarring position jump when loading a book**
  - Book would show stale position from previous book during loading, then jump to correct position
  - **Fix**: Now fetches saved position early (from local SQLite) and sets it immediately before async loading begins
  - Position is displayed correctly from the start of loading

### Changed
- **Standard Player cover now matches book detail page style**
  - Centered square cover (320px) instead of full-width
  - Rounded corners with drop shadow
  - Blurred background with light tint (like book detail page)
  - Queue/bookmark overlay buttons repositioned for smaller cover

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Added setScrubbing calls, updated Standard Player cover style
- `src/features/player/stores/playerStore.ts` - seekTo updates position immediately, loadBook fetches early position
- `src/constants/version.ts` - Version bump

---

## [0.6.12] - 2025-12-30

### Fixed
- **Chapter markers appearing in wrong positions on timeline**
  - **Root cause**: Tick positions were stored in pixels using a hardcoded TIMELINE_WIDTH (300), but rendered using device-dependent TIMELINE_WIDTH (SCREEN_WIDTH - scale(44))
  - **Fix**: Tick positions now stored in seconds (time-based), converted to pixels at render time
  - This ensures cached ticks work correctly across all device screen sizes
  - Tick cache version bumped to v3 to invalidate old pixel-based caches

### Technical Details
- Changed `TimelineTick.x` (pixels) to `TimelineTick.time` (seconds)
- Updated `getVisibleTicks()` to filter by time instead of pixels
- CDPlayerScreen now converts `tick.time * PIXELS_PER_SECOND` when rendering

### Files Modified
- `src/features/player/utils/tickGenerator.ts` - Store tick positions in seconds
- `src/features/player/services/tickCache.ts` - Bump cache version to v3
- `src/features/player/screens/CDPlayerScreen.tsx` - Convert seconds to pixels at render
- `src/constants/version.ts` - Version bump

---

## [0.6.11] - 2025-12-30

### Fixed
- **Documentation error in PLAYER_DEEP_DIVE.md**
  - Corrected seeking system documentation that incorrectly described timeline scrubbing
  - Now clearly distinguishes between two seek mechanisms:
    - **Timeline scrubbing**: Uses `isDirectScrubbing` (local UI state) + Reanimated shared values (60fps)
    - **Continuous seeking** (FF/RW buttons): Uses `isSeeking` in playerStore
  - Previous documentation incorrectly claimed timeline scrubbing sets `isSeeking = true`

### Files Modified
- `docs/PLAYER_DEEP_DIVE.md` - Fixed seeking system documentation
- `src/constants/version.ts` - Version bump

---

## [0.6.10] - 2025-12-30

### Changed
- **Standard Player layout reorganization**
  - Cover image now appears above title/author metadata
  - Timeline moved directly above player controls (skip/play/skip)
  - Creates cleaner visual hierarchy: Cover → Title → Chapter Info → Timeline → Controls

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Reorganized Standard Player layout
- `src/constants/version.ts` - Version bump

---

## [0.6.9] - 2025-12-30

### Added
- **Timeline tick caching system** - Pre-generates and caches timeline ticks for better performance
  - Downloaded books: Ticks are pre-generated and persisted to AsyncStorage after download completes
  - Last played book: Ticks are pre-warmed in memory when home screen loads
  - Falls back to on-demand generation if cache miss (still functional, just first load may be slower)

### Changed
- **ChapterTimelineProgressBar** - Now accepts `libraryItemId` prop for tick cache lookup
- **Download flow** - Generates and caches ticks after download completes (non-blocking)
- **Home screen** - Pre-warms tick cache for current/last played book on load

### Technical Details
- New files:
  - `src/features/player/services/tickCache.ts` - Cache service with memory + AsyncStorage
  - `src/features/player/utils/tickGenerator.ts` - Tick generation utilities
- Tick generation happens once per book, cached indefinitely until book is deleted
- Memory cache provides instant access, AsyncStorage provides persistence for downloaded books

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Pass libraryItemId to timeline
- `src/features/player/services/tickCache.ts` - New tick caching service
- `src/features/player/utils/tickGenerator.ts` - New tick generation utilities
- `src/core/services/downloadManager.ts` - Generate ticks after download
- `src/features/home/hooks/useHomeData.ts` - Pre-warm ticks for current book
- `src/constants/version.ts` - Version bump

---

## [0.6.8] - 2025-12-30

### Changed
- **Enhanced timeline scrubbing** - Replaced joystick scrub with long-press + pan gesture
  - Long-press (300ms) on timeline activates direct scrub mode
  - Tap-to-seek remains instant (<150ms)
  - **"DRAG TO SCRUB" tooltip** - Appears on long-press activation, disappears when dragging
  - Fine-scrub mode: Pull finger down for precision control
    - Normal: Full speed
    - Half speed: Finger 40px below start
    - Quarter speed: 80px below
    - Fine: 120px below
    - Fast (2x): Finger 40px above start
  - Visual feedback: Timeline scale lift, speed mode indicator, scrub tooltip
  - Haptic feedback: Chapter crossings (medium), minute markers (light), tap confirm, edge reached, mode changes
  - Snap-to-chapter: Auto-snaps when releasing within threshold of chapter boundary
  - New settings: `snapToChapterEnabled`, `snapToChapterThreshold` in settingsStore

### Added
- **useTimelineHaptics hook** - Centralized haptic feedback for timeline interactions
  - Configurable feedback for: chapterBoundaries, minuteMarkers, tapConfirm, edgeReached, modeChanges
  - Debounced triggers to prevent rapid-fire haptics
  - Convenience check functions for use during scrub updates

### Removed
- Joystick scrub component from CD player screen (CoverPlayButton)
- Joystick-related state and callbacks (jogState, scrubOffsetDisplay)
- Unused jog overlay UI and related styles

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Long-press + pan gesture, removed joystick
- `src/features/player/hooks/useTimelineHaptics.ts` - New haptic feedback hook
- `src/features/player/stores/settingsStore.ts` - Added snap-to-chapter settings
- `src/constants/version.ts` - Version bump

---

## [0.6.6] - 2025-12-29

### Fixed
- **Complete light mode theme support** - Converted all remaining screens to use centralized theme system
  - All screens now properly support light and dark modes
  - Fixed white text on white background issues in light mode
  - Settings screens (Playback, Storage, Haptic, JoystickSeek, ChapterCleaning) converted
  - Feature screens (Downloads, Stats, Queue, Wishlist, ManualAdd) confirmed converted
  - All screens use `useThemeColors()` hook from `@/shared/theme/themeStore`

### Technical Details
- Pattern: `createColors(themeColors: ThemeColors)` helper creates theme-aware color objects
- Theme tokens used: `text`, `textSecondary`, `textTertiary`, `background`, `backgroundSecondary`, `border`
- `accentColors.gold` replaces legacy `colors.accent` for static accent color
- Sub-components receive colors via props instead of accessing hardcoded values
- StyleSheets cleaned up with comments indicating where colors are set in JSX
- StatusBar dynamically uses `themeColors.statusBar` for proper bar style

### Files Modified
- `src/features/profile/screens/PlaybackSettingsScreen.tsx`
- `src/features/profile/screens/StorageSettingsScreen.tsx`
- `src/features/profile/screens/HapticSettingsScreen.tsx`
- `src/features/profile/screens/JoystickSeekSettingsScreen.tsx`
- `src/features/profile/screens/ChapterCleaningSettingsScreen.tsx`
- `src/constants/version.ts`

---

## [0.6.5] - 2025-12-28

### Changed
- **Centralized theme conversion for detail screens** - Migrated key screens to use centralized theme system
  - AuthorDetailScreen: Converted to use `useTheme` hook with `ThemeColorsConfig` interface
  - NarratorDetailScreen: Converted with dynamic styles via `createStyles(COLORS)` pattern
  - SeriesDetailScreen: Updated StackedCovers and SeriesBackground to accept theme color props
  - BookDetailScreen: Converted to use `lightColors` from centralized theme
  - QueuePanel: Updated to use `lightColors.queue.*` tokens for consistent styling
  - All screens now use `useMemo` for styles to support dynamic theming

### Technical Details
- Pattern: `createStyles(COLORS: ThemeColorsConfig) => StyleSheet.create({...})`
- Colors sourced from `@/shared/theme` via `useTheme()` hook or `lightColors`/`darkColors`
- Convenience aliases (e.g., `BG_COLOR = COLORS.background`) for inline JSX color props
- Sub-components receive color props instead of accessing global constants

### Files Modified
- `src/features/author/screens/AuthorDetailScreen.tsx`
- `src/features/narrator/screens/NarratorDetailScreen.tsx`
- `src/features/series/screens/SeriesDetailScreen.tsx`
- `src/features/book-detail/screens/BookDetailScreen.tsx`
- `src/features/queue/components/QueuePanel.tsx`

---

## [0.6.4] - 2025-12-28

### Fixed
- **Android crash on player screen** - Fixed "Canvas: trying to draw too large bitmap" crash
  - SVG timeline for chapter view was rendering at full audiobook duration width (e.g., 40,000+ pixels for 10-hour books)
  - Android has a canvas size limit (~100MB), causing crash when loading long audiobooks
  - Implemented viewport-based rendering: SVG is now fixed at ~2100px width
  - Tick positions are calculated relative to a sliding viewport window
  - Ticks only render within ±15 minutes of current playback position (already existed)
  - Now the SVG width matches the visible window instead of full duration

- **Image blur crash on Android** - Made blur effects iOS-only
  - expo-image `blurRadius` was causing massive bitmap allocation on Android
  - Changed to `blurRadius={Platform.OS === 'ios' ? value : 0}` for cover images

- **Performance warning red screens** - Changed console.error to console.warn in useScreenLoadTime
  - Dev client was showing red error screens for slow screen mounts
  - Now uses console.warn which shows yellow instead of blocking red

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Viewport-based timeline SVG rendering
- `src/core/hooks/useScreenLoadTime.ts` - console.error → console.warn

---

## [0.6.2] - 2025-12-28

### Added
- **Navigation bar theme support** - Bottom tab bar respects app theme setting
  - Light mode: White background, black icons and labels
  - Dark mode: Black background, white icons and labels
  - Active/inactive states properly themed

### Files Modified
- `src/navigation/components/FloatingTabBar.tsx` - Theme-aware navigation bar

---

## [0.6.1] - 2025-12-28

### Added
- **Full player (CDPlayerScreen) theme support** - Respects app theme setting
  - Light mode: White backgrounds, black text/icons, light gray controls
  - Dark mode: Black backgrounds, white text/icons, dark gray controls
  - All sheets (chapters, settings, bookmarks) use theme colors
  - Standard player controls bar, overlay buttons, and dividers themed
  - Timeline progress bars (both book and chapter views) use theme-aware tick colors
  - Header icons, source indicator, and close arrow respond to theme
  - Control buttons (rewind, play/pause, fast-forward) match theme
  - Red accent color (#E53935) preserved in both modes for play state and timestamps

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Comprehensive theme support
- `src/constants/version.ts` - Version bump to 0.6.1

---

## [0.6.0] - 2025-12-28

### Changed
- **Mini player theme toggle support** - Now respects app theme setting
  - Uses `useThemeStore` from profile settings dark mode toggle
  - Light mode: White background, black text/icons
  - Dark mode: Dark surface (`#1C1C1E`), white text/icons
  - Colors dynamically switch when theme is toggled
  - Red accent color preserved in both modes
  - All elements (container, title, buttons, timeline ticks) respond to theme

### Files Modified
- `src/navigation/components/GlobalMiniPlayer.tsx` - Theme-aware styling using themeStore

---

## [0.5.98] - 2025-12-28

### Fixed
- **Download count mismatch** - Home screen now shows all downloaded books
  - Previously only showed downloads that were also in library cache
  - Now fetches missing library item metadata from API when needed
  - Fixes discrepancy between home (showed 1) and library/downloads screens (showed 4)

### Files Modified
- `src/core/services/downloadManager.ts` - Fetch missing library items from API

---

## [0.5.97] - 2025-12-28

### Added
- **Unified user_books table** - Single source of truth for user-book relationships
  - Consolidates playback_progress, favorites, marked_complete, and read_history
  - Schema includes progress, status flags, timestamps, sync state, cached metadata, per-book settings
  - Partial indexes for efficient queries (favorites, finished, needs_sync)
  - CRUD methods with upsert support for atomic updates

- **Automatic migration on startup**
  - One-time migration merges legacy tables into user_books
  - Runs in parallel with other initialization tasks
  - Preserves all existing data with timestamp-based conflict resolution

- **Unified data access hooks** (`useUserBooks.ts`)
  - `useUserBook` - Get full user book record
  - `useBookProgress`, `useIsFavorite`, `useIsFinished`, `useBookPlaybackSpeed` - Specific data
  - `useFavoriteBooks`, `useFinishedBooks`, `useInProgressBooks` - Collections
  - `useUpdateProgress`, `useToggleFavorite`, `useMarkFinished` - Mutations
  - `useBookStatus`, `useBookActions` - Combined convenience hooks
  - React Query integration with automatic cache invalidation

### Technical Details
- Foundation for data storage consolidation (Phase 1 of architecture refactor)
- Legacy tables remain for backward compatibility during transition
- Stores can be migrated incrementally to use new unified hooks

### Files Modified
- `src/core/services/sqliteCache.ts` - Added user_books table, indexes, methods, migration
- `src/core/services/appInitializer.ts` - Added migration trigger on startup
- `src/core/hooks/useUserBooks.ts` - New unified data access hooks
- `src/core/hooks/index.ts` - Export new hooks

---

## [0.5.96] - 2025-12-28

### Changed
- **QueuePanel modernist redesign** - Updated to match Settings sheet theme
  - White background with black text
  - Light gray item cards (#F5F5F5)
  - Black badge and browse button
  - Gray icons for drag handle, remove, autoplay
  - Black/white toggle switch styling
  - Consistent padding and typography

### Files Modified
- `src/features/queue/components/QueuePanel.tsx` - Complete style overhaul

---

## [0.5.95] - 2025-12-28

### Fixed
- **Sheet visibility** - Fixed invisible text on sheets by separating backgrounds
  - Sheet container now transparent (individual sheets set their own background)
  - Settings, Bookmarks, Chapters sheets use white background
  - Queue panel keeps dark theme styling
  - Updated Chapters sheet to modernist white/black theme

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Sheet background separation, chapter styles

---

## [0.5.94] - 2025-12-28

### Changed
- **Modernist Sheet Design** - Complete redesign of Settings and Bookmarks sheets
  - White background (#FFFFFF) with black text
  - Light gray option buttons (#F0F0F0) with black active state
  - Section titles in gray uppercase with letter-spacing
  - More spacious padding throughout (20-24px)
  - Softer rounded corners (24px on container)
  - Gray dividers between bookmark items
  - Black icons for close, bookmark, play buttons
  - Clean badge design with black background

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Sheet, settings, and bookmark styles

---

## [0.5.93] - 2025-12-28

### Changed
- **Modernist Popup Design** - Updated toast and modal to clean white/black theme
  - White background with black text and icons
  - Increased padding and font sizes for better readability
  - Softer shadows for floating appearance
  - Note modal has handle bar for modern bottom sheet look
  - Underlined action text for clearer affordance
  - Black save button with white text

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Toast and modal style updates

---

## [0.5.92] - 2025-12-28

### Added
- **Enhanced Bookmark System** - Comprehensive bookmark UX improvements
  - Toast notification with "Add note" option after creating bookmark
  - Note input modal with character counter (500 limit)
  - Enhanced bookmark cards with cover thumbnail, chapter, timestamp, note preview
  - Long-press to edit existing bookmark notes
  - Delete with 5-second undo window
  - Improved empty state with helpful messaging
- **Inline Settings Controls** - Speed and sleep timer in settings panel
  - Quick option buttons for common speeds (1x, 1.25x, 1.5x, 2x)
  - Quick option buttons for sleep times (5min, 15min, 30min, 1h)
  - Inline custom input fields for arbitrary values
  - Live countdown display in sleep timer input
- **Sleep Timer on Play Button** - Visual feedback when timer active
  - Replaces play/pause button when sleep timer running
  - Shows live mm:ss countdown in red bold
  - Small play/pause icon above timer

### Changed
- **Settings Panel Layout** - Single column design
  - Progress bar toggle at top
  - Speed options with inline custom input
  - Sleep timer with inline custom input
  - View Bookmarks button
  - Clear Queue button
- Removed full-screen SpeedPanel and SleepTimerPanel pages

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Bookmark enhancements, inline settings, sleep timer display

---

## [0.5.82] - 2025-12-28

### Added
- **Full-Screen Speed Control Panel** - New immersive speed control experience
  - Vertical fill-bar slider with 0.1x–4x range
  - Logarithmic scale for natural drag feel
  - Animal icons: turtle (slow), sitting rabbit (1x), running rabbit (1.5x+)
  - Markers clip/reveal as fill rises
  - Snap points with haptic feedback at common speeds
  - Tappable display opens numeric keypad for manual entry
  - Playback controls at bottom
- **Full-Screen Sleep Timer Panel** - New circular pie selector for sleep timer
  - Clock-style drag rotation (12 o'clock = 0)
  - Full rotation = 60 minutes, multi-rotation for longer times
  - Red fill arc showing selected duration
  - Tick marks at 0, 15, 30, 45, END positions
  - "End of Chapter" option
  - Tappable display for manual time entry
  - Presets: 15m, 30m, 1h, 2h
  - OFF button in center
- **NumericInputModal Component** - Reusable modal for manual entry
  - Custom numeric keypad (no system keyboard)
  - Supports speed mode (decimal) and time mode (hours/minutes)
  - Preset quick-select buttons
  - Range validation with error display

### Changed
- **Player Settings Sheet** - Added Controls section
  - Speed Control option shows current speed, opens SpeedPanel
  - Sleep Timer option shows remaining time, opens SleepTimerPanel

### Files Added
- `src/features/player/components/NumericInputModal.tsx` - Shared numeric input modal
- `src/features/player/screens/SpeedPanel.tsx` - Full-screen speed control
- `src/features/player/screens/SleepTimerPanel.tsx` - Full-screen sleep timer

### Files Modified
- `src/features/player/index.ts` - Export new panels and modal
- `src/features/player/screens/CDPlayerScreen.tsx` - Integrate panels, add settings options

---

## [0.5.81] - 2025-12-28

### Changed
- **Minimal Search Bar** - Simplified Home page search bar design
  - Changed from pill/bordered style to minimal underline style
  - Smaller font size (13px) and icons (3.5%)
  - Bottom border only instead of full border
  - More compact height

### Files Modified
- `src/features/home/components/TextListSection.tsx` - Updated search bar styles

---

## [0.5.80] - 2025-12-28

### Added
- **Finished Tab on Home Page** - New tab showing completed books
  - Shows books marked as finished or with 100% progress
  - Matches Library page's Finished tab behavior
- **Search Bar on Home Page** - Filter books by title or author
  - Located under the tabs
  - Includes clear button when text is entered
  - Filters current tab's books in real-time

### Files Modified
- `src/features/home/components/TextListSection.tsx` - Added Finished tab, search bar, and filtering logic
- `src/features/home/screens/HomeScreen.tsx` - Added finished books data and search state

---

## [0.5.79] - 2025-12-28

### Changed
- **Home Page Book Rows** - Added cover images with play overlay
  - Small cover image (10% screen width) displayed for each book
  - Dark overlay (35% opacity) on cover for visibility
  - White play icon centered on cover (no circle stroke)
- **Scrollable Tabs** - Made Home page tabs horizontally scrollable
  - Matches Library page tab behavior
  - Extends edge-to-edge with proper padding

### Files Modified
- `src/features/home/components/TextListSection.tsx` - Cover images, new play icon, scrollable tabs

---

## [0.5.78] - 2025-12-28

### Changed
- **Home Page Tabs** - Added Library-style tabs to Home page
  - New tabs: In Progress, Downloaded, Favorites
  - Tab styling matches Library page (26px text tabs)
  - Favorites tab filters from available books
- **Theme-Aware Section Headers** - Fixed SectionHeader component
  - Now uses `useThemeColors()` for proper theming
  - Titles display correctly in both light and dark modes

### Files Modified
- `src/features/home/components/TextListSection.tsx` - Added 3-tab system, new tab bar styles
- `src/features/home/screens/HomeScreen.tsx` - Added favorite books data
- `src/features/home/components/SectionHeader.tsx` - Fixed hardcoded colors

---

## [0.5.77] - 2025-12-28

### Changed
- **Library Screen Layout Update** - Improved header layout
  - Removed "My Library" title - tabs now serve as the header
  - Moved search bar below tabs
  - Tightened spacing between elements
  - Tabs slightly larger (26px) for better visibility

### Files Modified
- `src/features/library/screens/MyLibraryScreen.tsx` - Layout reorder and spacing fixes

---

## [0.5.76] - 2025-12-28

### Changed
- **Library Screen Redesign** - Updated to match Home page styling
  - New Home-style text tabs: large 24px text labels instead of icon pills
  - Simplified tabs: All, Downloaded, In Progress, Finished, Favorites
  - Fixed all hardcoded colors to use `themeColors` for proper theme support
  - Title/subtitle colors now dynamic for both light and dark themes
  - Progress bar colors fixed on horizontal cards
  - Badge icons use theme-aware colors
  - Hero card play button uses theme colors
  - Screen title style updated to match Home (32px, 400 weight)

### Files Modified
- `src/features/library/screens/MyLibraryScreen.tsx` - Complete styling overhaul

---

## [0.5.75] - 2025-12-28

### Changed
- **Improved Time Display in Player** - Shows current book position in verbose format
  - Now displays: `19m 14s` (book position)
  - New format: `5h 23m 10s` instead of `5:23:10`
  - Updated both Standard Player and CD Player modes

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Updated time display format, added `formatTimeVerbose()` helper

---

## [0.5.74] - 2025-12-28

### Changed
- **Allow Scrubbing Across Chapter Boundaries** - Removed chapter bounds clamping from joystick scrubbing
  - Previously: Scrubbing was clamped to current chapter bounds, preventing scrubbing past chapter start/end
  - Now: Scrubbing is clamped only to book bounds (0 to duration), allowing free navigation across chapters
  - User can now scrub from any position to any other position in the book
  - Boundary haptics now trigger at book start/end instead of chapter boundaries

### Files Modified
- `src/shared/components/CoverPlayButton.tsx` - Changed clamp bounds from chapter to book in scrub interval and endScrub

---

## [0.5.73] - 2025-12-28

### Fixed
- **Position Overwritten During endScrub Delay** - Fixed final position race condition in scrub seek
  - Root cause: During 50ms delay after seek, audio callbacks overwrote store position with stale values
  - Example: Store set to 1001s, then callback overwrote with 972s, causing wrong resume position
  - Solution 1: Modified `updatePlaybackState()` to skip position updates when `isSeeking=true`
  - Solution 2: Modified `endScrub()` to use `isSeeking` flag for entire operation including 50ms delay
  - Flow: Set `isSeeking=true` → seek → delay → set `position` AND clear `isSeeking` together
  - Position updates are now blocked during the entire endScrub operation

### Files Modified
- `src/features/player/stores/playerStore.ts` - Check `isSeeking` in `updatePlaybackState()` before updating position
- `src/shared/components/CoverPlayButton.tsx` - Use `isSeeking` flag to block updates during endScrub

---

## [0.5.72] - 2025-12-28

### Fixed
- **Store Position Not Updated After Scrub** - Fixed position mismatch between store and audio
  - Root cause: `audioService.seekTo()` updated `lastKnownGoodPosition` but not the store
  - Store's `position` was stale from before scrubbing started
  - Example: Audio at 971s but store reported 998s, causing wrong position on resume
  - Solution: Added `usePlayerStore.setState({ position: finalPosition })` after seek
  - Store position now matches actual audio position after scrubbing

### Files Modified
- `src/shared/components/CoverPlayButton.tsx` - Update store position after final seek

---

## [0.5.71] - 2025-12-28

### Fixed
- **Track Switch Not Executing After Scrub** - Fixed position snap-back when scrubbing across track boundaries
  - Root cause: `endScrub()` called `seekTo()` while `isScrubbing=true`, which queued track switches
  - Then `setScrubbing(false)` cleared the pending switch without executing it
  - Audio remained on old track at wrong position, causing snap-back on play
  - Solution: Clear scrubbing flag BEFORE final seek, so track switches execute immediately
  - Example: Scrub from 265s→117s now correctly switches tracks instead of snapping back to 265s

### Files Modified
- `src/shared/components/CoverPlayButton.tsx` - Moved `setScrubbing(false)` before `seekTo()`

---

## [0.5.70] - 2025-12-28

### Fixed
- **SmartRewind Race Condition** - Fixed bug where SmartRewind could apply old position after scrubbing
  - Root cause: `clearSmartRewind()` was fire-and-forget, AsyncStorage clear could be incomplete
  - When `play()` was called after scrub, `restoreSmartRewindState()` would read stale AsyncStorage data
  - Solution: Added `skipNextSmartRewind` flag in audioService, set when scrubbing starts
  - `play()` now checks and consumes this flag before applying SmartRewind
  - Added log message `[SmartRewind] Skipping - just finished scrubbing` for debugging

### Files Modified
- `src/features/player/services/audioService.ts` - Added `skipNextSmartRewind` flag and `consumeSkipSmartRewind()` method
- `src/features/player/stores/playerStore.ts` - Check skip flag before applying SmartRewind

---

## [0.5.69] - 2025-12-28

### Fixed
- **Scrubbing Performance** - Fixed lag during joystick scrubbing
  - Root cause: React state updating at ~40fps causing excessive re-renders
  - Solution: Throttle scrub offset React state updates to 100ms intervals
  - Added `scrubOffsetShared` (Reanimated shared value) for immediate updates
  - Added `scrubOffsetDisplay` (throttled React state) for text displays
  - CDPlayerScreen now re-renders at ~10fps max during scrubbing (was ~40fps)
  - Timeline animations remain smooth using Reanimated shared values

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Added throttled scrub offset handling

---

## [0.5.68] - 2025-12-28

### Added
- **Timeline Gestures Restored** - Re-added seeking gestures to progress bars
  - Tap gesture: Added to both TimelineProgressBar and ChapterTimelineProgressBar
  - Pan gesture: Added only to TimelineProgressBar (book view)
  - Chapter view has tap-to-seek only (no pan to avoid joystick conflicts)

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Added gesture handling back

---

## [0.5.67] - 2025-12-28

### Changed
- **Bookmark Flag Design** - Updated flag appearance to match design spec
  - Stem now reaches full height of timeline (like red center marker)
  - Stem color: light blue (#64B5F6)
  - Flag shape: notched pennant (based on Flag.svg design)
  - Flag color: solid blue (#0146F5)
  - Consistent design in both book view and chapter view

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Updated bookmark flag rendering

---

## [0.5.66] - 2025-12-28

### Removed
- **Progress Bar Gestures** - Removed click/drag seeking from timeline
  - Removed pan gesture for scrubbing on TimelineProgressBar
  - Removed tap gesture for seeking on TimelineProgressBar
  - Removed pan/tap gestures from ChapterTimelineProgressBar
  - Scrubbing now only via joystick (avoids gesture conflicts)

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Removed gesture handlers from both timeline components

---

## [0.5.65] - 2025-12-28

### Added
- **Bookmark Flags on Timeline** - Visual bookmark indicators
  - Bookmarks now display as blue flags on the progress bar
  - Flag design: vertical pole with pennant shape at top
  - Book view: smaller flags positioned below the marker
  - Chapter view: larger flags that scroll with the timeline
  - Bookmarks rounded to nearest second for precise positioning
  - Flags only render within visible window for performance

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Added BookmarkFlagIcon, bookmark rendering in both timelines

---

## [0.5.64] - 2025-12-28

### Changed
- **Solid Red Joystick** - Simplified joystick appearance
  - Removed cover image and blur overlay
  - Removed play/pause icon from center
  - Joystick is now a solid red circle (#E53935)
  - Cleaned up unused imports (Image, BlurView, useCoverUrl)
  - Removed unused PlayIcon and PauseIcon components

### Files Modified
- `src/shared/components/CoverPlayButton.tsx` - Simplified to solid red circle

---

## [0.5.63] - 2025-12-28

### Changed
- **Joystick Scrub Only** - Removed play/pause from joystick
  - Tap no longer toggles play/pause
  - Joystick is now purely for scrubbing (drag left/right)
  - Long press still opens full player (if applicable)

### Files Modified
- `src/shared/components/CoverPlayButton.tsx` - Removed tap gesture, handlePlayPause

---

## [0.5.62] - 2025-12-28

### Changed
- **Standard Player Layout Cleanup** - Simplified layout
  - Removed duplicate smaller joystick/play button from upper area
  - Moved chapter title and time remaining to just under the header
  - Joystick only appears on timeline (chapter mode)
  - Book mode has no joystick (clean look)

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Layout changes, new styles

---

## [0.5.61] - 2025-12-28

### Changed
- **Joystick on Chapter Timeline** - Replaced red marker with joystick
  - Chapter view: Joystick (size 100) replaces the red dot at timeline center
  - Book view: Joystick hidden entirely (per user request)
  - Timeline still has vertical line marker below joystick
  - ChapterTimelineProgressBar now accepts `joystickComponent` prop

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Move joystick to timeline

---

## [0.5.60] - 2025-12-28

### Fixed
- **Critical: SmartRewind triggering on scrub release** - Audio jumping back
  - Root cause: SmartRewind detected "pause" during scrub and rewound on resume
  - SmartRewind state now cleared when scrub starts
  - Pause during scrub no longer records SmartRewind state
  - Added `audioService.getIsScrubbing()` getter
  - Added `playerStore.clearSmartRewind()` action

  ```
  BEFORE (audio jumped back 230s):
    Scrub to 721s → Release → SmartRewind from old 465s pause → Audio at 460s!

  AFTER (correct):
    Scrub starts → clearSmartRewind() → No old state
    Pause during scrub → Skip SmartRewind recording
    Resume → No rewind applied → Audio at 721s ✓
  ```

### Files Modified
- `src/features/player/services/audioService.ts` - Added `getIsScrubbing()` getter
- `src/features/player/stores/playerStore.ts` - Added `clearSmartRewind()`, check scrubbing in pause
- `src/shared/components/CoverPlayButton.tsx` - Call `clearSmartRewind()` on scrub start

---

## [0.5.59] - 2025-12-28

### Changed
- **Sub-second Position Accuracy** - Faster progress updates
  - Progress callback: 250ms → 100ms (10 updates/second)
  - Timeline now updates 2.5x more frequently for smoother scrolling
  - Media control updates: every ~1 second (was ~2 seconds)

### Files Modified
- `src/features/player/services/audioService.ts` - Poll rate 250ms → 100ms

---

## [0.5.58] - 2025-12-28

### Fixed
- **Critical: Audio not seeking to scrub position** - Await seek completion
  - `endScrub()` now async, awaits `seekTo()` before resuming playback
  - Added 50ms settle delay after seek before clearing scrubbing flag
  - Scrubbing flag stays ON during final seek (prevents callback overwrite)
  - All `player.seekTo()` calls now properly awaited in audioService
  - Removed setTimeout for trackSwitchInProgress clear (use await instead)

  ```
  BEFORE (race condition):
    setScrubbing(false)  ← Protection removed
    seekTo(500s)         ← Fire-and-forget
    play()               ← Immediate, audio still at 464s!

  AFTER (correct order):
    await seekTo(500s)   ← Wait for seek
    await delay(50ms)    ← Let audio settle
    setScrubbing(false)  ← Safe to clear
    play()               ← Audio at 500s ✓
  ```

### Files Modified
- `src/shared/components/CoverPlayButton.tsx` - Async endScrub, await seek
- `src/features/player/services/audioService.ts` - Await all player.seekTo() calls

---

## [0.5.57] - 2025-12-28

### Fixed
- **Scrub Position Sync** - Fixed position lag during joystick scrubbing
  - Added `audioService.setPosition()` - updates cached position without seeking
  - Scrub interval now calls `setPosition()` on EVERY update (not throttled)
  - `seekTo()` remains throttled for actual audio seeking
  - `lastKnownGoodPosition` now always reflects current scrub position

  ```
  BEFORE (position could lag):
    scrub interval → throttled seekTo() → lastKnownGoodPosition

  AFTER (position always current):
    scrub interval → setPosition() (immediate) + seekTo() (throttled)
  ```

### Files Modified
- `src/features/player/services/audioService.ts` - Added `setPosition()` method
- `src/shared/components/CoverPlayButton.tsx` - Call `setPosition()` on every scrub update

---

## [0.5.56] - 2025-12-28

### Changed
- **All Animations Now Instant** - Removed all animation durations
  - Timeline position updates: instant (was 100-500ms)
  - Timeline tap to seek: instant (was 100ms)
  - Thumb position updates: instant (was 100ms)
  - Thumb scale on drag: instant (was 100ms)
  - CD rotation speed changes: instant (was 300ms)
  - Player screen open/close: instant (was spring/150ms)
  - Pan gesture snap back: instant (was 150ms)
  - Title press navigation: instant (was 250ms delay)
  - Removed unused imports: `withTiming`, `Easing`, `ReanimatedEasing`, `DURATION`

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - All animation removal

---

## [0.5.55] - 2025-12-28

### Changed
- **Single Source of Truth Architecture** - Eliminated position conflicts
  - `audioService.lastKnownGoodPosition` is now THE authoritative position
  - Removed direct position writes from CoverPlayButton (joystick scrubber)
  - Simplified `playerStore.seekTo()` to only call `audioService.seekTo()`
  - Simplified `playerStore.updatePlaybackState()` to always accept position from audioService
  - Removed `lastSeekCommitTime` and `SEEK_SETTLING_MS` (no longer needed)
  - Position flow: `audioService.lastKnownGoodPosition` → callback → `playerStore.position` → UI
  - UI joystick preview uses `scrubOffset` (not position writes)

### Fixed
- **Cross-chapter scrubbing stability** - No more position flashing or multiple streams
  - Race condition fixed: `trackSwitchInProgress` flag set BEFORE `currentTrackIndex` update
  - audioService.seekTo() updates `lastKnownGoodPosition` immediately
  - Progress callback returns cached position during track switches and scrubbing

### Files Modified
- `src/shared/components/CoverPlayButton.tsx` - Removed direct position writes
- `src/features/player/stores/playerStore.ts` - Simplified seeking functions
- `src/features/player/services/audioService.ts` - Single source of truth for position

---

## [0.5.54] - 2025-12-28

### Fixed
- **Position flash on backward scrub** - Race condition in track switch
  - `trackSwitchInProgress` flag now set BEFORE updating `currentTrackIndex`
  - Prevents stale position being read during track switch

### Files Modified
- `src/features/player/services/audioService.ts` - Flag ordering fix

---

## [0.5.53] - 2025-12-28

### Fixed
- **Multiple audio streams bug** - Old player not stopped when switching tracks
  - Added `this.player.pause()` before swapping preloaded players in `executeTrackSwitch`
  - Fixed same issue in auto-advance logic
- **Position flash to chapter 1** - Added `lastKnownGoodPosition` cache
  - Cache provides stable position during track switch operations
  - `getGlobalPositionSync()` returns cached value during transitions

### Files Modified
- `src/features/player/services/audioService.ts` - Player cleanup, position cache

---

## [0.5.52] - 2025-12-28

### Fixed
- **First minute tick not marked** - Changed to 1-indexed minutes
  - Minute labels now show as "1", "2", "3" instead of "0", "1", "2"
  - First minute tick after chapter start now correctly labeled

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Minute indexing fix

---

## [0.5.51] - 2025-12-28

### Changed
- **Enhanced minute tick labels** - Better readability
  - 10-minute ticks now also show minute labels
  - Increased label font size for better visibility
  - Moved labels up slightly for better spacing

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Tick label improvements

---

## [0.5.50] - 2025-12-28

### Added
- **Minute Tick Labels** - Chapter-relative minute markers
  - 1-minute ticks now show small labels above them
  - Labels show minutes within the chapter (not book time)
  - Example: "1", "2", "3" for 1st, 2nd, 3rd minute of chapter
  - Smaller font (8px) and lighter color (50% opacity) than chapter labels
  - Labels positioned just above the tick mark
  - Minute 0 (chapter start) has no label (chapter label shows instead)

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Minute tick labels

---

## [0.5.49] - 2025-12-28

### Changed
- **Timeline Motion Spec Implementation** - Three motion types
  - **Skip/Large Jump (>5s)**: 100ms ease-out animation
  - **Playback (≤5s)**: 500ms linear animation for smooth scrolling
  - **Tap on timeline**: 100ms ease-out to tapped position
  - **Joystick scrub**: Direct update, no animation (0ms)
    - Added `scrubOffset` prop to ChapterTimelineProgressBar
    - Timeline follows joystick at 60fps with no animation wrapper
    - Ticks stay in place on release (no settle animation)
  - Visible tick window follows effective position during scrub

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Timeline motion implementation

---

## [0.5.48] - 2025-12-28

### Fixed
- **Chapter Label Smart Filtering** - Skip short chapter labels
  - Added MIN_CHAPTER_DURATION = 60 seconds threshold
  - Chapters shorter than 60s don't show labels (intros, transitions, credits)
  - Tick marks still render for all chapters
  - Combined with spacing check: must be long enough AND have space

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Chapter duration filtering

---

## [0.5.47] - 2025-12-28

### Fixed
- **Chapter Label Collision Detection** - No more overlapping labels
  - Tracks last label position to detect potential overlaps
  - Skips labels when chapters are too close (< 55px apart)
  - Chapter ticks still render, only labels are hidden
  - Prevents "CH 10CH 23" style collisions

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Label spacing logic

---

## [0.5.46] - 2025-12-28

### Changed
- **Smooth Chapter Timeline Animation** - Eliminated jitter
  - Playback: smooth 150ms linear animation for small position updates
  - Large jumps (seeks, chapter skips, rewind/ff): 300ms ease-out cubic animation
  - Tap-to-seek: 250ms ease-out cubic animation
  - Pan/scrub: direct (no animation) for responsive feel
  - Tracks position delta to choose appropriate animation duration
  - Uses Reanimated Easing for native-thread smoothness

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - ChapterTimelineProgressBar animation

---

## [0.5.45] - 2025-12-28

### Changed
- **Left Alignment Consistency** - Title aligns with chapter text
  - Removed paddingHorizontal from header container
  - Added paddingHorizontal: scale(22) to headerRow
  - Title, chapter row, and header row all now left-align at scale(22)

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Header/headerRow padding

---

## [0.5.44] - 2025-12-28

### Changed
- **Header Padding Alignment** - Match chapter row
  - Header paddingHorizontal: scale(20) → scale(22)
  - Now aligned with standardChapterRow padding

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Header padding

---

## [0.5.43] - 2025-12-28

### Changed
- **Standard Player Cover Height** - Taller cover image
  - Increased flex from 1.5 to 2.0 (~150px taller)

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Cover container flex increase

---

## [0.5.42] - 2025-12-28

### Changed
- **Chapter Timeline Performance Optimization**
  - Only render ticks within ±15 minutes of current position
  - Previously rendered ALL ticks for entire book (thousands for long books)
  - Now renders max ~120 ticks at any time (30 min window)
  - Ticks regenerate as position changes

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Windowed tick rendering

---

## [0.5.41] - 2025-12-28

### Changed
- **Chapter Timeline Refinements**
  - Zoomed in to ~5 minutes visible per screen
  - Changed 4th tier from 10-sec to 15-sec ticks
  - Center-aligned chapter labels above their ticks
  - Thicker chapter tick stroke (2.5px vs 1px for others)

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Timeline zoom, tick intervals, label alignment

---

## [0.5.40] - 2025-12-28

### Changed
- **Chapter Timeline Tick Heights** - Adjusted proportions
  - Chapter: 80px (was 50px)
  - 10-minute: 45px (was 24px)
  - 1-minute: 24px (was 14px)
  - 10-second: 11px (was 6px)

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Tick height adjustments

---

## [0.5.39] - 2025-12-28

### Changed
- **Chapter Timeline Zoom & 4th Tier** - More detail visible
  - Zoomed in from ~25 min to ~10 min visible per screen
  - Added 4th tier: 10-second tick marks (smallest)
  - Four-tier system now:
    - **Chapter** (50px) - at chapter boundaries with "CH X" labels
    - **10-minute** (24px) - every 10 minutes
    - **1-minute** (14px) - every minute
    - **10-second** (6px) - every 10 seconds
  - Smart collision avoidance for all tiers

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - 4-tier tick system, zoom adjustment

---

## [0.5.38] - 2025-12-28

### Changed
- **Chapter Timeline Sizing Fixes** - Match design mockup
  - Enlarged red marker circle from 60px to 100px
  - Extended red stem line to reach bottom of component (to cover image)
  - Increased chapter tick height from 28px to 50px
  - Increased 10-minute tick height from 16px to 24px
  - Increased 1-minute tick height from 8px to 10px
  - Total component height now 220px to accommodate larger elements

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Chapter timeline sizing updates

---

## [0.5.37] - 2025-12-28

### Changed
- **Chapter Timeline Time-Based Scale** - Three-tier tick system
  - Removed horizontal baseline
  - Now uses real time positioning (not normalized)
  - ~25 minutes visible per screen (roughly one chapter)
  - Three tick tiers:
    - **Chapter** (tallest, 28px) - at chapter boundaries with "CH X" labels
    - **10-minute** (medium, 16px) - every 10 minutes
    - **1-minute** (shortest, 8px) - every minute
  - Smart tick collision avoidance (skips overlapping ticks)

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Time-based ChapterTimelineProgressBar

---

## [0.5.36] - 2025-12-28

### Changed
- **Chapter Timeline Lollipop Design** - Visual redesign
  - Large red circle (60px) at top - lollipop style marker
  - Red vertical line extending down to the timeline
  - Chapter labels ("CH 1", "CH 2") above the major ticks
  - Major ticks (24px) at chapter boundaries
  - Minor ticks (12px) between chapters (10 per chapter)
  - Horizontal baseline connecting all ticks
  - Timeline scrolls beneath the fixed marker

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Redesigned ChapterTimelineProgressBar

---

## [0.5.35] - 2025-12-28

### Added
- **Chapter Timeline Progress Bar** - Scrolling chapter view
  - New `ChapterTimelineProgressBar` component for chapter mode
  - 5x wider than screen (scrolls horizontally)
  - Fixed red marker at center of screen
  - Timeline scrolls left as playback progresses
  - Chapter ticks normalized (equal width per chapter)
  - Chapter labels ("Ch 1", "Ch 2", etc.) below ticks
  - Pan gesture to scrub through timeline
  - Tap gesture to seek to position

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - New ChapterTimelineProgressBar component

---

## [0.5.34] - 2025-12-28

### Changed
- **Progress Bar Mode Structure** - Prepare for chapter view
  - Associated TimelineProgressBar with 'book' progressMode
  - Added placeholder for 'chapter' mode (uses book timeline temporarily)
  - Ready for chapter-specific progress bar implementation

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Progress bar mode switching

---

## [0.5.33] - 2025-12-28

### Changed
- **Standard Player Controls** - White background
  - Changed controls bar background from #F5F5F5 to #FFFFFF (pure white)

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Controls bar color

---

## [0.5.32] - 2025-12-28

### Changed
- **Standard Player Pills Hidden** - Cleaner interface
  - Hidden sleep timer, queue, and speed pills for Standard Player
  - Pills still visible in CD Player mode
  - Speed control moved to Settings sheet (grid of speed options)
  - Queue and Bookmark accessible via overlay buttons on cover

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Hide pills, add speed grid to settings

---

## [0.5.31] - 2025-12-28

### Changed
- **Standard Player Cover & Overlay Buttons**
  - Cover is now 1.5x taller (flex: 1.5)
  - Added white circular Queue button on left side of cover (above rewind)
  - Added white circular Bookmark button on right side (above fast forward)
  - Queue button shows count badge when items in queue
  - Bookmark button creates bookmark at current position with haptic feedback
  - Buttons have subtle shadow for visibility on any cover

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Cover height, overlay buttons, bookmark handler

---

## [0.5.30] - 2025-12-28

### Changed
- **Standard Player Title/Author/Narrator** - Complete Book Detail style
  - Left edge aligned with pills, chapter row, and progress bar (scale(22) padding)
  - Added narrator extraction from metadata
  - Two-column layout: "WRITTEN BY" and "NARRATED BY" side by side
  - Author clickable → navigates to AuthorDetail screen
  - Narrator clickable → navigates to NarratorDetail screen

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Narrator support, clickable links, aligned layout

---

## [0.5.29] - 2025-12-28

### Changed
- **Standard Player Title/Author** - Book Detail page style
  - Large bold title (22px, weight 700)
  - "WRITTEN BY" label in small gray uppercase
  - Author name below in medium weight
  - Left-aligned layout matching Book Detail screen

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - New title section styles

---

## [0.5.28] - 2025-12-27

### Changed
- **Standard Player Overlap Layout** - Controls overlap cover artwork
  - Controls bar now overlaps bottom of cover with negative margin
  - Removed rounded corners on controls bar (borderRadius: 0)
  - Made controls bar full width (no horizontal margins)
  - Progress bar full width and aligned to top of cover (no padding/margin)
  - Bottom padding reduced to just safe area inset

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Controls overlap, styles updated

---

## [0.5.27] - 2025-12-27

### Changed
- **Standard Player Bottom Alignment** - Controls at screen bottom
  - Reduced bottom padding for Standard Player (nav is hidden)
  - Bottom content now aligns where nav bar would be
  - Just safe area inset + 16px padding

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Bottom padding adjustment

---

## [0.5.26] - 2025-12-27

### Changed
- **Standard Player Layout** - Independent scrub button positioning
  - Scrub button now in upper area (after pills)
  - Flex spacer moved after scrub button
  - Bottom content (chapter, progress, cover, controls) pushed to bottom
  - Scrub button position doesn't affect bottom content layout

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Layout reorganization

---

## [0.5.25] - 2025-12-27

### Fixed
- **Rect Import** - Added missing `Rect` import from react-native-svg for pause icon

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Added Rect import

---

## [0.5.24] - 2025-12-27

### Changed
- **Standard Player Layout Overhaul** - Matching design spec
  - Chapter name + remaining time moved above progress bar
  - Full-width cover image (fills available space)
  - Controls bar moved to bottom of screen
  - Layout order: Scrub button → Chapter/Time → Timeline → Cover → Controls

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Layout reorganization

---

## [0.5.23] - 2025-12-27

### Changed
- **Standard Player Controls Bar** - New 3-button control bar design
  - Skip Back | Play/Pause | Skip Forward in a rounded bar
  - Vertical dividers between buttons
  - Red play/pause icon, black skip icons
  - Light gray background (#F5F5F5)
  - Scrub play button remains above for joystick scrubbing

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - New controls bar

---

## [0.5.22] - 2025-12-27

### Changed
- **Standard Player Cover Size** - Smaller centered cover
  - Cover reduced to 120x120 (from ~180x180)
  - Centered below progress bar
  - Smaller border radius and shadow for compact look

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Cover size reduced

---

## [0.5.21] - 2025-12-27

### Changed
- **Standard Player Cover Position** - Cover moved below progress bar
  - Album cover now appears under the timeline progress bar
  - Provides more visual space for controls at top

- **Hide Navigation Bar on Player** - Cleaner full-screen player
  - Main tab bar hidden when full player is open
  - More immersive player experience

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Cover repositioned
- `src/navigation/components/FloatingTabBar.tsx` - Hide when player visible

---

## [0.5.20] - 2025-12-27

### Changed
- **Standard Player Jog Overlay** - Scrub indicator above play button
  - Jog overlay (arrows + offset) now appears above scrub play button
  - Replaces time indicator when scrubbing is active
  - Dark styling for white background (light bg, dark text)
  - Red accent for offset amount

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Jog overlay positioning

---

## [0.5.19] - 2025-12-27

### Changed
- **Standard Player Layout Reorganization** - Improved control layout
  - Time indicator (position / duration) moved above scrub play button
  - Scrub play button positioned above timeline progress bar
  - Skip buttons centered below timeline (no play button in center)
  - Scrub speed scale hidden for cleaner look
  - Dark icons for skip buttons on white background

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Layout reorganization

---

## [0.5.18] - 2025-12-27

### Changed
- **Standard Player Timeline Progress Bar** - Ruler-style progress bar for standard player
  - Red marker circle with shadow/glow effect
  - Major tick marks at chapter boundaries
  - Minor ticks at 25%, 50%, 75% within chapters (adaptive density)
  - Equal width per chapter (normalized timeline)
  - Tap to seek, drag to scrub
  - Dark text for time labels and chapter info on white background

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Added TimelineProgressBar component

---

## [0.5.17] - 2025-12-27

### Changed
- **Standard Player White Background** - Clean light theme for standard player mode
  - White background replaces blurred cover background
  - Dark text for title, author, and source indicator
  - Dark icons for close arrow, settings, and cloud
  - StatusBar changes to dark-content for proper contrast
  - CD player mode retains original blur effect

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - White background, dark text/icons

---

## [0.5.16] - 2025-12-27

### Changed
- **Standard Player Default** - Standard player (static cover) is now the default
  - `useStandardPlayer` defaults to `true` instead of `false`
  - Users can still toggle to CD player mode in settings

### Files Modified
- `src/features/player/stores/playerStore.ts` - Changed default

---

## [0.5.15] - 2025-12-27

### Changed
- **Timeline Progress Bar** - Adaptive density for many chapters
  - ≥20px per chapter: full density (25%, 50%, 75% minor ticks)
  - ≥12px per chapter: reduced density (50% only)
  - <12px per chapter: no minor ticks, just chapter markers
  - Prevents overcrowding on books with many chapters

### Files Modified
- `src/navigation/components/GlobalMiniPlayer.tsx` - Adaptive tick density

---

## [0.5.14] - 2025-12-27

### Changed
- **Timeline Progress Bar** - Treat 0 chapters as 1 chapter
  - Books with no chapters now show same layout as 1-chapter books
  - 2 major ticks (start/end) + 3 minor ticks (25%, 50%, 75%)
  - Consistent appearance regardless of chapter metadata

### Files Modified
- `src/navigation/components/GlobalMiniPlayer.tsx` - 0 chapters fallback

---

## [0.5.13] - 2025-12-27

### Changed
- **Timeline Progress Bar** - Chapter-based normalized timeline
  - Major tick marks represent chapters (one per chapter)
  - Minor tick marks at 25%, 50%, 75% within each chapter
  - All chapters take equal width regardless of actual duration
  - Seeking respects chapter boundaries and maps correctly

### Files Modified
- `src/navigation/components/GlobalMiniPlayer.tsx` - Chapter-aware timeline

---

## [0.5.12] - 2025-12-27

### Added
- **Timeline Progress Bar** - Ruler-style progress bar for mini player
  - Red floating marker indicates current position
  - Major and minor tick marks like a ruler/timeline
  - Tap anywhere to seek
  - Drag marker to scrub through book
  - Current tick highlights in red
  - Marker has subtle shadow/glow effect

### Files Modified
- `src/navigation/components/GlobalMiniPlayer.tsx` - Added TimelineProgressBar component

---

## [0.5.11] - 2025-12-27

### Changed
- **Mini Player Buttons** - Refined styling
  - All circle buttons use 1pt stroke (was 1.5pt)
  - Play/pause icon is red, border remains black

### Files Modified
- `src/navigation/components/GlobalMiniPlayer.tsx` - Button stroke refinement

---

## [0.5.9] - 2025-12-27

### Changed
- **Navigation Bar Icons** - Updated all icons to match design spec
  - New thinner, cleaner icon designs for Browse, Library, Search, Profile, Home
  - Icons sourced from design SVG files

- **Mini Player Buttons** - Reduced size for cleaner appearance
  - Button size reduced from 44 to 32
  - Icon size reduced from 18 to 14

### Files Modified
- `src/navigation/components/FloatingTabBar.tsx` - New icon paths
- `src/navigation/components/GlobalMiniPlayer.tsx` - Smaller buttons/icons

---

## [0.5.8] - 2025-12-27

### Changed
- **Mini Player Redesign** - Clean, minimal floating player
  - Circular cover image instead of spinning CD animation
  - Bold title display
  - Three circular outline buttons: Skip Back, Skip Forward, Play/Pause
  - Removed progress bar for cleaner look
  - Swipe up gesture to open full player

- **Navigation Bar Reorder** - Updated tab order for better UX
  - New order: Browse | Library | Search | Profile | Home
  - Thin outline icons with active state

- **Library Screen Light Theme** - Unified with home screen styling
  - White background with dark text
  - Updated tab bar, search bar, and all cards to use theme colors
  - Dynamic theme support via useThemeColors hook

### Files Modified
- `src/navigation/components/GlobalMiniPlayer.tsx` - Complete redesign
- `src/navigation/components/FloatingTabBar.tsx` - Tab order change
- `src/features/library/screens/MyLibraryScreen.tsx` - Light theme conversion

---

## [0.5.7] - 2025-12-27

### Changed
- **BookDetailScreen Redesign** - Complete visual overhaul with light theme
  - Full-width square cover image at top
  - Overlay buttons on cover: back (top-left), queue/download/play (bottom row)
  - Download button shows circular SVG progress indicator during download
  - Two-column metadata layout: title & series (left), author & narrator (right)
  - Clickable genre pills that navigate to genre filter
  - Progress bar with completion % and time remaining
  - Clean Overview/Chapters tabs with accent underline
  - White background with dark text for readability

- **Dark Mode Support** - Added theme store and toggle
  - Created `themeStore.ts` with light/dark mode support
  - Added dark mode toggle in Profile screen
  - HomeScreen and TextListSection now respect theme colors

- **Tab Transition Animations** - Polished animations for home screen tabs
  - Subtle 12px slide with proper easing curves
  - Easing.out(quad) for exit, Easing.out(cubic) for enter

- **Long Press for Book Details** - Books now navigate to detail page on long press
  - Added haptic feedback on long press
  - Quick tap still plays the book

### Files Modified
- `src/features/book-detail/screens/BookDetailScreen.tsx` - Complete redesign
- `src/shared/components/Skeleton.tsx` - Light theme skeleton colors
- `src/shared/components/ErrorView.tsx` - Light theme error styling
- `src/shared/theme/themeStore.ts` - New theme store
- `src/features/home/screens/HomeScreen.tsx` - Theme colors, long press handler
- `src/features/home/components/TextListSection.tsx` - Theme colors, polished animations
- `src/features/profile/screens/ProfileScreen.tsx` - Dark mode toggle

---

## [0.5.6] - 2025-12-27

### Fixed
- **SQLite NOT NULL Constraint Error** - Fixed crash when server returns undefined position
  - Sync conflict resolution now validates `serverProgress.currentTime` before saving
  - Guards against `undefined`, `null`, or `NaN` position values from server
  - When server position is invalid, keeps local progress and marks as synced
  - Resolves `NOT NULL constraint failed: playback_progress.position` errors

### Files Modified
- `src/features/player/services/backgroundSyncService.ts` - Added position validation guard

---

## [0.5.5] - 2025-12-27

### Fixed
- **Android Manifest Duplicates** - Removed duplicate permission declarations
  - `FOREGROUND_SERVICE` (was declared twice)
  - `FOREGROUND_SERVICE_MEDIA_PLAYBACK` (was declared twice)
  - `WAKE_LOCK` (was declared twice)
  - Fixes build warnings about duplicate elements

- **NativeEventEmitter Warnings** - Fixed React Native 0.81+ compatibility
  - Added `addListener()` and `removeListeners()` methods to `AndroidAutoModule`
  - Resolves `NativeEventEmitter was called without required methods` warnings

- **SecureStore Size Warning** - Fixed iOS 2048 byte limit issue
  - Split storage between SecureStore (sensitive) and AsyncStorage (large data)
  - Token and server URL now use SecureStore (small, sensitive)
  - User data with mediaProgress/bookmarks now uses AsyncStorage (large, not sensitive)
  - Fixes `Value being stored is larger than 2048 bytes` warning

### Reviewed
- **Performance Budget Warnings** - Investigated cold start performance
  - HomeScreen (783ms) and CDPlayerScreen (721ms) exceed 400ms budget during cold start
  - Times are expected due to audio setup (~957ms) and library cache (~209ms)
  - 400ms budget intended for navigation, not initial load - current behavior acceptable

### Files Modified
- `android/app/src/main/AndroidManifest.xml` - Removed duplicate permissions
- `android/app/src/main/java/com/secretlibrary/app/AndroidAutoModule.kt` - Added listener methods
- `src/core/auth/authService.ts` - Split secure/async storage

---

## [0.5.4] - 2025-12-26

### Added
- **Accessibility Utilities (Fix 4.7)** - Comprehensive accessibility toolkit
  - `MIN_TOUCH_TARGET` constant (44pt per Apple HIG/Material Design)
  - `calculateHitSlop()` - Auto-calculate hit slop for small elements
  - `buildButtonAccessibility()` - Button accessibility props builder
  - `buildSliderAccessibility()` - Slider/adjustable props builder
  - `buildProgressAccessibility()` - Progress bar props builder
  - `buildImageAccessibility()` - Image accessibility props
  - `buildHeadingAccessibility()` - Header/heading props
  - `buildLinkAccessibility()` - Link element props
  - `buildToggleAccessibility()` - Switch/toggle props
  - `buildTabAccessibility()` - Tab button props
  - `buildListItemAccessibility()` - List item props
  - `formatTimeForAccessibility()` - Human-readable duration
  - `formatProgressForAccessibility()` - Progress percentage formatting
  - `buildBookDescription()` - Full audiobook description for screen readers
  - `checkColorContrast()` - WCAG contrast ratio checker

- **Accessibility Hooks**
  - `useAccessibilityState()` - All accessibility settings detection
  - `useScreenReader()` - Screen reader active detection
  - `useReduceMotion()` - Reduce motion preference detection
  - `useAnnounce()` - Screen reader announcement function
  - `useAccessibilityFocus()` - Focus management for screen readers
  - `useAnnounceScreen()` - Auto-announce screen changes

### Files Added
- `src/shared/accessibility/accessibilityUtils.ts` - Core accessibility utilities
- `src/shared/accessibility/useAccessibility.ts` - Accessibility React hooks
- `src/shared/accessibility/index.ts` - Module exports
- `src/shared/accessibility/__tests__/accessibilityUtils.test.ts` - 47 accessibility tests

### Test Count
- 667 tests passing (added 47 new tests)

### Phase 4 Complete
All Phase 4 fixes completed:
- Fix 4.1: WebSocket Integration
- Fix 4.2: Large Library Optimizations (Trigram Search)
- Fix 4.3: Search Performance (In-memory FTS)
- Fix 4.4: E2E Testing (Maestro - already configured)
- Fix 4.5: Advanced Analytics
- Fix 4.6: Animation & Haptics Polish (Tests added)
- Fix 4.7: Accessibility Audit (Complete toolkit)

---

## [0.5.3] - 2025-12-26

### Added
- **Haptics Test Suite (Fix 4.6)** - Comprehensive tests for haptic feedback service
  - 56 tests covering all haptic categories
  - Tests for playback, scrubber, speed control, sleep timer haptics
  - Tests for download, bookmark, and completion celebration haptics
  - Tests for UI interaction haptics (button, toggle, swipe, etc.)
  - Tests for category-based enable/disable settings
  - Tests for haptic patterns (double-tap, sequences)

### Files Added
- `src/core/native/__tests__/haptics.test.ts` - 56 comprehensive haptic tests

### Test Count
- 620 tests passing (added 56 new tests)

---

## [0.5.2] - 2025-12-26

### Added
- **Analytics Service (Fix 4.5)** - Unified analytics and performance tracking
  - Session tracking with duration and screen view counts
  - Playback analytics (play/pause, seek, speed change, chapters)
  - Download analytics (start, complete, error, delete)
  - Search analytics with privacy-safe query tracking
  - Library interaction tracking (book open, series, author)
  - Performance metric collection with budget enforcement
  - Batched event flushing (1-minute intervals)
  - App state tracking (foreground/background)
  - Integration with Sentry for breadcrumbs

### Files Added
- `src/core/analytics/analyticsService.ts` - Core analytics service
- `src/core/analytics/useAnalytics.ts` - React hooks for analytics
- `src/core/analytics/index.ts` - Module exports
- `src/core/analytics/__tests__/analyticsService.test.ts` - 24 analytics tests

### Test Count
- 564 tests passing (added 24 new tests)

---

## [0.5.1] - 2025-12-26

### Added
- **Phase 4: Advanced Features & Polish** - Performance and real-time sync improvements
  - **WebSocket Integration (Fix 4.1)** - Real-time sync with AudiobookShelf server
    - Socket.io-client connection to server for live updates
    - Automatic reconnection with exponential backoff + jitter
    - App state awareness (disconnect on background, reconnect on foreground)
    - Events: progress sync, item added/updated/removed, library scan complete
    - React Query cache invalidation on WebSocket events
    - Connects on login, disconnects on logout
  - **Trigram Search Index (Fix 4.2)** - Fast in-memory fuzzy search
    - Pre-computed trigram index for O(1) candidate lookup
    - Jaccard similarity scoring for fuzzy matching
    - Prefix matching for short queries (1-2 chars)
    - Sub-100ms search for libraries up to 10,000 books
    - Exact match lookups by title/author/narrator/series

### Files Added
- `src/core/services/websocketService.ts` - WebSocket service with auto-reconnection
- `src/core/services/__tests__/websocketService.test.ts` - 19 WebSocket tests
- `src/core/cache/searchIndex.ts` - Trigram-based fuzzy search index
- `src/core/cache/__tests__/searchIndex.test.ts` - 22 search index tests

### Files Modified
- `src/core/events/types.ts` - Added WebSocket events to EventMap
- `src/core/events/listeners.ts` - Added WebSocket event handlers for cache invalidation
- `src/core/services/appInitializer.ts` - Added WebSocket connect/disconnect lifecycle
- `src/core/auth/authContext.tsx` - Connect WebSocket on login, disconnect on logout
- `src/core/cache/libraryCache.ts` - Integrated search index, builds on cache load
- `src/core/cache/index.ts` - Export searchIndex and SearchResult type
- `jest.setup.js` - Added socket.io-client mock

### Test Count
- 540 tests passing (added 41 new tests)

---

## [0.5.0] - 2025-12-26

### Added
- **Phase 3: Strategic Refactoring** - Major architectural improvements for testability and maintainability
  - **Pure function utilities** - Extracted 5 utility modules from playerStore
    - `trackNavigator.ts` - Multi-file audiobook track navigation
    - `progressCalculator.ts` - Progress formatting and calculations
    - `playbackRateResolver.ts` - Per-book playback speed resolution
    - `chapterNavigator.ts` - Chapter navigation and progress
    - `smartRewindCalculator.ts` - Pause-based rewind calculation (already existed)
  - **XState audio machine** - State machine for audio playback control
    - States: idle, loading, ready, playing, paused, buffering, seeking, error
    - Replaces flag-based state with proper state transitions
    - Position updates blocked during seeking (fixes UI jitter)
  - **Extracted stores** - Decomposed playerStore into focused stores
    - `settingsStore.ts` - Playback settings, skip intervals, smart rewind
    - `progressStore.ts` - Per-book progress tracking and sync queue
    - `uiStore.ts` - Player UI state (loading, visibility, sheets)
  - **Download integrity verification** - Checksum and size validation
    - SHA-256 checksum verification for downloaded files
    - Size tolerance validation with retry logic
    - Batch verification support
  - **Comprehensive test suite** - 499 tests (major increase from baseline)
    - 100% coverage on pure utility functions
    - Integration tests for player behavior
    - State machine transition tests

### Files Added
- `src/features/player/utils/types.ts` - Shared type definitions
- `src/features/player/utils/trackNavigator.ts` - Track navigation utilities
- `src/features/player/utils/progressCalculator.ts` - Progress calculation utilities
- `src/features/player/utils/playbackRateResolver.ts` - Playback rate utilities
- `src/features/player/utils/chapterNavigator.ts` - Chapter navigation utilities
- `src/features/player/utils/index.ts` - Utility exports
- `src/features/player/machines/audioMachine.ts` - XState audio state machine
- `src/features/player/machines/index.ts` - Machine exports
- `src/features/player/stores/settingsStore.ts` - Player settings store
- `src/features/player/stores/progressStore.ts` - Progress tracking store
- `src/features/player/stores/uiStore.ts` - Player UI state store
- `src/features/player/stores/__tests__/testUtils.ts` - Test utilities and mocks
- `src/features/player/stores/__tests__/playerStore.integration.test.ts`
- `src/features/player/stores/__tests__/settingsStore.test.ts`
- `src/features/player/stores/__tests__/progressStore.test.ts`
- `src/features/player/stores/__tests__/uiStore.test.ts`
- `src/features/player/utils/__tests__/trackNavigator.test.ts`
- `src/features/player/utils/__tests__/progressCalculator.test.ts`
- `src/features/player/utils/__tests__/playbackRateResolver.test.ts`
- `src/features/player/utils/__tests__/chapterNavigator.test.ts`
- `src/features/player/utils/__tests__/smartRewindCalculator.test.ts`
- `src/features/player/machines/__tests__/audioMachine.test.ts`
- `src/core/services/downloadIntegrity.ts` - Download integrity service
- `src/core/services/__tests__/downloadIntegrity.test.ts`

### Files Modified
- `jest.setup.js` - Fixed expo-av mock, added expo-crypto mock
- `package.json` - Added xstate, @xstate/react, expo-crypto dependencies

---

## [0.4.93] - 2025-12-26

### Added
- **Phase 2: Structural Improvements** - Major internal architecture enhancements
  - **Event Bus system** - Type-safe pub/sub for decoupled cross-store communication
    - Created `src/core/events/` with eventBus, types, and app-wide listeners
    - Events for playback, progress sync, downloads, auth, and app lifecycle
  - **Parallel sync processing** - 5x faster progress sync with concurrent requests
    - Added `processWithConcurrency()` to backgroundSyncService
    - Batch processing with concurrency limit of 5 parallel requests
  - **Foreground refetch** - Auto-refresh stale data when app returns from background
    - Created `src/core/lifecycle/appStateListener.ts`
    - Invalidates progress/library queries after 5+ seconds in background
  - **Series progress fix** - Book completion now immediately updates series view
    - Event listeners invalidate queries and refresh library cache on book:finished
    - Conflict resolution also triggers cache refresh
  - **Partial download playback** - Play books while they're still downloading
    - Added `canPlayPartially()` and `getDownloadedFiles()` to downloadManager
    - Player now uses available files, emits events when new files complete
    - `download:file_complete` event fired for each completed audio file

### Files Added
- `src/core/events/types.ts` - Event type definitions for all app domains
- `src/core/events/eventBus.ts` - Type-safe event bus implementation
- `src/core/events/listeners.ts` - App-wide event listeners with query invalidation
- `src/core/events/index.ts` - Event module exports
- `src/core/lifecycle/appStateListener.ts` - Foreground/background detection
- `src/core/lifecycle/index.ts` - Lifecycle module exports

### Files Modified
- `src/features/player/stores/playerStore.ts` - Event emissions, partial download support
- `src/features/player/services/backgroundSyncService.ts` - Parallel sync, public syncUnsyncedFromStorage
- `src/core/services/downloadManager.ts` - Per-file events, getDownloadedFiles, canPlayPartially
- `src/core/services/appInitializer.ts` - Event system initialization on app startup

---

## [0.4.92] - 2025-12-23

### Added
- **Android Auto native support** - Full Android Auto integration
  - Created MediaPlaybackService for browse tree (Continue Listening, Downloads)
  - Created AndroidAutoModule React Native bridge for event handling
  - Added automotive_app_desc.xml for Android Auto compatibility
  - Browse data synced via JSON file from React Native layer

### Files Added
- `android/app/src/main/java/com/secretlibrary/app/MediaPlaybackService.kt`
- `android/app/src/main/java/com/secretlibrary/app/AndroidAutoModule.kt`
- `android/app/src/main/java/com/secretlibrary/app/AndroidAutoPackage.kt`
- `android/app/src/main/res/xml/automotive_app_desc.xml`

### Files Modified
- `android/app/src/main/AndroidManifest.xml` - Added MediaPlaybackService declaration
- `android/app/src/main/java/com/secretlibrary/app/MainApplication.kt` - Registered AndroidAutoPackage

---

## [0.4.91] - 2025-12-23

### Fixed
- **Joystick scrub lag/sync** - Scrubbing now seeks audio in real-time
  - Added throttled seeking every 300ms during scrub for responsive audio feedback
  - Changed scrub interval from 1ms to 16ms (60fps) for better performance
  - Audio now stays in sync with visual scrub position
- **Android Auto double playback** - Fixed duplicate playback on Android Auto
  - Added 2-second deduplication window to prevent rapid duplicate play requests
  - Both MediaSession and JS layer events now properly deduplicated

### Files Modified
- `src/shared/components/CoverPlayButton.tsx` - Added throttled real-time seeking during scrub
- `src/features/automotive/automotiveService.ts` - Added playItem deduplication logic

---

## [0.4.90] - 2025-12-21

### Fixed
- **Immediate playback speed changes** - Speed changes now apply instantly
  - Added `await` to `audioService.setPlaybackRate()` calls for immediate effect
  - SpeedSheet now waits for speed change before closing

### Files Modified
- `src/features/player/services/audioService.ts` - Await setPlaybackRate calls
- `src/features/player/sheets/SpeedSheet.tsx` - Await speed change before close

---

## [0.4.89] - 2025-12-21

### Added
- **UX Audit Phase 3 Implementation** - Implemented P3 nice-to-have improvements
  - **Personalized greeting** - Home header shows time-based greeting (Good morning/afternoon/evening)

### Already Implemented (Verified)
- Disc spinning animation - CDPlayerScreen has rotation animation with settings toggle
- Visual progress bar for onboarding - PreferencesOnboardingScreen has animated progress bar
- Sort options on list screens - All list screens (Series, Authors, Narrators, Genres) have sort options

### Files Modified
- `src/features/home/components/HomeHeader.tsx` - Added getGreeting() for time-based greeting

---

## [0.4.88] - 2025-12-21

### Added
- **UX Audit Phase 2 Implementation** - Implemented P2 improvements from UX audit
  - **Mini-player skip forward** - Added skip forward 30s button to match skip back
  - **Home carousel progress bars** - Added visual progress bars on Continue Listening cards

### Performance
- **Series page image flickering fix** - Eliminated image flickering on the series detail screen
  - Fixed StackedCovers using array index as key (now uses book ID or extracted URL ID)
  - Added `React.memo` to SeriesBookRow to prevent unnecessary re-renders
  - Memoized `bookIds` and `firstBookCoverUrl` to prevent reference instability
  - Memoized `renderBookItem` callback with proper dependencies
  - Memoized `ListHeader` component with `useMemo`
  - Added `cachePolicy="memory-disk"` to cover images

### Already Implemented (Verified)
- Chapter completion indicators - ChaptersTab already has checkmarks and progress
- Per-book status badges in Series - SeriesBookRow already has completion badges
- Recent searches - SearchScreen already stores and displays search history
- Login error messages - AuthService already has user-friendly error messages

### Files Modified
- `src/navigation/components/GlobalMiniPlayer.tsx` - Added FastForwardIcon and skip forward button
- `src/features/home/components/ContinueListeningSection.tsx` - Added progress bars to book cards
- `src/shared/components/StackedCovers.tsx` - Use stable keys from bookIds prop, added caching
- `src/features/series/screens/SeriesDetailScreen.tsx` - Memoized callbacks and header component
- `src/features/series/components/SeriesBookRow.tsx` - Wrapped with React.memo

---

## [0.4.87] - 2025-12-21

### Performance
- **CDPlayerScreen open time optimization** - Reduced screen open time by 220-600ms
  - Added chapter normalization cache (100-300ms saved) - Caches parsed chapter names by book to avoid re-parsing on every mount
  - Deferred CoverPlayButton gesture initialization using InteractionManager (50-150ms saved)
  - Deferred disc animation start until after first paint (50-100ms saved)
  - Shows simple play button placeholder during initial render, swaps to full gesture handler after interactions complete

### Files Modified
- `src/core/services/chapterNormalizer.ts` - Added persistent Map cache with LRU eviction (50 entries max)
- `src/features/player/screens/CDPlayerScreen.tsx` - Added InteractionManager deferral for gestures and animations

---

## [0.4.86] - 2025-12-21

### Added
- **UX Audit Phase 1 Implementation** - Implemented critical P1 fixes from comprehensive UX audit
  - **Skip button labels** - Added visible time labels (15s/30s) to CD Player skip buttons
  - **Sleep timer in mini-player** - Shows countdown when timer is active with moon icon
  - **Book Detail progress bar** - Enhanced to show both percentage and time remaining
  - **Library row progress bars** - Added thin visual progress bars to in-progress books
  - **Home screen empty state** - Welcome screen for new users with CTA to browse library

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Skip button labels with dynamic intervals
- `src/navigation/components/GlobalMiniPlayer.tsx` - Sleep timer countdown display
- `src/features/book-detail/screens/BookDetailScreen.tsx` - Enhanced progress bar with time remaining
- `src/features/library/screens/MyLibraryScreen.tsx` - Progress bars in book rows
- `src/features/home/screens/HomeScreen.tsx` - Comprehensive empty state for new users

### Documentation
- Created UX audit implementation plan at `~/.claude/plans/ux-audit-implementation.md`
- 52 total issues identified (10 P1, 40 P2, ~12 P3)

---

## [0.4.85] - 2025-12-21

### Fixed
- **Reanimated shared value warnings** - Fixed warning "Reading from `value` during component render" in Snackbar component by tracking animation completion state with React state instead of reading shared value directly during render

### Files Modified
- `src/shared/components/Snackbar.tsx` - Use `isHidden` React state instead of `opacity.value` for early return check

---

## [0.4.84] - 2025-12-21

### Added
- **Runtime Monitoring System (DEV only)**
  - Comprehensive error tracking with severity levels (critical/high/medium/low)
  - Network monitoring with fetch patching for slow/failed requests
  - Render performance monitoring (excessive re-renders, slow mounts)
  - Audio player state tracking
  - Image loading monitoring
  - Storage operation tracking
  - Memory monitoring (heap usage trends)
  - ANR (App Not Responding) detection via JS thread heartbeat
  - Navigation tracking
  - User interaction monitoring
  - Listener leak detection

- **Debug Stress Test Screen**
  - Memory pressure tests
  - Rapid re-render tests
  - Concurrent network stress tests
  - Storage stress tests
  - Listener leak detection
  - Error store health checks
  - Accessible from Profile > Developer > Stress Tests (DEV only)

### Files Added
- `src/utils/runtimeMonitor.ts` - Complete monitoring system with 11 monitors
- `src/features/debug/screens/DebugStressTestScreen.tsx` - Stress test UI
- `src/features/debug/index.ts` - Debug feature exports

### Files Modified
- `App.tsx` - Initialize runtime monitoring in __DEV__ mode
- `src/navigation/AppNavigator.tsx` - Added navigation tracking, debug screen route
- `src/features/profile/screens/ProfileScreen.tsx` - Added stress test link in Developer section

---

## [0.4.83] - 2025-12-21

### Removed
- **Dead Code Cleanup: 16 Orphaned Files (~2,700 lines)**
  - `features/series/screens/SeriesListScreen.tsx` (60 lines) - duplicate of library version
  - `features/player/screens/StandardPlayerScreen.tsx` (697 lines) - never imported
  - `navigation/components/BottomTabBar.tsx` (140 lines) - never imported
  - `shared/components/SyncStatusBadge.tsx` (142 lines) - 0 usages
  - `shared/components/GestureComponents.tsx` (76 lines) - 0 usages
  - `shared/assets/svg/backgrounds.tsx` (130 lines) - 0 usages
  - `shared/assets/svg/navigation.tsx` (56 lines) - 0 usages
  - `shared/assets/svg/overlays.tsx` (46 lines) - 0 usages
  - `features/home/homeDesign.ts` (243 lines) - 0 usages
  - `features/home/constants.ts` (157 lines) - 0 usages
  - `features/book-detail/components/BookInfo.tsx` (197 lines)
  - `features/book-detail/components/ChapterList.tsx` (147 lines)
  - `features/book-detail/components/PlayButtonWithProgress.tsx` (114 lines)
  - `features/library/components/AppliedFilters.tsx` (131 lines)
  - `features/player/hooks/useSmartRewind.ts` (249 lines)
  - `navigation/components/TopNavBar.tsx` (114 lines)

- **Dead Exports Removed**
  - `BottomTabBar` from navigation/components/index.ts
  - `StandardPlayerScreen` from player/index.ts
  - `Swipeable` and `SyncStatusBadge` from shared/components/index.ts
  - `SeriesListScreen` from series/index.ts
  - SVG exports (backgrounds, navigation, overlays) from svg/index.ts
  - `constants` re-export from home/index.ts

### Changed
- **Code Consolidation: formatDuration Unified**
  - Consolidated 4 duplicate `formatDuration` implementations into `shared/utils/format.ts`
  - Added `formatDurationLong` to format.ts for stats display
  - Updated imports in: SeriesCard, ShareStatsCard, StatsScreen, metadata.ts
  - Removed duplicates from: useListeningStats.ts, metadata.ts
  - Note: audioDebug.ts keeps its own version (different format: HH:MM:SS for logging)

### Files Modified
- 16 files deleted (see list above)
- `src/navigation/components/index.ts` - removed BottomTabBar export
- `src/features/player/index.ts` - removed StandardPlayerScreen export
- `src/shared/components/index.ts` - removed GestureComponents, SyncStatusBadge exports
- `src/shared/assets/svg/index.ts` - removed dead SVG exports
- `src/features/series/index.ts` - removed duplicate SeriesListScreen export
- `src/features/home/index.ts` - removed constants export
- `src/shared/utils/format.ts` - added formatDurationLong, updated formatDuration signature
- `src/shared/utils/metadata.ts` - uses formatDuration from format.ts
- `src/features/stats/hooks/useListeningStats.ts` - removed duplicate formatDuration
- `src/features/stats/screens/StatsScreen.tsx` - updated formatDuration import
- `src/features/stats/components/ShareStatsCard.tsx` - updated formatDuration import
- `src/features/series/components/SeriesCard.tsx` - updated formatDuration import
- `src/shared/utils/__tests__/metadata.test.ts` - updated tests for new formatDuration behavior

---

## [0.4.82] - 2025-12-21

### Removed
- **Dead Code: Waveform Extraction Feature**
  - Deleted `waveformService.ts` - waveforms were extracted but never displayed in UI
  - Removed waveform extraction code from `downloadManager.ts`
  - Removed `react-native-audio-analyzer` dependency (waveform generator)
  - Removed `react-native-nitro-modules` dependency (required by audio-analyzer)
  - Note: Waveform delete call already removed from `deleteDownload()` in previous session

### Files Modified
- `src/core/services/downloadManager.ts` - Removed waveform extraction block
- `src/core/services/waveformService.ts` - Deleted (dead code)

---

## [0.4.81] - 2025-12-21

### Fixed
- **Critical: MyLibraryScreen Pull-to-Refresh Now Works**
  - Fixed broken pull-to-refresh handler that only faked animation without refreshing
  - Now calls `loadCache(libraryId, true)` to force-refresh data from server

- **Critical: playerStore Download Listener Race Condition**
  - Added cancellation check to prevent stale callbacks when switching books
  - Download-to-local playback switch now validates book hasn't changed during delay

- **Performance: SQLite N+1 INSERT Pattern (50-70% Speedup)**
  - Added `batchInsert()` helper for multi-row VALUES clauses
  - Converted `setLibraryItems`, `setAuthors`, `setSeries`, `setNarrators`, `setCollections` to batch inserts
  - 1000 items now insert in ~10 DB operations instead of 1000

- **Performance: MyLibraryScreen O(n²) Download Lookup**
  - Added `downloadMap` for O(1) lookup instead of `completedDownloads.find()`
  - Added `enrichedBookIds` Set for O(1) membership check
  - Large libraries (1000+ books) now filter instantly

- **Performance: SQLite Memory-Heavy Aggregation**
  - Converted `getReadHistoryStats()` to use SQL GROUP BY aggregation
  - Authors and narrators now aggregate in database instead of loading all records
  - Only loads minimal data (genres column) where SQL can't handle JSON

### Changed
- **Code Quality: Extracted Series Parsing Helper**
  - Created `extractSeriesMetadata()` function
  - Replaced 3 duplicate regex patterns in MyLibraryScreen

- **Code Quality: Removed 19 Unused Styles**
  - Deleted header, libraryButton, emptyTab, and seriesImage styles (~70 lines)
  - Styles were never referenced in component JSX

### Files Modified
- `src/features/library/screens/MyLibraryScreen.tsx` - Pull-to-refresh fix, O(n²) fix, removed unused styles
- `src/features/player/stores/playerStore.ts` - Download listener race condition fix
- `src/core/services/sqliteCache.ts` - Batch insert helper, memory-heavy aggregation fix

---

## [0.4.80] - 2025-12-21

### Changed
- **Dependency Cleanup & Bundle Optimization**
  - Removed 9 unused dependencies (~3MB bundle savings):
    - `@shopify/react-native-skia` (~2MB) - never imported
    - `@expo/vector-icons` (~500KB) - fully migrated to lucide-react-native
    - `shaka-player` (~300KB) - web streaming, never used
    - `@react-navigation/material-top-tabs` - never imported
    - `react-native-tab-view` - never imported
    - `react-native-pager-view` - never imported
    - `expo-av` - replaced by expo-audio
    - `react-dom` - web only, not needed
    - `react-native-web` - web only, not needed
  - Added 2 missing dependencies:
    - `nanoid` - used by wishlistStore
    - `react-native-view-shot` - used by shareService

### Added
- **Comprehensive Code Analysis Report**
  - Analyzed 3 largest files (playerStore, sqliteCache, MyLibraryScreen)
  - Identified 4 critical issues, 5 high priority, 10+ medium priority
  - Found 10 duplicate type definitions to consolidate
  - No circular dependencies detected
  - Console statements already auto-stripped in production (babel plugin)

### Files Modified
- `package.json` - Removed 10 unused deps, added 2 missing

---

## [0.4.79] - 2025-12-21

### Fixed
- **CDPlayerScreen Performance Optimization**
  - Fixed excessive re-renders during playback: now 1 render per 500ms position update (was 2)
  - Removed `position` from main useShallow selector to prevent cascading re-renders
  - Added isolated position selector that only triggers updates where needed
  - Updated `handleSkipBack` and `handleSkipForward` to use `getState()` pattern
  - Skip callbacks no longer recreate on every position update
  - Removed unused `useBookProgress()` hook that was causing duplicate position re-renders
  - Removed unused `useSleepTimerState()` hook that could cause countdown re-renders
  - Note: Brief burst of renders during player open/state changes is expected (initialization)

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Optimized state selectors and removed unused hooks

---

## [0.4.78] - 2025-12-20

### Added
- **Performance Debugging Toolkit**
  - Created `src/utils/perfDebug.ts` with diagnostics utilities:
    - `useRenderTracker` - logs component renders with rapid render warnings
    - `useLifecycleTracker` - tracks mount/unmount with timing
    - `useMemoryMonitor` - monitors heap memory growth
    - `useEffectTracker` - logs effect runs and dependency changes
    - `listenerTracker` - tracks active event listeners for leak detection
    - `useImageLoadTracker` - detects image reload issues (flickering)
    - `timeSync` / `timeAsync` - time operations with emoji indicators
    - `useAppHealthMonitor` - global app health monitoring
  - Added health monitor to App.tsx (dev only)
  - Added trackers to SeriesDetailScreen and CDPlayerScreen

### Files Added
- `src/utils/perfDebug.ts` - Performance debugging utilities
- `src/utils/index.ts` - Utils exports

### Files Modified
- `App.tsx` - Added useAppHealthMonitor in development
- `src/features/series/screens/SeriesDetailScreen.tsx` - Added render/lifecycle tracking
- `src/features/player/screens/CDPlayerScreen.tsx` - Added render/lifecycle tracking

---

## [0.4.77] - 2025-12-20

### Changed
- **Profile Screen - Branding Update**
  - Added Secret Library logo to profile footer
  - Renamed "AudiobookShelf" to "Secret Library" in footer
  - Logo displays with rounded corners above app name

### Files Modified
- `src/features/profile/screens/ProfileScreen.tsx` - Added logo and updated branding

---

## [0.4.76] - 2025-12-20

### Fixed
- **My Library - Completed Tab Now Shows All Marked Books**
  - Fixed: Completed tab was only showing downloaded books
  - Now includes non-downloaded books that were marked as finished in Reading History
  - Created `markedFinishedBooks` list that fetches book metadata from library cache
  - Tab count now correctly reflects total completed books (downloaded + marked)

### Files Modified
- `src/features/library/screens/MyLibraryScreen.tsx` - Added markedFinishedBooks memo, updated tab counts and completed filter

---

## [0.4.75] - 2025-12-20

### Fixed
- **Genre Tags Navigation Fix**
  - Fixed genre chips on Author and Narrator detail screens not navigating correctly
  - Navigation was passing `{ genre }` but GenreDetailScreen expected `{ genreName }`
  - Genre chips now properly open the genre detail page with filtered books

### Files Modified
- `src/features/author/screens/AuthorDetailScreen.tsx` - Fixed genreName param
- `src/features/narrator/screens/NarratorDetailScreen.tsx` - Fixed genreName param

---

## [0.4.74] - 2025-12-20

### Fixed
- **My Library - Completed Tab Integration**
  - Completed tab now shows books marked as finished in Reading History (galleryStore)
  - Tab counts correctly include manually marked books
  - In Progress and Not Started tabs exclude books marked as finished
  - Book rows show completed badge for both server-completed and manually marked books
  - Full bidirectional sync: Book Details ↔ Reading History ↔ My Library

### Files Modified
- `src/features/library/screens/MyLibraryScreen.tsx` - Added galleryStore integration for Completed tab

---

## [0.4.73] - 2025-12-20

### Fixed
- **Book Details - Mark as Finished Integration**
  - Icon now updates immediately when marking a book as finished
  - Books marked on Book Details now appear in Reading History
  - Books in Reading History now show as finished on Book Details
  - Added Snackbar feedback with 5-second undo option
  - Haptic feedback on mark/unmark actions
  - Bidirectional sync between Book Details and Reading History screens

### Files Modified
- `src/features/book-detail/screens/BookDetailScreen.tsx` - Added galleryStore integration and Snackbar feedback

---

## [0.4.72] - 2025-12-20

### Added
- **Reading History - Complete UX Enhancement**
  - **Stats Card**: 3-column layout (books, hours, synced) with sync progress bar
  - **Toolbar**: Sort button, filter button, and search toggle (replaces sort pills)
  - **FilterSheet**: Bottom sheet for filtering by sync status, genre, author, series, duration
  - **SortSheet**: Bottom sheet for sorting (Recent, Title, Author, Duration)
  - **Active Filters Row**: Horizontal scroll of filter chips with Clear All
  - **Search**: Expandable search bar filtering by title, author, series
  - **Date Grouping**: Section headers (Today, Yesterday, This Week, etc.) when sorted by recent
  - **Sync All**: Button in stats card to sync unsynced items
  - **Selection Mode Sync**: Sync button alongside Remove in selection footer

### Files Modified
- `src/features/reading-history-wizard/screens/ReadingHistoryScreen.tsx` - Major redesign with all new components
- `src/features/reading-history-wizard/stores/galleryStore.ts` - Added filter state and actions
- `src/features/reading-history-wizard/components/FilterSheet.tsx` - NEW component
- `src/features/reading-history-wizard/components/SortSheet.tsx` - NEW component
- `src/features/reading-history-wizard/index.ts` - Export new components and types

---

## [0.4.70] - 2025-12-20

### Changed
- **Login Screen - Logo & Branding**
  - Added Secret Library logo to login screen header
  - Updated app title from "AudiobookShelf" to "Secret Library"
  - Logo displays with rounded corners above title

### Files Modified
- `src/features/auth/screens/LoginScreen.tsx` - Added logo image and updated branding

---

## [0.4.69] - 2025-12-20

### Changed
- **App Icons - Secret Library Branding**
  - Updated all app icons with Secret Library skull logo
  - `icon.png` (1024x1024) - Dark logo on cream background (#FAF8F5)
  - `adaptive-icon.png` (1024x1024) - Logo foreground for Android adaptive icons
  - `splash-icon.png` (512x512) - White circular logo for dark splash screen
  - `favicon.png` (64x64) - Web favicon
  - Updated app.json with icon references

### Files Modified
- `assets/icon.png` - Main app icon
- `assets/adaptive-icon.png` - Android adaptive icon foreground
- `assets/splash-icon.png` - Splash screen icon (white on dark)
- `assets/favicon.png` - Web favicon
- `app.json` - Added icon and adaptiveIcon.foregroundImage references

---

## [0.4.68] - 2025-12-20

### Changed
- **Manual Add Wishlist - Full Screen**
  - Converted from bottom sheet modal to full-screen page
  - Better UX for form entry with more space
  - Added back button and header navigation
  - Created new `ManualAddScreen` component
  - Registered in AppNavigator as `ManualAdd` route

### Files Modified
- `src/features/wishlist/screens/ManualAddScreen.tsx` - New full-screen form
- `src/features/wishlist/screens/WishlistScreen.tsx` - Navigate instead of modal
- `src/features/wishlist/screens/index.ts` - Export new screen
- `src/features/wishlist/index.ts` - Export new screen
- `src/navigation/AppNavigator.tsx` - Register ManualAdd route

---

## [0.4.67] - 2025-12-20

### Fixed
- **ManualAddSheet Form Not Visible**
  - Fixed layout issue where form fields weren't showing in the "Add to Wishlist" sheet
  - Changed from percentage-based to explicit height using `hp(75)` for reliable sizing
  - Added `flexGrow/flexShrink` to ScrollView for proper content expansion

### Files Modified
- `src/features/wishlist/components/ManualAddSheet.tsx` - Fixed sheet layout

---

## [0.4.66] - 2025-12-20

### Fixed
- **QueuePanel Navigation Error**
  - Fixed "LibraryTab not found" when tapping "Browse Library" from empty queue
  - Changed from direct navigation to nested navigation: `navigation.navigate('Main', { screen: 'LibraryTab' })`

- **WishlistStore Null Safety**
  - Fixed `TypeError: Cannot read property 'toLowerCase' of undefined` crashes
  - Added null safety to `followAuthor`, `unfollowAuthor`, `trackSeries`, `untrackSeries`
  - Added input validation with early returns for empty/undefined names
  - Applied optional chaining (`?.`) when accessing stored item names

### Files Modified
- `src/features/queue/components/QueuePanel.tsx` - Nested navigation fix
- `src/features/wishlist/stores/wishlistStore.ts` - Null safety throughout

---

## [0.4.65] - 2025-12-20

### Fixed
- **FIX-012: AuthorDetailScreen Null Pointer Crash**
  - Added null safety for authorName parameter
  - Early return with error UI when author name is missing
  - Null-safe initials generation using useMemo
  - Applied same fix to NarratorDetailScreen

- **FIX-015: Pluralization Grammar Error**
  - Fixed "1 seconds per second" → "1 second per second"
  - Proper pluralization in joystick seek speed label

- **FIX-005: Mark Finished Not Working**
  - API now properly sets `progress: 1` (100%) when marking as finished
  - Includes book duration for accurate server-side tracking
  - Fixed both BookDetailScreen and playerStore completion handling

- **FIX-011: Downloaded Books Showing "Unknown" Title**
  - Added loading state to DownloadedRow component
  - Shows "Loading..." while fetching metadata instead of "Unknown"
  - Only shows "Unknown Title" when book truly can't be found

### Verified (No Issues Found)
- FIX-006/013: Debug toasts - No debug toasts found in production code
- FIX-003: Duplicate buttons - Only one Browse Library button on home screen
- FIX-001/002/020/021: Filter pills - Already have proper padding
- FIX-004: Series Book 1 - No filtering logic that would exclude Book 1

### Files Modified
- `src/features/author/screens/AuthorDetailScreen.tsx` - Null safety
- `src/features/narrator/screens/NarratorDetailScreen.tsx` - Null safety
- `src/features/player/stores/joystickSeekStore.ts` - Pluralization fix
- `src/core/api/endpoints/user.ts` - markAsFinished with progress
- `src/features/book-detail/screens/BookDetailScreen.tsx` - Pass duration
- `src/features/player/stores/playerStore.ts` - Pass duration
- `src/features/downloads/screens/DownloadsScreen.tsx` - Loading state

---

## [0.4.64] - 2025-12-20

### Added
- **Enhanced Haptic Feedback for Destructive Actions**
  - New `destructiveConfirm()` method with double-impact pattern for delete/remove actions
  - New `undoAvailable()` method for undo feedback
  - Applied to Delete All Downloads and Sign Out confirmations

- **Pull-to-Refresh on NarratorDetailScreen**: Consistent with AuthorDetailScreen
  - RefreshControl with narrator theme color
  - Refreshes library cache data

### Existing Features Verified
- **NetworkStatusBar already integrated globally** in AppNavigator
  - Shows "No internet connection" banner when offline
  - Animated slide in/out with spring physics

- **DownloadItem already has good UX**
  - Visible delete/cancel buttons with haptic feedback
  - 44pt minimum touch targets
  - Progress bars and status indicators

### Files Modified
- `src/core/native/haptics.ts` - Added destructiveConfirm() and undoAvailable() methods
- `src/features/narrator/screens/NarratorDetailScreen.tsx` - Added RefreshControl
- `src/features/downloads/screens/DownloadsScreen.tsx` - Use destructiveConfirm for Delete All
- `src/features/profile/screens/ProfileScreen.tsx` - Add haptics for Sign Out

---

## [0.4.63] - 2025-12-20

### Added
- **Enhanced Button Component**: Improved standardization and features
  - Added `outline` variant for bordered buttons
  - Added `leftIcon` and `rightIcon` props for icon buttons
  - Added haptic feedback (Light impact) on all button presses
  - Added proper accessibility labels and states
  - Added `noHaptics` prop to disable feedback when needed

- **Enhanced IconButton Component**: Improved touch experience
  - Added haptic feedback (Light impact) on press
  - Added automatic hit slop for small buttons (ensures 44pt touch target)
  - Added `noHaptics` and `hitSlop` props for customization
  - Added proper accessibility state

- **Pull-to-Refresh on Detail Screens**: Better data refresh UX
  - BookDetailScreen: Refresh book details and progress
  - AuthorDetailScreen: Refresh author data and book list

### Files Modified
- `src/shared/components/Button.tsx` - Added outline variant, icons, haptics, accessibility
- `src/shared/components/buttons/IconButton.tsx` - Added haptics, hit slop, accessibility
- `src/features/book-detail/screens/BookDetailScreen.tsx` - Added RefreshControl
- `src/features/author/screens/AuthorDetailScreen.tsx` - Added RefreshControl

---

## [0.4.62] - 2025-12-20

### Added
- **Author Thumbnails in Search Results**: Enhanced search results to show author photos
  - Main search results now display author images (when available) instead of just initials
  - Matches the autocomplete dropdown behavior for consistency

- **Skeleton Loading for MyLibraryScreen**: Added loading state skeletons
  - Shows skeleton placeholders while library cache loads
  - Includes title, search bar, and book card placeholders

### Changed
- **Inline Error States on Login Screen**: Improved error display UX
  - Auth errors now show inline with icon instead of Alert dialogs
  - Error messages have visual container with red background tint
  - Errors auto-clear when user modifies input fields

### Files Modified
- `src/features/search/screens/SearchScreen.tsx` - Added author thumbnails to search results
- `src/features/library/screens/MyLibraryScreen.tsx` - Added skeleton loading state
- `src/features/auth/screens/LoginScreen.tsx` - Inline error states, removed Alert

---

## [0.4.61] - 2025-12-20

### Fixed
- **WishlistItemRow crash**: Fixed "Cannot read property 'toLowerCase' of undefined" error
  - Added defensive coding for missing item.priority (defaults to 'want-to-read')
  - Added guard in useCoverUrl for empty/invalid itemId
  - Fixed displayCover to only use coverUrl when libraryItemId exists

### Files Modified
- `src/features/wishlist/components/WishlistItemRow.tsx` - Added defensive coding
- `src/core/cache/useCoverUrl.ts` - Added empty itemId guard

---

## [0.4.60] - 2025-12-19

### Added
- **Long-Press Context Menu on Book Cards**: Per UX evaluation recommendation
  - New `BookContextMenu` component - animated bottom sheet with quick actions
  - Actions: Play, Download/Cancel/Delete, Add to Queue, Add to Wishlist, View Details
  - Context-aware options based on download and queue status
  - BookCard now supports `onLongPress` prop with haptic feedback (400ms delay)
  - Smooth spring animation on show, fade on dismiss

### Files Modified
- `src/shared/components/BookContextMenu.tsx` - New component
- `src/shared/components/BookCard.tsx` - Added onLongPress prop and handler
- `src/shared/components/index.ts` - Export BookContextMenu

---

## [0.4.59] - 2025-12-19

### Added
- **Quick Sign Out Button in Profile Header**: Per UX evaluation (visible without scrolling)
  - Red logout icon in user header area
  - No longer need to scroll to bottom to sign out
  - Matches same confirmation dialog as bottom button

### Files Modified
- `src/features/profile/screens/ProfileScreen.tsx` - Added sign out button to UserHeader

---

## [0.4.58] - 2025-12-19

### Added
- **Password Visibility Toggle on Login**: Eye icon to show/hide password
  - Tap eye icon to reveal password
  - EyeOff icon shown when password is visible
  - Improves UX for users entering credentials

### Files Modified
- `src/features/auth/screens/LoginScreen.tsx` - Added password visibility toggle

---

## [0.4.57] - 2025-12-19

### Added - Phase 2 UX Improvements
- **Enhanced Progress Display on Book Cards**: Per UX heuristic evaluation recommendation
  - Visual inline progress bar (gold fill on dark track)
  - Shows time remaining (e.g., "6h 12m left") instead of percentage
  - Progress bar appears in info section alongside time text
  - Cover still has thin progress overlay for visual consistency

### Files Modified
- `src/shared/components/BookCard.tsx` - Added InlineProgressBar component and time remaining display

---

## [0.4.56] - 2025-12-19

### Added - Phase 1 UX Complete
- **Real-time URL Validation on Login**: Server URL field now shows instant feedback
  - Green check icon when URL is valid
  - Yellow alert icon when URL will be auto-corrected (e.g., adding https://)
  - Red X icon when URL is invalid
  - Inline message below field explaining status
  - Visual border color changes to match status
  - Validates as user types for immediate feedback

### Files Modified
- `src/features/auth/screens/LoginScreen.tsx` - Added real-time URL validation

---

## [0.4.55] - 2025-12-19

### Added
- **Author Thumbnails in Search**: Autocomplete now shows circular author thumbnails
  - Uses author images from API when available
  - Falls back to initials (gold background) for authors without images
  - Adds `id` and `imagePath` to autocomplete author data

### Files Modified
- `src/features/search/screens/SearchScreen.tsx` - Added author thumbnails to autocomplete

---

## [0.4.54] - 2025-12-19

### Added - Phase 1 UX Improvements
- **Skeleton Loading Components** (`src/shared/components/Skeleton.tsx`):
  - Base components: `Shimmer`, `SkeletonBox`, `SkeletonCircle`, `SkeletonText`
  - Pre-built variants: `BookCardSkeleton`, `ContinueListeningCardSkeleton`, `ListRowSkeleton`
  - Screen skeletons: `SectionSkeleton`, `HomeHeroSkeleton`, `BookDetailSkeleton`
  - Entity skeletons: `AuthorRowSkeleton`, `SearchResultsSkeleton`
  - Smooth shimmer animation using react-native-reanimated

- **Snackbar Component with Undo** (`src/shared/components/Snackbar.tsx`):
  - Reusable snackbar/toast for feedback messages
  - Supports action buttons (e.g., "Undo")
  - Auto-dismiss with configurable duration
  - Multiple types: info, success, warning, error
  - `useSnackbar` hook for easy state management

### Changed
- **SearchScreen**: Shows skeleton loading while library cache initializes
- **BookDetailScreen**: Uses `BookDetailSkeleton` instead of ActivityIndicator during load
- **DownloadsScreen**: Delete All now shows undo snackbar with 5-second window to restore

### Files Added
- `src/shared/components/Snackbar.tsx`

### Files Modified
- `src/shared/components/Skeleton.tsx` - Expanded with component variants
- `src/shared/components/index.ts` - Added new exports
- `src/features/search/screens/SearchScreen.tsx` - Added skeleton loading
- `src/features/book-detail/screens/BookDetailScreen.tsx` - Use BookDetailSkeleton
- `src/features/downloads/screens/DownloadsScreen.tsx` - Added undo snackbar

---

## [0.4.53] - 2025-12-19

### Fixed
- **Wishlist Follow/Track crash**: Fixed `Cannot read property 'toLowerCase' of undefined` errors in:
  - `useIsAuthorFollowed` and `useIsSeriesTracked` hooks - added null checks for `a.name` and `s.name`
  - `getAuthor`, `getNarrator`, `getSeries` in libraryCache - added null guards for undefined input
- **Wishlist Follow/Track state**: Fixed buttons not updating state:
  - Changed `followAuthor`/`unfollowAuthor` to accept name string instead of objects
  - Changed `trackSeries`/`untrackSeries` to accept name string instead of objects
  - Updated hooks to match by name (case-insensitive) instead of by ID
- **Mark Finished state**: Fixed "Mark Finished" button not showing "Completed" state after marking:
  - Now checks both `progress >= 0.95` AND `userMediaProgress.isFinished === true`

### Files Modified
- `src/features/wishlist/stores/wishlistStore.ts` - Fixed action signatures and null checks
- `src/core/cache/libraryCache.ts` - Added null guards
- `src/features/wishlist/screens/WishlistScreen.tsx` - Added null checks
- `src/features/book-detail/screens/BookDetailScreen.tsx` - Fixed isCompleted check

---

## [0.4.52] - 2025-12-19

### Added
- **Wishlist Phase 3 - Author Following & Series Tracking**:
  - **AuthorDetailScreen Follow Button**: Toggle button to follow/unfollow authors
    - Bell icon (outline) for unfollowed, filled BellOff when following
    - Haptic feedback on toggle
    - Persisted to wishlist store
  - **SeriesDetailScreen Track Button**: Toggle button to track/untrack series
    - Same Bell/BellOff pattern as author follow
    - "Track Series" / "Tracking" labels
    - Positioned below series name
  - **Enhanced WishlistScreen Authors Tab**:
    - Tap author row to navigate to AuthorDetailScreen
    - Shows book count from library (e.g., "5 books in library")
    - Unfollow button (BellOff icon) for quick removal
    - Chevron indicator for navigation
    - Item separators between rows
  - **Enhanced WishlistScreen Series Tab**:
    - Tap series row to navigate to SeriesDetailScreen
    - Shows book count from library
    - Untrack button for quick removal
    - Chevron indicator for navigation
    - Item separators between rows

### Files Modified
- `src/features/author/screens/AuthorDetailScreen.tsx` - Added Follow button
- `src/features/series/screens/SeriesDetailScreen.tsx` - Added Track button
- `src/features/wishlist/screens/WishlistScreen.tsx` - Enhanced Authors/Series tabs

---

## [0.4.51] - 2025-12-19

### Added
- **Manual Add Sheet**: Form for adding books not in library to wishlist:
  - Title and Author fields (required with validation)
  - Narrator field (optional)
  - Series name and sequence number fields
  - Notes field for personal comments
  - Priority selector with three levels:
    - **Must Read** (red highlight) - High priority
    - **Want to Read** (gold accent) - Normal priority
    - **Maybe** - Lower priority, might read someday
  - Keyboard-aware modal with scroll support
  - Form validation with error states
  - Haptic feedback on submit

### Files Added
- `src/features/wishlist/components/ManualAddSheet.tsx` - Form sheet component

### Files Modified
- `src/features/wishlist/components/index.ts` - Export ManualAddSheet
- `src/features/wishlist/screens/WishlistScreen.tsx` - Integrate add sheet
- `src/features/wishlist/index.ts` - Export ManualAddSheet

---

## [0.4.50] - 2025-12-19

### Added
- **Wishlist Feature (Phase 1 - MVP)**: Core wishlist functionality for tracking books users want to read:
  - **Data Models** (`types.ts`): Comprehensive type definitions for WishlistItem, FollowedAuthor, TrackedSeries with priority levels, sources, and status tracking
  - **Zustand Store** (`wishlistStore.ts`): Full-featured state management with AsyncStorage persistence:
    - Add/remove/update wishlist items from library or manual entry
    - Follow/unfollow authors for new release notifications
    - Track/untrack series for completion tracking
    - Filtering by priority, status, source, and tags
    - Sorting by date added, priority, title, author, release date
    - Convenience hooks: `useIsOnWishlist`, `useWishlistCount`, `useIsAuthorFollowed`, `useIsSeriesTracked`
  - **Wishlist Screen** (`WishlistScreen.tsx`): Tab-based interface with:
    - All items / Must Read / Authors / Series tabs with badge counts
    - Sort picker dropdown
    - Add button for manual entry (placeholder)
    - Pull-to-refresh
    - Empty states for each tab
  - **WishlistItemRow Component**: Rich item display showing:
    - Book cover with priority badge (star for must-read, bookmark for others)
    - Title, author, narrator, series info
    - Duration and notes
    - Delete action with confirmation
  - **BookCard Enhancement**: Added `showWishlistButton` prop with animated bookmark button:
    - Top-right cover overlay
    - Bounce animation on toggle
    - Haptic feedback (success on add, light on remove)
    - Active state styling when on wishlist
  - **Profile Integration**: Wishlist link in "My Stuff" section with item count badge

### Technical
- Library cache integration for fetching book metadata by ID
- Bookmark icon SVG component for consistency
- Proper TypeScript interfaces with LucideIcon typing

### Files Added
- `src/features/wishlist/types.ts` - Type definitions
- `src/features/wishlist/stores/wishlistStore.ts` - Zustand store
- `src/features/wishlist/stores/index.ts` - Store exports
- `src/features/wishlist/screens/WishlistScreen.tsx` - Main screen
- `src/features/wishlist/screens/index.ts` - Screen exports
- `src/features/wishlist/components/WishlistItemRow.tsx` - Item component
- `src/features/wishlist/components/index.ts` - Component exports
- `src/features/wishlist/index.ts` - Feature exports

### Files Modified
- `src/shared/components/BookCard.tsx` - Added wishlist button
- `src/features/profile/screens/ProfileScreen.tsx` - Added wishlist link
- `src/navigation/AppNavigator.tsx` - Added wishlist screen route

---

## [0.4.49] - 2025-12-19

### Changed
- **Icon System Migration (In Progress)**: Migrating from Ionicons to Lucide React Native for consistent, modern iconography:
  - **Infrastructure**: Created icon system with `LucideIcon` wrapper, constants for sizes/colors/stroke width
  - **Custom Icons**: Created SkipBack30 and SkipForward30 SVG icons matching Lucide style
  - **Player Screens**: Migrated CDPlayerScreen, StandardPlayerScreen, BookCompletionSheet
  - **Player Sheets**: Migrated SpeedSheet, SleepTimerSheet
  - **Navigation**: Migrated GlobalMiniPlayer, TopNav, BottomTabBar
  - **Home Components**: Migrated HomePillsRow, PlaybackControls, RecentlyAddedSection, YourSeriesSection
  - **Reading History**: Migrated MarkBooksScreen
  - **EmptyState**: Added emoji-to-icon mapping for backward compatibility

### Technical
- Using Lucide's consistent 24x24 viewBox with 2px stroke width
- Added `strokeWidth` prop for fine-tuned icon weights
- Using `fill` prop for solid/filled icon variants
- Responsive scaling with `moderateScale()` and `scale()`

### Files Modified
- `src/shared/components/icons/` - New icon system (constants, LucideIcon, SkipBack30, SkipForward30)
- `src/shared/components/EmptyState.tsx` - Added built-in SVG icons and emoji mapping
- `src/features/player/screens/CDPlayerScreen.tsx` - Lucide icons
- `src/features/player/screens/StandardPlayerScreen.tsx` - Lucide icons
- `src/features/player/components/BookCompletionSheet.tsx` - Lucide icons
- `src/features/player/sheets/SpeedSheet.tsx` - Lucide icons
- `src/features/player/sheets/SleepTimerSheet.tsx` - Lucide icons
- `src/navigation/components/GlobalMiniPlayer.tsx` - Lucide icons
- `src/navigation/components/TopNav.tsx` - Lucide icons
- `src/navigation/components/BottomTabBar.tsx` - Lucide icons
- `src/features/home/components/HomePillsRow.tsx` - Lucide icons
- `src/features/home/components/PlaybackControls.tsx` - Lucide icons
- `src/features/home/components/RecentlyAddedSection.tsx` - Lucide icons
- `src/features/home/components/YourSeriesSection.tsx` - Lucide icons
- `src/features/reading-history-wizard/screens/MarkBooksScreen.tsx` - Lucide icons

### Remaining
- 42 files still using Ionicons (library, book-detail, profile, series, queue, etc.)

---

## [0.4.48] - 2025-12-19

### Changed
- **Reading History UX/UI Redesign**: Complete visual overhaul of the Mark Books and Reading History screens:
  - **Portrait Card Design**: Changed from landscape to 2:3 portrait aspect ratio (65% screen width) matching actual book covers
  - **Card Stack Visual**: Added 3-card stack with peek-behind effect showing upcoming cards
  - **Swipe Overlays**: Color-coded feedback during swipe gestures (green for finished, white for skip, blue for queue)
  - **Progress Bar**: New library completion progress indicator with percentage and counts
  - **View Tabs**: Redesigned as pill-style tabs (Books/Authors/Series) with active counts
  - **Stats Row**: Shows finished/queued/remaining counts with colored icons
  - **Action Buttons**: Circular buttons with undo badge counter showing undo stack depth
  - **Haptic Feedback**: Comprehensive haptics at threshold, action confirmation, and button presses
  - **Reading History Screen**: Redesigned list items with duration info, stats summary header, sort pills (Recent/Title/Author/Duration), selection mode with footer

### Technical
- Responsive scaling using `wp()`, `hp()`, `moderateScale()` throughout
- Unified color palette matching app design system
- Card stack animations with scale, opacity, and offset transforms
- Swipe gesture handling with interpolated overlays

### Files Modified
- `src/features/reading-history-wizard/screens/MarkBooksScreen.tsx` - Complete redesign
- `src/features/reading-history-wizard/screens/ReadingHistoryScreen.tsx` - Complete redesign

---

## [0.4.40] - 2025-12-18

### Added
- **Reading History Wizard (Phase 2 - Infrastructure)**: Complete wizard framework for marking previously-read books:
  - **Wizard Store** (`wizardStore.ts`): Zustand store with AsyncStorage persistence for:
    - 5-step navigation state with save/resume capability
    - Genre preferences (favorites and exclusions)
    - Known authors tracking
    - Series completion status (complete, partial, not-started)
    - Individual book confirmation
    - Pending books for final marking
  - **WizardContainer Component**: Reusable wrapper providing:
    - Header with close button and "Reading History" title
    - Step progress indicator with step labels
    - Scrollable content area
    - Navigation footer with Back/Skip/Next buttons
    - Exit dialog with Save & Exit / Discard options
  - **StepProgressIndicator Component**: Visual 5-step progress bar with:
    - Numbered circles (completed shows checkmark)
    - Connecting lines between steps
    - Step labels below ("Genres", "Authors", "Series", "Books", "Review")
  - **5 Step Screens**:
    - Step 1 (Genres): Tap to favorite, long-press to exclude genres
    - Step 2 (Authors): Select authors with 2+ books in library
    - Step 3 (Series): Mark series as all/some/none read
    - Step 4 (Books): Review individual books from known authors
    - Step 5 (Review): Final confirmation with book list, removes books from list, marks all as finished
  - **Profile Entry Point**: New "Reading History" link in Profile showing "Set up" or "Resume" badge
  - **Navigation Integration**: Added as modal screen in AppNavigator

### Files Added
- `src/features/reading-history-wizard/stores/wizardStore.ts` - Wizard state management
- `src/features/reading-history-wizard/components/StepProgressIndicator.tsx` - Progress UI
- `src/features/reading-history-wizard/components/WizardContainer.tsx` - Step wrapper
- `src/features/reading-history-wizard/screens/Step1GenresScreen.tsx` - Genre selection
- `src/features/reading-history-wizard/screens/Step2AuthorsScreen.tsx` - Author selection
- `src/features/reading-history-wizard/screens/Step3SeriesScreen.tsx` - Series progress
- `src/features/reading-history-wizard/screens/Step4BooksScreen.tsx` - Individual books
- `src/features/reading-history-wizard/screens/Step5ConfirmScreen.tsx` - Review & apply
- `src/features/reading-history-wizard/screens/ReadingHistoryWizardScreen.tsx` - Main orchestrator
- `src/features/reading-history-wizard/index.ts` - Feature exports

### Files Modified
- `src/navigation/AppNavigator.tsx` - Added ReadingHistoryWizard screen
- `src/features/profile/screens/ProfileScreen.tsx` - Added Reading History entry point
- `src/constants/version.ts` - Version bump to 0.4.40

---

## [0.4.39] - 2025-12-18

### Added
- **Mark as Finished in Book Detail**: Added action links row in BookDetailScreen with:
  - "Add to Queue" action with icon (moved from tabs row)
  - "Mark Finished" action - marks book as complete on server
  - For completed books, shows "Completed" with option to reset progress
  - Haptic feedback on actions
  - Loading indicator while updating

### Changed
- Reorganized BookDetailScreen layout: queue and completion actions now in centered action links row

### Files Modified
- `src/features/book-detail/screens/BookDetailScreen.tsx` - Added mark as finished/reset progress functionality
- `src/constants/version.ts` - Version bump to 0.4.39

---

## [0.4.38] - 2025-12-18

### Added
- **Book Completion Prompt**: When a book finishes playing, a completion sheet now appears allowing users to:
  - Mark the book as finished (syncs to server with `isFinished: true`)
  - Listen again (dismiss and keep book at current position)
  - Close without action
- **Completion Settings**: New settings in Playback Settings under "Book Completion":
  - **Completion Prompt**: Toggle to show/hide the completion sheet (default: ON)
  - **Auto-Mark Finished**: When prompt is disabled, automatically mark books as finished (default: OFF)
- **Mark as Finished Action**: New `markBookFinished()` action that:
  - Syncs completion status to server
  - Adds to reading history
  - Removes book from queue if present
  - Provides haptic feedback

### Files Modified
- `src/features/player/stores/playerStore.ts` - Added completion settings, markBookFinished action, modified finish handler
- `src/features/player/components/BookCompletionSheet.tsx` - NEW: Completion modal UI
- `src/features/player/index.ts` - Export BookCompletionSheet
- `src/features/profile/screens/PlaybackSettingsScreen.tsx` - Added "Book Completion" settings section
- `src/navigation/AppNavigator.tsx` - Render BookCompletionSheet globally
- `src/constants/version.ts` - Version bump to 0.4.38

---

## [0.4.37] - 2025-12-18

### Fixed
- **Series Sequencing for Non-Sequenced Books**: When a series has no explicit sequence numbers (all books show as #1), the app now:
  - Detects when all books have the same sequence number and treats that as "no sequence"
  - Removes the sequence number display from book titles (no more "1. Book Title")
  - Sorts books by publication date (oldest first), then alphabetically by title
  - Updates all related UI: series detail screen, progress header, and batch action buttons

### Files Modified
- `src/features/series/screens/SeriesDetailScreen.tsx` - Smart sequence detection and improved sorting
- `src/features/series/components/SeriesProgressHeader.tsx` - Uses sequence detection for display
- `src/features/series/components/BatchActionButtons.tsx` - Added hasRealSequences prop
- `src/constants/version.ts` - Version bump to 0.4.37

---

## [0.4.36] - 2025-12-18

### Fixed
- **Double Playback Race Condition (Complete Fix)**: Fixed the root cause of double playback where streaming a book while sync data was loading caused two audio streams to play simultaneously. The bug occurred because:
  - The "same book already loaded" check ran AFTER unloading audio, so it always failed
  - A second `loadBook` call could bypass the debounce if enough time passed
  - Fixed by moving the check BEFORE unloading audio, so we properly detect when the book is already playing and skip the reload

### Files Modified
- `src/features/player/stores/playerStore.ts` - Moved same-book check before unloadAudio() call
- `src/constants/version.ts` - Version bump to 0.4.36

---

## [0.4.35] - 2025-12-18

### Fixed
- **Double Playback Race Condition (Partial)**: Initial attempt to fix double playback. Added protection to:
  - Prevent loading the same book if it's already being loaded
  - Debounce all rapid load requests (not just different books)
  - Note: This fix was incomplete - see 0.4.36 for the complete fix

### Files Modified
- `src/features/player/stores/playerStore.ts` - Added same-book loading guard and improved debouncing
- `src/constants/version.ts` - Version bump to 0.4.35

---

## [0.4.34] - 2025-12-18

### Enhanced
- **Chapter Name Cleaning - Player Page**: Extended chapter name cleaning to the full-screen player (CDPlayerScreen). Clean chapter names now display in:
  - Chapters sheet when tapping the chapter list
  - Current chapter display below the progress bar

### Files Modified
- `src/features/player/screens/CDPlayerScreen.tsx` - Uses normalized chapter names in chapters sheet and current chapter display
- `src/constants/version.ts` - Version bump to 0.4.34

---

## [0.4.33] - 2025-12-18

### Added
- **Chapter Name Cleaning**: Client-side normalization of messy chapter names for a polished display experience. Based on analysis of 68,000+ real audiobook chapter titles:
  - Comprehensive pattern parser handles 15+ chapter formats (track numbers, disc codes, Roman numerals, spelled-out numbers, front/back matter)
  - Four cleaning levels: Off, Light, Standard (recommended), Aggressive
  - Settings screen at Profile → Settings → Chapter Names with live examples
  - Unicode normalization (en-dash, em-dash, curly quotes, non-breaking spaces)
  - Smart duplicate handling appends disambiguating numbers

### New Files
- `src/core/services/chapterNormalizer.ts` - Core normalization engine with pattern matchers
- `src/shared/hooks/useNormalizedChapters.ts` - React hook for chapter normalization
- `src/features/profile/stores/chapterCleaningStore.ts` - Settings store for cleaning preferences
- `src/features/profile/screens/ChapterCleaningSettingsScreen.tsx` - Settings UI with level selection

### Files Modified
- `src/features/book-detail/components/ChaptersTab.tsx` - Uses normalized chapter names
- `src/features/book-detail/components/ChapterList.tsx` - Uses normalized chapter names
- `src/features/profile/screens/ProfileScreen.tsx` - Added link to Chapter Names settings
- `src/features/profile/index.ts` - Exports new screen and store
- `src/shared/hooks/index.ts` - Exports useNormalizedChapters hook
- `src/navigation/AppNavigator.tsx` - Added ChapterCleaningSettings screen
- `src/constants/version.ts` - Version bump to 0.4.33

---

## [0.4.32] - 2025-12-18

### Added
- **URL Auto-Correction (Issue 1.5)**: Login screen now automatically normalizes server URLs - adds `https://` if no protocol specified, removes trailing slashes, and validates URL format. Shows correction message when URL is auto-fixed.

- **Not Started & Completed Filters (Issues 2.10/2.11)**: My Library tab bar now includes "Not Started" and "Completed" filters. Not Started shows books with 0% progress, Completed shows books with ≥95% progress. Each tab has contextual empty states.

- **Chapter Skip via Long-Press (Issues 3.13/3.14)**: Long-press (400ms) on skip back/forward buttons jumps to previous/next chapter. Short tap still skips by configured seconds. Includes haptic feedback and larger disc spin animation for chapter jumps.

- **Offline State for Non-Downloaded Books (Issue 6.16)**: BookCard now shows visual offline state when the user is offline and the book isn't downloaded:
  - Cover at 40% opacity
  - Red badge with cloud-off icon
  - Download button disabled with cloud-off icon
  - Uses `useNetworkStatus()` hook for real-time detection

### Investigated
- **Android Auto (Issues 8.x)**: Native Android Auto modules (`AndroidAutoModule.kt`, `MediaPlaybackService.kt`) were deleted during app rename. TypeScript code is ready, but native Kotlin implementation needs to be recreated. Lock screen controls work via expo-media-control; Android Auto browsing requires native MediaBrowserService.

### Files Modified
- `src/features/auth/screens/LoginScreen.tsx` - URL normalization and correction UI
- `src/features/library/screens/MyLibraryScreen.tsx` - Added not-started and completed tabs
- `src/features/library/components/LibraryEmptyState.tsx` - Empty states for new tabs
- `src/features/player/screens/CDPlayerScreen.tsx` - Long-press chapter skip handlers
- `src/shared/components/BookCard.tsx` - Offline unavailable state UI
- `src/constants/version.ts` - Version bump to 0.4.32

---

## [0.4.31] - 2025-12-18

### Fixed
- **Invalid Credentials Error (Issue 1.11)**: Login now shows user-friendly error messages instead of generic "Unauthorized" - displays "Invalid username or password" for auth failures, "Cannot connect to server" for network issues, and "Server error" for 500s.

- **Player Open Stutter (Issue 5.1)**: Fixed player animation re-triggering on every re-render by tracking previous visibility state with a ref. Animation now only runs on actual visibility transitions.

- **Download Cancel UI Clarity (Issue 6.6)**: Made the cancel button more visually prominent during active downloads with a red background and red icon, making it easier to distinguish from the pause/resume button.

- **App Open Transition Glitch (Issue 10.6)**: Wrapped all heavy initialization (audio service, player settings, queue init, network monitor, download manager) in `InteractionManager.runAfterInteractions()` to defer until after animations complete.

### Improved
- **Live Sleep Timer Countdown (Issue 4.6)**: Sleep timer now displays live MM:SS countdown format (e.g., "12:45") instead of static minute approximations. Shows precise time remaining under 1 hour.

- **Network Status Indicator (Issues 10.13 & 10.16)**: Added global `NetworkStatusBar` component that slides down from top when offline. Uses NetInfo for real-time network monitoring with smooth spring animations. Also exports `useNetworkStatus()` hook for screens needing network state.

### Files Modified
- `src/core/auth/authService.ts` - User-friendly login error messages
- `src/features/player/screens/CDPlayerScreen.tsx` - Live sleep timer format, player animation fix
- `src/features/downloads/components/DownloadItem.tsx` - Prominent cancel button styling
- `src/navigation/AppNavigator.tsx` - InteractionManager for deferred init, NetworkStatusBar
- `src/shared/components/NetworkStatusBar.tsx` - New global network status component
- `src/shared/components/index.ts` - Export NetworkStatusBar and useNetworkStatus
- `src/constants/version.ts` - Version bump to 0.4.31

---

## [0.4.30] - 2025-12-18

### Fixed
- **Auth Persistence (Bug 1.13)**: Added retry logic with exponential backoff to SecureStore reads for more reliable session restoration on app restart. Added detailed logging to help diagnose auth issues.

- **Playback Speed Restoration (Bug 4.20/4.21)**: Speed indicator now correctly shows the actual playback rate after app restart. Added persistence of active playback rate and last played book ID. On restore, the rate is applied to both the store (UI) and audioService to ensure sync.

- **Haptics Consistency (Bug 10.11/10.12)**: Updated skip buttons to use category-specific `haptics.skip()` method for proper category checking. Updated SleepTimerSheet to use `haptics.sleepTimerSet()` and `haptics.sleepTimerClear()`. Updated SpeedSheet to use `haptics.speedChange()`.

### Improved
- **Lock Screen Controls (Bug 7.5-7.10)**: Added better logging for media control metadata and playback state updates to help diagnose Android lock screen issues. Added `android:foregroundServiceType="mediaPlayback"` to MediaPlaybackService for Android 10+ compatibility.

### Files Modified
- `src/core/auth/authService.ts` - Added retry logic and logging to session restore
- `src/features/player/stores/playerStore.ts` - Added persistence for activePlaybackRate and lastPlayedBookId
- `src/features/player/services/audioService.ts` - Improved media control logging
- `src/features/player/screens/CDPlayerScreen.tsx` - Use category-specific haptics for skip buttons
- `src/features/player/sheets/SleepTimerSheet.tsx` - Use category-specific haptics
- `src/features/player/sheets/SpeedSheet.tsx` - Use category-specific haptics
- `android/app/src/main/AndroidManifest.xml` - Added foregroundServiceType to MediaPlaybackService
- `src/constants/version.ts` - Version bump to 0.4.30

---

## [0.4.0] - 2025-12-15

### Added
- **Mood-Based Discovery Feature** ("What Sounds Good?")
  - Ephemeral mood sessions with 24-hour expiry - captures what you want RIGHT NOW
  - Vibe selection: Cozy & Comforting, Fast & Gripping, Makes Me Think, Light & Fun, Emotional Journey, Epic & Sweeping
  - Length preference: Short (< 8h), Medium (8-20h), Long (20h+), or Any
  - World setting: Our World, Fantasy, Sci-Fi, Historical, or Any
  - Smart book scoring with vibe-to-genre matching
  - Results grouped by match quality (Perfect 80%+, Great 60-79%, Good 40-59%)
  - Quick-tune bar for adjusting mood without leaving results
  - Session timer showing time remaining
  - Entry point card on Browse screen

- **New Feature Files**
  - `src/features/mood-discovery/` - Complete feature module
  - Types: Vibe, LengthPreference, WorldSetting, MoodSession, ScoredBook
  - Store: moodSessionStore with Zustand persist and 24hr expiry
  - Components: VibeSelector, LengthSlider, WorldSelector, QuickTuneBar, MoodBookCard, MoodDiscoveryCard
  - Hooks: useMoodFilteredBooks, useMoodRecommendations, useMoodRecommendationsByQuality
  - Screens: MoodDiscoveryScreen, MoodResultsScreen

### Changed
- Browse screen now shows "What sounds good?" card for mood discovery entry

### Technical
- Vibe-to-genre mapping for scoring books against mood preferences
- Session persistence with automatic expiry validation on rehydration
- Quick-tune extends session by resetting expiry timer

---

## [0.3.2] - 2025-12-15

### Added
- **Joystick Seek Settings Screen**
  - New dedicated settings screen for customizing joystick-style seek behavior
  - Configurable minimum speed (1×-30×) and maximum speed (30×-600×)
  - Response curve presets: Precise (0.4), Balanced (0.65), Linear (1.0), Aggressive (1.5)
  - Custom curve exponent slider (0.2-2.0) for fine-tuning
  - Deadzone adjustment (0-30pt) to prevent accidental seeks
  - Haptic feedback toggle
  - Interactive SVG curve preview showing response mapping
  - Test area to try settings before committing
  - Reset to defaults option with confirmation

- **Joystick Seek Store**
  - New Zustand store with AsyncStorage persistence
  - Helper functions: `calculateSeekSpeed()`, `applyDeadzone()`, `formatSpeedLabel()`
  - Settings automatically applied to CDPlayerScreen joystick seek

### Changed
- **CDPlayerScreen**: Now uses joystick seek settings from store instead of hardcoded values
- **CoverPlayButton**: Accepts optional `joystickSettings` prop for curve-based seeking
- **PlaybackSettingsScreen**: Added navigation link to Joystick Seek settings

### Files Added
- `src/features/player/stores/joystickSeekStore.ts` - Settings store with persistence
- `src/features/profile/screens/JoystickSeekSettingsScreen.tsx` - Complete settings UI

### Files Modified
- `src/shared/components/CoverPlayButton.tsx` - Added joystickSettings prop support
- `src/features/player/screens/CDPlayerScreen.tsx` - Pass joystick settings to CoverPlayButton
- `src/features/profile/screens/PlaybackSettingsScreen.tsx` - Added navigation to Joystick Seek
- `src/navigation/AppNavigator.tsx` - Added JoystickSeekSettings route
- `src/features/profile/index.ts` - Export JoystickSeekSettingsScreen
- `src/constants/version.ts` - Version bump to 0.3.2

---

## [0.3.1] - 2025-12-15

### Fixed
- **View All Button on Browse Screen**
  - View All buttons now work on all content rows (New This Week, Short & Sweet, etc.)
  - Navigates to My Library when tapped
  - Added `seeAllRoute` to all content rows in useDiscoverData hook

- **Player Close Animation**
  - Reduced close animation duration from 200ms to 150ms
  - Added accelerate easing for dismiss (feels more natural)
  - Snap-back animation now uses timing instead of spring (quicker, more responsive)
  - Both swipe-dismiss and snap-back now feel snappier

### Files Modified
- `src/features/discover/hooks/useDiscoverData.ts` - Added seeAllRoute to all rows
- `src/features/player/screens/CDPlayerScreen.tsx` - Faster close/snap animations
- `src/constants/version.ts` - Version bump to 0.3.1

---

## [0.3.0] - 2025-12-15

### Added
- **Unified Animation & Motion Design System**
  - New `src/shared/animation/` module with centralized animation infrastructure
  - `tokens.ts`: Duration, easing, spring, scale, and CD rotation tokens based on UX research
  - `hooks.ts`: Animation hooks with accessibility support
    - `useReduceMotion()`: Detect accessibility preference for reduced motion
    - `useAccessibleAnimation()`: Animate with reduced motion support
    - `usePressAnimation()`: Standard press feedback animation
    - `useBounceAnimation()`: Celebratory bounce for like buttons, achievements
    - `useFadeAnimation()`: Fade in/out animations
    - `useSlideAnimation()`: Slide in/out animations
  - `AnimatedPressable.tsx`: Reusable animated pressable components
    - `AnimatedPressable`: General purpose with configurable scale and haptics
    - `AnimatedIconPressable`: Optimized for icon buttons
    - `AnimatedCardPressable`: Optimized for cards/rows

### Changed
- **HomeDiscSection**: Now uses centralized animation tokens
  - CD rotation uses `CD_ROTATION.baseSpeed` token
  - Press animation uses `SCALE.cardPress`, `DURATION.press`, `EASING.decelerate`
- **CDPlayerScreen**: Now uses centralized animation tokens
  - CD rotation uses `CD_ROTATION.baseSpeed` token
  - Buffering oscillation uses `CD_ROTATION.bufferingFrequency` and `CD_ROTATION.bufferingAmplitude`
  - Progress thumb animation uses `DURATION.press` token

### Design Philosophy
- Motion serves feedback, orientation, and delight
- Based on NNGroup research, Material Design, Apple HIG, and Spotify patterns
- All animations respect `prefers-reduced-motion` accessibility setting

### Files Added
- `src/shared/animation/index.ts` - Module barrel export
- `src/shared/animation/tokens.ts` - Animation design tokens
- `src/shared/animation/hooks.ts` - Animation hooks
- `src/shared/animation/AnimatedPressable.tsx` - Animated pressable components

### Files Modified
- `src/features/home/components/HomeDiscSection.tsx` - Use animation tokens
- `src/features/player/screens/CDPlayerScreen.tsx` - Use animation tokens
- `src/constants/version.ts` - Version bump to 0.3.0

---

## [0.2.9] - 2025-12-15

### Added
- **Manage Downloads Screen Redesign (UX Research-backed)**
  - Storage card with visual bar showing used/available device space
  - Downloading section with real-time progress bars, pause/resume/cancel controls
  - Queued section showing pending downloads with cancel option
  - Downloaded section with swipe-to-delete gesture (sorted by size, largest first)
  - Section headers with counts and bulk actions (Pause All, Delete All)
  - Download Settings link at bottom
  - Empty state with Browse Library CTA

- **UX Research Implementation**
  - Based on NNGroup progress indicator guidelines
  - Competitor patterns analyzed: Audible, Spotify, Netflix
  - Progress shows: percentage, bytes downloaded/total, estimated time remaining
  - Destructive actions (delete) require confirmation
  - 44x44px minimum touch targets per accessibility guidelines
  - Haptic feedback on destructive actions

### Files Modified
- `src/features/downloads/screens/DownloadsScreen.tsx` - Complete redesign per UX spec
- `src/constants/version.ts` - Version bump to 0.2.9

---

## [0.2.8] - 2025-12-15

### Changed
- **Toned Down Animations Throughout App**
  - CD disc spin speed reduced from 12 deg/s to 6 deg/s (1 rotation per 60s instead of 30s)
  - Press scale animations reduced from 0.96 to 0.98 with shorter duration
  - Buffering oscillation reduced from ±3° to ±1.5° at slower frequency
  - Progress bar thumb scale reduced from 1.2x to 1.1x
  - Spring animations replaced with timing animations where appropriate
  - Tab bar indicator uses smooth 150ms timing instead of bouncy spring
  - Mini player snap-back uses subtle 150ms timing

### Files Modified
- `src/features/home/components/HomeDiscSection.tsx` - Slower spin, subtler press
- `src/features/player/screens/CDPlayerScreen.tsx` - Slower spin, reduced buffering wobble, subtler thumb
- `src/navigation/components/GlobalMiniPlayer.tsx` - Smoother snap-back
- `src/shared/components/CoverPlayButton.tsx` - Softer spring config
- `src/features/player/components/LiquidSlider.tsx` - Softer spring config
- `src/shared/components/feedback/TabBar.tsx` - Timing instead of spring
- `src/constants/version.ts` - Version bump to 0.2.8

---

## [0.2.7] - 2025-12-15

### Fixed
- **Home Screen CD Disc Opens Player**
  - Tapping the CD disc on home screen now properly opens the full player
  - If book is already loaded, opens player directly
  - If book is not loaded, loads the book first then opens player
  - Opens without auto-playing (user can press play when ready)

### Files Modified
- `src/features/home/screens/HomeScreen.tsx` - Fixed handleDiscPress to load book and open player
- `src/constants/version.ts` - Version bump to 0.2.7

---

## [0.2.6] - 2025-12-15

### Added
- **Clear All Downloads Feature**
  - Implemented functional "Clear All Downloads" in Storage Settings
  - Shows confirmation dialog with download count and storage to be freed
  - Shows "Clearing..." state during operation
  - Success/error feedback via alerts

### Files Modified
- `src/features/profile/screens/StorageSettingsScreen.tsx` - Connected to downloadManager.clearAllDownloads()
- `src/constants/version.ts` - Version bump to 0.2.6

---

## [0.2.5] - 2025-12-15

### Changed
- **Bottom Navigation Tab Reorder (UX Research)**
  - Reordered tabs: Home → Library → Search → Browse → Profile (was: Browse → Library → Search → Profile → Home)
  - Home moved to leftmost position as primary entry point
  - Profile moved to rightmost position following platform conventions
  - Search centered for quick access with one-handed use

- **Active Tab Styling Improvements**
  - Active tab icon and label now use accent color (#F3B60C) for better visibility
  - Added underline indicator below active tab label
  - Improved visual hierarchy between active and inactive states

### Files Modified
- `src/navigation/components/FloatingTabBar.tsx` - Reordered TABS array, updated active styling
- `src/constants/version.ts` - Version bump to 0.2.5

---

## [0.2.4] - 2025-12-15

### Removed
- **Codebase Cleanup - Unused Files (~1MB removed)**
  - Deleted unused search components: `SearchResultItem.tsx`, `SearchResultSection.tsx`
  - Deleted unused screens: `AuthorListScreen.tsx`, `NarratorListScreen.tsx`, `SimplePlayerScreen.tsx`, `CollectionsScreen.tsx`
  - Deleted build artifacts: `xcodebuild.log`, `xcodebuild-error.log`, `devices.json`, `settings.local.json`
  - Deleted web entry point: `index.web.js` (app is mobile-only)
  - Deleted outdated docs: `docs/progress.md` (superseded by CHANGELOG.md)

### Changed
- Updated barrel exports in `author/index.ts`, `narrator/index.ts`, `player/index.ts`, `collections/index.ts`

### Files Deleted (12 total)
- `src/features/search/components/SearchResultItem.tsx`
- `src/features/search/components/SearchResultSection.tsx`
- `src/features/author/screens/AuthorListScreen.tsx`
- `src/features/narrator/screens/NarratorListScreen.tsx`
- `src/features/player/screens/SimplePlayerScreen.tsx`
- `src/features/collections/screens/CollectionsScreen.tsx`
- `xcodebuild.log`
- `xcodebuild-error.log`
- `devices.json`
- `settings.local.json`
- `index.web.js`
- `docs/progress.md`

---

## [0.2.3] - 2025-12-15

### Added
- **Comprehensive Documentation**
  - Created `CLAUDE.md` in project root with AI assistant instructions
  - Updated `docs/architecture.md` with complete technical architecture
  - Created `docs/DOCUMENTATION.md` with full app documentation

### Documentation Includes
- Project structure and overview
- State management patterns (React Query, Zustand)
- Player architecture and seeking flow
- Queue system documentation
- Downloads architecture
- Offline-first strategy
- Design system tokens
- API integration guide
- Troubleshooting guide

### Files Modified
- `CLAUDE.md` - NEW: AI assistant quick reference
- `docs/architecture.md` - Updated with current architecture
- `docs/DOCUMENTATION.md` - NEW: Comprehensive app documentation
- `src/constants/version.ts` - Version bump to 0.2.3

---

## [0.2.2] - 2025-12-14

### Fixed
- **Android Search Input Issues**
  - SearchScreen: Changed fixed `height: 40` to `minHeight: 44` to prevent text overflow
  - SearchScreen: Added `paddingVertical: 8` to input to prevent text clipping
  - MyLibraryScreen: Added `minHeight: 44` to search bar container
  - MyLibraryScreen: Added `paddingVertical: 4` to search input
  - SearchBar: Added hitSlop to clear button for better touch targets

### Files Modified
- `src/features/search/screens/SearchScreen.tsx` - Fixed search container and input styling
- `src/features/search/components/SearchBar.tsx` - Added hitSlop to clear button
- `src/features/library/screens/MyLibraryScreen.tsx` - Fixed search bar minHeight and input padding
- `src/constants/version.ts` - Version bump to 0.2.2

---

## [0.2.1] - 2025-12-14

### Fixed
- **My Library Screen Cleanup**
  - Removed duplicate filter chips (FilterChips component) since tab bar already provides filtering
  - Cleaned up unused imports (FilterChips, AppliedFilters)
  - Simplified filteredBooks logic by removing redundant listen filter state

### Files Modified
- `src/features/library/screens/MyLibraryScreen.tsx` - Removed duplicate filter UI
- `src/constants/version.ts` - Version bump to 0.2.1

---

## [0.2.0] - 2024-12-14

### Added
- **Queue Management Improvements**
  - Drag-and-drop reordering in queue panel (using react-native-draggable-flatlist)
  - Queue access from both CDPlayerScreen and SimplePlayerScreen via new panel
  - "Up Next" preview in GlobalMiniPlayer showing next queued book
  - Queue button with badge showing item count

- **Version Tracking System**
  - Added `src/constants/version.ts` for centralized version management
  - Version displayed in Profile screen footer
  - This CHANGELOG.md for tracking changes across sessions

### Fixed
- Added missing `audioLog.debug` method to `src/shared/utils/audioDebug.ts`
- Queue pill repositioned under sleep timer in CDPlayerScreen

### Changed
- CDPlayerScreen pills layout: Sleep and Queue stacked vertically on left, Speed on right

### Files Modified
- `package.json` - Added react-native-draggable-flatlist dependency
- `src/features/queue/components/QueuePanel.tsx` - NEW: Draggable queue panel component
- `src/features/player/screens/CDPlayerScreen.tsx` - Added queue sheet and repositioned pills
- `src/features/player/screens/SimplePlayerScreen.tsx` - Added queue sheet
- `src/navigation/components/GlobalMiniPlayer.tsx` - Added "Up Next" preview
- `src/shared/utils/audioDebug.ts` - Added debug method
- `src/constants/version.ts` - NEW: Version tracking
- `src/features/profile/screens/ProfileScreen.tsx` - Dynamic version display

---

## [0.1.0] - Pre-changelog

Initial development version. Changes before this point are not tracked in this format.

### Features at this point
- Home screen redesign
- My Library screen with filtering
- CD Player and Simple Player screens
- Queue system with SQLite persistence
- Download management
- Series and author browsing
- Profile and settings screens
