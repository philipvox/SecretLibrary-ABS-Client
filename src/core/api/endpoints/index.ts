/**
 * src/core/api/endpoints/index.ts
 *
 * Unified export for all domain-specific API endpoints
 */

export { userApi } from './user';
export { collectionsApi } from './collections';

/**
 * Combined API namespace for convenient access
 */
export const api = {
  user: () => import('./user').then((m) => m.userApi),
  collections: () => import('./collections').then((m) => m.collectionsApi),
} as const;
