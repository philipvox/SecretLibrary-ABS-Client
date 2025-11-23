/**
 * src/core/api/index.ts
 * 
 * Public API exports for the API client layer.
 */

// Export the singleton API client instance
export { apiClient, ApiClient } from './client.ts';
// Export endpoints for direct usage if needed
export { endpoints, buildQueryString } from './endpoints';

// Re-export API-specific types for convenience
export type {
  ApiClientConfig,
  LoginRequest,
  LoginResponse,
  PaginationParams,
  PaginatedResponse,
  LibraryItemsQuery,
  SearchQuery,
  SearchResults,
  ProgressUpdateRequest,
  CreateSessionRequest,
  ApiResponse,
  ApiError,
} from '../types/api';