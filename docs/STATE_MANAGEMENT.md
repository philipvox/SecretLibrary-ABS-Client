# State Management

This document describes the state management patterns used in the AudiobookShelf mobile app.

## Table of Contents

- [Overview](#overview)
- [State Categories](#state-categories)
- [React Query (Server State)](#react-query-server-state)
- [Zustand (Client State)](#zustand-client-state)
- [Local Component State](#local-component-state)
- [Offline-First Patterns](#offline-first-patterns)
- [Query Keys Factory](#query-keys-factory)
- [Best Practices](#best-practices)

## Overview

The app uses a layered state management approach:

| State Type | Tool | Purpose | Persistence |
|------------|------|---------|-------------|
| Server State | React Query | API data, caching | Memory + SQLite |
| Client State | Zustand | App state, player | AsyncStorage |
| Local State | useState/useReducer | Component UI | None |

```
+--------------------------------------------------+
|                    Component                      |
+--------------------------------------------------+
|  useState/useReducer (UI state)                  |
+--------------------------------------------------+
         |                        |
         v                        v
+------------------+    +------------------+
|   React Query    |    |     Zustand      |
|  (Server State)  |    |  (Client State)  |
+------------------+    +------------------+
         |                        |
         v                        v
+------------------+    +------------------+
|   API / Network  |    |   AsyncStorage   |
+------------------+    +------------------+
```

## State Categories

### When to Use Each

| Scenario | Solution |
|----------|----------|
| Data from API | React Query |
| User preferences | Zustand with persist |
| Player state | Zustand |
| Form input | useState |
| Modal open/close | useState |
| Download queue | Zustand |
| Auth tokens | Zustand with SecureStore |

## React Query (Server State)

### Configuration

The query client is configured in `src/core/queryClient.ts`:

```typescript
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,     // 5 minutes
      gcTime: 1000 * 60 * 30,       // 30 minutes
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});
```

### Query Keys Factory

Use the centralized query keys for consistency:

```typescript
import { queryKeys } from '@/core/queryClient';

// Library queries
queryKeys.libraries.all
queryKeys.libraries.list()
queryKeys.libraries.detail(libraryId)
queryKeys.libraries.items(libraryId)

// Item queries
queryKeys.items.all
queryKeys.items.detail(itemId)
queryKeys.items.chapters(itemId)

// User queries
queryKeys.user.profile()
queryKeys.user.progress(itemId)
queryKeys.user.favorites()
```

### Creating Query Hooks

Standard pattern for data fetching hooks:

```typescript
// src/features/library/hooks/useLibraryItems.ts
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/core/queryClient';
import { apiClient } from '@/core/api';

export function useLibraryItems(libraryId: string) {
  return useQuery({
    queryKey: queryKeys.libraries.items(libraryId),
    queryFn: () => apiClient.getLibraryItems(libraryId),
    staleTime: 1000 * 60 * 5,
  });
}
```

### Mutations with Optimistic Updates

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/core/queryClient';

export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, isFavorite }: { itemId: string; isFavorite: boolean }) =>
      apiClient.toggleFavorite(itemId, isFavorite),

    // Optimistic update
    onMutate: async ({ itemId, isFavorite }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.user.favorites() });

      const previous = queryClient.getQueryData(queryKeys.user.favorites());

      queryClient.setQueryData(queryKeys.user.favorites(), (old: string[]) =>
        isFavorite
          ? [...old, itemId]
          : old.filter((id) => id !== itemId)
      );

      return { previous };
    },

    // Rollback on error
    onError: (err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.user.favorites(), context.previous);
      }
    },

    // Sync with server
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user.favorites() });
    },
  });
}
```

### Prefetching

```typescript
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/core/queryClient';

function BookList({ books }) {
  const queryClient = useQueryClient();

  const prefetchBook = (bookId: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.items.detail(bookId),
      queryFn: () => apiClient.getItem(bookId),
      staleTime: 1000 * 60 * 5,
    });
  };

  return (
    <FlatList
      data={books}
      renderItem={({ item }) => (
        <BookCard
          book={item}
          onHoverIn={() => prefetchBook(item.id)}
        />
      )}
    />
  );
}
```

## Zustand (Client State)

### Store Pattern

```typescript
// src/features/player/stores/playerStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface PlayerState {
  // State
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  playbackSpeed: number;

  // Actions
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  setSpeed: (speed: number) => void;
  loadTrack: (track: Track) => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentTrack: null,
      isPlaying: false,
      currentTime: 0,
      playbackSpeed: 1.0,

      // Actions
      play: () => set({ isPlaying: true }),
      pause: () => set({ isPlaying: false }),
      seek: (time) => set({ currentTime: time }),
      setSpeed: (speed) => set({ playbackSpeed: speed }),
      loadTrack: (track) => set({
        currentTrack: track,
        currentTime: 0,
        isPlaying: false,
      }),
    }),
    {
      name: 'player-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        playbackSpeed: state.playbackSpeed,
        // Don't persist currentTrack or isPlaying
      }),
    }
  )
);
```

### Selectors for Performance

```typescript
// Avoid re-renders by selecting only needed state
const isPlaying = usePlayerStore((state) => state.isPlaying);
const currentTime = usePlayerStore((state) => state.currentTime);

// Or use shallow comparison for multiple values
import { shallow } from 'zustand/shallow';

const { isPlaying, currentTime } = usePlayerStore(
  (state) => ({
    isPlaying: state.isPlaying,
    currentTime: state.currentTime,
  }),
  shallow
);
```

### Store Slices

For large stores, split into slices:

```typescript
// slices/playbackSlice.ts
export const createPlaybackSlice = (set, get) => ({
  isPlaying: false,
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
});

// slices/trackSlice.ts
export const createTrackSlice = (set, get) => ({
  currentTrack: null,
  loadTrack: (track) => set({ currentTrack: track }),
});

// playerStore.ts
export const usePlayerStore = create()((...a) => ({
  ...createPlaybackSlice(...a),
  ...createTrackSlice(...a),
}));
```

## Local Component State

### Simple UI State

```typescript
function FilterModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);

  return (
    <>
      <Button onPress={() => setIsOpen(true)} title="Filter" />
      <Modal visible={isOpen}>
        {/* Filter UI */}
      </Modal>
    </>
  );
}
```

### Complex Form State

```typescript
function LoginForm() {
  const [form, setForm] = useReducer(
    (state, action) => ({ ...state, ...action }),
    { username: '', password: '', rememberMe: false }
  );

  return (
    <>
      <TextInput
        value={form.username}
        onChangeText={(username) => setForm({ username })}
      />
      <TextInput
        value={form.password}
        onChangeText={(password) => setForm({ password })}
        secureTextEntry
      />
    </>
  );
}
```

## Offline-First Patterns

### Sync Queue

Mutations are queued when offline and synced when back online:

```typescript
import { syncQueue } from '@/core/services/syncQueue';

// Queue action when offline
await syncQueue.enqueue('progress', {
  itemId,
  currentTime,
  duration,
});

// Start network listener on app launch
syncQueue.startNetworkListener();
```

### Offline-Aware API Calls

```typescript
import { updateProgressOffline } from '@/core/api';

// This function:
// 1. Saves to local SQLite immediately
// 2. Attempts API call if online
// 3. Queues for later sync if offline
await updateProgressOffline(itemId, currentTime, duration);
```

### Cached Data Fallback

```typescript
export function useLibraryItems(libraryId: string) {
  const query = useQuery({
    queryKey: queryKeys.libraries.items(libraryId),
    queryFn: () => apiClient.getLibraryItems(libraryId),
  });

  // On error, try to load from SQLite cache
  const cachedData = useCachedLibraryItems(libraryId);

  return {
    ...query,
    data: query.data ?? cachedData,
  };
}
```

## Query Keys Factory

The query keys factory ensures consistent cache keys:

```typescript
// src/core/queryClient.ts
export const queryKeys = {
  libraries: {
    all: ['libraries'] as const,
    list: () => [...queryKeys.libraries.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.libraries.all, 'detail', id] as const,
    items: (id: string) => [...queryKeys.libraries.all, 'items', id] as const,
  },
  items: {
    all: ['items'] as const,
    detail: (id: string) => [...queryKeys.items.all, 'detail', id] as const,
    chapters: (id: string) => [...queryKeys.items.all, 'chapters', id] as const,
  },
  user: {
    all: ['user'] as const,
    profile: () => [...queryKeys.user.all, 'profile'] as const,
    progress: (itemId: string) => [...queryKeys.user.all, 'progress', itemId] as const,
    favorites: () => [...queryKeys.user.all, 'favorites'] as const,
  },
  authors: {
    all: ['authors'] as const,
    list: (libraryId: string) => [...queryKeys.authors.all, 'list', libraryId] as const,
    detail: (id: string) => [...queryKeys.authors.all, 'detail', id] as const,
  },
  series: {
    all: ['series'] as const,
    list: (libraryId: string) => [...queryKeys.series.all, 'list', libraryId] as const,
    detail: (id: string) => [...queryKeys.series.all, 'detail', id] as const,
  },
  collections: {
    all: ['collections'] as const,
    list: () => [...queryKeys.collections.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.collections.all, 'detail', id] as const,
  },
} as const;
```

### Invalidation Patterns

```typescript
const queryClient = useQueryClient();

// Invalidate specific item
queryClient.invalidateQueries({
  queryKey: queryKeys.items.detail(itemId),
});

// Invalidate all library items
queryClient.invalidateQueries({
  queryKey: queryKeys.libraries.items(libraryId),
});

// Invalidate all user data
queryClient.invalidateQueries({
  queryKey: queryKeys.user.all,
});
```

## Best Practices

### Do

1. Use query keys factory for all queries
2. Select minimal state from Zustand stores
3. Keep component state local when possible
4. Use optimistic updates for better UX
5. Implement offline fallbacks for critical data

### Avoid

1. Storing derived data - compute it instead
2. Duplicating server data in Zustand
3. Deep object comparisons without `shallow`
4. Fetching data in event handlers - use mutations
5. Prop drilling - use stores or context instead

### State Decision Tree

```
Is this data from the API?
├── YES -> React Query
│   └── Need offline access?
│       ├── YES -> Also cache in SQLite
│       └── NO -> React Query only
│
└── NO -> Is this app-wide state?
    ├── YES -> Zustand
    │   └── Need persistence?
    │       ├── YES -> Zustand with persist middleware
    │       └── NO -> Zustand (memory only)
    │
    └── NO -> Is this UI state?
        ├── YES -> useState / useReducer
        └── NO -> Consider if state is needed at all
```
