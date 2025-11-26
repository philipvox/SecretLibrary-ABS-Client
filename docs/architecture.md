# Architecture

## Directory Structure
```
src/
├── config/
│   ├── constants.ts      # API URLs, timeouts
│   └── features.ts       # Feature flags
├── core/
│   ├── api/
│   │   ├── baseClient.ts # HTTP client with auth
│   │   ├── client.ts     # API methods
│   │   └── endpoints.ts  # URL definitions
│   ├── auth/
│   │   ├── authContext.tsx
│   │   └── authService.ts
│   ├── storage/
│   │   ├── cache.ts
│   │   └── database.ts
│   └── types/
│       ├── api.ts        # Request/response types
│       ├── library.ts    # LibraryItem, Collection
│       ├── media.ts      # MediaProgress, PlaybackSession
│       ├── metadata.ts   # Author, Series
│       └── user.ts
├── features/
│   ├── author/
│   ├── book-detail/
│   ├── browse/
│   ├── collections/
│   ├── downloads/        # Offline download management
│   ├── library/
│   ├── narrator/
│   ├── player/
│   ├── profile/
│   ├── search/
│   └── series/
├── navigation/
│   └── AppNavigator.tsx
└── shared/
    ├── components/       # Button, Card, Icon, etc.
    └── theme/            # colors, spacing, typography
```

## Navigation Structure
```
Stack Navigator (root)
├── Login (unauthenticated)
└── Main (authenticated)
    ├── Tab Navigator (4 tabs)
    │   ├── LibraryTab → LibraryItemsScreen
    │   ├── SearchTab → SearchScreen
    │   ├── BrowseTab → BrowseScreen (top tabs)
    │   └── ProfileTab → ProfileScreen
    ├── BookDetail (modal)
    ├── SeriesDetail (modal)
    ├── AuthorDetail (modal)
    ├── NarratorDetail (modal)
    ├── CollectionDetail (modal)
    ├── Downloads (modal)
    └── PlayerScreen (fullscreen modal)
```

## Data Flow

1. **API Client** (`core/api/client.ts`) - singleton, handles auth headers
2. **React Query** - caching, refetching, loading states
3. **Custom Hooks** - `useLibraryItems`, `useSeries`, etc.
4. **Screens** - consume hooks, render UI

## Player Architecture

- **playerStore** (Zustand) - current track, position, isPlaying, isOffline
- **audioService** - expo-av wrapper, playback control
- **progressService** - sync progress to server
- **MiniPlayer** - always visible when playing
- **PlayerScreen** - fullscreen modal with streaming/downloaded indicator

## Downloads Architecture

- **downloadService** - expo-file-system/legacy wrapper
- **downloadStore** (Zustand) - downloads array, activeDownloads map
- **useDownloads** / **useBookDownload** - React hooks
- **DownloadButton** - circular progress indicator
- **DownloadsScreen** - list management

**Storage:**
```
{documentDirectory}/downloads/
  {libraryItemId}/
    audio.m4b
    cover.jpg (optional)
```

**Metadata (AsyncStorage):**
```ts
interface DownloadedBook {
  id: string;
  libraryItemId: string;
  title: string;
  author: string;
  localAudioPath: string;
  localCoverPath?: string;
  totalSize: number;
  downloadedAt: number;
  duration: number;
}
```

## Offline Playback Flow

1. `playerStore.loadBook()` checks for downloaded book via `downloadService`
2. If found, sets `isOffline: true` and uses local file path
3. `loadAudioFile()` loads from `file://` URI instead of server URL
4. Progress saved to AsyncStorage (syncs when back online)
5. Player header shows "Downloaded" vs "Streaming" indicator

## Key Types
```ts
interface LibraryItem {
  id: string;
  libraryId: string;
  media: { metadata: BookMetadata; audioFiles: AudioFile[] };
}

interface BookMetadata {
  title: string;
  authorName: string;
  narratorName: string;
  seriesName: string;
  genres: string[];
}

interface DownloadProgress {
  libraryItemId: string;
  progress: number;        # 0-1
  bytesWritten: number;
  totalBytes: number;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
}
```