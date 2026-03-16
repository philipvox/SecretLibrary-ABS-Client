/**
 * src/constants/layout.ts
 *
 * Layout constants for consistent spacing across the app.
 */

import { Dimensions } from 'react-native';
import { scale } from '@/shared/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const _hp = (percentage: number) => (percentage / 100) * SCREEN_HEIGHT;

// Top navigation is an overlay with gradient, so screens only need
// a small buffer below safe area insets (not the full nav height)
export const TOP_NAV_HEIGHT = 8;

// Bottom navigation bar height (FloatingTabBar)
// Standard: iOS 49pt, Android 56dp - we use 52 + safe area padding
export const BOTTOM_NAV_HEIGHT = 60;

// Mini player height when visible (matches GlobalMiniPlayer's GLOBAL_MINI_PLAYER_HEIGHT)
export const MINI_PLAYER_HEIGHT = scale(130);

// Combined bottom spacing needed for screens
// Nav bar + mini player + extra padding for comfortable scrolling
export const BOTTOM_TAB_HEIGHT = BOTTOM_NAV_HEIGHT + 8; // Just nav bar + padding
export const BOTTOM_PLAYER_OFFSET = MINI_PLAYER_HEIGHT + 8; // Mini player when visible

// Total bottom padding for scroll content (nav + mini player + padding)
// Use this in contentContainerStyle: { paddingBottom: SCREEN_BOTTOM_PADDING + insets.bottom }
export const SCREEN_BOTTOM_PADDING = BOTTOM_NAV_HEIGHT + MINI_PLAYER_HEIGHT + 50;

// Combined header offset for screens (just a small buffer since nav is overlay)
// This is used as padding-top for scroll content
export const SCREEN_TOP_OFFSET = TOP_NAV_HEIGHT + 8;
