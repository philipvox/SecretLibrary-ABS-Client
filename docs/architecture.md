# AudiobookShelf Mobile App Architecture

## Overview
Native mobile wrapper for AudiobookShelf with enhanced features including fuzzy search, recommendations, and improved UI for series, authors, and narrators.

## Tech Stack
- **Framework**: React Native with Expo
- **Language**: TypeScript
- **State Management**: Zustand (lightweight, easy to use)
- **Data Fetching**: TanStack Query (React Query)
- **Navigation**: React Navigation
- **Local Storage**: Expo SQLite
- **Search**: Fuse.js (fuzzy search)
- **Audio**: Expo AV

## Project Structure

### Core (`src/core/`)
Foundation layer - all files here are imported by features but never import from features.

- **api/**: AudiobookShelf API client, single source of truth for all server communication
- **auth/**: Authentication logic, token management, auth context
- **storage/**: Local database, caching, offline support
- **sync/**: Background sync between app and server
- **types/**: All TypeScript type definitions used across the app

### Features (`src/features/`)
Each feature is self-contained with its own components, hooks, screens, and services.

**Feature Structure:**
```
feature-name/
├── components/     # UI components specific to this feature
├── hooks/          # Custom hooks for this feature
├── screens/        # Screen components
├── services/       # Business logic
└── index.ts        # Public API exports
```

**Features:**
- **library**: Main library browsing, grid/list views, filters
- **search**: Enhanced fuzzy search with filters
- **player**: Audio playback, controls, background playback
- **book-detail**: Book information page with recommendations
- **series**: Series page with progress tracking
- **author**: Author page with bibliography
- **narrator**: Enhanced narrator page (like author page)
- **playlists**: User-created playlists
- **recommendations**: Recommendation engine and UI

### Shared (`src/shared/`)
Reusable components, hooks, and utilities used across features.

- **components/**: UI primitives (Button, Card, List, etc.)
- **hooks/**: Common hooks (useDebounce, useCache, etc.)
- **utils/**: Helper functions
- **theme/**: Design system (colors, typography, spacing)

### Navigation (`src/navigation/`)
App navigation structure and route definitions.

## Key Architectural Principles

### 1. Single Source of Truth
- All API calls in `core/api/client.ts`
- All types in `core/types/`
- All theme values in `shared/theme/`

### 2. Feature Encapsulation
- Features only import from `core/` and `shared/`
- No cross-feature imports
- Each feature exports clean public API

### 3. File Size Limit
- Maximum 400 lines per file
- Split large files into smaller, focused modules
- One responsibility per file

### 4. Configuration-Driven
- Feature flags in `config/features.ts`
- Constants in `config/constants.ts`
- Easy to modify behavior without code changes

## Data Flow

1. **Server → App**: API client fetches data → Store in local DB → Update UI
2. **App → Server**: User action → API call → Sync with server → Update local state
3. **Offline**: Use cached data from local DB → Queue changes → Sync when online

## Build Stages

### Stage 1: Core Foundation (1-2 weeks)
- API client with all endpoints
- Authentication flow
- Local storage setup
- Basic navigation shell
- Theme system

### Stage 2: Library & Browsing (1-2 weeks)
- Library grid/list views
- Basic book detail
- Download management
- Filters and sorting

### Stage 3: Search (1 week)
- Search index builder
- Fuzzy search implementation
- Search UI with filters

### Stage 4: Player (1-2 weeks)
- Audio playback engine
- Player UI
- Background playback
- Position syncing

### Stage 5: Enhanced Pages (1 week each)
- Series page
- Author page
- Narrator page

### Stage 6: Social Features (1-2 weeks)
- Playlists
- Collections
- Recommendations engine

## Development Guidelines

### For Claude Code Sessions
1. Work on ONE feature at a time
2. Keep files under 400 lines
3. Update `docs/current-work.md` after each session
4. Include file paths in all code blocks
5. Use explicit imports
6. Add "why" comments, not "what" comments

### Code Style
- TypeScript for everything
- Functional components with hooks
- Async/await for promises
- Error boundaries for error handling
- Loading states for all async operations

### Testing Strategy
- Unit tests for business logic (services, utils)
- Integration tests for API client
- E2E tests for critical user flows
- Manual testing for UI/UX
