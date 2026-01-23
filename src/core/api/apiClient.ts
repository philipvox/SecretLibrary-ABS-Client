/**
 * src/core/api/apiClient.ts
 *
 * AudiobookShelf API client extending base client with all API operations.
 */

import { BaseApiClient } from './baseClient';
import { endpoints, buildQueryString } from './endpoints';
import { createLogger } from '@/shared/utils/logger';

const apiLogger = createLogger('API');
import {
  LoginResponse,
  LibrariesResponse,
  PaginatedResponse,
  LibraryItemsQuery,
  ProgressUpdateRequest,
  CreateSessionRequest,
  SearchQuery,
  SearchResults,
  SeriesResponse,
  AuthorsResponse,
  CollectionsResponse,
  PlaylistsResponse,
  AuthorQuery,
  FilterData,
  ExternalBookMatch,
} from '../types/api';
import { User } from '../types/user';
import { Library, LibraryItem, Collection, Playlist } from '../types/library';
import { MediaProgress, PlaybackSession } from '../types/media';
import { Series, Author } from '../types/metadata';

/**
 * Main API Client class with all AudiobookShelf API operations
 */
class ApiClient extends BaseApiClient {
  
  // ==================== Authentication ====================

  async login(username: string, password: string): Promise<LoginResponse> {
    const response = await this.post<LoginResponse>(endpoints.auth.login, {
      username,
      password,
    });
    if (response.user?.token) {
      this.setAuthToken(response.user.token);
    }
    return response;
  }

  async logout(): Promise<void> {
    await this.post(endpoints.auth.logout);
    this.clearAuthToken();
  }

  // ==================== User ====================

  async getCurrentUser(): Promise<User> {
    return this.get<User>(endpoints.user.me);
  }

  async getItemsInProgress(): Promise<LibraryItem[]> {
    // Fetch items in progress
    const response = await this.get<{ libraryItems: LibraryItem[] }>(
      endpoints.user.itemsInProgress
    );
    const items = response.libraryItems || [];
    apiLogger.debug(`getItemsInProgress: received ${items.length} items`);

    // Fetch user data to get mediaProgress array
    const user = await this.getCurrentUser();
    const progressMap = new Map<string, MediaProgress>();

    // Build map of libraryItemId -> progress data
    if (user.mediaProgress) {
      for (const mp of user.mediaProgress) {
        if (mp.libraryItemId) {
          progressMap.set(mp.libraryItemId, mp);
        }
      }
    }

    // Attach progress to each item
    return items.map((item) => {
      const progress = progressMap.get(item.id);
      if (progress) {
        item.mediaProgress = progress;
      }
      return item;
    });
  }

  // ==================== Libraries ====================

  async getLibraries(): Promise<Library[]> {
    const response = await this.get<LibrariesResponse>(endpoints.libraries.list);
    return response.libraries;
  }

  async getLibrary(libraryId: string): Promise<Library> {
    return this.get<Library>(endpoints.libraries.get(libraryId));
  }

  async getLibraryItems(
    libraryId: string,
    options?: LibraryItemsQuery
  ): Promise<PaginatedResponse<LibraryItem>> {
    const queryString = buildQueryString(options as Record<string, unknown>);
    const url = `${endpoints.libraries.items(libraryId)}${queryString}`;
    return this.get<PaginatedResponse<LibraryItem>>(url);
  }

  // ==================== Items ====================

  async getItem(itemId: string, include?: string): Promise<LibraryItem> {
    const queryString = include ? buildQueryString({ include }) : '';
    const url = `${endpoints.items.get(itemId)}${queryString}`;
    return this.get<LibraryItem>(url);
  }

  /**
   * Get cover URL with automatic cache busting.
   * Uses a global cache version that increments on library refresh.
   */
  private _coverCacheVersion = 0;

  /** Call this when library is refreshed to bust cover caches */
  bumpCoverCacheVersion(): void {
    this._coverCacheVersion = Date.now();
  }

  /** Reset cover cache version (call on logout to prevent stale covers) */
  resetCoverCacheVersion(): void {
    this._coverCacheVersion = 0;
  }

  getItemCoverUrl(itemId: string, options?: { width?: number; height?: number; format?: string }): string {
    const baseUrl = `${this.getBaseURL()}${endpoints.items.cover(itemId)}`;

    // Build query params
    const params = new URLSearchParams();

    // Add cache version for cache busting
    if (this._coverCacheVersion > 0) {
      params.append('v', this._coverCacheVersion.toString());
    }

    // Add size params if provided (AudiobookShelf API supports width/height)
    if (options?.width) {
      params.append('width', options.width.toString());
    }
    if (options?.height) {
      params.append('height', options.height.toString());
    }

    // Add format param - default to jpeg for better Android compatibility
    params.append('format', options?.format || 'jpeg');

    const queryString = params.toString();
    return queryString ? `${baseUrl}?${queryString}` : baseUrl;
  }

  // ==================== Progress ====================

  async getMediaProgress(progressId: string): Promise<MediaProgress> {
    return this.get<MediaProgress>(endpoints.user.progress(progressId));
  }

  async updateProgress(
    itemId: string,
    progressData: ProgressUpdateRequest
  ): Promise<MediaProgress> {
    return this.patch<MediaProgress>(
      endpoints.user.progress(itemId),
      progressData
    );
  }

  // ==================== Playback Sessions ====================

  async createPlaybackSession(
    libraryItemId: string,
    sessionData: CreateSessionRequest
  ): Promise<PlaybackSession> {
    return this.post<PlaybackSession>(
      endpoints.playback.session(libraryItemId),
      sessionData
    );
  }

  async syncPlaybackSession(
    sessionId: string,
    currentTime: number,
    timeListened?: number
  ): Promise<void> {
    await this.post(endpoints.playback.sessionSync(sessionId), {
      currentTime,
      timeListened,
    });
  }

  async closePlaybackSession(sessionId: string): Promise<void> {
    await this.post(endpoints.playback.sessionClose(sessionId));
  }

  // ==================== Search ====================

  async searchLibrary(libraryId: string, query: SearchQuery): Promise<SearchResults> {
    const queryString = buildQueryString(query as unknown as Record<string, unknown>);
    const url = `${endpoints.libraries.search(libraryId)}${queryString}`;
    return this.get<SearchResults>(url);
  }

  /**
   * Search external metadata providers for book info by title/ISBN
   * Uses server-configured providers (Hardcover, Audible, Google, etc.)
   *
   * @param query - Search query (title or ISBN)
   * @param author - Optional author to narrow results
   * @param provider - Optional specific provider (e.g., 'openlibrary', 'google', 'audible')
   */
  async searchExternalBooks(
    query: string,
    author?: string,
    provider?: string
  ): Promise<ExternalBookMatch[]> {
    const params: Record<string, string> = { title: query };
    if (author) params.author = author;
    if (provider) params.provider = provider;
    const queryString = buildQueryString(params);
    const url = `${endpoints.search.books}${queryString}`;

    try {
      const response = await this.get<ExternalBookMatch[]>(url);
      return response || [];
    } catch (error) {
      apiLogger.warn('searchExternalBooks failed:', error);
      return [];
    }
  }

  // ==================== Series ====================
  async getLibraryFilterData(libraryId: string): Promise<FilterData> {
    return this.get<FilterData>(endpoints.libraries.filterData(libraryId));
  }
  async getLibrarySeries(libraryId: string): Promise<Series[]> {
    const response = await this.get<{ results: Series[]; total: number }>(
      `${endpoints.libraries.series(libraryId)}?limit=500`
    );
    return response?.results || [];
  }

  async getSeries(seriesId: string): Promise<Series> {
    return this.get<Series>(endpoints.series.get(seriesId));
  }

  // ==================== Authors ====================

  async getLibraryAuthors(libraryId: string): Promise<Author[]> {
    const response = await this.get<AuthorsResponse>(
      endpoints.libraries.authors(libraryId)
    );
    return response.authors;
  }

  async getAuthor(authorId: string, include?: AuthorQuery): Promise<Author> {
    const queryString = buildQueryString(include as Record<string, unknown>);
    const url = `${endpoints.authors.get(authorId)}${queryString}`;
    return this.get<Author>(url);
  }

  getAuthorImageUrl(authorId: string): string {
    return `${this.getBaseURL()}${endpoints.authors.image(authorId)}`;
  }

  // ==================== Collections ====================

  async getCollections(): Promise<Collection[]> {
    const response = await this.get<CollectionsResponse>(endpoints.collections.list);
    return response.collections;
  }

  async getCollection(collectionId: string): Promise<Collection> {
    return this.get<Collection>(endpoints.collections.get(collectionId));
  }

  async createCollection(collectionData: Partial<Collection>): Promise<Collection> {
    return this.post<Collection>(endpoints.collections.create, collectionData);
  }

  async updateCollection(
    collectionId: string,
    collectionData: Partial<Collection>
  ): Promise<Collection> {
    return this.patch<Collection>(
      endpoints.collections.update(collectionId),
      collectionData
    );
  }

  async deleteCollection(collectionId: string): Promise<void> {
    await this.delete(endpoints.collections.delete(collectionId));
  }

  // ==================== Playlists ====================

  async getPlaylists(): Promise<Playlist[]> {
    const response = await this.get<PlaylistsResponse>(endpoints.playlists.list);
    return response.playlists;
  }

  async getPlaylist(playlistId: string): Promise<Playlist> {
    return this.get<Playlist>(endpoints.playlists.get(playlistId));
  }

  async createPlaylist(playlistData: Partial<Playlist>): Promise<Playlist> {
    return this.post<Playlist>(endpoints.playlists.create, playlistData);
  }

  async updatePlaylist(
    playlistId: string,
    playlistData: Partial<Playlist>
  ): Promise<Playlist> {
    return this.patch<Playlist>(
      endpoints.playlists.update(playlistId),
      playlistData
    );
  }

  async deletePlaylist(playlistId: string): Promise<void> {
    await this.delete(endpoints.playlists.delete(playlistId));
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export class for testing
export { ApiClient };
