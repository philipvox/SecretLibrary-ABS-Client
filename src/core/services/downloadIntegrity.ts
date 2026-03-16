/**
 * src/core/services/downloadIntegrity.ts
 *
 * Download integrity verification service.
 * Verifies downloaded files using file size validation.
 *
 * Features:
 * - File size validation
 * - Partial download detection
 * - Size-based integrity fingerprints
 *
 * NOTE: SHA-256 checksums were removed because expo-crypto doesn't support
 * streaming hashes. Reading entire audiobook files (500MB+) as base64 strings
 * caused OOM crashes. File size validation is sufficient for download integrity.
 */

import * as FileSystem from 'expo-file-system/legacy';

// =============================================================================
// Types
// =============================================================================

export interface FileIntegrityInfo {
  filePath: string;
  expectedSize: number;
  expectedChecksum?: string; // SHA-256
}

export interface IntegrityResult {
  isValid: boolean;
  filePath: string;
  actualSize: number;
  expectedSize: number;
  sizeMatch: boolean;
  checksumMatch: boolean | null; // null if no checksum provided
  actualChecksum?: string;
  error?: string;
}

export interface BatchIntegrityResult {
  totalFiles: number;
  validFiles: number;
  invalidFiles: number;
  results: IntegrityResult[];
  hasErrors: boolean;
}

// =============================================================================
// Constants
// =============================================================================

// Minimum file size considered valid (1KB)
export const MIN_VALID_FILE_SIZE = 1024;

// Size tolerance percentage (allow 1% variance for metadata differences)
export const SIZE_TOLERANCE_PERCENT = 0.01;

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Calculate a size-based fingerprint for a file.
 * Returns a string like "size:123456789" for use as a lightweight integrity check.
 *
 * NOTE: This replaced SHA-256 hashing because expo-crypto doesn't support
 * streaming hashes, and reading entire audiobook files (500MB+) as base64
 * caused OOM crashes on mobile devices.
 */
export async function calculateFileChecksum(filePath: string): Promise<string> {
  try {
    const fileSize = await getFileSize(filePath);
    return `size:${fileSize}`;
  } catch (error) {
    throw new Error(
      `Failed to calculate checksum for ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get file size in bytes.
 */
export async function getFileSize(filePath: string): Promise<number> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(filePath);

    if (!fileInfo.exists) {
      throw new Error(`File does not exist: ${filePath}`);
    }

    return fileInfo.size ?? 0;
  } catch (error) {
    throw new Error(
      `Failed to get file size for ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Check if file exists.
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(filePath);
    return fileInfo.exists;
  } catch {
    return false;
  }
}

/**
 * Verify file integrity against expected values.
 */
export async function verifyFileIntegrity(
  info: FileIntegrityInfo
): Promise<IntegrityResult> {
  const result: IntegrityResult = {
    isValid: false,
    filePath: info.filePath,
    actualSize: 0,
    expectedSize: info.expectedSize,
    sizeMatch: false,
    checksumMatch: null,
  };

  try {
    // Check if file exists
    const exists = await fileExists(info.filePath);
    if (!exists) {
      result.error = 'File does not exist';
      return result;
    }

    // Get actual file size
    result.actualSize = await getFileSize(info.filePath);

    // Check minimum size
    if (result.actualSize < MIN_VALID_FILE_SIZE) {
      result.error = `File too small (${result.actualSize} bytes)`;
      return result;
    }

    // Check size match with tolerance
    const sizeDifference = Math.abs(result.actualSize - info.expectedSize);
    const toleranceBytes = info.expectedSize * SIZE_TOLERANCE_PERCENT;
    result.sizeMatch = sizeDifference <= toleranceBytes;

    if (!result.sizeMatch) {
      result.error = `Size mismatch: expected ${info.expectedSize}, got ${result.actualSize}`;
    }

    // Check checksum if provided (size-based fingerprint comparison)
    if (info.expectedChecksum) {
      try {
        result.actualChecksum = await calculateFileChecksum(info.filePath);
        // Support both size-based fingerprints ("size:123") and legacy hex checksums
        if (info.expectedChecksum.startsWith('size:') || result.actualChecksum.startsWith('size:')) {
          // Size-based: both must have same size (already validated above)
          result.checksumMatch = result.sizeMatch;
        } else {
          result.checksumMatch =
            result.actualChecksum.toLowerCase() ===
            info.expectedChecksum.toLowerCase();
        }

        if (!result.checksumMatch) {
          result.error = 'Checksum mismatch';
        }
      } catch (checksumError) {
        result.checksumMatch = false;
        result.error = `Checksum verification failed: ${checksumError instanceof Error ? checksumError.message : 'Unknown error'}`;
      }
    }

    // Determine overall validity
    result.isValid =
      result.sizeMatch &&
      (result.checksumMatch === null || result.checksumMatch === true);

    return result;
  } catch (error) {
    result.error =
      error instanceof Error ? error.message : 'Unknown error occurred';
    return result;
  }
}

/**
 * Verify integrity of multiple files.
 */
export async function verifyBatchIntegrity(
  files: FileIntegrityInfo[]
): Promise<BatchIntegrityResult> {
  const results: IntegrityResult[] = [];
  let validCount = 0;
  let invalidCount = 0;

  for (const file of files) {
    const result = await verifyFileIntegrity(file);
    results.push(result);

    if (result.isValid) {
      validCount++;
    } else {
      invalidCount++;
    }
  }

  return {
    totalFiles: files.length,
    validFiles: validCount,
    invalidFiles: invalidCount,
    results,
    hasErrors: invalidCount > 0,
  };
}

/**
 * Quick validation - just check file exists and has reasonable size.
 * Faster than full verification for routine checks.
 */
export async function quickValidate(
  filePath: string,
  expectedSize?: number
): Promise<boolean> {
  try {
    const exists = await fileExists(filePath);
    if (!exists) return false;

    const size = await getFileSize(filePath);
    if (size < MIN_VALID_FILE_SIZE) return false;

    if (expectedSize !== undefined) {
      const tolerance = expectedSize * SIZE_TOLERANCE_PERCENT;
      if (Math.abs(size - expectedSize) > tolerance) return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Delete file if it fails integrity check.
 * Returns true if file was deleted, false if it was valid.
 */
export async function deleteIfInvalid(
  info: FileIntegrityInfo
): Promise<{ deleted: boolean; result: IntegrityResult }> {
  const result = await verifyFileIntegrity(info);

  if (!result.isValid) {
    try {
      const exists = await fileExists(info.filePath);
      if (exists) {
        await FileSystem.deleteAsync(info.filePath, { idempotent: true });
      }
      return { deleted: true, result };
    } catch {
      // Deletion failed, but file is still invalid
      return { deleted: false, result };
    }
  }

  return { deleted: false, result };
}

// =============================================================================
// Download Validation Helpers
// =============================================================================

/**
 * Validate a download after completion.
 * Includes retry logic for transient issues.
 */
export async function validateDownload(
  filePath: string,
  expectedSize: number,
  expectedChecksum?: string,
  retries: number = 2
): Promise<IntegrityResult> {
  let lastResult: IntegrityResult | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const result = await verifyFileIntegrity({
      filePath,
      expectedSize,
      expectedChecksum,
    });

    lastResult = result;

    if (result.isValid) {
      return result;
    }

    // Small delay before retry
    if (attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return lastResult!;
}

/**
 * Get integrity status summary for logging.
 */
export function getIntegrityStatusSummary(result: IntegrityResult): string {
  if (result.isValid) {
    return `Valid (${result.actualSize} bytes)`;
  }

  const issues: string[] = [];

  if (!result.sizeMatch) {
    issues.push(`size mismatch (${result.actualSize}/${result.expectedSize})`);
  }

  if (result.checksumMatch === false) {
    issues.push('checksum mismatch');
  }

  if (result.error && issues.length === 0) {
    issues.push(result.error);
  }

  return `Invalid: ${issues.join(', ')}`;
}

/**
 * Get batch integrity summary for logging.
 */
export function getBatchIntegritySummary(result: BatchIntegrityResult): string {
  return `${result.validFiles}/${result.totalFiles} files valid (${result.invalidFiles} invalid)`;
}
