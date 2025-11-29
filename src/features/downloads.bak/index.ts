/**
 * src/features/downloads/index.ts
 */

export { autoDownloadService } from './services/autoDownloadService';
export type { DownloadedBook } from './services/autoDownloadService';

// Legacy exports (if they exist)
// src/features/downloads/index.ts

// Only export the new auto-download service
// Old downloadService.ts is deprecated due to Expo SDK 54 issues
export { autoDownloadService } from './services/autoDownloadService';
export type { DownloadedBook, DownloadStatus } from './services/autoDownloadService';