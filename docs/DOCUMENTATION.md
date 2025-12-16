# AudiobookShelf Mobile App Documentation

Comprehensive documentation for the AudiobookShelf React Native mobile application.

---

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Features](#features)
4. [Screens](#screens)
5. [Components](#components)
6. [State Management](#state-management)
7. [Services](#services)
8. [Design System](#design-system)
9. [API Integration](#api-integration)
10. [Offline Support](#offline-support)
11. [Audio Playback](#audio-playback)
12. [Downloads](#downloads)
13. [Queue System](#queue-system)
14. [Troubleshooting](#troubleshooting)

---

## Overview

The AudiobookShelf mobile app is a React Native/Expo application that connects to AudiobookShelf servers, enabling users to:

- Stream audiobooks from their server
- Download books for offline listening
- Track listening progress across devices
- Manage their personal library
- Browse and discover content

### Tech Stack

| Category | Technology | Version |
|----------|------------|---------|
| Framework | React Native | 0.81.5 |
| Platform | Expo SDK | 54 |
| Language | TypeScript | Strict mode |
| Navigation | React Navigation | 7.x |
| State (Server) | TanStack Query | 5.x |
| State (Client) | Zustand | 5.x |
| Database | Expo SQLite | 16.x |
| Audio | expo-av | 16.x |
| Animations | react-native-reanimated | 4.x |

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Mac) or Android Emulator
- AudiobookShelf server to connect to

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd audiobookshelf-app-fresh

# Install dependencies
npm install

# Start development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

### Environment Setup

The app connects to AudiobookShelf servers. Users enter their server URL during login.

---

## Features

### Core Features

| Feature | Description | Status |
|---------|-------------|--------|
| Audio Playback | Stream or play downloaded audiobooks | Complete |
| Downloads | Download books for offline listening | Complete |
| My Library | Personal collection of books | Complete |
| Queue | Playback queue with drag-and-drop | Complete |
| Search | Full-text search across library | Complete |
| Progress Sync | Sync progress across devices | Complete |
| Sleep Timer | Auto-stop with shake-to-extend | Complete |
| Bookmarks | Save positions with notes | Complete |
| Chapters | Navigate by chapter | Complete |
| Speed Control | Per-book playback speed | Complete |

### Advanced Features

| Feature | Description | Status |
|---------|-------------|--------|
| CarPlay/Android Auto | Automotive integration | MVP |
| Offline Mode | Full offline functionality | Complete |
| Background Sync | Progress syncs automatically | Complete |
| Auto-Download | Download next in series | Complete |
| Listening Stats | Track listening time | Complete |

---

## Screens

### Main Tabs

#### Home Screen (`HomeScreen.tsx`)
- Continue listening section with hero card
- Recommendations based on preferences
- Recently added books
- Quick access to library

#### My Library Screen (`MyLibraryScreen.tsx`)
- Tabbed interface: All, Downloaded, In Progress, Favorites
- Search bar for filtering
- Sort options
- Book list with play buttons
- Series grouping

#### Discover/Browse Screen (`BrowseScreen.tsx`)
- Browse by category
- Authors, Narrators, Series, Genres
- Collections

#### Profile Screen (`ProfileScreen.tsx`)
- User information
- Downloads management link
- Playback settings link
- Storage settings link
- Listening stats link
- Sign out

### Player Screens

#### CD Player Screen (`CDPlayerScreen.tsx`)
- Full-screen player with album art
- Progress scrubber
- Play/pause, skip forward/back
- Chapter navigation
- Speed control
- Sleep timer
- Queue access
- Bookmarks

#### Simple Player Screen (`SimplePlayerScreen.tsx`)
- Minimalist player interface
- Essential controls only

### Detail Screens

#### Book Detail (`BookDetailScreen.tsx`)
- Book cover and metadata
- Description
- Play/download buttons
- Add to library
- Series information
- Author/narrator links

#### Series Detail (`SeriesDetailScreen.tsx`)
- Series overview
- All books in series
- Progress tracking
- Favorite toggle

#### Author Detail (`AuthorDetailScreen.tsx`)
- Author information
- All books by author
- Favorite toggle

#### Narrator Detail (`NarratorDetailScreen.tsx`)
- Narrator information
- All books narrated
- Favorite toggle

### Settings Screens

#### Playback Settings (`PlaybackSettingsScreen.tsx`)
- Control mode (rewind vs chapter skip)
- Skip intervals
- Default playback speed
- Sleep timer defaults

#### Storage Settings (`StorageSettingsScreen.tsx`)
- Download folder
- WiFi-only downloads
- Cache management
- Storage usage

---

## Components

### Shared Components (`src/shared/components/`)

#### Interactive

| Component | Purpose |
|-----------|---------|
| `Button` | Primary button component |
| `IconButton` | Icon-only button |
| `HeartButton` | Favorite toggle |
| `DownloadButton` | Download with progress |
| `CircularDownloadButton` | Circular download indicator |

#### Display

| Component | Purpose |
|-----------|---------|
| `BookCard` | Book display card |
| `SwipeableBookCard` | Swipeable book card |
| `Card` | Generic card container |
| `GlassCard` | Frosted glass card |
| `Icon` | Icon wrapper |
| `SeriesProgressBadge` | Series completion indicator |
| `StackedCovers` | Overlapping book covers |

#### Feedback

| Component | Purpose |
|-----------|---------|
| `LoadingSpinner` | Loading indicator |
| `ErrorView` | Error display with retry |
| `EmptyState` | Empty content state |
| `ThumbnailProgressBar` | Progress on thumbnails |

#### Navigation

| Component | Purpose |
|-----------|---------|
| `TabBar` | Tab navigation |
| `NavigationBar` | Custom bottom nav |
| `GlobalMiniPlayer` | Floating mini player |
| `AlphabetScrubber` | A-Z quick navigation |

### Feature Components

Each feature folder contains its own components:

```
features/{feature}/components/
├── FeatureSpecificComponent.tsx
└── index.ts
```

---

## State Management

### React Query (Server State)

Used for API data fetching and caching:

```typescript
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/core/queryClient';

function useBookDetail(itemId: string) {
  return useQuery({
    queryKey: queryKeys.items.detail(itemId),
    queryFn: () => apiClient.getItem(itemId),
  });
}
```

### Zustand (Client State)

Used for app state that doesn't come from the server:

```typescript
import { create } from 'zustand';

const usePlayerStore = create((set, get) => ({
  isPlaying: false,
  position: 0,
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
}));
```

### Key Stores

#### PlayerStore

The main playback state manager:

```typescript
// Key state
currentBook: LibraryItem | null
position: number
duration: number
isPlaying: boolean
isSeeking: boolean  // CRITICAL: blocks position updates
chapters: Chapter[]
bookmarks: Bookmark[]
sleepTimer: SleepTimerState
bookSpeedMap: Record<string, number>  // Per-book speeds

// Key actions
loadBook(item, options)
play() / pause()
seekTo(position)
skipForward() / skipBackward()
nextChapter() / prevChapter()
setSleepTimer(minutes)
addBookmark(note)
```

#### QueueStore

Manages the playback queue:

```typescript
queue: LibraryItem[]
autoplayEnabled: boolean

addToQueue(item)
removeFromQueue(itemId)
reorderQueue(fromIndex, toIndex)
playNext()
```

#### MyLibraryStore

User's personal library:

```typescript
libraryIds: string[]
favoriteSeriesNames: string[]

addToLibrary(itemId)
removeFromLibrary(itemId)
toggleFavoriteSeries(seriesName)
```

---

## Services

### Core Services (`src/core/services/`)

#### Download Manager (`downloadManager.ts`)

Manages audiobook downloads:

```typescript
// Start a download
downloadManager.startDownload(libraryItem);

// Pause/resume
downloadManager.pauseDownload(itemId);
downloadManager.resumeDownload(itemId);

// Delete
downloadManager.deleteDownload(itemId);

// Listen to progress
downloadManager.addProgressListener(itemId, (progress) => {
  console.log(`${progress.percent}% complete`);
});
```

#### SQLite Cache (`sqliteCache.ts`)

Offline data storage:

```typescript
// Tables
- library_items
- progress
- downloads
- bookmarks
- sync_queue
```

### Player Services (`src/features/player/services/`)

#### Audio Service (`audioService.ts`)

Low-level audio playback:

```typescript
audioService.loadAudio(url, startPosition);
audioService.loadTracks(tracks);  // Multi-track
audioService.play();
audioService.pause();
audioService.seekTo(position);
audioService.setPlaybackRate(rate);
```

#### Session Service (`sessionService.ts`)

Server playback sessions:

```typescript
const session = await sessionService.startSession(libraryItemId);
await sessionService.syncProgress(sessionId, currentTime);
await sessionService.closeSession(sessionId);
```

#### Progress Service (`progressService.ts`)

Progress persistence:

```typescript
const progress = await progressService.loadProgress(itemId);
await progressService.saveProgress(itemId, position, duration);
```

#### Background Sync Service (`backgroundSyncService.ts`)

Automatic progress sync:

```typescript
backgroundSyncService.start();  // Syncs every 30s
backgroundSyncService.stop();
backgroundSyncService.syncNow();
```

---

## Design System

### Colors (`src/shared/theme/colors.ts`)

```typescript
colors.accent              // #F3B60C (gold)
colors.backgroundPrimary   // #000000
colors.backgroundSecondary // #0D0D0D
colors.backgroundTertiary  // #1A1A1A
colors.textPrimary         // #FFFFFF
colors.textSecondary       // rgba(255,255,255,0.70)
colors.textTertiary        // rgba(255,255,255,0.50)
colors.success             // #4ADE80 (green)
colors.error               // #FF4B4B (red)
```

### Spacing (`src/shared/theme/spacing.ts`)

```typescript
spacing.xxs  // 2
spacing.xs   // 4
spacing.sm   // 8
spacing.md   // 12
spacing.lg   // 16
spacing.xl   // 20
spacing.xxl  // 24
spacing.xxxl // 32
```

### Responsive Scaling

```typescript
import { scale, wp, hp } from '@/shared/theme';

// Scale based on 402pt design width
scale(16)  // Proportionally scaled value

// Percentage of screen
wp(50)  // 50% of width
hp(25)  // 25% of height
```

### Typography (`src/shared/theme/typography.ts`)

```typescript
typography.displayLarge   // 28pt, bold
typography.displayMedium  // 22pt, bold
typography.headlineLarge  // 17pt, semibold
typography.headlineMedium // 15pt, semibold
typography.bodyLarge      // 16pt, regular
typography.bodyMedium     // 14pt, regular
typography.labelMedium    // 12pt, medium
typography.caption        // 10pt, regular
```

---

## API Integration

### API Client (`src/core/api/apiClient.ts`)

```typescript
import { apiClient } from '@/core/api';

// Get library items
const items = await apiClient.getLibraryItems(libraryId, params);

// Get single item
const item = await apiClient.getItem(itemId);

// Get cover URL
const coverUrl = apiClient.getItemCoverUrl(itemId);

// Update progress
await apiClient.updateProgress(itemId, progress);
```

### Offline-Aware API (`src/core/api/offlineApi.ts`)

```typescript
import { updateProgressOffline } from '@/core/api';

// Queues if offline, syncs when online
await updateProgressOffline(itemId, currentTime, duration);
```

### Error Handling

```typescript
import { ApiError, NetworkError } from '@/core/api/errors';

try {
  await apiClient.getItem(id);
} catch (error) {
  if (error instanceof NetworkError) {
    // Handle offline
  } else if (error instanceof ApiError) {
    // Handle API error
  }
}
```

---

## Offline Support

### Architecture

1. **SQLite Cache**: Persistent storage for library data
2. **Download Manager**: Audio file management
3. **Sync Queue**: Queued mutations for later sync
4. **Network Monitor**: Detects connectivity changes

### Offline Playback

Downloaded books play from local files:

```typescript
// Check if downloaded
const downloadPath = await downloadManager.getDownloadPath(itemId);

if (downloadPath) {
  // Play from local file
  audioService.loadAudio(`file://${downloadPath}`);
} else {
  // Stream from server
  audioService.loadAudio(streamUrl);
}
```

### Sync Queue

Mutations are queued when offline:

```typescript
// Progress updates queued automatically
// Favorites queued automatically
// Processed when network restored
```

---

## Audio Playback

### Playback Flow

1. User taps play on a book
2. `playerStore.loadBook()` is called
3. Check if book is downloaded
4. Load audio via `audioService`
5. Apply per-book playback speed
6. Start progress sync
7. Update UI via store subscription

### Seeking (Critical Pattern)

The app uses a dedicated seeking mode to prevent UI jitter:

```typescript
// When user starts seeking
playerStore.startSeeking();
playerStore.setSeekPosition(targetPosition);

// Position updates from audio service are BLOCKED

// When user releases
playerStore.commitSeek();
// Actual seek performed
// 300ms settling time
// Seeking mode disabled
```

### Multi-Track Support

Books with multiple audio files are handled seamlessly:

```typescript
const tracks = audioFiles.map(file => ({
  url: file.url,
  startOffset: file.startOffset,
  duration: file.duration,
}));

audioService.loadTracks(tracks);
```

### Sleep Timer

```typescript
// Set timer (minutes)
playerStore.setSleepTimer(30);

// Enable shake-to-extend
playerStore.setShakeToExtend(true);

// Timer state
const { remaining, isActive } = playerStore.sleepTimer;
```

---

## Downloads

### Starting a Download

```typescript
import { useDownloads } from '@/core/hooks/useDownloads';

const { startDownload, downloads } = useDownloads();

// Start download
startDownload(libraryItem);

// Track progress
const download = downloads.find(d => d.itemId === item.id);
console.log(`${download.progress}% complete`);
```

### Download States

| State | Description |
|-------|-------------|
| `pending` | Queued, waiting to start |
| `downloading` | Currently downloading |
| `paused` | User paused |
| `complete` | Finished successfully |
| `error` | Failed (will retry) |

### Download Management

```typescript
const {
  pauseDownload,
  resumeDownload,
  deleteDownload
} = useDownloads();

pauseDownload(itemId);
resumeDownload(itemId);
deleteDownload(itemId);
```

### Auto-Download Series

At 80% completion, the next book in series is automatically downloaded (if enabled in settings).

---

## Queue System

### Adding to Queue

```typescript
import { useQueueStore } from '@/features/queue';

const { addToQueue } = useQueueStore();
addToQueue(libraryItem);
```

### Queue Panel

The queue is accessible from both player screens via a slide-up panel:

- Drag-and-drop reordering
- Swipe to remove
- Autoplay toggle
- "Up Next" preview in mini player

### Autoplay

When a book finishes and autoplay is enabled:

1. Queue checks for next item
2. If queue empty, checks for next in series
3. Automatically loads and plays next book

---

## Troubleshooting

### Common Issues

#### Audio Won't Play

1. Check server connection
2. Verify book has audio files
3. Check download status (if offline)
4. Try restarting the app

#### Progress Not Syncing

1. Check network connectivity
2. Verify server is reachable
3. Progress syncs every 30 seconds
4. Force sync in settings

#### Download Stuck

1. Check available storage
2. Verify network (WiFi-only setting)
3. Pause and resume download
4. Delete and re-download

#### UI Glitches During Seek

This should be fixed. If experiencing:
1. Ensure app is updated
2. The seeking mode blocks position updates
3. 300ms settling time after seek

### Debug Logging

```typescript
import { audioLog } from '@/shared/utils/audioDebug';

// Categories
audioLog.store('Player store action');
audioLog.audio('Audio service event');
audioLog.session('Server session event');
audioLog.progress('Progress update');
audioLog.sync('Sync event');
audioLog.error('Error occurred');
```

### Performance Tips

1. Use FlashList for long lists
2. Memoize expensive computations
3. Use Zustand selectors
4. Avoid unnecessary re-renders
5. Profile with React DevTools

---

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - AI assistant instructions
- [architecture.md](architecture.md) - Technical architecture
- [COMPONENTS.md](COMPONENTS.md) - Component library
- [STATE_MANAGEMENT.md](STATE_MANAGEMENT.md) - State patterns
- [CHANGELOG.md](../CHANGELOG.md) - Version history
