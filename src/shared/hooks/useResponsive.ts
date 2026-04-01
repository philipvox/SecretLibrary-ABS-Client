/**
 * src/shared/hooks/useResponsive.ts
 *
 * Responsive layout hook for iPad/tablet and desktop web optimization.
 * Provides device detection, dynamic dimensions, and scaled values.
 */

import { useState, useEffect, useMemo } from 'react';
import { Dimensions, Platform } from 'react-native';

const IS_WEB = Platform.OS === 'web';

// =============================================================================
// TYPES
// =============================================================================

export interface ResponsiveInfo {
  /** Current screen width */
  width: number;
  /** Current screen height */
  height: number;
  /** True if device is iPad or large tablet */
  isTablet: boolean;
  /** True if device is iPad specifically */
  isIPad: boolean;
  /** True if running on web (any size) */
  isWeb: boolean;
  /** True if web with desktop-width viewport (>= 768px) */
  isDesktopWeb: boolean;
  /** Scale factor for UI elements (1.0 for phones, reduced for tablets) */
  scaleFactor: number;
  /** Maximum content width (constrains content on large screens) */
  maxContentWidth: number;
  /** Horizontal padding for centered content */
  contentPadding: number;
  /** Number of columns for grid layouts */
  gridColumns: number;
  /** Number of columns for cover art grids (larger items than spine grids) */
  coverGridColumns: number;
  /** Book spine scale multiplier */
  spineScale: number;
  /** Whether to use compact layout */
  isCompact: boolean;
  /** Effective width for card/cover calculations (capped on web to prevent oversize) */
  effectiveWidth: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Breakpoint for tablet detection (iPad mini is 768pt wide in portrait) */
const TABLET_BREAKPOINT = 600;

/** Maximum content width for tablets (prevents overly wide layouts) */
const MAX_CONTENT_WIDTH = 600;

/** iPad-specific max content width (slightly larger) */
const IPAD_MAX_CONTENT_WIDTH = 700;

/** Web desktop max content width for text/form screens (profile, book detail) */
const WEB_CONTENT_MAX_WIDTH = 960;

/** Web desktop max width for wide grid screens (browse, library) */
const WEB_WIDE_MAX_WIDTH = 1200;

/** Web desktop breakpoint */
const WEB_DESKTOP_BREAKPOINT = 768;

/** Design canvas width (phone) */
const DESIGN_WIDTH = 402;

// =============================================================================
// DEVICE DETECTION
// =============================================================================

/**
 * Detect if device is iPad
 * Uses Platform.isPad on iOS, screen size heuristic on Android
 */
function detectIsIPad(width: number, height: number): boolean {
  if (Platform.OS === 'ios') {
    // React Native provides isPad on iOS
    return (Platform as any).isPad === true;
  }
  // Android tablets: use screen size heuristic
  const minDimension = Math.min(width, height);
  return minDimension >= TABLET_BREAKPOINT;
}

/**
 * Detect if device is any tablet (iPad or Android tablet)
 */
function detectIsTablet(width: number, height: number): boolean {
  const minDimension = Math.min(width, height);
  return minDimension >= TABLET_BREAKPOINT;
}

/**
 * Calculate scale factor for tablet
 * On tablets, we don't want UI to scale up linearly with screen size
 */
function calculateScaleFactor(width: number, isTablet: boolean): number {
  if (!isTablet) {
    return 1.0;
  }
  // On tablets, use a more moderate scale to prevent oversized elements
  // This creates a "phone-like" density on the larger screen
  const ratio = DESIGN_WIDTH / width;
  // Blend between 1.0 (no reduction) and the ratio (full reduction)
  // Using 0.6 blend = elements are 60% of what linear scaling would produce
  return 0.7 + (ratio * 0.3);
}

/**
 * Calculate spine scale for bookshelves
 * Tablets need smaller spines relative to screen size
 */
function calculateSpineScale(width: number, isTablet: boolean): number {
  if (!isTablet) {
    return 1.0;
  }
  // On iPad, reduce spine size to fit more books on screen
  // Base this on how much wider the screen is vs phone
  const widthRatio = DESIGN_WIDTH / width;
  // Spine scale: 0.65-0.85 depending on screen width
  return Math.max(0.65, Math.min(0.85, widthRatio + 0.4));
}

/**
 * Calculate grid columns based on screen width
 */
function calculateGridColumns(width: number, isTablet: boolean): number {
  if (IS_WEB) {
    if (width >= 1440) return 6;
    if (width >= 1200) return 5;
    if (width >= 1024) return 4;
    if (width >= 768) return 3;
    return 2;
  }
  if (!isTablet) {
    return 2; // Phone: 2 columns
  }
  if (width >= 1024) {
    return 4; // Large iPad landscape: 4 columns
  }
  return 3; // iPad portrait: 3 columns
}

/**
 * Calculate cover grid columns (larger items like book covers)
 */
function calculateCoverGridColumns(width: number, isTablet: boolean): number {
  if (IS_WEB) {
    if (width >= 1440) return 5;
    if (width >= 1200) return 4;
    if (width >= 900) return 3;
    return 2;
  }
  if (!isTablet) return 2;
  if (width >= 1024) return 3;
  return 2;
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Hook for responsive layout calculations
 * Automatically updates when screen dimensions change (rotation, multitasking)
 */
export function useResponsive(): ResponsiveInfo {
  const [dimensions, setDimensions] = useState(() => Dimensions.get('window'));

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });

    return () => subscription.remove();
  }, []);

  return useMemo(() => {
    const { width, height } = dimensions;
    const isIPad = detectIsIPad(width, height);
    const isTablet = IS_WEB ? false : detectIsTablet(width, height);
    const isDesktopWeb = IS_WEB && width >= WEB_DESKTOP_BREAKPOINT;
    const scaleFactor = IS_WEB ? 1.0 : calculateScaleFactor(width, isTablet);
    const spineScale = IS_WEB ? 1.0 : calculateSpineScale(width, isTablet);
    const gridColumns = calculateGridColumns(width, isTablet);
    const coverGridColumns = calculateCoverGridColumns(width, isTablet);

    // Calculate max content width and padding
    let maxContentWidth: number;
    if (IS_WEB) {
      maxContentWidth = isDesktopWeb ? WEB_CONTENT_MAX_WIDTH : width;
    } else {
      maxContentWidth = isIPad ? IPAD_MAX_CONTENT_WIDTH : MAX_CONTENT_WIDTH;
    }

    const shouldConstrain = (IS_WEB ? isDesktopWeb : isTablet) && width > maxContentWidth;
    const contentPadding = shouldConstrain ? (width - maxContentWidth) / 2 : 0;

    // Effective width for card calculations — prevents cards from being
    // absurdly wide on desktop. Horizontal scroll sections use this to size
    // individual cards as if the viewport were phone-ish.
    const effectiveWidth = IS_WEB ? Math.min(width, WEB_WIDE_MAX_WIDTH) : width;

    return {
      width,
      height,
      isTablet,
      isIPad,
      isWeb: IS_WEB,
      isDesktopWeb,
      scaleFactor,
      maxContentWidth,
      contentPadding,
      gridColumns,
      coverGridColumns,
      spineScale,
      isCompact: IS_WEB ? false : !isTablet,
      effectiveWidth,
    };
  }, [dimensions]);
}

// =============================================================================
// STATIC HELPERS (for non-hook usage)
// =============================================================================

/**
 * Get current responsive info without hook (snapshot)
 * Use this in non-component contexts, but prefer useResponsive() in components
 */
export function getResponsiveInfo(): ResponsiveInfo {
  const { width, height } = Dimensions.get('window');
  const isIPad = detectIsIPad(width, height);
  const isTablet = IS_WEB ? false : detectIsTablet(width, height);
  const isDesktopWeb = IS_WEB && width >= WEB_DESKTOP_BREAKPOINT;
  const scaleFactor = IS_WEB ? 1.0 : calculateScaleFactor(width, isTablet);
  const spineScale = IS_WEB ? 1.0 : calculateSpineScale(width, isTablet);
  const gridColumns = calculateGridColumns(width, isTablet);
  const coverGridColumns = calculateCoverGridColumns(width, isTablet);

  let maxContentWidth: number;
  if (IS_WEB) {
    maxContentWidth = isDesktopWeb ? WEB_CONTENT_MAX_WIDTH : width;
  } else {
    maxContentWidth = isIPad ? IPAD_MAX_CONTENT_WIDTH : MAX_CONTENT_WIDTH;
  }

  const shouldConstrain = (IS_WEB ? isDesktopWeb : isTablet) && width > maxContentWidth;
  const contentPadding = shouldConstrain ? (width - maxContentWidth) / 2 : 0;
  const effectiveWidth = IS_WEB ? Math.min(width, WEB_WIDE_MAX_WIDTH) : width;

  return {
    width,
    height,
    isTablet,
    isIPad,
    isWeb: IS_WEB,
    isDesktopWeb,
    scaleFactor,
    maxContentWidth,
    contentPadding,
    gridColumns,
    coverGridColumns,
    spineScale,
    isCompact: IS_WEB ? false : !isTablet,
    effectiveWidth,
  };
}

/**
 * Check if current device is iPad (static check)
 */
export function isIPad(): boolean {
  const { width, height } = Dimensions.get('window');
  return detectIsIPad(width, height);
}

/**
 * Check if current device is tablet (static check)
 */
export function isTablet(): boolean {
  const { width, height } = Dimensions.get('window');
  return detectIsTablet(width, height);
}
