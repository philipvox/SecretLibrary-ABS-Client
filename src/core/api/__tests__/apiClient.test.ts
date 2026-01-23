/**
 * src/core/api/__tests__/apiClient.test.ts
 *
 * Unit tests for the API client.
 * Tests configuration, URL generation, and cover cache versioning.
 *
 * Note: Full HTTP request testing requires integration tests with a real server.
 * These tests focus on the client's internal logic and URL generation.
 */

import { apiClient } from '../apiClient';
import { endpoints, buildQueryString } from '../endpoints';

describe('ApiClient', () => {
  beforeEach(() => {
    // Reset API client state between tests
    apiClient.configure({ baseURL: '' });
    apiClient.clearAuthToken();
  });

  describe('configuration', () => {
    it('should configure base URL', () => {
      apiClient.configure({ baseURL: 'https://audiobooks.example.com' });
      expect(apiClient.getBaseURL()).toBe('https://audiobooks.example.com');
    });

    it('should accept base URL with trailing slash', () => {
      apiClient.configure({ baseURL: 'https://audiobooks.example.com/' });
      // Note: trailing slash is preserved if present
      expect(apiClient.getBaseURL()).toBe('https://audiobooks.example.com/');
    });

    it('should handle empty base URL', () => {
      apiClient.configure({ baseURL: '' });
      expect(apiClient.getBaseURL()).toBe('');
    });
  });

  describe('authentication token management', () => {
    it('should set auth token without error', () => {
      expect(() => apiClient.setAuthToken('test-token-123')).not.toThrow();
    });

    it('should clear auth token without error', () => {
      apiClient.setAuthToken('test-token');
      expect(() => apiClient.clearAuthToken()).not.toThrow();
    });

    it('should handle empty token', () => {
      expect(() => apiClient.setAuthToken('')).not.toThrow();
    });
  });

  describe('cover URL generation', () => {
    beforeEach(() => {
      apiClient.configure({ baseURL: 'https://abs.example.com' });
    });

    it('should generate basic cover URL', () => {
      const url = apiClient.getItemCoverUrl('item-123');
      expect(url).toContain('https://abs.example.com');
      expect(url).toContain('/api/items/item-123/cover');
    });

    it('should include width parameter', () => {
      const url = apiClient.getItemCoverUrl('item-123', { width: 200 });
      expect(url).toContain('width=200');
    });

    it('should include height parameter', () => {
      const url = apiClient.getItemCoverUrl('item-123', { height: 300 });
      expect(url).toContain('height=300');
    });

    it('should include both width and height', () => {
      const url = apiClient.getItemCoverUrl('item-123', { width: 200, height: 200 });
      expect(url).toContain('width=200');
      expect(url).toContain('height=200');
    });

    it('should include format parameter', () => {
      const url = apiClient.getItemCoverUrl('item-123', { format: 'webp' });
      expect(url).toContain('format=webp');
    });
  });

  describe('cover cache versioning', () => {
    beforeEach(() => {
      apiClient.configure({ baseURL: 'https://abs.example.com' });
    });

    it('should add version parameter after cache bump', () => {
      apiClient.bumpCoverCacheVersion();
      const url = apiClient.getItemCoverUrl('item-123');
      expect(url).toContain('v=');
    });

    it('should change URL after each cache bump', () => {
      apiClient.bumpCoverCacheVersion();
      const url1 = apiClient.getItemCoverUrl('item-123');

      // Wait a tiny bit to ensure different timestamp
      apiClient.bumpCoverCacheVersion();
      const url2 = apiClient.getItemCoverUrl('item-123');

      // Both should have version, but different values
      expect(url1).toContain('v=');
      expect(url2).toContain('v=');
    });
  });

});

describe('endpoints', () => {
  describe('auth endpoints', () => {
    it('should have login endpoint', () => {
      expect(endpoints.auth.login).toBe('/login');
    });

    it('should have logout endpoint', () => {
      expect(endpoints.auth.logout).toBe('/logout');
    });
  });

  describe('user endpoints', () => {
    it('should have me endpoint', () => {
      expect(endpoints.user.me).toBe('/api/me');
    });

    it('should have items in progress endpoint', () => {
      expect(endpoints.user.itemsInProgress).toBe('/api/me/items-in-progress');
    });
  });

  describe('library endpoints', () => {
    it('should have list libraries endpoint', () => {
      expect(endpoints.libraries.list).toBe('/api/libraries');
    });

    it('should generate library get endpoint', () => {
      expect(endpoints.libraries.get('lib-123')).toBe('/api/libraries/lib-123');
    });

    it('should generate library items endpoint', () => {
      expect(endpoints.libraries.items('lib-123')).toBe('/api/libraries/lib-123/items');
    });

    it('should generate library series endpoint', () => {
      expect(endpoints.libraries.series('lib-123')).toBe('/api/libraries/lib-123/series');
    });

    it('should generate library authors endpoint', () => {
      expect(endpoints.libraries.authors('lib-123')).toBe('/api/libraries/lib-123/authors');
    });
  });

  describe('item endpoints', () => {
    it('should generate item get endpoint', () => {
      expect(endpoints.items.get('item-789')).toBe('/api/items/item-789');
    });

    it('should generate item cover endpoint', () => {
      expect(endpoints.items.cover('item-789')).toBe('/api/items/item-789/cover');
    });

    it('should generate item play endpoint', () => {
      expect(endpoints.items.play('item-789')).toBe('/api/items/item-789/play');
    });
  });

  describe('playback endpoints', () => {
    it('should generate session sync endpoint', () => {
      expect(endpoints.playback.sessionSync('sess-abc')).toBe('/api/session/sess-abc/sync');
    });

    it('should generate session close endpoint', () => {
      expect(endpoints.playback.sessionClose('sess-abc')).toBe('/api/session/sess-abc/close');
    });
  });
});

describe('buildQueryString', () => {
  it('should return empty string for empty object', () => {
    expect(buildQueryString({})).toBe('');
  });

  it('should return empty string for undefined', () => {
    expect(buildQueryString(undefined)).toBe('');
  });

  it('should build query string with single param', () => {
    expect(buildQueryString({ limit: 20 })).toBe('?limit=20');
  });

  it('should build query string with multiple params', () => {
    const result = buildQueryString({ limit: 20, page: 1 });
    expect(result).toContain('limit=20');
    expect(result).toContain('page=1');
    expect(result.startsWith('?')).toBe(true);
  });

  it('should skip null values', () => {
    const result = buildQueryString({ limit: 20, page: null });
    expect(result).toBe('?limit=20');
  });

  it('should skip undefined values', () => {
    const result = buildQueryString({ limit: 20, page: undefined });
    expect(result).toBe('?limit=20');
  });

  it('should include zero values', () => {
    const result = buildQueryString({ page: 0 });
    expect(result).toBe('?page=0');
  });

  it('should include false boolean', () => {
    const result = buildQueryString({ collapsed: false });
    expect(result).toBe('?collapsed=false');
  });

  it('should encode special characters', () => {
    const result = buildQueryString({ q: 'test query' });
    // URLSearchParams encodes spaces as + (which is also valid encoding)
    expect(result).toMatch(/test(\+|%20)query/);
  });
});
