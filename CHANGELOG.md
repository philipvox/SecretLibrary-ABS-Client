# Changelog

All notable changes to the AudiobookShelf app are documented in this file.

**For Claude/AI assistants:** When making changes to this codebase, please:
1. Update the version in `src/constants/version.ts`
2. Add an entry to this changelog with your changes
3. Use semantic versioning (MAJOR.MINOR.PATCH)

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
