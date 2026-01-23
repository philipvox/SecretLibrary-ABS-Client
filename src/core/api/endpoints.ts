/**
 * src/core/api/endpoints.ts
 * 
 * Centralized mapping of all AudiobookShelf API endpoints.
 * This provides a single source of truth for API URLs.
 */

/**
 * API endpoint paths
 */
export const endpoints = {
  // Server Status
  server: {
    status: '/api/status',       // Returns server version and features
    healthCheck: '/api/healthcheck',  // Quick health check
  },

  // Authentication
  auth: {
    login: '/login',
    logout: '/logout',
  },

  // User
  user: {
    me: '/api/me',
    progress: (progressId: string) => `/api/me/progress/${progressId}`,
    itemsInProgress: '/api/me/items-in-progress',
    listeningStats: '/api/me/listening-stats',
  },

  // Libraries
  libraries: {
    list: '/api/libraries',
    get: (libraryId: string) => `/api/libraries/${libraryId}`,
    items: (libraryId: string) => `/api/libraries/${libraryId}/items`,
    search: (libraryId: string) => `/api/libraries/${libraryId}/search`,
    series: (libraryId: string) => `/api/libraries/${libraryId}/series`,
    authors: (libraryId: string) => `/api/libraries/${libraryId}/authors`,
    filterData: (libraryId: string) => `/api/libraries/${libraryId}/filterdata`,
    recent: (libraryId: string) => `/api/libraries/${libraryId}/recent-episodes`,
  },

  // Items
  items: {
    get: (itemId: string) => `/api/items/${itemId}`,
    cover: (itemId: string) => `/api/items/${itemId}/cover`,
    download: (itemId: string) => `/api/items/${itemId}/download`,
    play: (itemId: string) => `/api/items/${itemId}/play`,
    playEpisode: (itemId: string, episodeId: string) => 
      `/api/items/${itemId}/play/${episodeId}`,
  },

  // Playback
  playback: {
    session: (libraryItemId: string) => `/api/session/${libraryItemId}`,
    sessionSync: (sessionId: string) => `/api/session/${sessionId}/sync`,
    sessionClose: (sessionId: string) => `/api/session/${sessionId}/close`,
  },

  // Series
  series: {
    get: (seriesId: string) => `/api/series/${seriesId}`,
  },

  // Authors
  authors: {
    get: (authorId: string) => `/api/authors/${authorId}`,
    image: (authorId: string) => `/api/authors/${authorId}/image`,
  },

  // Collections
  collections: {
    list: '/api/collections',
    get: (collectionId: string) => `/api/collections/${collectionId}`,
    create: '/api/collections',
    update: (collectionId: string) => `/api/collections/${collectionId}`,
    delete: (collectionId: string) => `/api/collections/${collectionId}`,
  },

  // Playlists
  playlists: {
    list: '/api/playlists',
    get: (playlistId: string) => `/api/playlists/${playlistId}`,
    create: '/api/playlists',
    update: (playlistId: string) => `/api/playlists/${playlistId}`,
    delete: (playlistId: string) => `/api/playlists/${playlistId}`,
  },

  // Podcasts
  podcasts: {
    feed: (itemId: string) => `/api/podcasts/${itemId}/feed`,
    episode: (itemId: string, episodeId: string) => 
      `/api/podcasts/${itemId}/episode/${episodeId}`,
    searchEpisode: (itemId: string) => `/api/podcasts/${itemId}/search-episode`,
    downloadEpisodes: (itemId: string) => `/api/podcasts/${itemId}/download-episodes`,
    clearQueue: (itemId: string) => `/api/podcasts/${itemId}/clear-episode-download-queue`,
  },

  // Notifications
  notifications: {
    list: '/api/notifications',
    get: (notificationId: string) => `/api/notifications/${notificationId}`,
    create: '/api/notifications',
    update: (notificationId: string) => `/api/notifications/${notificationId}`,
    delete: (notificationId: string) => `/api/notifications/${notificationId}`,
    test: '/api/notifications/test',
  },

  // RSS Feeds
  rss: {
    get: (itemId: string) => `/api/items/${itemId}/rssfeed`,
    open: (itemId: string) => `/api/items/${itemId}/open-feed`,
    close: (itemId: string) => `/api/items/${itemId}/close-feed`,
  },

  // Search (global)
  search: {
    covers: '/api/search/covers',
    books: '/api/search/books',
    podcast: '/api/search/podcast',
    author: '/api/search/author',
  },

  // Tools
  tools: {
    encode: (itemId: string) => `/api/tools/item/${itemId}/encode`,
    scanLibrary: (libraryId: string) => `/api/libraries/${libraryId}/scan`,
  },
} as const;

/**
 * Helper to build query string from params
 */
export function buildQueryString<T extends Record<string, unknown>>(params?: T): string {
  if (!params) return '';

  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}
