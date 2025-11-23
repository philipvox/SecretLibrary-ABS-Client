# AudiobookShelf API Reference

## Base Information

- **Base URL**: `http://your-server:port` (user configurable)
- **Authentication**: Bearer token in `Authorization` header
- **API Docs**: https://api.audiobookshelf.org/

## Authentication

### Login
```
POST /login
Body: { username: string, password: string }
Response: { user: User, userDefaultLibraryId: string, serverSettings: object, token: string }
```

### Logout
```
POST /logout
```

## Library Endpoints

### Get Libraries
```
GET /api/libraries
Response: { libraries: Library[] }
```

### Get Library Items
```
GET /api/libraries/{id}/items
Query params: limit, page, sort, filter, minified
Response: { results: LibraryItem[], total: number, limit: number, page: number }
```

## Item Endpoints

### Get Item
```
GET /api/items/{id}
Query params: include (comma-separated: progress,rssfeed,downloads)
Response: LibraryItem with full details
```

### Get Item Cover
```
GET /api/items/{id}/cover
Response: Image binary
```

## Playback Endpoints

### Get Media Progress
```
GET /api/me/progress/{id}
Response: MediaProgress
```

### Update Media Progress
```
PATCH /api/me/progress/{id}
Body: { currentTime: number, duration: number, progress: number, isFinished: boolean }
```

### Create Playback Session
```
POST /api/session/{libraryItemId}
Body: { deviceInfo: object, supportedMimeTypes: string[] }
Response: PlaybackSession
```

## Search Endpoints

### Search Library
```
GET /api/libraries/{id}/search
Query params: q (search query), limit
Response: { book: LibraryItem[], series: Series[], authors: Author[], tags: string[] }
```

## Series Endpoints

### Get Series
```
GET /api/libraries/{id}/series
Response: { results: Series[] }
```

### Get Series by ID
```
GET /api/series/{id}
Response: Series with books
```

## Author/Narrator Endpoints

### Get Authors
```
GET /api/libraries/{id}/authors
Response: { authors: Author[] }
```

### Get Author by ID
```
GET /api/authors/{id}
Query params: include (items,series)
Response: Author with books and series
```

## Collections/Playlists

### Get Collections
```
GET /api/collections
Response: { collections: Collection[] }
```

### Get Playlists
```
GET /api/playlists
Response: { playlists: Playlist[] }
```

## User Endpoints

### Get User
```
GET /api/me
Response: User with settings and progress
```

## Notes for Implementation

### Rate Limiting
- Check if AudiobookShelf has rate limits
- Implement exponential backoff for retries

### Pagination
- Most list endpoints support pagination
- Default limit is usually 50 items
- Use minified=1 for list views to reduce payload

### Caching Strategy
- Cache library structure (expires after 1 hour)
- Cache book metadata (expires after 24 hours)
- Cache covers locally (never expires unless deleted)
- Progress should always be fresh (or sync conflicts)

### Error Codes
- 401: Unauthorized - token expired or invalid
- 404: Not found - item doesn't exist
- 500: Server error - retry after delay

### Special Considerations
- Progress syncing needs conflict resolution
- Download management requires tracking local files
- Background playback needs special permissions

## Quirks and Edge Cases

[To be documented as we discover them during development]
