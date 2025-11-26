# Progress Tracker

## Complete

### Stage 1-2: Foundation
- Project setup with Expo
- TypeScript config with path aliases
- API client with auth
- Type definitions
- Theme system (colors, spacing, typography)

### Stage 3: Core Features
- Login screen with server URL input
- Auth context and token storage
- Library grid view
- Book detail screen with chapters
- Cover image loading

### Stage 4: Player
- Audio playback with expo-av
- Play/pause, seek, skip 30s
- Progress tracking and sync
- Mini player (bottom bar)
- Full-screen player modal
- Background playback
- Sleep timer
- Bookmarks
- Playback speed control
- Chapter navigation

### Stage 5: Search
- Search screen with input
- Fuzzy search using Fuse.js
- Results for books, series, authors
- Recent searches

### Stage 6: Navigation
- Bottom tab navigator (floating pill design)
- 4 tabs: Library, Search, Browse, Profile

### Stage 7: Discovery
- Series list with search/sort
- Series detail with books
- Authors list with search/sort
- Author detail with books
- Narrators list with search/sort
- Narrator detail with books
- Browse tab with material top tabs
- Collections list and detail
- Profile tab with user info

### Stage 8: Offline Downloads ✅
- Download service (expo-file-system/legacy)
- Zustand store for download state
- Download button on BookDetailScreen header
- Download option in PlayerScreen menu
- Circular progress indicator during download
- Downloads screen (Profile > Storage > Downloads)
- Offline playback detection
- Local progress saving for offline books
- Streaming/Downloaded indicator in player
- Storage stats in Profile (count + size)
- Cancel download in progress
- Delete downloaded books

## Architecture Decisions

**Expo AV for Audio:** Background audio support built-in, simple API
**Zustand for Player State:** Lightweight, less boilerplate than Redux
**TanStack Query for Server State:** Caching, refetching, loading states
**5-minute Sync Interval:** Balance between server load and accuracy
**Local Progress Cache (AsyncStorage):** Instant resume, works offline
**expo-file-system/legacy:** Stable API for downloads (new API deprecated methods)

## File Structure

```
src/features/downloads/
├── services/
│   └── downloadService.ts    # File download/storage manager
├── stores/
│   └── downloadStore.ts      # Zustand state management
├── hooks/
│   └── useDownloads.ts       # React hooks for downloads
├── components/
│   ├── DownloadButton.tsx    # Button with progress indicator
│   └── DownloadItem.tsx      # List item for downloads screen
├── screens/
│   └── DownloadsScreen.tsx   # Downloads management screen
└── index.ts                  # Public exports
```

## Storage Architecture

**File System:**
```
{documentDirectory}/downloads/
  {libraryItemId}/
    audio.m4b (or detected extension)
    cover.jpg (optional)
```

**Metadata (AsyncStorage):**
- Key: `downloads_metadata`
- Stores: id, title, author, paths, size, duration, downloadedAt

## Known Limitations

- No background downloads (requires expo-background-fetch)
- No download queue (one at a time)
- No network status detection (NetInfo)
- Single audio file per book (no multi-file support)
- No auto-resume after app restart

## Remaining Work

### Stage 9: Polish
- Animations and transitions
- Error boundaries
- Pull to refresh everywhere
- Skeleton loaders
- Loading states optimization

### Stage 10: Advanced
- Background download queue
- Network status handling
- Lock screen media controls
- CarPlay/Android Auto
- Widget support

## File Size Reference

Large files (near 400 line limit):
- PlayerScreen.tsx: ~380 lines
- playerStore.ts: ~350 lines
- audioService.ts: ~335 lines
- downloadService.ts: ~220 lines