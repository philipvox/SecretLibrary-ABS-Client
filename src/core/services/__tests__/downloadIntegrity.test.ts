/**
 * Tests for Download Integrity Service
 */

import * as FileSystem from 'expo-file-system/legacy';

import {
  calculateFileChecksum,
  getFileSize,
  fileExists,
  verifyFileIntegrity,
  verifyBatchIntegrity,
  quickValidate,
  deleteIfInvalid,
  validateDownload,
  getIntegrityStatusSummary,
  getBatchIntegritySummary,
  MIN_VALID_FILE_SIZE,
  SIZE_TOLERANCE_PERCENT,
} from '../downloadIntegrity';

// Mock expo-file-system/legacy (matching the source's import)
jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
  EncodingType: {
    Base64: 'base64',
    UTF8: 'utf8',
  },
}), { virtual: true });

const mockGetInfoAsync = FileSystem.getInfoAsync as jest.Mock;
const mockDeleteAsync = FileSystem.deleteAsync as jest.Mock;

describe('Download Integrity Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Constants', () => {
    it('has correct minimum file size', () => {
      expect(MIN_VALID_FILE_SIZE).toBe(1024);
    });

    it('has correct size tolerance', () => {
      expect(SIZE_TOLERANCE_PERCENT).toBe(0.01);
    });
  });

  describe('fileExists', () => {
    it('returns true when file exists', async () => {
      mockGetInfoAsync.mockResolvedValue({ exists: true });

      const result = await fileExists('/path/to/file.mp3');
      expect(result).toBe(true);
    });

    it('returns false when file does not exist', async () => {
      mockGetInfoAsync.mockResolvedValue({ exists: false });

      const result = await fileExists('/path/to/missing.mp3');
      expect(result).toBe(false);
    });

    it('returns false on error', async () => {
      mockGetInfoAsync.mockRejectedValue(new Error('Permission denied'));

      const result = await fileExists('/path/to/file.mp3');
      expect(result).toBe(false);
    });
  });

  describe('getFileSize', () => {
    it('returns file size when file exists', async () => {
      mockGetInfoAsync.mockResolvedValue({ exists: true, size: 1024000 });

      const size = await getFileSize('/path/to/file.mp3');
      expect(size).toBe(1024000);
    });

    it('throws when file does not exist', async () => {
      mockGetInfoAsync.mockResolvedValue({ exists: false });

      await expect(getFileSize('/path/to/missing.mp3')).rejects.toThrow(
        'File does not exist'
      );
    });

    it('returns 0 when size is undefined', async () => {
      mockGetInfoAsync.mockResolvedValue({ exists: true, size: undefined });

      const size = await getFileSize('/path/to/file.mp3');
      expect(size).toBe(0);
    });
  });

  describe('calculateFileChecksum', () => {
    it('calculates checksum correctly', async () => {
      // Source now uses size-based fingerprints instead of SHA-256
      mockGetInfoAsync.mockResolvedValue({ exists: true, size: 1024000 });

      const checksum = await calculateFileChecksum('/path/to/file.mp3');
      expect(checksum).toBe('size:1024000');
    });

    it('throws on read error', async () => {
      mockGetInfoAsync.mockResolvedValue({ exists: false });

      await expect(calculateFileChecksum('/path/to/file.mp3')).rejects.toThrow(
        'Failed to calculate checksum'
      );
    });
  });

  describe('verifyFileIntegrity', () => {
    it('returns valid for matching file', async () => {
      mockGetInfoAsync.mockResolvedValue({ exists: true, size: 1024000 });

      const result = await verifyFileIntegrity({
        filePath: '/path/to/file.mp3',
        expectedSize: 1024000,
      });

      expect(result.isValid).toBe(true);
      expect(result.sizeMatch).toBe(true);
      expect(result.checksumMatch).toBeNull();
    });

    it('returns invalid when file does not exist', async () => {
      mockGetInfoAsync.mockResolvedValue({ exists: false });

      const result = await verifyFileIntegrity({
        filePath: '/path/to/missing.mp3',
        expectedSize: 1024000,
      });

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('File does not exist');
    });

    it('returns invalid when file too small', async () => {
      mockGetInfoAsync.mockResolvedValue({ exists: true, size: 100 });

      const result = await verifyFileIntegrity({
        filePath: '/path/to/tiny.mp3',
        expectedSize: 100,
      });

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('File too small');
    });

    it('returns invalid when size mismatch', async () => {
      mockGetInfoAsync.mockResolvedValue({ exists: true, size: 2000000 });

      const result = await verifyFileIntegrity({
        filePath: '/path/to/file.mp3',
        expectedSize: 1000000,
      });

      expect(result.isValid).toBe(false);
      expect(result.sizeMatch).toBe(false);
      expect(result.error).toContain('Size mismatch');
    });

    it('allows size within tolerance', async () => {
      const expectedSize = 1000000;
      const actualSize = expectedSize + expectedSize * SIZE_TOLERANCE_PERCENT * 0.5;

      mockGetInfoAsync.mockResolvedValue({ exists: true, size: actualSize });

      const result = await verifyFileIntegrity({
        filePath: '/path/to/file.mp3',
        expectedSize,
      });

      expect(result.isValid).toBe(true);
      expect(result.sizeMatch).toBe(true);
    });

    it('verifies checksum when provided (size-based fingerprint)', async () => {
      // Source now uses size-based fingerprints: checksum = "size:N"
      // When size matches, checksum also matches
      mockGetInfoAsync.mockResolvedValue({ exists: true, size: 1024000 });

      const result = await verifyFileIntegrity({
        filePath: '/path/to/file.mp3',
        expectedSize: 1024000,
        expectedChecksum: 'size:1024000',
      });

      expect(result.isValid).toBe(true);
      expect(result.checksumMatch).toBe(true);
    });

    it('returns invalid on checksum mismatch (size-based)', async () => {
      // When expectedSize doesn't match actualSize, checksum also fails
      mockGetInfoAsync.mockResolvedValue({ exists: true, size: 2000000 });

      const result = await verifyFileIntegrity({
        filePath: '/path/to/file.mp3',
        expectedSize: 1024000,
        expectedChecksum: 'size:1024000',
      });

      expect(result.isValid).toBe(false);
      expect(result.checksumMatch).toBe(false);
      expect(result.error).toBe('Checksum mismatch');
    });

    it('handles legacy hex checksum by falling back to size validation', async () => {
      // Legacy hex checksums can't be verified (would cause OOM), so falls back to size check
      mockGetInfoAsync.mockResolvedValue({ exists: true, size: 1024000 });

      const result = await verifyFileIntegrity({
        filePath: '/path/to/file.mp3',
        expectedSize: 1024000,
        expectedChecksum: 'ABCDEF123',
      });

      // Size matches, so legacy checksum validation passes via size fallback
      expect(result.isValid).toBe(true);
      expect(result.checksumMatch).toBe(true);
    });
  });

  describe('verifyBatchIntegrity', () => {
    it('verifies multiple files', async () => {
      // Each file check calls getInfoAsync twice (exists + size)
      mockGetInfoAsync
        .mockResolvedValueOnce({ exists: true }) // file1 exists check
        .mockResolvedValueOnce({ exists: true, size: 1024000 }) // file1 size
        .mockResolvedValueOnce({ exists: true }) // file2 exists check
        .mockResolvedValueOnce({ exists: true, size: 2048000 }) // file2 size
        .mockResolvedValueOnce({ exists: false }); // file3 exists check

      const result = await verifyBatchIntegrity([
        { filePath: '/path/file1.mp3', expectedSize: 1024000 },
        { filePath: '/path/file2.mp3', expectedSize: 2048000 },
        { filePath: '/path/missing.mp3', expectedSize: 512000 },
      ]);

      expect(result.totalFiles).toBe(3);
      expect(result.validFiles).toBe(2);
      expect(result.invalidFiles).toBe(1);
      expect(result.hasErrors).toBe(true);
    });

    it('returns no errors when all valid', async () => {
      mockGetInfoAsync.mockResolvedValue({ exists: true, size: 1024000 });

      const result = await verifyBatchIntegrity([
        { filePath: '/path/file1.mp3', expectedSize: 1024000 },
        { filePath: '/path/file2.mp3', expectedSize: 1024000 },
      ]);

      expect(result.hasErrors).toBe(false);
      expect(result.validFiles).toBe(2);
    });
  });

  describe('quickValidate', () => {
    it('returns true for valid file', async () => {
      mockGetInfoAsync.mockResolvedValue({ exists: true, size: 1024000 });

      const result = await quickValidate('/path/to/file.mp3');
      expect(result).toBe(true);
    });

    it('returns false when file does not exist', async () => {
      mockGetInfoAsync.mockResolvedValue({ exists: false });

      const result = await quickValidate('/path/to/missing.mp3');
      expect(result).toBe(false);
    });

    it('returns false when file too small', async () => {
      mockGetInfoAsync.mockResolvedValue({ exists: true, size: 100 });

      const result = await quickValidate('/path/to/tiny.mp3');
      expect(result).toBe(false);
    });

    it('validates size when provided', async () => {
      mockGetInfoAsync.mockResolvedValue({ exists: true, size: 2000000 });

      const result = await quickValidate('/path/to/file.mp3', 1000000);
      expect(result).toBe(false);
    });
  });

  describe('deleteIfInvalid', () => {
    it('deletes invalid file', async () => {
      mockGetInfoAsync.mockResolvedValue({ exists: true, size: 100 });
      mockDeleteAsync.mockResolvedValue(undefined);

      const { deleted, result } = await deleteIfInvalid({
        filePath: '/path/to/invalid.mp3',
        expectedSize: 1024000,
      });

      expect(deleted).toBe(true);
      expect(result.isValid).toBe(false);
      expect(mockDeleteAsync).toHaveBeenCalled();
    });

    it('does not delete valid file', async () => {
      mockGetInfoAsync.mockResolvedValue({ exists: true, size: 1024000 });

      const { deleted, result } = await deleteIfInvalid({
        filePath: '/path/to/valid.mp3',
        expectedSize: 1024000,
      });

      expect(deleted).toBe(false);
      expect(result.isValid).toBe(true);
      expect(mockDeleteAsync).not.toHaveBeenCalled();
    });
  });

  describe('validateDownload', () => {
    it('returns valid result on first try', async () => {
      mockGetInfoAsync.mockResolvedValue({ exists: true, size: 1024000 });

      const result = await validateDownload('/path/to/file.mp3', 1024000);
      expect(result.isValid).toBe(true);
    });

    it('retries on failure', async () => {
      // First 2 attempts fail (exists check fails), 3rd attempt succeeds
      mockGetInfoAsync
        .mockResolvedValueOnce({ exists: false }) // attempt 1
        .mockResolvedValueOnce({ exists: false }) // attempt 2
        .mockResolvedValueOnce({ exists: true })  // attempt 3 exists check
        .mockResolvedValueOnce({ exists: true, size: 1024000 }); // attempt 3 size

      const result = await validateDownload('/path/to/file.mp3', 1024000);
      expect(result.isValid).toBe(true);
      // Called 4 times: fail, fail, exists success, size success
      expect(mockGetInfoAsync).toHaveBeenCalledTimes(4);
    });
  });

  describe('getIntegrityStatusSummary', () => {
    it('returns valid summary for valid file', () => {
      const result = getIntegrityStatusSummary({
        isValid: true,
        filePath: '/path/file.mp3',
        actualSize: 1024000,
        expectedSize: 1024000,
        sizeMatch: true,
        checksumMatch: null,
      });

      expect(result).toBe('Valid (1024000 bytes)');
    });

    it('returns invalid summary with size mismatch', () => {
      const result = getIntegrityStatusSummary({
        isValid: false,
        filePath: '/path/file.mp3',
        actualSize: 2000000,
        expectedSize: 1000000,
        sizeMatch: false,
        checksumMatch: null,
      });

      expect(result).toContain('size mismatch');
    });

    it('returns invalid summary with checksum mismatch', () => {
      const result = getIntegrityStatusSummary({
        isValid: false,
        filePath: '/path/file.mp3',
        actualSize: 1024000,
        expectedSize: 1024000,
        sizeMatch: true,
        checksumMatch: false,
      });

      expect(result).toContain('checksum mismatch');
    });
  });

  describe('getBatchIntegritySummary', () => {
    it('returns summary string', () => {
      const result = getBatchIntegritySummary({
        totalFiles: 10,
        validFiles: 8,
        invalidFiles: 2,
        results: [],
        hasErrors: true,
      });

      expect(result).toBe('8/10 files valid (2 invalid)');
    });
  });
});
