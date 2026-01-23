/**
 * src/core/types/api.ts
 * 
 * TypeScript types for API request/response shapes, pagination, and error handling.
 */

import { User } from './user';
import { Library, LibraryItem, Collection, Playlist } from './library';
import { MediaProgress, PlaybackSession } from './media';
import { Series, Author } from './metadata';

/**
 * Base API response structure
 */
export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
}

/**
 * API error structure
 */
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}
export interface FilterData {
  authors: { id: string; name: string }[];
  genres: string[];
  tags: string[];
  series: { id: string; name: string }[];
  narrators: string[];
  languages: string[];
  publishers: string[];
}
/**
 * Pagination parameters for list requests
 */
export interface PaginationParams {
  limit?: number;
  page?: number;
  sort?: string;
  desc?: boolean;
}

/**
 * Paginated response structure
 */
export interface PaginatedResponse<T> {
  results: T[];
  total: number;
  limit: number;
  page: number;
}

/**
 * Library items query options
 */
export interface LibraryItemsQuery extends PaginationParams {
  filter?: string;
  minified?: boolean;
  collapseSeries?: boolean;
  include?: string; // comma-separated: progress,rssfeed,downloads
}

/**
 * Search query parameters
 */
export interface SearchQuery {
  q: string;
  limit?: number;
}

/**
 * Search result item wrappers (API returns wrapped objects)
 */
export interface BookSearchResult {
  libraryItem: LibraryItem;
  matchKey?: string;
  matchText?: string;
}

export interface SeriesSearchResult {
  series: Series;
  books: BookSearchResult[];
}

export interface AuthorSearchResult {
  id: string;
  name: string;
}

export interface NarratorSearchResult {
  name: string;
}

/**
 * Search results
 */
export interface SearchResults {
  book?: BookSearchResult[];
  series?: SeriesSearchResult[];
  authors?: AuthorSearchResult[];
  narrators?: NarratorSearchResult[];
  tags?: string[];
}

/**
 * Login request body
 */
export interface LoginRequest {
  username: string;
  password: string;
}

/**
 * Login response
 */
export interface LoginResponse {
  user: User;
  userDefaultLibraryId: string;
  serverSettings: ServerSettings;
  ereaderDevices?: unknown[];
}

/**
 * Server settings
 */
export interface ServerSettings {
  id: string;
  scannerFindCovers: boolean;
  scannerCoverProvider: string;
  scannerParseSubtitle: boolean;
  scannerPreferMatchedMetadata: boolean;
  scannerDisableWatcher: boolean;
  storeCoverWithItem: boolean;
  storeMetadataWithItem: boolean;
  metadataFileFormat: string;
  rateLimitLoginRequests: number;
  rateLimitLoginWindow: number;
  backupSchedule: boolean;
  backupsToKeep: number;
  maxBackupSize: number;
  loggerDailyLogsToKeep: number;
  loggerScannerLogsToKeep: number;
  homeBookshelfView: number;
  bookshelfView: number;
  sortingIgnorePrefix: boolean;
  sortingPrefixes: string[];
  chromecastEnabled: boolean;
  dateFormat: string;
  timeFormat: string;
  language: string;
  logLevel: number;
  version: string;
}

/**
 * Progress update request
 */
export interface ProgressUpdateRequest {
  currentTime: number;
  duration?: number;
  progress?: number;
  isFinished?: boolean;
  hideFromContinueListening?: boolean;
}

/**
 * Playback session create request
 */
export interface CreateSessionRequest {
  deviceInfo: {
    clientName: string;
    clientVersion: string;
    manufacturer?: string;
    model?: string;
    sdkVersion?: number;
    deviceId: string;
  };
  supportedMimeTypes: string[];
  mediaPlayer?: string;
}

/**
 * Author query options
 */
export interface AuthorQuery {
  include?: 'items' | 'series' | 'items,series';
}

/**
 * Libraries response
 */
export interface LibrariesResponse {
  libraries: Library[];
}

/**
 * Collections response
 */
export interface CollectionsResponse {
  collections: Collection[];
}

/**
 * Playlists response
 */
export interface PlaylistsResponse {
  playlists: Playlist[];
}

/**
 * Series list response
 */
export interface SeriesResponse {
  results: Series[];
  total?: number;
  limit?: number;
  page?: number;
}

/**
 * Authors list response
 */
export interface AuthorsResponse {
  authors: Author[];
}

/**
 * External book metadata search result (from /api/search/books)
 * Used when searching external providers (Hardcover, Audible, Google, etc.) by ISBN or title
 */
export interface ExternalBookMatch {
  title: string;
  subtitle?: string;
  author?: string;
  narrator?: string;
  publisher?: string;
  publishedYear?: string;
  description?: string;
  cover?: string;
  isbn?: string;
  asin?: string;
  genres?: string[];
  tags?: string[];
  series?: { series: string; sequence?: string }[];
  language?: string;
  duration?: number;
}

/**
 * HTTP method types
 */
export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/**
 * Request configuration
 */
export interface RequestConfig {
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean>;
  timeout?: number;
}

/**
 * API client configuration
 */
export interface ApiClientConfig {
  baseURL: string;
  token?: string;
  timeout?: number;
}
