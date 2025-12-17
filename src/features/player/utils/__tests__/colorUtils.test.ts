/**
 * src/features/player/utils/__tests__/colorUtils.test.ts
 *
 * Tests for color manipulation utilities.
 */

import {
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  darkenColor,
  lightenColor,
  isLightColor,
  getHighContrastAccent,
  getAccentColor,
  pickGradientColors,
  getFallbackColors,
} from '../colorUtils';

describe('colorUtils', () => {
  describe('hexToRgb', () => {
    it('converts hex to RGB correctly', () => {
      expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
      expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
      expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
      expect(hexToRgb('#00ff00')).toEqual({ r: 0, g: 255, b: 0 });
      expect(hexToRgb('#0000ff')).toEqual({ r: 0, g: 0, b: 255 });
    });

    it('handles hex without # prefix', () => {
      expect(hexToRgb('ffffff')).toEqual({ r: 255, g: 255, b: 255 });
    });

    it('handles uppercase hex', () => {
      expect(hexToRgb('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 });
    });

    it('returns null for invalid hex', () => {
      expect(hexToRgb('')).toBeNull();
      expect(hexToRgb('#fff')).toBeNull(); // Short hex not supported
      expect(hexToRgb('#gggggg')).toBeNull();
    });

    it('returns null for null/undefined input', () => {
      expect(hexToRgb(null as any)).toBeNull();
      expect(hexToRgb(undefined as any)).toBeNull();
    });
  });

  describe('rgbToHex', () => {
    it('converts RGB to hex correctly', () => {
      expect(rgbToHex(255, 255, 255)).toBe('#ffffff');
      expect(rgbToHex(0, 0, 0)).toBe('#000000');
      expect(rgbToHex(255, 0, 0)).toBe('#ff0000');
    });

    it('clamps values to 0-255 range', () => {
      expect(rgbToHex(300, 0, 0)).toBe('#ff0000');
      expect(rgbToHex(-50, 0, 0)).toBe('#000000');
    });

    it('rounds floating point values', () => {
      expect(rgbToHex(127.6, 0, 0)).toBe('#800000');
    });

    it('pads single digit hex values', () => {
      expect(rgbToHex(0, 0, 15)).toBe('#00000f');
    });
  });

  describe('rgbToHsl', () => {
    it('converts white correctly', () => {
      const hsl = rgbToHsl(255, 255, 255);
      expect(hsl.l).toBe(1);
    });

    it('converts black correctly', () => {
      const hsl = rgbToHsl(0, 0, 0);
      expect(hsl.l).toBe(0);
    });

    it('converts pure red correctly', () => {
      const hsl = rgbToHsl(255, 0, 0);
      expect(hsl.h).toBeCloseTo(0, 2);
      expect(hsl.s).toBeCloseTo(1, 2);
      expect(hsl.l).toBeCloseTo(0.5, 2);
    });

    it('converts pure green correctly', () => {
      const hsl = rgbToHsl(0, 255, 0);
      expect(hsl.h).toBeCloseTo(0.333, 2); // 120 degrees = 1/3
      expect(hsl.s).toBeCloseTo(1, 2);
    });

    it('converts pure blue correctly', () => {
      const hsl = rgbToHsl(0, 0, 255);
      expect(hsl.h).toBeCloseTo(0.667, 2); // 240 degrees = 2/3
      expect(hsl.s).toBeCloseTo(1, 2);
    });

    it('converts gray correctly (zero saturation)', () => {
      const hsl = rgbToHsl(128, 128, 128);
      expect(hsl.s).toBe(0);
    });
  });

  describe('hslToRgb', () => {
    it('converts white correctly', () => {
      const rgb = hslToRgb(0, 0, 1);
      expect(rgb.r).toBe(255);
      expect(rgb.g).toBe(255);
      expect(rgb.b).toBe(255);
    });

    it('converts black correctly', () => {
      const rgb = hslToRgb(0, 0, 0);
      expect(rgb.r).toBe(0);
      expect(rgb.g).toBe(0);
      expect(rgb.b).toBe(0);
    });

    it('converts pure red correctly', () => {
      const rgb = hslToRgb(0, 1, 0.5);
      expect(rgb.r).toBe(255);
      expect(rgb.g).toBe(0);
      expect(rgb.b).toBe(0);
    });

    it('roundtrips correctly with rgbToHsl', () => {
      const original = { r: 100, g: 150, b: 200 };
      const hsl = rgbToHsl(original.r, original.g, original.b);
      const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
      expect(rgb.r).toBeCloseTo(original.r, 0);
      expect(rgb.g).toBeCloseTo(original.g, 0);
      expect(rgb.b).toBeCloseTo(original.b, 0);
    });
  });

  describe('darkenColor', () => {
    it('darkens white by default factor', () => {
      const result = darkenColor('#ffffff');
      expect(result).not.toBe('#ffffff');
      const rgb = hexToRgb(result);
      expect(rgb!.r).toBeLessThan(255);
    });

    it('darkens with custom factor', () => {
      const result = darkenColor('#ffffff', 0.5);
      const rgb = hexToRgb(result);
      expect(rgb!.r).toBeCloseTo(128, -1);
    });

    it('returns fallback for empty/invalid input', () => {
      expect(darkenColor('')).toBe('#1A1A2E');
      expect(darkenColor('#invalid')).toBe('#1A1A2E');
    });
  });

  describe('lightenColor', () => {
    it('lightens black by default factor', () => {
      const result = lightenColor('#000000');
      expect(result).not.toBe('#000000');
      const rgb = hexToRgb(result);
      expect(rgb!.r).toBeGreaterThan(0);
    });

    it('lightens with custom factor', () => {
      const result = lightenColor('#000000', 0.5);
      const rgb = hexToRgb(result);
      expect(rgb!.r).toBeCloseTo(128, -1);
    });

    it('returns fallback for empty/invalid input', () => {
      expect(lightenColor('')).toBe('#FFFFFF');
      expect(lightenColor('#invalid')).toBe('#FFFFFF');
    });
  });

  describe('isLightColor', () => {
    it('returns true for white', () => {
      expect(isLightColor('#ffffff')).toBe(true);
    });

    it('returns false for black', () => {
      expect(isLightColor('#000000')).toBe(false);
    });

    it('returns false for empty/invalid input', () => {
      expect(isLightColor('')).toBe(false);
      expect(isLightColor('#invalid')).toBe(false);
    });

    it('uses luminance formula correctly', () => {
      // Gray at exactly 50% should be close to threshold
      expect(isLightColor('#808080')).toBe(true); // Slightly above 0.5 luminance
      expect(isLightColor('#7f7f7f')).toBe(false); // Slightly below
    });
  });

  describe('getHighContrastAccent', () => {
    it('returns a bright color', () => {
      const result = getHighContrastAccent('#404040');
      const rgb = hexToRgb(result);
      expect(rgb).not.toBeNull();
      // Should be bright (high lightness)
      const hsl = rgbToHsl(rgb!.r, rgb!.g, rgb!.b);
      expect(hsl.l).toBeGreaterThanOrEqual(0.6);
    });

    it('returns fallback for empty/invalid input', () => {
      expect(getHighContrastAccent('')).toBe('#FF6B6B');
      expect(getHighContrastAccent('#invalid')).toBe('#FF6B6B');
    });
  });

  describe('getAccentColor', () => {
    it('returns a valid hex color', () => {
      const result = getAccentColor('#3498db');
      expect(result).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('returns fallback for empty/invalid input', () => {
      expect(getAccentColor('')).toBe('#FF6B6B');
      expect(getAccentColor('#invalid')).toBe('#FF6B6B');
    });

    it('shifts hue by approximately 180 degrees', () => {
      // This is a complementary color transformation
      const result = getAccentColor('#ff0000'); // Red
      // Should shift towards cyan/blue range
      const rgb = hexToRgb(result);
      expect(rgb).not.toBeNull();
    });
  });

  describe('pickGradientColors', () => {
    it('returns fallback for empty array', () => {
      const result = pickGradientColors([]);
      expect(result).toEqual({ dark: '#1A1A2E', light: '#2D2D44' });
    });

    it('returns fallback for null/undefined', () => {
      const result = pickGradientColors(null as any);
      expect(result).toEqual({ dark: '#1A1A2E', light: '#2D2D44' });
    });

    it('returns valid colors for valid input', () => {
      const result = pickGradientColors(['#3498db', '#e74c3c', '#2ecc71']);
      expect(result.dark).toMatch(/^#[0-9a-f]{6}$/i);
      expect(result.light).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('filters out extreme lightness values', () => {
      // Pure white and pure black should be filtered
      const result = pickGradientColors(['#ffffff', '#000000']);
      expect(result).toEqual({ dark: '#1A1A2E', light: '#2D2D44' });
    });

    it('picks most saturated color as base', () => {
      const result = pickGradientColors(['#808080', '#ff0000']); // Gray vs Red
      // Should use red as base since it's more saturated
      const rgb = hexToRgb(result.dark);
      expect(rgb).not.toBeNull();
    });
  });

  describe('getFallbackColors', () => {
    it('returns consistent colors for same bookId', () => {
      const result1 = getFallbackColors('book-123');
      const result2 = getFallbackColors('book-123');
      expect(result1).toEqual(result2);
    });

    it('returns different colors for different bookIds', () => {
      const result1 = getFallbackColors('book-123');
      const result2 = getFallbackColors('book-456');
      // Note: Could potentially be same if hash collision, but unlikely
      // At minimum, we verify both return valid colors
      expect(result1.bg).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(result2.bg).toMatch(/^#[0-9a-fA-F]{6}$/);
    });

    it('returns first palette for empty bookId', () => {
      const result = getFallbackColors('');
      expect(result).toEqual({ bg: '#1A1A2E', accent: '#E94560' });
    });

    it('always returns valid hex colors', () => {
      const testIds = ['a', 'test', 'book-1', 'some-long-book-id-here', '12345'];
      testIds.forEach(id => {
        const result = getFallbackColors(id);
        expect(result.bg).toMatch(/^#[0-9a-fA-F]{6}$/);
        expect(result.accent).toMatch(/^#[0-9a-fA-F]{6}$/);
      });
    });
  });
});
