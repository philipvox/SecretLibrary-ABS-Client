/**
 * src/shared/components/CoachMarksOverlay.tsx
 *
 * First-run coach marks — spotlights the biggest "you'd never guess this"
 * interactions with short tooltip text and simple animated illustrations.
 *
 * Illustrations are mostly white/cream on dark; orange is used sparingly
 * for UI chrome only (gesture label, active dot, Next button).
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  Image,
} from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scale } from '@/shared/theme';
import { haptics } from '@/core/native/haptics';
import { useCoachMarksStore } from '@/shared/stores/coachMarksStore';

// =============================================================================
// TIP DATA
// =============================================================================

interface CoachTip {
  id: string;
  title: string;
  description: string;
  gestureLabel: string;
}

const TIPS: CoachTip[] = [
  {
    id: 'hold-skull',
    title: 'Hold the Skull',
    description: 'Press and hold the skull logo to jump straight to Settings from anywhere.',
    gestureLabel: 'LONG PRESS',
  },
  {
    id: 'quick-bookmark',
    title: 'Quick Bookmarks',
    description: 'In the player, tap the bookmark pill to save your spot instantly. Hold it to see all your bookmarks.',
    gestureLabel: 'TAP · HOLD',
  },
  {
    id: 'star-ratings',
    title: 'Star Ratings',
    description: 'Double-tap any book cover to place gold star stickers. Double-tap a star to remove it.',
    gestureLabel: 'DOUBLE TAP',
  },
  {
    id: 'series-swipe',
    title: 'Browse the Series',
    description: 'On a book\'s detail page, swipe left or right to flip through other books in the series.',
    gestureLabel: 'SWIPE',
  },
  {
    id: 'my-library',
    title: 'My Library',
    description: 'Tap any book to open its menu, then tap Save to add it to your library. This creates a playlist on your server that stays in sync.',
    gestureLabel: 'TAP',
  },
  {
    id: 'my-series',
    title: 'My Series',
    description: 'On a series page, tap the heart to save the whole series. Every book in it appears in your library automatically.',
    gestureLabel: 'TAP',
  },
  {
    id: 'community-spines',
    title: 'Community Spines',
    description: 'Tap any book to open its menu, then tap the book icon to browse and pick a new spine design from the community.',
    gestureLabel: 'TAP',
  },
  {
    id: 'default-view',
    title: 'Choose Your View',
    description: 'Prefer covers over spines? Go to Display Settings and set your default view to Grid, List, or Shelf. Every screen will open that way.',
    gestureLabel: 'SETTINGS',
  },
];

// =============================================================================
// COLORS
// =============================================================================

const ACCENT = '#FF6B35';
const CARD_BG = '#1a1a1a';
const BACKDROP = 'rgba(0, 0, 0, 0.88)';
const TEXT_PRIMARY = '#e8e8e8';
const TEXT_SECONDARY = '#888888';
const ILL_WHITE = '#e8e8e8'; // Illustration primary (cream-white)
const ILL_DIM = 'rgba(255,255,255,0.25)'; // Illustration secondary (dimmed)
const GOLD = '#F3B60C'; // Only for actual star stickers
const STAR_IMAGE = require('../../../assets/stars/star5.webp');

// =============================================================================
// ANIMATION HELPERS
// =============================================================================

function useLoopAnim(duration: number) {
  const val = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(val, { toValue: 1, duration, useNativeDriver: true }),
        Animated.delay(300),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [val, duration]);
  return val;
}

// =============================================================================
// GESTURE ILLUSTRATIONS — mostly white, orange-free
// =============================================================================

/** The actual Secret Library skull logo, rendered in white */
function SkullIcon({ size = 56 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 189.47 189.47">
      <Path fill={ILL_WHITE} d="M105.18,30.63c-11.17,5.68-24.12,6.5-36.32,4.09,1.32-2.17,6.21-4.03,12.02-5.23.44.43.88.83,1.33,1.23.21.2.79.75.99.94,1.88,2.05,5.49,1.79,6.98-.58.6-.97,1.2-1.95,1.76-2.94,6.15-.26,11.56.44,13.24,2.49Z" />
      <Path fill={ILL_WHITE} d="M92.58,18.85v.06c-.1.87-.28,1.74-.54,2.57,0,.04-.02.06-.03.1-.04.14-.08.28-.13.43-.07.23-.15.46-.24.67-.35.93-.77,1.89-1.25,2.86-.11.23-.21.44-.33.65-.07.14-.15.28-.23.43-.33.58-.65,1.15-.99,1.71-.13.23-.26.44-.39.66-.01.01-.01.03-.03.04-.02.04-.03.06-.06.09-.01.02-.03.06-.05.09-.07.1-.13.2-.2.3,0,.01-.02.04-.03.05-.03.06-.07.11-.12.16-.08.09-.16.17-.23.24-.08.07-.17.13-.23.19t-.01.01c-.14.09-.28.16-.42.19-.08.02-.16.04-.24.06-.08.02-.16.03-.24.02-.05,0-.1,0-.17,0h-.01c-.47-.05-.93-.3-1.4-.67,0,0-.01,0-.01-.01-.29-.27-.6-.55-.89-.84h-.01s-.07-.07-.11-.11c-1.11-1.04-2.1-1.98-2.9-2.9-.13-.15-.25-.32-.37-.47-.01-.01-.02-.03-.02-.04-1.27-1.73-1.83-3.47-1.36-5.38,0-.03.02-.06.02-.09,0-.04.02-.06.03-.1.25-.78.66-1.61,1.26-2.52.07-.11.15-.22.23-.34.16-.21.33-.42.51-.64.21-.23.42-.48.66-.72h0c.65-.57,1.23-1.18,1.73-1.83.07-.1.14-.2.23-.31.6-.77,1.15-1.72,1.56-3.07.03-.09.06-.18.08-.28,0-.03.02-.05.02-.08.24-.79.4-1.63.46-2.48v-.18s.66-.18.66-.18c.33.45.67.92,1.01,1.37.3.42.59.84.9,1.27.54.78,1.09,1.57,1.56,2.39.26.42.49.84.71,1.27.21.39.4.78.57,1.2.1.23.2.46.28.7.08.19.14.37.21.57h0c.05.17.11.33.15.49.05.19.1.37.14.56,0,.05.02.09.03.15.06.26.11.54.15.82.02.21.05.43.07.64v.05c0,.05-.01.1,0,.16Z" />
      <Path fill={ILL_WHITE} d="M154.64,114.18c-.37-3.76-1.31-7.46-2.46-11.07-.64-2.02-1.25-4.16-2.16-6.07-1.85-3.88-5.23-6.54-7.85-10-3.91-5.22-6.83-11.26-10.7-16.6-.63-.89-1.89-.85-2.64-.06-.01,0-.01.01-.02.02-.92.79-2.07.95-3.04.95-2.85-.11-5.54-1.18-8.24-1.6-4.14-.71-8.04-.72-10.38,2.11-.32.42-.62.86-.86,1.34-1.25,2.83-4.32,4.66-7.29,4.89-8.11.84-13.25-5.28-20.51-1.81-2.37,1.02-5.4,2.86-8.36,2.99-4.72.37-8.78-2.84-13.36-1.89-1.19.37-2.77.89-4.17.93-2.31.28-4.54.99-7.08.43l-.6-.14c-1.65,1.78-3.17,3.66-4.51,5.62-.07.09-.13.19-.22.27l-.23.23s-.08.07-.13.12c-.65,1.09-1.27,2.18-1.83,3.31-.02.08-.07.13-.11.2-.75,1.41-1.37,2.79-1.93,4.21-5.64,15.05-6.3,20.7-.65,34.8,9.7,24.22,30.45,41.48,34.12,43.17,3.98,1.85,23.33-5,27.65-4.58,3.6.36,5.96,4.3,7.39,7.22.67,1.35,2.45,8.85,3.88,9.06.89.13,1.87-.16,2.91-.47.44-.13.86-.26,1.27-.34,1.44-.36,2.36-.7,2.85-.92-.28-.81-.67-1.87-.98-2.66-1.14-2.94-1.88-5.63-2.01-8.81,2.99-1.34,4.15,5.92,4.79,7.65.39,1.11.82,2.27,1.14,3.13,1.18-.35,3.08-.96,4.99-1.57,1.9-.64,3.81-1.26,4.96-1.67-.48-1.36-.81-2.8-1.4-4.1-.51-1.12-1.11-1.82-1.3-3.08-.12-.79-.6-5.69,1.35-4.5,1.25.76,1.68,2.6,2.06,3.9.41,1.43.97,2.65,1.43,4.05.29.88.75,2.2,1.09,2.91.42-.13.99-.27,1.66-.44,1.76-.47,5.47-1.43,7.09-1.95-.12-.6-.41-1.48-.77-2.69-.56-1.79-1.04-3.62-1.28-5.47-.09-.72-.04-1.44.62-2,.7-.6,3.33,5.98,3.59,6.54.54,1.13.78,2.42,2.04,2.6,1.57.26,3.2-.97,4.52-1.59,1.39-.68,2.87-1.23,3.36-2.85.72-2.43-.58-4.91-2.07-6.67-1.65-2-2.93-4.3-3.84-6.72-1.09-2.9-3.63-15.08-3.5-15.97.61-3.83,2.92-6.7,6.56-8.34,2.92-1.31,4.45-3.88,4.68-7.18.12-1.55-.12-3.15.19-4.68.29-1.5.47-2.59.3-4.18ZM112.28,126.14c-.35,13.26-15.48,23.48-27.03,11.4-6.92-6.92-7.95-20.42.99-26.01,10.82-7.04,25.02,2.1,26.06,14.38l-.02.23ZM125.73,142.21c-5.9-16.63-.51-18.6,5.09-1.25.99,3.11-4.09,4.42-5.09,1.25ZM146.64,124.67l-.13.15c-6.59,8.95-18.3,1.62-20.71-9.47-3.05-11.7,5.51-24.38,16.32-17.1,8.46,4.89,10.31,18.99,4.52,26.42Z" />
      <Path fill={ILL_WHITE} d="M127.43,65.65c.14,1.55.05,3.09-1.51,3.06,0,0-.02,0-.03,0-2.67-.14-5.21-1.28-7.87-1.84-4.34-1.11-9.91-1.44-12.98,2.49-.62.69-1.06,1.55-1.56,2.26-2.31,3.02-6.74,2.76-10.07,1.87-9.92-3.39-11.63-3.29-20.88,1.59-5.3,2.29-10.83-2.26-16.21-.57-1.77.72-3.42.92-5.27,1.22-1.61.32-3.18.65-4.68.47-2.98-3.62,13.84-16.58,18.36-19.16,1.26-.72,1.89-1.7,2.2-2.83,0-.03.02-.05.02-.08.07-.2.12-.42.15-.64.03-.19.05-.4.07-.61.11-1.05.07-2.16.1-3.25,0-.31,0-.62.03-.94.17-3.48.2-7.2.12-10.7-.04-.54.52-.9.99-.73,9.38,2.54,19.76,2.7,29.13-.33,3.01-.92,5.9-2.19,8.68-3.64.59.76.43,2,.33,3.32-.04,1.55.13,2.95.18,4.44l.25,4.38c.09,2.19.11,4.72,1.39,6.7,2.15,3.32,18.39,6.14,19.05,13.5Z" />
    </Svg>
  );
}

/** Long press — actual skull logo with subtle expanding ring */
function LongPressIllustration() {
  const t = useLoopAnim(2200);

  const ringScale = t.interpolate({
    inputRange: [0, 0.3, 0.8, 1],
    outputRange: [0.7, 1.3, 1.6, 0.7],
  });
  const ringOpacity = t.interpolate({
    inputRange: [0, 0.3, 0.8, 1],
    outputRange: [0.4, 0.2, 0, 0.4],
  });
  const skullScale = t.interpolate({
    inputRange: [0, 0.12, 0.8, 0.88, 1],
    outputRange: [1, 0.88, 0.88, 1, 1],
  });

  return (
    <View style={illStyles.container}>
      {/* Expanding ring — white, subtle */}
      <Animated.View
        style={[illStyles.ring, { transform: [{ scale: ringScale }], opacity: ringOpacity }]}
      />
      {/* Skull — presses down slightly during "hold" */}
      <Animated.View style={{ transform: [{ scale: skullScale }] }}>
        <SkullIcon size={scale(56)} />
      </Animated.View>
    </View>
  );
}

/** Bookmark icon (always visible), with tap ripple then hold ring around it */
function TapHoldIllustration() {
  const t = useLoopAnim(2800);

  // Phase 1 (0–0.25): Quick tap ripple
  const tapScale = t.interpolate({
    inputRange: [0, 0.08, 0.2, 0.25],
    outputRange: [0.4, 1.3, 1.5, 0.4],
  });
  const tapOpacity = t.interpolate({
    inputRange: [0, 0.08, 0.2, 0.25],
    outputRange: [0, 0.35, 0, 0],
  });
  // Phase 2 (0.35–0.85): Hold — slow expanding ring
  const holdRingScale = t.interpolate({
    inputRange: [0, 0.35, 0.5, 0.85, 0.95, 1],
    outputRange: [0.6, 0.6, 0.9, 1.5, 0.6, 0.6],
  });
  const holdRingOpacity = t.interpolate({
    inputRange: [0, 0.35, 0.45, 0.8, 0.9, 1],
    outputRange: [0, 0, 0.35, 0.1, 0, 0],
  });

  return (
    <View style={illStyles.container}>
      {/* Tap ripple */}
      <Animated.View
        style={[illStyles.ripple, { transform: [{ scale: tapScale }], opacity: tapOpacity }]}
      />
      {/* Hold ring */}
      <Animated.View
        style={[illStyles.ring, { transform: [{ scale: holdRingScale }], opacity: holdRingOpacity }]}
      />
      {/* Bookmark icon — always visible */}
      <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={ILL_WHITE} strokeWidth={1.5}>
        <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </Svg>
    </View>
  );
}

/** Double tap — mini book cover with actual gold star stickers popping in */
function DoubleTapIllustration() {
  const t = useLoopAnim(2400);

  // Tap 1
  const tap1Scale = t.interpolate({
    inputRange: [0, 0.06, 0.16, 0.2],
    outputRange: [0.3, 1.2, 1.4, 0.3],
  });
  const tap1Opacity = t.interpolate({
    inputRange: [0, 0.06, 0.16, 0.2],
    outputRange: [0, 0.3, 0, 0],
  });
  // Tap 2
  const tap2Scale = t.interpolate({
    inputRange: [0.18, 0.24, 0.34, 0.38],
    outputRange: [0.3, 1.2, 1.4, 0.3],
  });
  const tap2Opacity = t.interpolate({
    inputRange: [0.18, 0.24, 0.34, 0.38],
    outputRange: [0, 0.3, 0, 0],
  });
  // Star 1 pops in
  const star1Scale = t.interpolate({
    inputRange: [0.38, 0.48, 0.82, 0.95],
    outputRange: [0, 1.15, 1, 0],
  });
  const star1Opacity = t.interpolate({
    inputRange: [0.38, 0.48, 0.82, 0.95],
    outputRange: [0, 1, 1, 0],
  });
  // Star 2 pops in slightly later
  const star2Scale = t.interpolate({
    inputRange: [0.46, 0.56, 0.82, 0.95],
    outputRange: [0, 1.1, 1, 0],
  });
  const star2Opacity = t.interpolate({
    inputRange: [0.46, 0.56, 0.82, 0.95],
    outputRange: [0, 0.8, 0.8, 0],
  });

  return (
    <View style={illStyles.container}>
      {/* Mini book cover — rounded box */}
      <View style={illStyles.miniCover}>
        <View style={illStyles.coverLine1} />
        <View style={illStyles.coverLine2} />
        <View style={illStyles.coverLine3} />
      </View>
      {/* Tap ripples over the cover */}
      <Animated.View style={[illStyles.ripple, { transform: [{ scale: tap1Scale }], opacity: tap1Opacity }]} />
      <Animated.View style={[illStyles.ripple, { transform: [{ scale: tap2Scale }], opacity: tap2Opacity }]} />
      {/* Actual star stickers that pop in */}
      <Animated.View style={[illStyles.starPos1, { transform: [{ scale: star1Scale }], opacity: star1Opacity }]}>
        <Image source={STAR_IMAGE} style={illStyles.starImg} resizeMode="contain" />
      </Animated.View>
      <Animated.View style={[illStyles.starPos2, { transform: [{ scale: star2Scale }], opacity: star2Opacity }]}>
        <Image source={STAR_IMAGE} style={illStyles.starImgSmall} resizeMode="contain" />
      </Animated.View>
    </View>
  );
}

/** Swipe — book covers sliding left/right like browsing a series */
function SwipeIllustration() {
  const t = useLoopAnim(3000);

  // Slide the row left (one book), pause, slide back right
  const slideX = t.interpolate({
    inputRange: [0, 0.06, 0.32, 0.5, 0.56, 0.82, 1],
    outputRange: [0, 0, -30, -30, -30, 0, 0],
  });
  // Center book fades as it moves off-center
  const book2Opacity = t.interpolate({
    inputRange: [0, 0.12, 0.32, 0.5, 0.68, 0.82, 1],
    outputRange: [1, 1, 0.3, 0.3, 0.3, 1, 1],
  });
  // Right book becomes active as it slides to center
  const book3Opacity = t.interpolate({
    inputRange: [0, 0.12, 0.32, 0.5, 0.68, 0.82, 1],
    outputRange: [0.3, 0.3, 1, 1, 1, 0.3, 0.3],
  });

  const bookW = scale(22);
  const bookH = scale(34);
  const gap = scale(6);

  return (
    <View style={illStyles.container}>
      {/* Clip window so books slide in/out cleanly */}
      <View style={[illStyles.swipeClip, { width: bookW * 3 + gap * 2 + scale(4) }]}>
        <Animated.View style={[illStyles.booksRow, { transform: [{ translateX: slideX }] }]}>
          {/* Book 0 — off-screen left initially */}
          <View style={[illStyles.swipeBook, { width: bookW, height: bookH, marginRight: gap, opacity: 0.2 }]}>
            <Svg width={bookW * 0.5} height={2} viewBox="0 0 12 2"><Rect width={12} height={2} rx={1} fill={ILL_DIM} /></Svg>
          </View>
          {/* Book 1 — left */}
          <View style={[illStyles.swipeBook, { width: bookW, height: bookH, marginRight: gap, opacity: 0.3 }]}>
            <Svg width={bookW * 0.55} height={2} viewBox="0 0 12 2"><Rect width={12} height={2} rx={1} fill={ILL_WHITE} /></Svg>
            <Svg width={bookW * 0.4} height={2} viewBox="0 0 12 2" style={{ marginTop: 3 }}><Rect width={12} height={2} rx={1} fill={ILL_DIM} /></Svg>
          </View>
          {/* Book 2 — center (starts active) */}
          <Animated.View style={[illStyles.swipeBook, illStyles.swipeBookActive, { width: bookW, height: bookH, marginRight: gap, opacity: book2Opacity }]}>
            <Svg width={bookW * 0.55} height={2} viewBox="0 0 12 2"><Rect width={12} height={2} rx={1} fill={ILL_WHITE} /></Svg>
            <Svg width={bookW * 0.4} height={2} viewBox="0 0 12 2" style={{ marginTop: 3 }}><Rect width={12} height={2} rx={1} fill={ILL_DIM} /></Svg>
          </Animated.View>
          {/* Book 3 — right (becomes active after slide) */}
          <Animated.View style={[illStyles.swipeBook, { width: bookW, height: bookH, marginRight: gap, opacity: book3Opacity }]}>
            <Svg width={bookW * 0.55} height={2} viewBox="0 0 12 2"><Rect width={12} height={2} rx={1} fill={ILL_WHITE} /></Svg>
            <Svg width={bookW * 0.4} height={2} viewBox="0 0 12 2" style={{ marginTop: 3 }}><Rect width={12} height={2} rx={1} fill={ILL_DIM} /></Svg>
          </Animated.View>
          {/* Book 4 — far right */}
          <View style={[illStyles.swipeBook, { width: bookW, height: bookH, opacity: 0.15 }]}>
            <Svg width={bookW * 0.5} height={2} viewBox="0 0 12 2"><Rect width={12} height={2} rx={1} fill={ILL_DIM} /></Svg>
          </View>
        </Animated.View>
      </View>
      {/* Subtle chevrons on sides */}
      <View style={illStyles.chevronLeft}>
        <Svg width={8} height={14} viewBox="0 0 8 14" fill="none" stroke={ILL_DIM} strokeWidth={1.5}>
          <Path d="M7 1L1 7L7 13" />
        </Svg>
      </View>
      <View style={illStyles.chevronRight}>
        <Svg width={8} height={14} viewBox="0 0 8 14" fill="none" stroke={ILL_DIM} strokeWidth={1.5}>
          <Path d="M1 1L7 7L1 13" />
        </Svg>
      </View>
    </View>
  );
}

/** My Library — mini popup sheet slides up, Save icon highlights */
function MyLibraryIllustration() {
  const t = useLoopAnim(3000);

  // Phase 1: tap ripple on a book spine
  const tapScale = t.interpolate({
    inputRange: [0, 0.1, 0.2, 0.22],
    outputRange: [0.4, 1.3, 1.5, 0.4],
  });
  const tapOpacity = t.interpolate({
    inputRange: [0, 0.1, 0.2, 0.22],
    outputRange: [0, 0.3, 0, 0],
  });
  // Phase 2: mini popup sheet slides up
  const sheetY = t.interpolate({
    inputRange: [0.2, 0.35, 0.75, 0.88, 1],
    outputRange: [30, 0, 0, 30, 30],
  });
  const sheetOpacity = t.interpolate({
    inputRange: [0.2, 0.35, 0.75, 0.88, 1],
    outputRange: [0, 1, 1, 0, 0],
  });
  // Phase 3: Save icon highlights
  const saveHighlight = t.interpolate({
    inputRange: [0.4, 0.5, 0.65, 0.75, 0.88, 1],
    outputRange: [0, 1, 1, 1, 0, 0],
  });

  const iconSize = scale(14);

  return (
    <View style={illStyles.container}>
      {/* Book spine in background */}
      <View style={{
        position: 'absolute', top: scale(6),
        width: scale(14), height: scale(44), borderRadius: scale(3),
        backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
      }} />
      {/* Tap ripple */}
      <Animated.View
        style={[illStyles.ripple, { top: scale(20), transform: [{ scale: tapScale }], opacity: tapOpacity }]}
      />
      {/* Mini popup sheet */}
      <Animated.View style={{
        position: 'absolute', bottom: scale(4),
        transform: [{ translateY: sheetY }], opacity: sheetOpacity,
        backgroundColor: 'rgba(30,30,30,0.95)', borderRadius: scale(8),
        paddingHorizontal: scale(10), paddingVertical: scale(6),
        flexDirection: 'row', gap: scale(10), alignItems: 'center',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
      }}>
        {/* Queue icon placeholder */}
        <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke={ILL_DIM} strokeWidth={1.5}>
          <Path d="M12 5v14M5 12h14" />
        </Svg>
        {/* Save / Library icon — highlights on tap */}
        <Animated.View style={{ opacity: saveHighlight }}>
          <View style={{ backgroundColor: ACCENT, borderRadius: scale(4), padding: scale(2) }}>
            <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="#0f0f0f" strokeWidth={2}>
              <Path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <Path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </Svg>
          </View>
        </Animated.View>
        {/* Download icon placeholder */}
        <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke={ILL_DIM} strokeWidth={1.5}>
          <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
        </Svg>
      </Animated.View>
    </View>
  );
}

/** My Series — series stack with a heart badge */
function MySeriesIllustration() {
  const t = useLoopAnim(2800);

  // Heart badge pops in
  const heartScale = t.interpolate({
    inputRange: [0.3, 0.42, 0.52, 0.75, 0.88, 1],
    outputRange: [0, 1.2, 1, 1, 0, 0],
  });
  const heartOpacity = t.interpolate({
    inputRange: [0.3, 0.42, 0.75, 0.88, 1],
    outputRange: [0, 1, 1, 0, 0],
  });
  // Tap ripple
  const tapScale = t.interpolate({
    inputRange: [0, 0.12, 0.28, 0.32],
    outputRange: [0.4, 1.3, 1.5, 0.4],
  });
  const tapOpacity = t.interpolate({
    inputRange: [0, 0.12, 0.28, 0.32],
    outputRange: [0, 0.3, 0, 0],
  });
  // Books fan slightly on heart
  const fan = t.interpolate({
    inputRange: [0.35, 0.5, 0.75, 0.88, 1],
    outputRange: ['0deg', '-3deg', '-3deg', '0deg', '0deg'],
  });

  const bookW = scale(20);
  const bookH = scale(32);

  return (
    <View style={illStyles.container}>
      {/* Tap ripple */}
      <Animated.View
        style={[illStyles.ripple, { transform: [{ scale: tapScale }], opacity: tapOpacity }]}
      />
      {/* Stacked books (series) — slight offset to look like a stack */}
      <Animated.View style={{ transform: [{ rotate: fan }] }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
          {/* Back book */}
          <View style={{
            width: bookW, height: bookH, borderRadius: scale(3),
            backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.06)', marginRight: -scale(6),
          }} />
          {/* Middle book */}
          <View style={{
            width: bookW, height: bookH + scale(4), borderRadius: scale(3),
            backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.10)', marginRight: -scale(6),
            zIndex: 1,
          }} />
          {/* Front book */}
          <View style={{
            width: bookW, height: bookH + scale(8), borderRadius: scale(3),
            backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.15)', zIndex: 2,
            justifyContent: 'center', alignItems: 'center', gap: 2,
          }}>
            <Svg width={bookW * 0.55} height={2} viewBox="0 0 12 2"><Rect width={12} height={2} rx={1} fill={ILL_WHITE} /></Svg>
            <Svg width={bookW * 0.4} height={2} viewBox="0 0 12 2"><Rect width={12} height={2} rx={1} fill={ILL_DIM} /></Svg>
          </View>
        </View>
      </Animated.View>
      {/* Heart badge — pops in on top-right of the stack */}
      <Animated.View style={{
        position: 'absolute', top: scale(8), right: scale(16),
        transform: [{ scale: heartScale }], opacity: heartOpacity,
      }}>
        <Svg width={20} height={20} viewBox="0 0 24 24" fill={ACCENT} stroke={ACCENT} strokeWidth={1.5}>
          <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </Svg>
      </Animated.View>
    </View>
  );
}

/** Community Spines — tap book, popup appears, tap open-book icon, spine swaps */
function CommunitySpinesIllustration() {
  const t = useLoopAnim(3400);

  // Phase 1: tap ripple on spine
  const tapScale = t.interpolate({
    inputRange: [0, 0.1, 0.18, 0.2],
    outputRange: [0.4, 1.3, 1.5, 0.4],
  });
  const tapOpacity = t.interpolate({
    inputRange: [0, 0.1, 0.18, 0.2],
    outputRange: [0, 0.3, 0, 0],
  });
  // Phase 2: open-book icon pops in (the button in the popup)
  const iconScale = t.interpolate({
    inputRange: [0.22, 0.34, 0.42, 0.7, 0.82, 1],
    outputRange: [0, 1.15, 1, 1, 0, 0],
  });
  const iconOpacity = t.interpolate({
    inputRange: [0.22, 0.34, 0.7, 0.82, 1],
    outputRange: [0, 1, 1, 0, 0],
  });
  // Phase 3: second tap ripple on the icon
  const tap2Scale = t.interpolate({
    inputRange: [0.42, 0.5, 0.56, 0.58],
    outputRange: [0.4, 1.2, 1.4, 0.4],
  });
  const tap2Opacity = t.interpolate({
    inputRange: [0.42, 0.5, 0.56, 0.58],
    outputRange: [0, 0.25, 0, 0],
  });
  // Phase 4: spine switches design (color swap)
  const spine1Opacity = t.interpolate({
    inputRange: [0, 0.55, 0.62, 0.7, 0.82, 1],
    outputRange: [1, 1, 0, 0, 1, 1],
  });
  const spine2Opacity = t.interpolate({
    inputRange: [0, 0.55, 0.62, 0.7, 0.82, 1],
    outputRange: [0, 0, 1, 1, 0, 0],
  });

  const spineW = scale(16);
  const spineH = scale(56);

  return (
    <View style={illStyles.container}>
      {/* Tap ripple on spine */}
      <Animated.View
        style={[illStyles.ripple, { transform: [{ scale: tapScale }], opacity: tapOpacity }]}
      />
      {/* Spine design A */}
      <Animated.View style={{ position: 'absolute', opacity: spine1Opacity }}>
        <View style={{
          width: spineW, height: spineH, borderRadius: scale(3),
          backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.12)',
          justifyContent: 'center', alignItems: 'center',
        }}>
          <View style={{ width: spineW * 0.5, height: 2, borderRadius: 1, backgroundColor: ILL_WHITE, marginBottom: 3 }} />
          <View style={{ width: spineW * 0.35, height: 2, borderRadius: 1, backgroundColor: ILL_DIM }} />
        </View>
      </Animated.View>
      {/* Spine design B (swapped in after picking) */}
      <Animated.View style={{ position: 'absolute', opacity: spine2Opacity }}>
        <View style={{
          width: spineW, height: spineH, borderRadius: scale(3),
          backgroundColor: 'rgba(255,107,53,0.25)', borderWidth: 1,
          borderColor: ACCENT,
          justifyContent: 'center', alignItems: 'center',
        }}>
          <View style={{ width: spineW * 0.5, height: 2, borderRadius: 1, backgroundColor: ILL_WHITE, marginBottom: 3 }} />
          <View style={{ width: spineW * 0.35, height: 2, borderRadius: 1, backgroundColor: ILL_WHITE, opacity: 0.5 }} />
        </View>
      </Animated.View>
      {/* Open-book icon — pops in then gets tapped */}
      <Animated.View style={{
        position: 'absolute', top: scale(8), right: scale(14),
        transform: [{ scale: iconScale }], opacity: iconOpacity,
      }}>
        <View style={{
          backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: scale(12),
          width: scale(24), height: scale(24), borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.25)',
          justifyContent: 'center', alignItems: 'center',
        }}>
          {/* Spines icon — three vertical bars of different heights */}
          <Svg width={12} height={12} viewBox="0 0 12 12">
            <Rect x={1.5} y={4} width={2.5} height={6} rx={0.5} fill={ILL_WHITE} />
            <Rect x={5} y={2} width={2.5} height={8} rx={0.5} fill={ILL_WHITE} />
            <Rect x={8.5} y={3} width={2.5} height={7} rx={0.5} fill={ILL_WHITE} />
          </Svg>
        </View>
      </Animated.View>
      {/* Second tap ripple on the icon */}
      <Animated.View style={{
        position: 'absolute', top: scale(8), right: scale(14),
        width: scale(22), height: scale(22), borderRadius: scale(11),
        transform: [{ scale: tap2Scale }], opacity: tap2Opacity,
        backgroundColor: ILL_DIM,
      }} />
    </View>
  );
}

/** Default view — three view mode columns cycle with sliding highlight */
function DefaultViewIllustration() {
  const t = useLoopAnim(3200);

  const iconSize = scale(22);
  const colW = scale(26);        // Each column width
  const colGap = scale(2);       // Gap between columns
  const ringSize = colW + scale(4);
  // Total row width = 3 columns + 2 gaps
  const rowW = colW * 3 + colGap * 2;

  // Each mode gets a ~1s hold with smooth transitions
  // shelf: 0–0.30, transition: 0.30–0.36, grid: 0.36–0.63, transition: 0.63–0.69, list: 0.69–0.93, transition: 0.93–1
  const shelfOpacity = t.interpolate({
    inputRange: [0, 0.28, 0.36, 0.90, 1],
    outputRange: [1, 1, 0.2, 0.2, 1],
  });
  const gridOpacity = t.interpolate({
    inputRange: [0, 0.28, 0.36, 0.61, 0.69, 1],
    outputRange: [0.2, 0.2, 1, 1, 0.2, 0.2],
  });
  const listOpacity = t.interpolate({
    inputRange: [0, 0.61, 0.69, 0.90, 1],
    outputRange: [0.2, 0.2, 1, 1, 0.2],
  });

  // Active icon scales up slightly
  const shelfScale = t.interpolate({
    inputRange: [0, 0.28, 0.36, 0.90, 1],
    outputRange: [1.15, 1.15, 1, 1, 1.15],
  });
  const gridScale = t.interpolate({
    inputRange: [0, 0.28, 0.36, 0.61, 0.69, 1],
    outputRange: [1, 1, 1.15, 1.15, 1, 1],
  });
  const listScale = t.interpolate({
    inputRange: [0, 0.61, 0.69, 0.90, 1],
    outputRange: [1, 1, 1.15, 1.15, 1],
  });

  // Highlight ring translateX: center of col 0, 1, 2
  const col0X = 0;
  const col1X = colW + colGap;
  const col2X = (colW + colGap) * 2;
  const ringX = t.interpolate({
    inputRange: [0, 0.30, 0.36, 0.63, 0.69, 0.93, 1],
    outputRange: [col0X, col0X, col1X, col1X, col2X, col2X, col0X],
  });

  return (
    <View style={illStyles.container}>
      {/* Icons + labels row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: colGap }}>
        {/* Shelf column */}
        <Animated.View style={{ width: colW, alignItems: 'center', opacity: shelfOpacity, transform: [{ scale: shelfScale }] }}>
          <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill={ILL_WHITE}>
            <Rect x={4} y={4} width={3.5} height={13} rx={1} />
            <Rect x={10} y={6} width={3.5} height={11} rx={1} />
            <Rect x={16} y={3} width={3.5} height={14} rx={1} />
            <Rect x={3} y={18} width={18} height={2} rx={0.5} />
          </Svg>
          <Text style={{ color: ILL_WHITE, fontSize: scale(7), fontWeight: '600', marginTop: scale(5) }}>Shelf</Text>
        </Animated.View>
        {/* Grid column */}
        <Animated.View style={{ width: colW, alignItems: 'center', opacity: gridOpacity, transform: [{ scale: gridScale }] }}>
          <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill={ILL_WHITE}>
            <Rect x={3} y={3} width={8} height={8} rx={1.5} />
            <Rect x={13} y={3} width={8} height={8} rx={1.5} />
            <Rect x={3} y={13} width={8} height={8} rx={1.5} />
            <Rect x={13} y={13} width={8} height={8} rx={1.5} />
          </Svg>
          <Text style={{ color: ILL_WHITE, fontSize: scale(7), fontWeight: '600', marginTop: scale(5) }}>Grid</Text>
        </Animated.View>
        {/* List column */}
        <Animated.View style={{ width: colW, alignItems: 'center', opacity: listOpacity, transform: [{ scale: listScale }] }}>
          <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill={ILL_WHITE}>
            <Rect x={3} y={4.5} width={3} height={3} rx={1.5} />
            <Rect x={3} y={10.5} width={3} height={3} rx={1.5} />
            <Rect x={3} y={16.5} width={3} height={3} rx={1.5} />
            <Rect x={8} y={5} width={13} height={2} rx={1} />
            <Rect x={8} y={11} width={13} height={2} rx={1} />
            <Rect x={8} y={17} width={13} height={2} rx={1} />
          </Svg>
          <Text style={{ color: ILL_WHITE, fontSize: scale(7), fontWeight: '600', marginTop: scale(5) }}>List</Text>
        </Animated.View>
      </View>
      {/* Sliding highlight ring — positioned behind icons */}
      <Animated.View style={{
        position: 'absolute',
        width: ringSize, height: ringSize,
        borderRadius: scale(8), borderWidth: 1.5,
        borderColor: ILL_WHITE,
        top: (scale(90) - ringSize) / 2 - scale(5),
        left: (scale(90) - rowW) / 2 - (ringSize - colW) / 2,
        transform: [{ translateX: ringX }],
      }} />
    </View>
  );
}

const ILLUSTRATIONS: Record<string, React.ComponentType> = {
  'hold-skull': LongPressIllustration,
  'quick-bookmark': TapHoldIllustration,
  'star-ratings': DoubleTapIllustration,
  'series-swipe': SwipeIllustration,
  'my-library': MyLibraryIllustration,
  'my-series': MySeriesIllustration,
  'community-spines': CommunitySpinesIllustration,
  'default-view': DefaultViewIllustration,
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

interface CoachMarksOverlayProps {
  onComplete: () => void;
}

export function CoachMarksOverlay({ onComplete }: CoachMarksOverlayProps) {
  const insets = useSafeAreaInsets();
  const markAsSeen = useCoachMarksStore((s) => s.markAsSeen);

  const [currentStep, setCurrentStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const cardAnim = useRef(new Animated.Value(0)).current;

  const tip = TIPS[currentStep];
  const isLast = currentStep === TIPS.length - 1;
  const Illustration = ILLUSTRATIONS[tip.id];

  // Entrance animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(cardAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, cardAnim]);

  const transitionTo = useCallback(
    (nextStep: number) => {
      Animated.timing(cardAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setCurrentStep(nextStep);
        Animated.spring(cardAnim, { toValue: 1, friction: 8, tension: 50, useNativeDriver: true }).start();
      });
    },
    [cardAnim]
  );

  const handleNext = useCallback(() => {
    haptics.selection();
    if (isLast) {
      handleDismiss();
    } else {
      transitionTo(currentStep + 1);
    }
  }, [isLast, currentStep, transitionTo]);

  const handleDismiss = useCallback(() => {
    haptics.buttonPress();
    markAsSeen();
    Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
      onComplete();
    });
  }, [fadeAnim, markAsSeen, onComplete]);

  const cardScale = cardAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1],
  });

  return (
    <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
      <View style={[styles.centeredContainer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Animated.View
          style={[
            styles.card,
            { opacity: cardAnim, transform: [{ scale: cardScale }] },
          ]}
        >
          {/* Gesture label — orange */}
          <Text style={styles.gestureLabel}>{tip.gestureLabel}</Text>

          {/* Illustration */}
          <View style={styles.illustrationWrap}>
            {Illustration && <Illustration />}
          </View>

          {/* Title */}
          <Text style={styles.title}>{tip.title}</Text>

          {/* Description */}
          <Text style={styles.description}>{tip.description}</Text>

          {/* Step dots */}
          <View style={styles.dotsRow}>
            {TIPS.map((_, i) => (
              <View
                key={i}
                style={[styles.dot_indicator, i === currentStep && styles.dot_active]}
              />
            ))}
          </View>

          {/* Buttons */}
          <View style={styles.buttonRow}>
            {!isLast ? (
              <TouchableOpacity onPress={handleDismiss} style={styles.skipButton} activeOpacity={0.7}>
                <Text style={styles.skipText}>Skip All</Text>
              </TouchableOpacity>
            ) : (
              <View />
            )}
            <TouchableOpacity onPress={handleNext} style={styles.nextButton} activeOpacity={0.8}>
              <Text style={styles.nextText}>{isLast ? 'Got It' : 'Next'}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BACKDROP,
    zIndex: 99999,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(28),
  },
  card: {
    width: '100%',
    maxWidth: scale(340),
    backgroundColor: CARD_BG,
    borderRadius: scale(20),
    paddingHorizontal: scale(28),
    paddingTop: scale(28),
    paddingBottom: scale(24),
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  gestureLabel: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: scale(10),
    letterSpacing: 2,
    color: ACCENT,
    marginBottom: scale(16),
  },
  illustrationWrap: {
    width: scale(90),
    height: scale(90),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: scale(20),
  },
  title: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: scale(24),
    fontWeight: '400',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: scale(10),
  },
  description: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: scale(14),
    fontStyle: 'italic',
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: scale(22),
    marginBottom: scale(24),
    paddingHorizontal: scale(4),
  },
  dotsRow: {
    flexDirection: 'row',
    gap: scale(6),
    marginBottom: scale(20),
  },
  dot_indicator: {
    width: scale(6),
    height: scale(6),
    borderRadius: scale(3),
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  dot_active: {
    backgroundColor: ACCENT,
    width: scale(18),
    borderRadius: scale(3),
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  skipButton: {
    paddingVertical: scale(10),
    paddingHorizontal: scale(4),
  },
  skipText: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: scale(11),
    color: TEXT_SECONDARY,
  },
  nextButton: {
    backgroundColor: ACCENT,
    paddingVertical: scale(10),
    paddingHorizontal: scale(24),
    borderRadius: scale(8),
  },
  nextText: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: scale(12),
    fontWeight: '600',
    color: '#0f0f0f',
    letterSpacing: 0.5,
  },
});

// =============================================================================
// ILLUSTRATION STYLES
// =============================================================================

const illStyles = StyleSheet.create({
  container: {
    width: scale(90),
    height: scale(90),
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Expanding ring — white, not orange
  ring: {
    position: 'absolute',
    width: scale(60),
    height: scale(60),
    borderRadius: scale(30),
    borderWidth: 1.5,
    borderColor: ILL_WHITE,
  },
  // Tap ripple — white, soft
  ripple: {
    position: 'absolute',
    width: scale(44),
    height: scale(44),
    borderRadius: scale(22),
    backgroundColor: ILL_DIM,
  },
  // Mini book cover for double-tap illustration
  miniCover: {
    width: scale(48),
    height: scale(68),
    borderRadius: scale(6),
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: scale(4),
  },
  coverLine1: {
    width: scale(24),
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  coverLine2: {
    width: scale(18),
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  coverLine3: {
    width: scale(20),
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.10)',
    marginTop: scale(2),
  },
  // Star sticker positions on the cover
  starPos1: {
    position: 'absolute',
    top: scale(10),
    right: scale(12),
  },
  starPos2: {
    position: 'absolute',
    bottom: scale(18),
    left: scale(14),
  },
  starImg: {
    width: scale(26),
    height: scale(26),
  },
  starImgSmall: {
    width: scale(18),
    height: scale(18),
    transform: [{ rotate: '20deg' }],
  },
  // Swipe — book covers sliding
  swipeClip: {
    overflow: 'hidden',
    height: scale(40),
    justifyContent: 'center',
    alignItems: 'center',
  },
  booksRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  swipeBook: {
    borderRadius: scale(4),
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  swipeBookActive: {
    borderColor: 'rgba(255,255,255,0.25)',
  },
  chevronLeft: {
    position: 'absolute',
    left: scale(2),
  },
  chevronRight: {
    position: 'absolute',
    right: scale(2),
  },
});
