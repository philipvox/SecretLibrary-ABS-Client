# Architecture

This document describes the overall architecture of the AudiobookShelf mobile app.

## Table of Contents

- [Directory Structure](#directory-structure)
- [Navigation Structure](#navigation-structure)
- [Data Flow](#data-flow)
- [Feature Module Pattern](#feature-module-pattern)
- [Core Services](#core-services)
- [Player Architecture](#player-architecture)
- [Downloads Architecture](#downloads-architecture)
- [Offline-First Architecture](#offline-first-architecture)
- [API Layer](#api-layer)
- [Type System](#type-system)

## Directory Structure

```
src/
├── config/                     # App configuration
│   ├── constants.ts            # API URLs, timeouts, limits
│   └── features.ts             # Feature flags
│
├── core/                       # Foundation layer
│   ├── api/                    # HTTP client
│   │   ├── baseClient.ts       # Axios configuration with interceptors
│   │   ├── apiClient.ts        # Main API client with all methods
│   │   ├── endpoints.ts        # URL definitions
│   │   ├── errors.ts           # Custom error classes
│   │   ├── middleware.ts       # Request/response middleware
│   │   ├── networkOptimizer.ts # Deduplication, caching, retry
│   │   ├── offlineApi.ts       # Offline-aware API functions
│   │   ├── playbackApi.ts      # Playback session APIs
│   │   └── endpoints/          # Domain-specific API modules
│   │       ├── auth.ts
│   │       ├── user.ts
│   │       ├── libraries.ts
│   │       ├── items.ts
│   │       ├── collections.ts
│   │       ├── series.ts
│   │       ├── authors.ts
│   │       └── playlists.ts
│   │
│   ├── auth/                   # Authentication
│   │   ├── authContext.tsx     # Auth provider and hooks
│   │   └── authService.ts      # Token management
│   │
│   ├── services/               # Core services
│   │   ├── sqliteCache.ts      # SQLite database management
│   │   ├── syncQueue.ts        # Offline sync queue
│   │   ├── downloadManager.ts  # Audio file downloads
│   │   └── prefetchService.ts  # Data prefetching
│   │
│   ├── hooks/                  # Core React hooks
│   │   ├── useDownloads.ts     # Download management hooks
│   │   ├── useSyncStatus.ts    # Sync status monitoring
│   │   └── useLibraryPrefetch.ts
│   │
│   ├── types/                  # TypeScript definitions
│   │   ├── api.ts              # Request/response types
│   │   ├── library.ts          # LibraryItem, Collection
│   │   ├── media.ts            # MediaProgress, PlaybackSession
│   │   ├── metadata.ts         # Author, Series, Narrator
│   │   ├── user.ts             # User type
│   │   └── files.ts            # File types
│   │
│   ├── cache/                  # Caching utilities
│   │   └── libraryCache.ts
│   │
│   ├── storage/                # Storage utilities
│   │   ├── database.ts
│   │   └── cache.ts
│   │
│   ├── sync/                   # Sync service
│   │   └── syncService.ts
│   │
│   ├── native/                 # Native module utilities
│   │   ├── haptics.ts
│   │   ├── performanceMonitor.ts
│   │   └── storageOptimizer.ts
│   │
│   └── queryClient.ts          # React Query config + query keys
│
├── features/                   # Feature modules
│   ├── author/
│   ├── book-detail/
│   ├── browse/
│   ├── collections/
│   ├── downloads/
│   ├── library/
│   ├── narrator/
│   ├── player/
│   ├── profile/
│   ├── recommendations/
│   ├── search/
│   ├── series/
│   └── user/
│
├── navigation/                 # App navigation
│   ├── AppNavigator.tsx        # Root navigator setup
│   ├── types.ts                # Navigation type definitions
│   └── components/
│       ├── TopNavBar.tsx
│       └── FloatingTabBar.tsx
│
└── shared/                     # Shared utilities
    ├── components/             # Reusable UI components
    │   ├── buttons/
    │   ├── cards/
    │   ├── inputs/
    │   ├── feedback/
    │   ├── Button.tsx
    │   ├── Card.tsx
    │   ├── LoadingSpinner.tsx
    │   ├── ErrorView.tsx
    │   ├── EmptyState.tsx
    │   ├── Skeleton.tsx
    │   ├── AnimatedComponents.tsx
    │   ├── GestureComponents.tsx
    │   ├── LazyComponents.tsx
    │   └── index.ts
    │
    ├── hooks/                  # Shared hooks
    │   └── index.ts
    │
    ├── theme/                  # Design tokens
    │   ├── colors.ts
    │   ├── spacing.ts
    │   ├── typography.ts
    │   └── index.ts
    │
    └── utils/                  # Utility functions
        ├── metadata.ts
        ├── navigation.ts
        └── index.ts
```

## Navigation Structure

```
Stack Navigator (Root)
├── Login Screen (unauthenticated)
│
└── Main Stack (authenticated)
    │
    ├── Bottom Tab Navigator (4 tabs)
    │   │
    │   ├── LibraryTab
    │   │   └── LibraryItemsScreen
    │   │
    │   ├── SearchTab
    │   │   └── SearchScreen
    │   │
    │   ├── BrowseTab
    │   │   └── BrowseScreen
    │   │       └── Top Tab Navigator
    │   │           ├── Series
    │   │           ├── Authors
    │   │           ├── Narrators
    │   │           └── Collections
    │   │
    │   └── ProfileTab
    │       └── ProfileScreen
    │
    ├── Modal Screens
    │   ├── BookDetail
    │   ├── SeriesDetail
    │   ├── AuthorDetail
    │   ├── NarratorDetail
    │   ├── CollectionDetail
    │   └── Downloads
    │
    └── PlayerScreen (fullscreen modal)
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                         UI Layer                             │
│  (Screens and Components)                                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       Hooks Layer                            │
│  (useLibraryItems, useBookDetail, usePlayerStore)           │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   React Query   │ │     Zustand     │ │   Local State   │
│  (Server State) │ │ (Client State)  │ │   (useState)    │
└─────────────────┘ └─────────────────┘ └─────────────────┘
              │               │
              ▼               ▼
┌─────────────────┐ ┌─────────────────┐
│   API Client    │ │  AsyncStorage   │
│   (axios)       │ │  (persist)      │
└─────────────────┘ └─────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│                    SQLite Cache                              │
│  (Offline data, downloads, sync queue)                      │
└─────────────────────────────────────────────────────────────┘
```

## Feature Module Pattern

Each feature follows this structure:

```
features/{feature-name}/
├── components/           # UI components (max ~200 lines each)
│   ├── FeatureCard.tsx
│   └── FeatureList.tsx
│
├── hooks/                # Data fetching and state hooks
│   ├── useFeatureData.ts
│   └── useFeatureMutations.ts
│
├── screens/              # Screen components (max ~200 lines)
│   └── FeatureScreen.tsx
│
├── services/             # Business logic and adapters
│   └── featureService.ts
│
├── stores/               # Zustand stores (if needed)
│   └── featureStore.ts
│
├── types.ts              # Feature-specific types
│
└── index.ts              # Public exports (barrel file)
```

### Feature Independence

- Features should not import from other features
- Shared code goes in `src/shared/`
- Cross-feature communication via stores or navigation params

## Core Services

### SQLite Cache

Located at `src/core/services/sqliteCache.ts`:

```
Tables:
├── library_items         # Cached library items
├── progress              # Playback progress (local + synced)
├── favorites             # User favorites
├── downloads             # Downloaded audio files
├── download_queue        # Pending downloads
├── sync_queue            # Offline mutations queue
├── sync_log              # Sync history
└── image_cache           # Cached cover images
```

### Sync Queue

Located at `src/core/services/syncQueue.ts`:

- Queues mutations when offline
- Processes queue when network restored
- Retry logic with max attempts
- Network state monitoring via NetInfo

### Download Manager

Located at `src/core/services/downloadManager.ts`:

- Queue-based download processing
- Progress tracking with listeners
- Pause/resume capability
- File system management

## Player Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     PlayerScreen                             │
│  (Full-screen modal with controls)                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     playerStore                              │
│  (Zustand)                                                   │
│  - currentTrack                                              │
│  - isPlaying                                                 │
│  - currentTime                                               │
│  - playbackSpeed                                             │
│  - isOffline                                                 │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  audioService   │ │ progressService │ │  sessionService │
│  (expo-av)      │ │ (sync to server)│ │ (API sessions)  │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### Playback Flow

1. User taps play on a book
2. `playerStore.loadBook()` checks for downloaded version
3. If downloaded: `isOffline: true`, use local file path
4. If streaming: create playback session with server
5. Audio loads via expo-av
6. Progress syncs periodically to server (or queued if offline)

## Downloads Architecture

### Storage Structure

```
{documentDirectory}/downloads/
└── {libraryItemId}/
    ├── audio.m4b        # Audio file
    └── cover.jpg        # Cover image (optional)
```

### Download Flow

```
User taps download
        │
        ▼
┌─────────────────┐
│ Add to queue    │
│ (SQLite)        │
└─────────────────┘
        │
        ▼
┌─────────────────┐
│ Download        │
│ Manager picks   │
│ up from queue   │
└─────────────────┘
        │
        ▼
┌─────────────────┐
│ Download with   │
│ progress        │
│ (expo-fs)       │
└─────────────────┘
        │
        ▼
┌─────────────────┐
│ Update status   │
│ to completed    │
└─────────────────┘
```

## Offline-First Architecture

### Layers

```
┌─────────────────────────────────────────────────────────────┐
│                     Network Layer                            │
│  (Online API calls)                                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Offline-Aware API                          │
│  - Check network status                                      │
│  - Queue if offline                                          │
│  - Use cached data as fallback                              │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  SQLite Cache   │ │   Sync Queue    │ │  Download Store │
│  (read/write)   │ │   (mutations)   │ │  (files)        │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### Sync Strategy

1. **Writes**: Always write to local SQLite first
2. **Network check**: Attempt server sync if online
3. **Queue**: If offline or failed, queue for later
4. **Background sync**: Process queue when network restored

## API Layer

### Structure

```
core/api/
├── baseClient.ts       # Axios instance with interceptors
├── apiClient.ts        # Main client extending base
├── endpoints.ts        # URL mapping
├── errors.ts           # ApiError, NetworkError, etc.
├── middleware.ts       # Request/response hooks
├── networkOptimizer.ts # Dedup, cache, retry, queue
├── offlineApi.ts       # Offline-aware wrappers
└── endpoints/          # Domain APIs
    ├── auth.ts         # authApi.login(), logout()
    ├── user.ts         # userApi.getProgress(), etc.
    ├── libraries.ts    # librariesApi.getAll(), etc.
    ├── items.ts        # itemsApi.getById(), etc.
    ├── collections.ts  # collectionsApi.create(), etc.
    ├── series.ts       # seriesApi.getById()
    ├── authors.ts      # authorsApi.getWithItems()
    └── playlists.ts    # playlistsApi.create(), etc.
```

### Network Optimizer Features

- **Request Deduplication**: Prevents duplicate concurrent requests
- **Response Caching**: Short-term cache with TTL
- **Retry Logic**: Exponential backoff for failures
- **Request Queue**: Priority-based request ordering
- **Prefetching**: Low-priority background data loading

## Type System

### Core Types

```typescript
// Library Item
interface LibraryItem {
  id: string;
  libraryId: string;
  mediaType: 'book' | 'podcast';
  media: BookMedia | PodcastMedia;
  // ...
}

// Book Media
interface BookMedia {
  metadata: BookMetadata;
  audioFiles: AudioFile[];
  chapters: Chapter[];
  duration: number;
}

// Metadata
interface BookMetadata {
  title: string;
  authorName: string;
  narratorName: string;
  seriesName?: string;
  genres: string[];
  description?: string;
}

// Progress
interface MediaProgress {
  id: string;
  libraryItemId: string;
  currentTime: number;
  duration: number;
  progress: number;
  isFinished: boolean;
}
```

### API Response Types

```typescript
// Paginated response
interface PaginatedResponse<T> {
  results: T[];
  total: number;
  limit: number;
  page: number;
}

// API error
interface ApiError {
  code: string;
  message: string;
  status?: number;
  details?: unknown;
}
```
