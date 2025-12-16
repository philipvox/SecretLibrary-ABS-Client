# Architecture

Technical architecture documentation for the AudiobookShelf mobile app.

---

## Table of Contents

- [Overview](#overview)
- [Directory Structure](#directory-structure)
- [Navigation Architecture](#navigation-architecture)
- [State Management](#state-management)
- [Data Flow](#data-flow)
- [Player Architecture](#player-architecture)
- [Queue System](#queue-system)
- [Downloads Architecture](#downloads-architecture)
- [Offline-First Architecture](#offline-first-architecture)
- [Caching Strategy](#caching-strategy)
- [API Layer](#api-layer)
- [Design System](#design-system)
- [Key Services](#key-services)

---

## Overview

The AudiobookShelf mobile app is a React Native/Expo application that connects to AudiobookShelf servers for audiobook streaming and offline playback.

### Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React Native 0.81 + Expo SDK 54 |
| Language | TypeScript (strict mode) |
| Navigation | React Navigation v7 (tabs + stacks) |
| Server State | TanStack React Query v5 |
| Client State | Zustand v5 |
| Database | Expo SQLite |
| Storage | AsyncStorage, SecureStore |
| Audio | expo-av, expo-media-control |
| Animations | react-native-reanimated v4 |
| Gestures | react-native-gesture-handler |

### Key Architectural Decisions

1. **Offline-First**: SQLite caching enables offline access
2. **Non-Blocking UI**: Show cached data immediately, fetch fresh in background
3. **Feature Modules**: Self-contained feature folders with own stores/services
4. **Seeking Mode Fix**: Dedicated seeking state prevents position jitter
5. **Per-Book Settings**: Playback speed remembered per book

---

## Directory Structure

```
src/
├── constants/                  # App-wide constants
│   ├── version.ts              # Version tracking
│   └── layout.ts               # Layout constants
│
├── core/                       # Foundation layer
│   ├── api/                    # HTTP client
│   │   ├── apiClient.ts        # Main API client
│   │   ├── baseClient.ts       # Axios configuration
│   │   ├── endpoints.ts        # URL definitions
│   │   ├── errors.ts           # Error classes
│   │   ├── playbackApi.ts      # Playback session APIs
│   │   ├── offlineApi.ts       # Offline-aware wrappers
│   │   └── networkOptimizer.ts # Request dedup, cache, retry
│   │
│   ├── auth/                   # Authentication
│   │   ├── authContext.tsx     # Auth provider
│   │   └── authService.ts      # Token management
│   │
│   ├── cache/                  # Caching
│   │   └── libraryCache.ts     # In-memory library cache
│   │
│   ├── services/               # Core services
│   │   ├── sqliteCache.ts      # SQLite database (~70KB)
│   │   ├── downloadManager.ts  # Download system (~34KB)
│   │   ├── networkMonitor.ts   # Network status
│   │   ├── prefetchService.ts  # Data prefetching
│   │   └── appInitializer.ts   # App startup
│   │
│   ├── hooks/                  # Core hooks
│   │   ├── useDownloads.ts     # Download management
│   │   ├── useBootstrap.ts     # App initialization
│   │   └── useNetwork.ts       # Network status
│   │
│   ├── types/                  # TypeScript definitions
│   │   ├── api.ts              # API types
│   │   ├── library.ts          # LibraryItem types
│   │   ├── media.ts            # Media types
│   │   └── index.ts            # Exports
│   │
│   └── queryClient.ts          # React Query config
│
├── features/                   # Feature modules (18 total)
│   ├── player/                 # Audio playback
│   │   ├── stores/
│   │   │   └── playerStore.ts  # Main store (~2000 lines)
│   │   ├── services/
│   │   │   ├── audioService.ts
│   │   │   ├── sessionService.ts
│   │   │   ├── progressService.ts
│   │   │   └── backgroundSyncService.ts
│   │   ├── screens/
│   │   │   ├── CDPlayerScreen.tsx
│   │   │   └── SimplePlayerScreen.tsx
│   │   └── components/
│   │
│   ├── queue/                  # Playback queue
│   │   ├── stores/
│   │   │   └── queueStore.ts
│   │   ├── components/
│   │   │   └── QueuePanel.tsx
│   │   └── screens/
│   │       └── QueueScreen.tsx
│   │
│   ├── library/                # My Library
│   │   ├── stores/
│   │   │   └── myLibraryStore.ts
│   │   ├── screens/
│   │   │   └── MyLibraryScreen.tsx
│   │   └── components/
│   │
│   ├── downloads/              # Download management
│   ├── search/                 # Search functionality
│   ├── home/                   # Home screen
│   ├── browse/                 # Browse/discover
│   ├── book-detail/            # Book detail
│   ├── series/                 # Series detail
│   ├── author/                 # Author detail
│   ├── narrator/               # Narrator detail
│   ├── profile/                # Profile & settings
│   ├── recommendations/        # Recommendations
│   ├── automotive/             # CarPlay/Android Auto
│   ├── stats/                  # Listening statistics
│   ├── completion/             # Book completion
│   └── discover/               # Discover content
│
├── navigation/                 # Navigation setup
│   ├── AppNavigator.tsx        # Root navigator
│   ├── types.ts                # Navigation types
│   └── components/
│       ├── NavigationBar.tsx   # Custom tab bar
│       ├── GlobalMiniPlayer.tsx # Floating mini player
│       └── TabBar.tsx
│
└── shared/                     # Shared code
    ├── components/             # ~25 UI components
    │   ├── BookCard.tsx
    │   ├── Button.tsx
    │   ├── Icon.tsx
    │   ├── HeartButton.tsx
    │   ├── DownloadButton.tsx
    │   ├── SeriesProgressBadge.tsx
    │   ├── StackedCovers.tsx
    │   └── index.ts
    │
    ├── theme/                  # Design tokens
    │   ├── colors.ts
    │   ├── spacing.ts
    │   ├── typography.ts
    │   └── index.ts
    │
    ├── hooks/                  # Shared hooks
    └── utils/                  # Utilities
        ├── format.ts
        ├── audioDebug.ts
        └── index.ts
```

---

## Navigation Architecture

### Structure

```
AppNavigator (Stack)
│
├── LoginScreen (unauthenticated)
│
└── Main (authenticated)
    │
    ├── MainTabs (Bottom Tabs - hidden tab bar)
    │   ├── HomeTab → HomeScreen
    │   ├── LibraryTab → MyLibraryScreen
    │   ├── DiscoverTab → BrowseScreen
    │   └── ProfileTab → ProfileScreen
    │
    ├── Detail Screens (Modal presentation)
    │   ├── BookDetail
    │   ├── SeriesDetail
    │   ├── AuthorDetail
    │   ├── NarratorDetail
    │   └── CollectionDetail
    │
    ├── Feature Screens
    │   ├── Search
    │   ├── Downloads
    │   ├── Stats
    │   ├── QueueScreen
    │   ├── PlaybackSettings
    │   ├── StorageSettings
    │   └── Preferences
    │
    └── Player Screens (Full-screen modal)
        ├── CDPlayerScreen
        └── SimplePlayerScreen

Global Overlays (Always visible when authenticated):
├── GlobalMiniPlayer (bottom floating player)
└── NavigationBar (custom tab bar)
```

### Navigation Patterns

- **Bottom Tabs**: 4 main tabs with hidden default tab bar
- **Custom Tab Bar**: `NavigationBar` component provides navigation
- **Mini Player**: `GlobalMiniPlayer` floats above tabs when playing
- **Modal Screens**: Detail screens presented as modals

---

## State Management

### Three-Layer State Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     UI Components                            │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  React Query    │ │     Zustand     │ │   Local State   │
│  (Server State) │ │ (Client State)  │ │   (useState)    │
│                 │ │                 │ │                 │
│ - API responses │ │ - Player state  │ │ - Form inputs   │
│ - Cached data   │ │ - Queue         │ │ - Modal open    │
│ - Loading state │ │ - Downloads     │ │ - Toggles       │
│ - Refetching    │ │ - Preferences   │ │                 │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### Zustand Stores

| Store | Location | Purpose |
|-------|----------|---------|
| `playerStore` | `features/player/stores/` | Playback state, seeking, chapters, bookmarks, sleep timer |
| `queueStore` | `features/queue/stores/` | Queue items, autoplay, reordering |
| `myLibraryStore` | `features/library/stores/` | User's library, favorites |
| `preferencesStore` | `features/recommendations/stores/` | User preferences |
| `completionStore` | `features/completion/stores/` | Book completion tracking |

### PlayerStore Deep Dive

The playerStore is the most complex store (~2000 lines):

```typescript
interface PlayerState {
  // Current playback
  currentBook: LibraryItem | null;
  viewingBook: LibraryItem | null;  // Can differ from playing
  position: number;
  duration: number;
  isPlaying: boolean;
  isBuffering: boolean;
  playbackRate: number;

  // CRITICAL: Seeking state
  isSeeking: boolean;      // Blocks position updates during seek
  seekPosition: number;    // Target seek position

  // Content
  chapters: Chapter[];
  bookmarks: Bookmark[];

  // Features
  sleepTimer: SleepTimerState;
  shakeToExtendEnabled: boolean;
  bookSpeedMap: Record<string, number>;  // Per-book speeds
  controlMode: 'rewind' | 'chapter';
  progressMode: 'bar' | 'chapters';
}
```

---

## Data Flow

### Book Playback Flow

```
User taps Play on BookCard
         │
         ▼
┌─────────────────────────┐
│ playerStore.loadBook()  │
└─────────────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Check if downloaded     │
│ (downloadManager)       │
└─────────────────────────┘
         │
    ┌────┴────┐
    ▼         ▼
Downloaded   Streaming
    │         │
    ▼         ▼
Local file   sessionService.startSession()
paths        Get stream URLs
    │         │
    └────┬────┘
         ▼
┌─────────────────────────┐
│ audioService.loadAudio()│
│ or loadTracks()         │
└─────────────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Apply per-book speed    │
│ Load bookmarks          │
│ Extract chapters        │
└─────────────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Start playback          │
│ Begin progress sync     │
└─────────────────────────┘
```

### Seeking Flow (Critical Fix)

```
User starts seek (drag scrubber)
         │
         ▼
┌─────────────────────────┐
│ startSeeking()          │
│ isSeeking = true        │
│ seekPosition = target   │
└─────────────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Position updates from   │
│ audioService BLOCKED    │
│ (prevents UI jitter)    │
└─────────────────────────┘
         │
User releases scrubber
         │
         ▼
┌─────────────────────────┐
│ commitSeek()            │
│ Perform actual seek     │
│ Wait 300ms settling     │
│ isSeeking = false       │
└─────────────────────────┘
```

---

## Player Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                   CDPlayerScreen                             │
│  (Full-screen player with album art, chapters, controls)    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      playerStore                             │
│  (Zustand - central state management)                       │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  audioService   │ │ progressService │ │  sessionService │
│                 │ │                 │ │                 │
│ - expo-av       │ │ - Load progress │ │ - API sessions  │
│ - Multi-track   │ │ - Save progress │ │ - Stream URLs   │
│ - Seek/play     │ │ - SQLite        │ │ - Sync to server│
└─────────────────┘ └─────────────────┘ └─────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                backgroundSyncService                         │
│  (Periodic progress sync to server - every 30s)             │
└─────────────────────────────────────────────────────────────┘
```

### Multi-Track Support

The player handles both single-file and multi-file audiobooks:

```typescript
// Single file
audioService.loadAudio(url, startPosition);

// Multi-track (chapters split across files)
audioService.loadTracks([
  { url: 'file1.mp3', startOffset: 0, duration: 3600 },
  { url: 'file2.mp3', startOffset: 3600, duration: 3600 },
]);
```

---

## Queue System

### QueueStore

```typescript
interface QueueState {
  queue: LibraryItem[];
  autoplayEnabled: boolean;
  autoSeriesBookId: string | null;

  // Actions
  addToQueue(item: LibraryItem): void;
  removeFromQueue(itemId: string): void;
  reorderQueue(fromIndex: number, toIndex: number): void;
  playNext(): LibraryItem | null;
  checkAndAddSeriesBook(currentBook: LibraryItem): void;
}
```

### Auto-Add Series

At 80% book completion, the next book in series is auto-added:

```
Book at 80% progress
         │
         ▼
┌─────────────────────────┐
│ checkAndAddSeriesBook() │
│ - Get series info       │
│ - Find next book        │
│ - Add to queue          │
└─────────────────────────┘
```

### Queue Panel

Accessible from both player screens with drag-and-drop reordering:

```
CDPlayerScreen / SimplePlayerScreen
         │
         ▼
┌─────────────────────────┐
│ QueuePanel (sheet)      │
│ - DraggableFlatList     │
│ - Haptic feedback       │
│ - Swipe to remove       │
│ - Autoplay toggle       │
└─────────────────────────┘
```

---

## Downloads Architecture

### Storage Structure

```
{documentDirectory}/downloads/
└── {libraryItemId}/
    ├── audio.m4b         # Audio file
    ├── cover.jpg         # Cover image
    └── metadata.json     # Book metadata
```

### Download Flow

```
User taps Download
         │
         ▼
┌─────────────────────────┐
│ downloadManager         │
│ .startDownload(item)    │
└─────────────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Add to SQLite queue     │
│ Status: 'pending'       │
└─────────────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Process queue           │
│ (respects network       │
│  restrictions)          │
└─────────────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Download with progress  │
│ expo-file-system        │
└─────────────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Update status:          │
│ 'complete'              │
└─────────────────────────┘
```

### Download Manager Features

- Queue-based processing
- Priority ordering
- Pause/resume support
- Network-aware (WiFi-only option)
- Progress tracking with listeners
- Auto-download next in series

---

## Offline-First Architecture

### Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                      UI Layer                                │
│  (Always responsive - uses cached data)                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Offline-Aware API                          │
│  - Check network status                                     │
│  - Return cached data immediately                           │
│  - Fetch fresh data in background                           │
│  - Queue mutations if offline                               │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  SQLite Cache   │ │   Sync Queue    │ │  Downloaded     │
│                 │ │                 │ │  Files          │
│ - Library items │ │ - Offline       │ │                 │
│ - Progress      │ │   mutations     │ │ - Audio files   │
│ - Bookmarks     │ │ - Auto-retry    │ │ - Covers        │
│ - Sessions      │ │   when online   │ │                 │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### Sync Queue

When offline, mutations are queued:

```typescript
// Example: Update progress while offline
await updateProgressOffline(itemId, currentTime, duration);
// -> Queued in SQLite sync_queue table
// -> Processed automatically when network restored
```

---

## Caching Strategy

### Three-Level Cache

1. **In-Memory Cache** (`libraryCache.ts`)
   - Fast access for frequently used data
   - Library items, series, authors
   - Cleared on app restart

2. **SQLite Cache** (`sqliteCache.ts`)
   - Persistent offline data
   - Progress, bookmarks, downloads
   - Sync queue

3. **React Query Cache** (`queryClient.ts`)
   - Server state caching
   - Automatic background refetch
   - Stale-while-revalidate pattern

### Cache Tables (SQLite)

```
library_items      # Cached library items
progress           # Playback progress
favorites          # User favorites
downloads          # Download status/metadata
download_queue     # Pending downloads
sync_queue         # Offline mutations
listening_sessions # Session history
bookmarks          # User bookmarks
```

---

## API Layer

### Structure

```
core/api/
├── baseClient.ts       # Axios instance + interceptors
├── apiClient.ts        # Main client with all methods
├── endpoints.ts        # URL definitions
├── errors.ts           # ApiError, NetworkError
├── playbackApi.ts      # Playback session APIs
├── offlineApi.ts       # Offline-aware wrappers
└── networkOptimizer.ts # Request optimization
```

### Network Optimizer Features

- **Request Deduplication**: Prevents duplicate concurrent requests
- **Response Caching**: Short-term cache with TTL
- **Retry Logic**: Exponential backoff for failures
- **Request Queue**: Priority-based ordering

---

## Design System

### Theme Tokens

```typescript
// Colors
colors.accent            // #F3B60C (gold)
colors.backgroundPrimary // #000000
colors.textPrimary       // #FFFFFF
colors.textSecondary     // rgba(255,255,255,0.70)

// Spacing
spacing.xs   // 4
spacing.sm   // 8
spacing.md   // 12
spacing.lg   // 16
spacing.xl   // 20

// Responsive scaling
scale(16)    // Scales based on screen width
```

### Design Principles

1. **Dark Theme**: Black backgrounds, white text, gold accents
2. **Responsive**: `scale()` function for proportional sizing
3. **Touch Targets**: Minimum 44pt for interactive elements
4. **Android Compatibility**: `minHeight` not `height`, proper padding

---

## Key Services

### Audio Service (`audioService.ts`)

- Multi-track audio loading
- Seamless streaming/offline switching
- Seek operations
- Playback rate control

### Session Service (`sessionService.ts`)

- Server playback sessions
- Stream URL management
- Progress synchronization

### Progress Service (`progressService.ts`)

- Load progress from SQLite/server
- Save progress locally
- Merge local/server progress

### Background Sync Service (`backgroundSyncService.ts`)

- Periodic progress sync (every 30s)
- Non-blocking operation
- Handles offline gracefully

### Download Manager (`downloadManager.ts`)

- Queue-based downloading
- Network-aware restrictions
- Progress tracking
- Auto-download next in series

### SQLite Cache (`sqliteCache.ts`)

- Database management
- Table migrations
- Query helpers
- Offline data storage
