# AudiobookShelf Mobile App

React Native/Expo app for AudiobookShelf server.

## Current Status (Stage 8 Complete)

**Complete:**
- ✅ Auth (login, token storage, context)
- ✅ Library browsing with grid view
- ✅ Book detail with chapters
- ✅ Audio player (play/pause, seek, progress sync)
- ✅ Mini player with full-screen modal
- ✅ Search with fuzzy matching
- ✅ Series list/detail screens
- ✅ Authors list/detail screens
- ✅ Narrators list/detail screens (extracted from metadata)
- ✅ Collections list/detail screens
- ✅ Browse tab (top tabs: Series | Authors | Narrators | Collections)
- ✅ Profile tab (user info, server URL, logout)
- ✅ 4 bottom tabs: Library, Search, Browse, Profile
- ✅ Offline downloads (expo-file-system)
- ✅ Download button on BookDetail header & Player menu
- ✅ Downloads screen (Profile > Storage > Downloads)
- ✅ Offline playback detection
- ✅ Streaming/Downloaded indicator in player

**Next (Stage 9):**
- 🎯 Polish and animations
- 🎯 Error boundaries
- 🎯 Skeleton loaders
- 🎯 Pull to refresh everywhere

## Tech Stack

- React Native + Expo SDK 54
- TypeScript
- React Navigation (bottom tabs + stack + top tabs)
- TanStack Query (data fetching/caching)
- Zustand (player state, download state)
- expo-av (audio playback)
- expo-file-system/legacy (offline downloads)

## Project Structure
```
src/
├── core/           # Foundation (api, auth, types, storage)
├── features/       # Feature modules (each self-contained)
│   ├── auth/
│   ├── authors/
│   ├── book-detail/
│   ├── browse/
│   ├── collections/
│   ├── downloads/    # NEW: Offline download management
│   ├── library/
│   ├── narrators/
│   ├── player/
│   ├── profile/
│   ├── search/
│   └── series/
├── navigation/     # AppNavigator, routes
└── shared/         # Reusable components, theme, utils
```

## Navigation Structure

```
Stack Navigator (root)
├── Login (unauthenticated)
└── Main (authenticated)
    ├── Bottom Tab Navigator (4 tabs)
    │   ├── LibraryTab → LibraryItemsScreen
    │   ├── SearchTab → SearchScreen
    │   ├── BrowseTab → BrowseScreen
    │   │   └── Top Tab Navigator
    │   │       ├── Series → SeriesListContent
    │   │       ├── Authors → AuthorsListContent
    │   │       ├── Narrators → NarratorsListContent
    │   │       └── Collections → CollectionsListContent
    │   └── ProfileTab → ProfileScreen
    ├── BookDetail (modal)
    ├── SeriesDetail (modal)
    ├── AuthorDetail (modal)
    ├── NarratorDetail (modal)
    ├── CollectionDetail (modal)
    ├── Downloads (modal)
    └── PlayerScreen (fullscreen modal)
```

## Downloads Feature

**Storage location:** `{documentDirectory}/downloads/{libraryItemId}/`
**Metadata storage:** AsyncStorage (`downloads_metadata`)

```
src/features/downloads/
├── services/downloadService.ts   # File download/storage
├── stores/downloadStore.ts       # Zustand state
├── hooks/useDownloads.ts         # React hooks
├── components/
│   ├── DownloadButton.tsx        # Progress indicator button
│   └── DownloadItem.tsx          # List item component
├── screens/DownloadsScreen.tsx   # Management screen
└── index.ts
```

**Usage:**
```tsx
import { DownloadButton, useBookDownload } from '@/features/downloads';

// In component
const { downloaded, downloading, progress } = useBookDownload(bookId);
<DownloadButton item={book} />
```

## Key Patterns

**Feature structure:**
```
features/{name}/
├── components/    # UI components
├── hooks/         # Data fetching hooks
├── screens/       # Screen components
├── services/      # Adapters, business logic
├── stores/        # Zustand stores (if needed)
└── index.ts       # Public exports
```

**Data fetching:** TanStack Query with staleTime caching
**State:** Zustand for player + downloads, React Query for server state
**Navigation:** Type-safe with stack and tab navigators

## Rules

- Max 400 lines per file
- No cross-feature imports (use shared/)
- TypeScript strict mode
- Export via index.ts barrel files
- Use expo-file-system/legacy (new API has deprecated methods)

## Commands
```bash
npm install        # Install dependencies
npm start          # Start Expo dev server
npx expo run:ios   # Run on iOS (native build required for image-colors)
npm run android    # Run on Android emulator
```