/**
 * src/features/downloads/index.ts
 *
 * Downloads feature - using downloadManager with SQLite persistence
 */

// Re-export core download manager
export { downloadManager } from '@/core/services/downloadManager';
export type { DownloadTask } from '@/core/services/downloadManager';

// Screens
export { DownloadsScreen } from './screens/DownloadsScreen';

// Components
export { DownloadItem } from './components/DownloadItem';
