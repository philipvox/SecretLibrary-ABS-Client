/**
 * src/core/cache/__tests__/useCoverUrl.test.ts
 *
 * Tests for cover URL utilities.
 */

import { getCoverUrl } from '../useCoverUrl';

// Mock apiClient
const mockGetItemCoverUrl = jest.fn();
jest.mock('@/core/api', () => ({
  apiClient: {
    getItemCoverUrl: (itemId: string, options?: { width?: number; height?: number }) =>
      mockGetItemCoverUrl(itemId, options),
  },
}));

// Mock libraryCache
const mockLibraryCacheState = {
  lastRefreshed: null as number | null,
};

jest.mock('../libraryCache', () => ({
  useLibraryCache: Object.assign(
    jest.fn((selector: (state: typeof mockLibraryCacheState) => unknown) =>
      selector(mockLibraryCacheState)
    ),
    {
      getState: () => mockLibraryCacheState,
    }
  ),
}));

describe('getCoverUrl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLibraryCacheState.lastRefreshed = null;
  });

  it('returns base URL when no lastRefreshed', () => {
    mockGetItemCoverUrl.mockReturnValue('https://server.com/api/items/123/cover');

    const url = getCoverUrl('123');

    expect(url).toBe('https://server.com/api/items/123/cover');
    // When no options provided, getCoverUrl applies default width of 80
    expect(mockGetItemCoverUrl).toHaveBeenCalledWith('123', { width: 80 });
  });

  it('appends cache-busting timestamp when lastRefreshed is set', () => {
    mockGetItemCoverUrl.mockReturnValue('https://server.com/api/items/123/cover');
    mockLibraryCacheState.lastRefreshed = 1234567890;

    const url = getCoverUrl('123');

    expect(url).toBe('https://server.com/api/items/123/cover?t=1234567890');
  });

  it('uses & separator when URL already has query params', () => {
    mockGetItemCoverUrl.mockReturnValue('https://server.com/api/items/123/cover?width=200');
    mockLibraryCacheState.lastRefreshed = 1234567890;

    const url = getCoverUrl('123');

    expect(url).toBe('https://server.com/api/items/123/cover?width=200&t=1234567890');
  });

  it('passes options to getItemCoverUrl', () => {
    mockGetItemCoverUrl.mockReturnValue('https://server.com/api/items/123/cover?width=200&height=200');

    getCoverUrl('123', { width: 200, height: 200 });

    expect(mockGetItemCoverUrl).toHaveBeenCalledWith('123', { width: 200, height: 200 });
  });

  it('handles width-only option', () => {
    mockGetItemCoverUrl.mockReturnValue('https://server.com/api/items/123/cover?width=150');

    getCoverUrl('123', { width: 150 });

    expect(mockGetItemCoverUrl).toHaveBeenCalledWith('123', { width: 150 });
  });

  it('handles different item IDs', () => {
    mockGetItemCoverUrl
      .mockReturnValueOnce('https://server.com/api/items/abc/cover')
      .mockReturnValueOnce('https://server.com/api/items/xyz/cover');

    const url1 = getCoverUrl('abc');
    const url2 = getCoverUrl('xyz');

    expect(url1).toContain('abc');
    expect(url2).toContain('xyz');
  });

  it('returns URL without timestamp when lastRefreshed is 0', () => {
    mockGetItemCoverUrl.mockReturnValue('https://server.com/api/items/123/cover');
    mockLibraryCacheState.lastRefreshed = 0;

    const url = getCoverUrl('123');

    // 0 is falsy so no timestamp should be added
    expect(url).toBe('https://server.com/api/items/123/cover');
  });
});
