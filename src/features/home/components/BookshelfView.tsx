/**
 * src/features/home/components/BookshelfView.tsx
 *
 * Bookshelf view with two layout modes:
 * - 'shelf': Books stand upright, horizontal scroll with domino animation
 * - 'stack': Books rotated 90°, stacked vertically (static rotation like DiscoverMoreCard)
 *
 * Stack mode uses simple CSS rotation approach for reliable rendering.
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { BookSpineVertical, BookSpineVerticalData } from './BookSpineVertical';
import { DiscoverMoreCard, RecommendedBook } from './DiscoverMoreCard';
import { secretLibraryColors as staticColors } from '@/shared/theme/secretLibrary';
import { scale, useSecretLibraryColors } from '@/shared/theme';
// MIGRATED: Now using new spine system via adapter
import { getSpineDimensions, calculateBookDimensions, hashString, MIN_TOUCH_TARGET, isLightColor, darkenColorForDisplay } from '../utils/spine/adapter';
import { HEIGHT_SCALE } from '../utils/spine/constants';
import { useSpineCacheStore } from '../stores/spineCache';
import { haptics } from '@/core/native/haptics';

// =============================================================================
// TYPES
// =============================================================================

export type LayoutMode = 'shelf' | 'stack';
type AnimationPhase = 'idle' | 'switching' | 'entering';

interface BookshelfViewProps {
  books: BookSpineVerticalData[];
  onBookPress: (book: BookSpineVerticalData) => void;
  layoutMode?: LayoutMode;
  bottomPadding?: number;
  /** Recommended books to show in "Find More" card */
  recommendations?: RecommendedBook[];
  /** Callback when "Find More" card is pressed */
  onDiscoverPress?: () => void;
  /** Callback when a recommended book spine is pressed */
  onRecommendationPress?: (book: RecommendedBook) => void;
}

interface BookInfo {
  width: number;
  height: number;
  touchPadding: number;
  leanAngle: number;
  shouldLean: boolean;
}

// =============================================================================
// SCREEN & SCALING - Dynamic based on device size
// =============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Base spine dimensions (unscaled - HEIGHT_SCALE applied via SHELF_SCALE_FACTOR)
const BASE_MAX_HEIGHT = 450;  // Tallest genre base (Fantasy)
const BASE_MAX_WIDTH = 200;    // Thickest (30+ hour books)

// Scale factors - HEIGHT_SCALE directly controls book height
// HEIGHT_SCALE = 1.0 → normal size, 1.5 → 50% taller, etc.
const SHELF_SCALE_FACTOR = HEIGHT_SCALE;
const STACK_SCALE_FACTOR = HEIGHT_SCALE * 0.45;  // Stack mode is smaller
const THICKNESS_MULTIPLIER = 1;

// Layout constants
const SHELF_PADDING_H = 16;
const BOOK_GAP = Math.round(8 * SHELF_SCALE_FACTOR);
const LEAN_ANGLE = 3;
const STACK_GAP = 8;

// Safety clamps - maximum dimensions even after scaling
const SHELF_MAX_HEIGHT = SCREEN_HEIGHT * 2;
const STACK_MAX_HEIGHT = SCREEN_HEIGHT * 2;
const MAX_SCALED_WIDTH = 120;

// Animation timing
const DOMINO_DELAY = 25;      // ms between each book
const ENTER_DURATION = 180;   // ms for enter animation

// Easing
const ENTER_EASING = Easing.out(Easing.back(1.2)); // Bounce in

// Debug logging (dev only)
if (__DEV__) {
  console.log('[BookshelfView] Screen:', SCREEN_WIDTH, 'x', SCREEN_HEIGHT);
  console.log('[BookshelfView] SHELF_SCALE_FACTOR:', SHELF_SCALE_FACTOR.toFixed(3));
  console.log('[BookshelfView] STACK_SCALE_FACTOR:', STACK_SCALE_FACTOR.toFixed(3));
  console.log('[BookshelfView] Shelf max height:', Math.round(BASE_MAX_HEIGHT * SHELF_SCALE_FACTOR));
  console.log('[BookshelfView] Stack max height:', Math.round(BASE_MAX_HEIGHT * STACK_SCALE_FACTOR));
}

// =============================================================================
// STATIC STACK ITEM (DiscoverMoreCard approach)
// =============================================================================

/**
 * Static horizontal spine wrapper for stack mode.
 * Uses simple CSS rotation (90°) like DiscoverMoreCard.
 * Container dimensions are swapped (height becomes width, width becomes height).
 */
interface StaticStackItemProps {
  book: BookSpineVerticalData;
  spineWidth: number;
  spineHeight: number;
  onPress: (book: BookSpineVerticalData) => void;
}

// Minimum thickness for stack mode spines (prevents invisible thin lines)
const STACK_MIN_THICKNESS = 35;

const StaticStackItem = React.memo(function StaticStackItem({
  book,
  spineWidth,
  spineHeight,
  onPress,
}: StaticStackItemProps) {
  // Re-scale from shelf dimensions to stack dimensions
  // Input dimensions are scaled with SHELF_SCALE_FACTOR, convert to STACK_SCALE_FACTOR
  const stackToShelfRatio = STACK_SCALE_FACTOR / SHELF_SCALE_FACTOR;
  const scaledWidth = Math.max(spineWidth * stackToShelfRatio, STACK_MIN_THICKNESS);  // Enforce minimum thickness
  const scaledHeight = spineHeight * stackToShelfRatio;

  // After 90° rotation: spine height becomes container width, spine width becomes container height
  const containerWidth = scaledHeight;
  const containerHeight = scaledWidth;

  const handlePress = useCallback(() => {
    haptics.selection();
    onPress(book);
  }, [book, onPress]);

  return (
    <View style={[styles.stackItemContainer, { width: containerWidth, height: containerHeight }]}>
      <View
        style={[
          styles.stackItemRotator,
          {
            width: scaledWidth,
            height: scaledHeight,
            // Center the rotated element within the container
            marginLeft: (containerWidth - scaledWidth) / 2,
            marginTop: (containerHeight - scaledHeight) / 2,
          },
        ]}
      >
        <BookSpineVertical
          book={book}
          width={scaledWidth}
          height={scaledHeight}
          leanAngle={0}
          isActive={false}
          showShadow={false}
          onPress={handlePress}
          isHorizontalDisplay={true}
        />
      </View>
    </View>
  );
});

// =============================================================================
// ANIMATED BOOK WRAPPER (for shelf mode)
// =============================================================================

interface AnimatedBookWrapperProps {
  book: BookSpineVerticalData;
  info: BookInfo;
  index: number;
  totalBooks: number;
  phase: AnimationPhase;
  isActive: boolean;
  onPress: (book: BookSpineVerticalData) => void;
  onPressIn: (index: number) => void;
  onPressOut: () => void;
}

const AnimatedBookWrapper = React.memo(function AnimatedBookWrapper({
  book,
  info,
  index,
  totalBooks,
  phase,
  isActive,
  onPress,
  onPressIn,
  onPressOut,
}: AnimatedBookWrapperProps) {
  // Animation values for shelf mode only
  const opacity = useSharedValue(1);
  const translateY = useSharedValue(0);

  // Local press handler that passes index
  const handlePressIn = useCallback(() => {
    onPressIn(index);
  }, [onPressIn, index]);

  useEffect(() => {
    if (phase === 'switching') {
      // Hide instantly
      opacity.value = 0;
    } else if (phase === 'entering') {
      // ENTER: Fall from top with domino effect
      const delay = index * DOMINO_DELAY;

      // Set initial state instantly (while invisible)
      opacity.value = 0;
      translateY.value = -300;

      // Animate in
      translateY.value = withDelay(
        delay,
        withTiming(0, { duration: ENTER_DURATION, easing: ENTER_EASING })
      );
      opacity.value = withDelay(
        delay,
        withTiming(1, { duration: ENTER_DURATION })
      );
    }
  }, [phase, index, totalBooks, info.leanAngle]);

  // Animated style - shelf mode only (upright books)
  const containerStyle = useAnimatedStyle(() => {
    return {
      width: info.width,
      height: info.height,
      opacity: opacity.value,
      transform: [
        { translateY: translateY.value },
        { rotate: `${info.leanAngle}deg` },
      ],
    };
  });

  return (
    <Animated.View style={[styles.bookContainer, containerStyle]}>
      <BookSpineVertical
        book={book}
        width={info.width}
        height={info.height}
        leanAngle={0}
        isActive={isActive}
        isPushedLeft={false}
        isPushedRight={false}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={onPressOut}
        showShadow={false}
      />
    </Animated.View>
  );
});

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function BookshelfView({
  books,
  onBookPress,
  layoutMode = 'shelf',
  bottomPadding = 0,
  recommendations = [],
  onDiscoverPress,
  onRecommendationPress,
}: BookshelfViewProps) {
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  // Theme-aware colors
  const colors = useSecretLibraryColors();

  // Animation state
  const [phase, setPhase] = useState<AnimationPhase>('idle');
  const [displayMode, setDisplayMode] = useState<LayoutMode>(layoutMode);
  const isFirstRender = useRef(true);

  // Handle mode transitions
  useEffect(() => {
    // Skip animation on first render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setDisplayMode(layoutMode);
      return;
    }

    if (layoutMode === displayMode) return;

    // Stack mode is instant (static), shelf mode has domino animation
    if (layoutMode === 'stack') {
      // Instant switch to stack mode
      setDisplayMode(layoutMode);
      setPhase('idle');
      return;
    }

    // Switching to shelf mode - animate with domino effect
    setPhase('switching');

    const switchTimer = setTimeout(() => {
      setDisplayMode(layoutMode);
      setPhase('entering');
    }, 10);

    // Back to idle after enter completes
    const enterTime = ((books.length - 1) * DOMINO_DELAY) + ENTER_DURATION + 20;
    const idleTimer = setTimeout(() => {
      setPhase('idle');
    }, enterTime);

    return () => {
      clearTimeout(switchTimer);
      clearTimeout(idleTimer);
    };
  }, [layoutMode, books.length, displayMode]);

  // Get spine cache for fast lookups
  const getSpineData = useSpineCacheStore((state) => state.getSpineData);
  // Subscribe to colorVersion to trigger re-render when colors are extracted
  const colorVersion = useSpineCacheStore((state) => state.colorVersion);

  // Calculate book dimensions - uses cache when available
  const bookInfo = useMemo(() => {
    let nextLeanAt = 5;
    const totalBooks = books.length;
    const isLastIndex = (index: number) => index === totalBooks - 1;

    return books.map((book, index) => {
      // Try to get from cache first
      const cached = getSpineData(book.id);

      let dims;
      let bookHash: number;

      if (cached) {
        // Use cached dimensions with safety clamping
        const scaledWidth = Math.min(
          cached.baseWidth * SHELF_SCALE_FACTOR * THICKNESS_MULTIPLIER,
          MAX_SCALED_WIDTH
        );
        const scaledHeight = Math.min(
          cached.baseHeight * SHELF_SCALE_FACTOR,
          SHELF_MAX_HEIGHT
        );
        const touchPadding = Math.max(0, Math.ceil((MIN_TOUCH_TARGET - scaledWidth) / 2));
        dims = {
          width: scaledWidth,
          height: scaledHeight,
          touchPadding,
        };
        bookHash = cached.hash;
      } else {
        // Fallback: calculate on the fly
        const genres = book.genres || [];
        const tags = book.tags || [];
        const duration = book.duration || 6 * 60 * 60;
        const hasGenreData = genres.length > 0 || tags.length > 0;

        if (hasGenreData) {
          const calculated = calculateBookDimensions({
            id: book.id,
            genres,
            tags,
            duration,
            seriesName: book.seriesName,
          });
          const scaledWidth = Math.min(
            calculated.width * SHELF_SCALE_FACTOR * THICKNESS_MULTIPLIER,
            MAX_SCALED_WIDTH
          );
          const scaledHeight = Math.min(
            calculated.height * SHELF_SCALE_FACTOR,
            SHELF_MAX_HEIGHT
          );
          const touchPadding = Math.max(0, Math.ceil((MIN_TOUCH_TARGET - scaledWidth) / 2));
          dims = {
            width: scaledWidth,
            height: scaledHeight,
            touchPadding
          };
        } else {
          const baseDims = getSpineDimensions(book.id, genres, duration, book.seriesName);
          dims = {
            width: Math.min(baseDims.width * SHELF_SCALE_FACTOR * THICKNESS_MULTIPLIER, MAX_SCALED_WIDTH),
            height: Math.min(baseDims.height * SHELF_SCALE_FACTOR, SHELF_MAX_HEIGHT),
            touchPadding: baseDims.touchPadding,
          };
        }
        bookHash = hashString(book.id);
      }

      // Last book always leans LEFT
      if (isLastIndex(index) && totalBooks > 1) {
        return { ...dims, leanAngle: -LEAN_ANGLE, shouldLean: true };
      }

      const shouldLean = index === nextLeanAt && !isLastIndex(index);
      if (shouldLean) {
        nextLeanAt = index + 5 + (bookHash % 5);
      }

      const leanAngle = shouldLean ? ((bookHash % 2 === 0) ? LEAN_ANGLE : -LEAN_ANGLE) : 0;

      return { ...dims, leanAngle, shouldLean };
    });
  }, [books, getSpineData]);

  // Enrich books with cached colors for efficient rendering
  // Apply darkening to light colors for the grey background theme
  const enrichedBooks = useMemo(() => {
    return books.map((book) => {
      // Skip if already has colors
      if (book.backgroundColor && book.textColor) {
        // Still need to darken if light
        if (isLightColor(book.backgroundColor)) {
          const darkened = darkenColorForDisplay(book.backgroundColor);
          return {
            ...book,
            backgroundColor: darkened,
            textColor: staticColors.white, // Light text on dark background
          };
        }
        return book;
      }

      // Get colors from cache
      const cached = getSpineData(book.id);
      if (cached) {
        let bgColor = cached.backgroundColor;
        let txtColor = cached.textColor;

        // If cached color is light, darken it for grey background
        if (isLightColor(bgColor)) {
          bgColor = darkenColorForDisplay(bgColor);
          txtColor = staticColors.white; // Light text on dark background
        }

        return {
          ...book,
          backgroundColor: bgColor,
          textColor: txtColor,
        };
      }
      return book;
    });
  }, [books, getSpineData, colorVersion]);

  const handlePressIn = useCallback((index: number) => setActiveIndex(index), []);
  const handlePressOut = useCallback(() => setActiveIndex(null), []);
  const handlePress = useCallback((book: BookSpineVerticalData) => {
    setActiveIndex(null);
    onBookPress(book);
  }, [onBookPress]);

  const isStackMode = displayMode === 'stack';

  return (
    <View style={[styles.container, { backgroundColor: colors.white }, !isStackMode && { paddingBottom: bottomPadding }]}>
      <ScrollView
        horizontal={!isStackMode}
        style={styles.scrollView}
        contentContainerStyle={[
          isStackMode ? styles.scrollContentStack : styles.scrollContentShelf,
          !isStackMode && {
            paddingRight: insets.right + SHELF_PADDING_H,
            paddingBottom: insets.bottom,
          },
          isStackMode && {
            paddingBottom: insets.bottom + bottomPadding + 20,
            paddingTop: 20,
          },
        ]}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      >
        {/* Shelf mode: Animated upright spines */}
        {!isStackMode && enrichedBooks.map((book, index) => (
          <AnimatedBookWrapper
            key={book.id}
            book={book}
            info={bookInfo[index]}
            index={index}
            totalBooks={enrichedBooks.length}
            phase={phase}
            isActive={activeIndex === index}
            onPress={handlePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
          />
        ))}

        {/* Stack mode: Static horizontal spines (DiscoverMoreCard approach) */}
        {isStackMode && enrichedBooks.map((book, index) => (
          <StaticStackItem
            key={book.id}
            book={book}
            spineWidth={bookInfo[index]?.width || 40}
            spineHeight={bookInfo[index]?.height || 300}
            onPress={handlePress}
          />
        ))}

        {/* "Find More Books" card - only in shelf mode */}
        {!isStackMode && onDiscoverPress && recommendations.length > 0 && (
          <DiscoverMoreCard
            recommendations={recommendations}
            onPress={onDiscoverPress}
            onBookPress={onRecommendationPress}
            height={bookInfo[0]?.height || 320}
          />
        )}
      </ScrollView>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: staticColors.grayLight,
    overflow: 'hidden',
  },
  scrollView: {
    flex: 1,
  },
  scrollContentShelf: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingLeft: SHELF_PADDING_H,
    paddingBottom: scale(40),
    gap: BOOK_GAP,
    minHeight: '100%',
  },
  scrollContentStack: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexGrow: 1,
    paddingHorizontal: SHELF_PADDING_H,
    gap: STACK_GAP,
  },
  bookContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Static stack item styles (DiscoverMoreCard approach)
  stackItemContainer: {
    overflow: 'hidden',
  },
  stackItemRotator: {
    transform: [{ rotate: '90deg' }],
  },
});

export default BookshelfView;