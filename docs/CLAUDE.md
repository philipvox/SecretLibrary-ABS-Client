# Development Guide

Quick reference for AI-assisted development on the AudiobookShelf mobile app.

## Project Overview

React Native/Expo app for AudiobookShelf server with offline-first architecture.

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | React Native + Expo SDK 54 |
| Language | TypeScript (strict) |
| Navigation | React Navigation v7 |
| Server State | TanStack Query v5 |
| Client State | Zustand v5 |
| Local Storage | Expo SQLite + AsyncStorage |
| Audio | expo-av / react-native-track-player |
| HTTP Client | Axios |

## Project Structure

```
src/
├── config/           # Constants, feature flags
├── core/             # Foundation (api, auth, types, services)
│   ├── api/          # HTTP client, endpoints, errors
│   ├── auth/         # Authentication context/service
│   ├── services/     # SQLite, sync queue, downloads
│   ├── hooks/        # Core React hooks
│   └── types/        # TypeScript definitions
├── features/         # Feature modules (self-contained)
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
├── navigation/       # AppNavigator, routes, types
└── shared/           # Reusable components, theme, utils
    ├── components/   # UI components (buttons, cards, inputs, feedback)
    ├── hooks/        # Shared hooks
    ├── theme/        # Design tokens
    └── utils/        # Utility functions
```

## Feature Module Pattern

```
features/{name}/
├── components/     # UI components
├── hooks/          # Data fetching hooks
├── screens/        # Screen components
├── services/       # Business logic
├── stores/         # Zustand stores (if needed)
├── types.ts        # Feature types
└── index.ts        # Public exports
```

## Key Files

| File | Purpose |
|------|---------|
| `core/queryClient.ts` | React Query config + query keys factory |
| `core/api/apiClient.ts` | Main API client |
| `core/api/endpoints.ts` | URL definitions |
| `core/api/errors.ts` | Custom error classes |
| `core/services/sqliteCache.ts` | SQLite database |
| `core/services/syncQueue.ts` | Offline sync queue |
| `shared/components/index.ts` | Component exports |
| `shared/theme/index.ts` | Design tokens |

## State Management Rules

| State Type | Tool | When to Use |
|------------|------|-------------|
| Server data | React Query | API responses, cached data |
| App state | Zustand | Player, downloads, preferences |
| UI state | useState | Form inputs, modals, toggles |

## Query Keys

Use the centralized factory:

```typescript
import { queryKeys } from '@/core/queryClient';

// Examples
queryKeys.libraries.items(libraryId)
queryKeys.items.detail(itemId)
queryKeys.user.progress(itemId)
queryKeys.user.favorites()
```

## API Layer

Domain-specific APIs in `core/api/endpoints/`:

```typescript
import { librariesApi, itemsApi, userApi } from '@/core/api';

// Usage
const libraries = await librariesApi.getAll();
const item = await itemsApi.getById(itemId);
const progress = await userApi.getMediaProgress(itemId);
```

Offline-aware functions:

```typescript
import { updateProgressOffline, toggleFavoriteOffline } from '@/core/api';

// Queues if offline, syncs when online
await updateProgressOffline(itemId, currentTime, duration);
```

## Shared Components

```typescript
import {
  Button,
  IconButton,
  Card,
  GlassCard,
  TextInput,
  SearchInput,
  LoadingSpinner,
  ErrorView,
  EmptyState,
  TabBar,
} from '@/shared/components';
```

## Coding Rules

1. Maximum 400 lines per file
2. No cross-feature imports (use shared/)
3. TypeScript strict mode
4. Export via index.ts barrel files
5. Use query keys factory for all queries
6. Follow component hierarchy: Screen > Feature > UI

## Commands

```bash
npm start              # Start Expo dev server
npm run ios            # Run on iOS
npm run android        # Run on Android
npm run clean          # Clear cache and restart
npm run typecheck      # Type check
npm run lint           # Lint code
```

## Navigation

4 bottom tabs: Library, Search, Browse, Profile

Modal screens: BookDetail, SeriesDetail, AuthorDetail, NarratorDetail, CollectionDetail, Downloads

Full-screen modal: PlayerScreen

## Offline Support

1. SQLite for cached data and sync queue
2. Downloads stored in documentDirectory
3. Mutations queued when offline
4. Auto-sync when network restored

## Common Patterns

### Data Fetching Hook

```typescript
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/core/queryClient';

export function useBookDetail(itemId: string) {
  return useQuery({
    queryKey: queryKeys.items.detail(itemId),
    queryFn: () => apiClient.getItem(itemId),
  });
}
```

### Screen Template

```typescript
export function FeatureScreen({ route }) {
  const { data, isLoading, error, refetch } = useFeatureData(route.params.id);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorView message={error.message} onRetry={refetch} />;
  if (!data) return <EmptyState title="No data" />;

  return <FeatureContent data={data} />;
}
```

### Zustand Store

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export const useFeatureStore = create(
  persist(
    (set) => ({
      value: null,
      setValue: (v) => set({ value: v }),
    }),
    { name: 'feature-store', storage: createJSONStorage(() => AsyncStorage) }
  )
);
```

## Documentation

- [README](../README.md) - Project overview
- [Getting Started](GETTING_STARTED.md) - Setup guide
- [Architecture](architecture.md) - Project structure
- [API Reference](api.md) - AudiobookShelf API
- [Components](COMPONENTS.md) - Component library
- [State Management](STATE_MANAGEMENT.md) - State patterns
