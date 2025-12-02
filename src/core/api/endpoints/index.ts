/**
 * src/core/api/endpoints/index.ts
 *
 * Unified export for all domain-specific API endpoints
 */

export { authApi } from './auth';
export { userApi } from './user';
export { librariesApi } from './libraries';
export { itemsApi } from './items';
export { collectionsApi } from './collections';
export { seriesApi } from './series';
export { authorsApi } from './authors';
export { playlistsApi } from './playlists';

/**
 * Combined API namespace for convenient access
 */
export const api = {
  auth: () => import('./auth').then((m) => m.authApi),
  user: () => import('./user').then((m) => m.userApi),
  libraries: () => import('./libraries').then((m) => m.librariesApi),
  items: () => import('./items').then((m) => m.itemsApi),
  collections: () => import('./collections').then((m) => m.collectionsApi),
  series: () => import('./series').then((m) => m.seriesApi),
  authors: () => import('./authors').then((m) => m.authorsApi),
  playlists: () => import('./playlists').then((m) => m.playlistsApi),
} as const;
