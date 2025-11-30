/**
 * src/core/native/storageOptimizer.ts
 *
 * Native storage optimization utilities.
 * Manages cache directories, file cleanup, and storage quotas.
 */

import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

const DEBUG = __DEV__;
const log = (...args: any[]) => DEBUG && console.log('[Storage]', ...args);

// ============================================================================
// STORAGE DIRECTORIES
// ============================================================================

const CACHE_DIR = FileSystem.cacheDirectory || '';
const DOCUMENT_DIR = FileSystem.documentDirectory || '';

const DIRECTORIES = {
  imageCache: `${CACHE_DIR}images/`,
  audioCache: `${CACHE_DIR}audio/`,
  downloads: `${DOCUMENT_DIR}downloads/`,
  temp: `${CACHE_DIR}temp/`,
};

// ============================================================================
// STORAGE INFO
// ============================================================================

interface StorageInfo {
  totalSpace: number;
  freeSpace: number;
  usedSpace: number;
  usedPercentage: number;
  cacheSize: number;
  downloadSize: number;
}

interface DirectoryInfo {
  path: string;
  size: number;
  fileCount: number;
  oldestFile?: { uri: string; modificationTime: number };
  newestFile?: { uri: string; modificationTime: number };
}

class StorageOptimizer {
  private initialized = false;

  /**
   * Initialize storage directories
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    // Create directories if they don't exist
    for (const [name, path] of Object.entries(DIRECTORIES)) {
      try {
        const info = await FileSystem.getInfoAsync(path);
        if (!info.exists) {
          await FileSystem.makeDirectoryAsync(path, { intermediates: true });
          log(`Created directory: ${name}`);
        }
      } catch (e) {
        log(`Failed to create directory ${name}:`, e);
      }
    }

    this.initialized = true;
    log('Storage optimizer initialized');
  }

  /**
   * Get storage information
   */
  async getStorageInfo(): Promise<StorageInfo> {
    try {
      const freeSpace = await FileSystem.getFreeDiskStorageAsync();
      const totalSpace = await FileSystem.getTotalDiskCapacityAsync();
      const usedSpace = totalSpace - freeSpace;

      const [cacheInfo, downloadInfo] = await Promise.all([
        this.getDirectorySize(CACHE_DIR),
        this.getDirectorySize(DIRECTORIES.downloads),
      ]);

      return {
        totalSpace,
        freeSpace,
        usedSpace,
        usedPercentage: (usedSpace / totalSpace) * 100,
        cacheSize: cacheInfo,
        downloadSize: downloadInfo,
      };
    } catch (e) {
      log('Failed to get storage info:', e);
      return {
        totalSpace: 0,
        freeSpace: 0,
        usedSpace: 0,
        usedPercentage: 0,
        cacheSize: 0,
        downloadSize: 0,
      };
    }
  }

  /**
   * Get size of a directory
   */
  async getDirectorySize(path: string): Promise<number> {
    try {
      const info = await FileSystem.getInfoAsync(path);
      if (!info.exists) return 0;

      // On iOS/Android, size property includes directory contents
      if ('size' in info) {
        return (info as any).size || 0;
      }

      // Fallback: manually calculate
      const contents = await FileSystem.readDirectoryAsync(path);
      let totalSize = 0;

      for (const item of contents) {
        const itemPath = `${path}${item}`;
        const itemInfo = await FileSystem.getInfoAsync(itemPath);
        if (itemInfo.exists && 'size' in itemInfo) {
          totalSize += (itemInfo as any).size || 0;
        }
      }

      return totalSize;
    } catch (e) {
      return 0;
    }
  }

  /**
   * Get detailed directory information
   */
  async getDirectoryInfo(path: string): Promise<DirectoryInfo> {
    try {
      const contents = await FileSystem.readDirectoryAsync(path);
      let totalSize = 0;
      let oldestFile: { uri: string; modificationTime: number } | undefined;
      let newestFile: { uri: string; modificationTime: number } | undefined;

      for (const item of contents) {
        const itemPath = `${path}${item}`;
        const itemInfo = await FileSystem.getInfoAsync(itemPath);

        if (itemInfo.exists) {
          const size = (itemInfo as any).size || 0;
          const modTime = (itemInfo as any).modificationTime || Date.now();

          totalSize += size;

          if (!oldestFile || modTime < oldestFile.modificationTime) {
            oldestFile = { uri: itemPath, modificationTime: modTime };
          }
          if (!newestFile || modTime > newestFile.modificationTime) {
            newestFile = { uri: itemPath, modificationTime: modTime };
          }
        }
      }

      return {
        path,
        size: totalSize,
        fileCount: contents.length,
        oldestFile,
        newestFile,
      };
    } catch (e) {
      return { path, size: 0, fileCount: 0 };
    }
  }

  // ============================================================================
  // CACHE MANAGEMENT
  // ============================================================================

  /**
   * Clear all cache directories
   */
  async clearAllCaches(): Promise<number> {
    let freedSpace = 0;

    const cacheDirs = [
      DIRECTORIES.imageCache,
      DIRECTORIES.audioCache,
      DIRECTORIES.temp,
    ];

    for (const dir of cacheDirs) {
      try {
        const sizeBefore = await this.getDirectorySize(dir);
        await FileSystem.deleteAsync(dir, { idempotent: true });
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
        freedSpace += sizeBefore;
        log(`Cleared cache: ${dir}`);
      } catch (e) {
        log(`Failed to clear cache ${dir}:`, e);
      }
    }

    log(`Total freed: ${this.formatBytes(freedSpace)}`);
    return freedSpace;
  }

  /**
   * Clear old cache files (older than maxAge)
   */
  async clearOldCacheFiles(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    let freedSpace = 0;
    const cutoffTime = Date.now() - maxAgeMs;

    const cacheDirs = [DIRECTORIES.imageCache, DIRECTORIES.audioCache];

    for (const dir of cacheDirs) {
      try {
        const contents = await FileSystem.readDirectoryAsync(dir);

        for (const item of contents) {
          const itemPath = `${dir}${item}`;
          const info = await FileSystem.getInfoAsync(itemPath);

          if (info.exists) {
            const modTime = (info as any).modificationTime || Date.now();
            if (modTime < cutoffTime) {
              const size = (info as any).size || 0;
              await FileSystem.deleteAsync(itemPath, { idempotent: true });
              freedSpace += size;
            }
          }
        }
      } catch (e) {
        log(`Failed to clean old files in ${dir}:`, e);
      }
    }

    log(`Cleared old files, freed: ${this.formatBytes(freedSpace)}`);
    return freedSpace;
  }

  /**
   * Clear cache to stay under size limit (LRU eviction)
   */
  async enforceCacheLimit(maxSizeBytes: number): Promise<number> {
    let freedSpace = 0;
    const cacheDirs = [DIRECTORIES.imageCache, DIRECTORIES.audioCache];

    for (const dir of cacheDirs) {
      const dirInfo = await this.getDirectoryInfo(dir);

      if (dirInfo.size > maxSizeBytes) {
        // Get all files with modification times
        const contents = await FileSystem.readDirectoryAsync(dir);
        const files: { path: string; size: number; modTime: number }[] = [];

        for (const item of contents) {
          const itemPath = `${dir}${item}`;
          const info = await FileSystem.getInfoAsync(itemPath);
          if (info.exists) {
            files.push({
              path: itemPath,
              size: (info as any).size || 0,
              modTime: (info as any).modificationTime || Date.now(),
            });
          }
        }

        // Sort by modification time (oldest first)
        files.sort((a, b) => a.modTime - b.modTime);

        // Delete oldest files until under limit
        let currentSize = dirInfo.size;
        for (const file of files) {
          if (currentSize <= maxSizeBytes) break;

          await FileSystem.deleteAsync(file.path, { idempotent: true });
          currentSize -= file.size;
          freedSpace += file.size;
        }
      }
    }

    if (freedSpace > 0) {
      log(`Enforced cache limit, freed: ${this.formatBytes(freedSpace)}`);
    }
    return freedSpace;
  }

  // ============================================================================
  // FILE OPERATIONS
  // ============================================================================

  /**
   * Get a cached file path, creating if it doesn't exist
   */
  getCachePath(type: 'image' | 'audio', filename: string): string {
    const dir = type === 'image' ? DIRECTORIES.imageCache : DIRECTORIES.audioCache;
    return `${dir}${filename}`;
  }

  /**
   * Get the download path for a file
   */
  getDownloadPath(filename: string): string {
    return `${DIRECTORIES.downloads}${filename}`;
  }

  /**
   * Check if a file exists
   */
  async fileExists(path: string): Promise<boolean> {
    try {
      const info = await FileSystem.getInfoAsync(path);
      return info.exists;
    } catch {
      return false;
    }
  }

  /**
   * Get file size
   */
  async getFileSize(path: string): Promise<number> {
    try {
      const info = await FileSystem.getInfoAsync(path);
      return info.exists ? ((info as any).size || 0) : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Delete a file
   */
  async deleteFile(path: string): Promise<boolean> {
    try {
      await FileSystem.deleteAsync(path, { idempotent: true });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Move a file
   */
  async moveFile(from: string, to: string): Promise<boolean> {
    try {
      await FileSystem.moveAsync({ from, to });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Copy a file
   */
  async copyFile(from: string, to: string): Promise<boolean> {
    try {
      await FileSystem.copyAsync({ from, to });
      return true;
    } catch {
      return false;
    }
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  /**
   * Format bytes to human readable string
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Parse size string to bytes
   */
  parseBytes(sizeStr: string): number {
    const units: Record<string, number> = {
      B: 1,
      KB: 1024,
      MB: 1024 * 1024,
      GB: 1024 * 1024 * 1024,
      TB: 1024 * 1024 * 1024 * 1024,
    };

    const match = sizeStr.match(/^([\d.]+)\s*([A-Z]+)$/i);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    return value * (units[unit] || 1);
  }

  /**
   * Check if storage is low
   */
  async isStorageLow(thresholdMB: number = 500): Promise<boolean> {
    const info = await this.getStorageInfo();
    return info.freeSpace < thresholdMB * 1024 * 1024;
  }

  /**
   * Get recommended cache limit based on available storage
   */
  async getRecommendedCacheLimit(): Promise<number> {
    const info = await this.getStorageInfo();

    // Use 5% of total space or 500MB, whichever is smaller
    const percentLimit = info.totalSpace * 0.05;
    const maxLimit = 500 * 1024 * 1024; // 500MB

    return Math.min(percentLimit, maxLimit);
  }
}

// ============================================================================
// EXPORT SINGLETON
// ============================================================================

export const storageOptimizer = new StorageOptimizer();
export { DIRECTORIES };
export type { StorageInfo, DirectoryInfo };
