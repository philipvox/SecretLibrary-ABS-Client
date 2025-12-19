# Changelog

All notable changes to the AudiobookShelf app are documented in this file.

**For Claude/AI assistants:** When making changes to this codebase, please:
1. Update the version in `src/constants/version.ts`
2. Add an entry to this changelog with your changes
3. Use semantic versioning (MAJOR.MINOR.PATCH)

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
