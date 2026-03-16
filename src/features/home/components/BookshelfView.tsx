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
import { View, StyleSheet, ScrollView, FlatList, Platform } from 'react-native';
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
import { useResponsive } from '@/shared/hooks/useResponsive';
// MIGRATED: Now using new spine system via adapter
import { getSpineDimensions, calculateBookDimensions, hashString, MIN_TOUCH_TARGET } from '../utils/spine/adapter';
import { HEIGHT_SCALE, SERVER_SPINE_BOX, PROCEDURAL_SPINE_BOX } from '../utils/spine/constants';
import { fitToBoundingBox, getDurationScale, DURATION_SCALE_LONG_MAX } from '../utils/spine/core/dimensions';
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
  onBookLongPress?: (book: BookSpineVerticalData) => void;
  layoutMode?: LayoutMode;
  bottomPadding?: number;
  /** Scale factor for spine heights (1.0 = full, 0.5 = half). Default: 1.0 */
  heightScale?: number;
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

// Base scale factors - HEIGHT_SCALE directly controls book height
// HEIGHT_SCALE = 1.0 → normal size, 1.5 → 50% taller, etc.
const BASE_SHELF_SCALE_FACTOR = HEIGHT_SCALE;
const BASE_STACK_SCALE_FACTOR = HEIGHT_SCALE * 0.45;  // Stack mode is smaller

// Layout constants
const SHELF_PADDING_H = 16;
const BASE_BOOK_GAP = 8;
const LEAN_ANGLE = 3;
const STACK_GAP = 8;


// Animation timing
const DOMINO_DELAY = 25;      // ms between each book
const ENTER_DURATION = 180;   // ms for enter animation

// Easing
const ENTER_EASING = Easing.out(Easing.back(1.2)); // Bounce in

/**
 * Calculate scale factors based on device type
 * iPad uses reduced scale to fit more books on screen
 */
function getScaleFactors(spineScale: number) {
  const shelfScale = BASE_SHELF_SCALE_FACTOR * spineScale;
  const stackScale = BASE_STACK_SCALE_FACTOR * spineScale;
  const bookGap = Math.round(BASE_BOOK_GAP * shelfScale);

  return {
    shelfScale,
    stackScale,
    bookGap,
  };
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
  onLongPress?: (book: BookSpineVerticalData) => void;
  shelfScale: number;
  stackScale: number;
}

// Minimum thickness for stack mode spines (prevents invisible thin lines)
const STACK_MIN_THICKNESS = 35;

const StaticStackItem = React.memo(function StaticStackItem({
  book,
  spineWidth,
  spineHeight,
  onPress,
  onLongPress,
  shelfScale,
  stackScale,
}: StaticStackItemProps) {
  // Re-scale from shelf dimensions to stack dimensions
  // Input dimensions are scaled with shelfScale, convert to stackScale
  const stackToShelfRatio = stackScale / shelfScale;
  const scaledWidth = Math.max(spineWidth * stackToShelfRatio, STACK_MIN_THICKNESS);  // Enforce minimum thickness
  const scaledHeight = spineHeight * stackToShelfRatio;

  // After 90° rotation: spine height becomes container width, spine width becomes container height
  const containerWidth = scaledHeight;
  const containerHeight = scaledWidth;

  const handlePress = useCallback(() => {
    haptics.selection();
    onPress(book);
  }, [book, onPress]);

  const handleLongPress = useCallback(() => {
    onLongPress?.(book);
  }, [book, onLongPress]);

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
          onLongPress={onLongPress ? handleLongPress : undefined}
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
  onLongPress?: (book: BookSpineVerticalData) => void;
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
  onLongPress,
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
  // Add extra horizontal margin for leaning books to prevent overlap
  const leanMargin = Math.abs(info.leanAngle) > 0 ? Math.abs(info.leanAngle) * 1.5 : 0;

  const containerStyle = useAnimatedStyle(() => {
    return {
      width: info.width,
      height: info.height,
      opacity: opacity.value,
      marginHorizontal: leanMargin,
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
        onLongPress={onLongPress}
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
  onBookLongPress,
  layoutMode = 'shelf',
  bottomPadding = 0,
  heightScale: heightScaleProp = 1.0,
  recommendations = [],
  onDiscoverPress,
  onRecommendationPress,
}: BookshelfViewProps) {
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [containerHeight, setContainerHeight] = useState(0);

  const handleContainerLayout = useCallback((e: { nativeEvent: { layout: { height: number } } }) => {
    setContainerHeight(e.nativeEvent.layout.height);
  }, []);

  // Theme-aware colors
  const colors = useSecretLibraryColors();

  // Responsive layout for iPad
  const responsive = useResponsive();
  const { shelfScale: baseShelfScale, stackScale, bookGap } = useMemo(
    () => getScaleFactors(responsive.spineScale),
    [responsive.spineScale]
  );
  // Apply optional height scale (e.g. 0.5 for half-height series sections)
  const shelfScale = baseShelfScale * heightScaleProp;

  // Compute fillScale to make tallest possible spine fill available height.
  // Only applies for full-screen shelf (heightScale=1.0). Series rows (heightScale=0.5)
  // are inside a ScrollView where container height depends on content — using fillScale
  // there would create a layout feedback loop.
  const fillScale = useMemo(() => {
    if (heightScaleProp !== 1.0) return 1;
    if (containerHeight <= 0) return 1;
    const availableHeight = containerHeight - bottomPadding - insets.bottom;
    if (availableHeight <= 0) return 1;
    const maxBoundingBoxHeight = Math.max(SERVER_SPINE_BOX.MAX_HEIGHT, PROCEDURAL_SPINE_BOX.MAX_HEIGHT);
    const maxPossibleHeight = maxBoundingBoxHeight * shelfScale * DURATION_SCALE_LONG_MAX;
    return availableHeight / maxPossibleHeight;
  }, [containerHeight, bottomPadding, insets.bottom, shelfScale, heightScaleProp]);

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

    if (layoutMode === displayMode) {
      // Ensure phase is reset to idle if we re-enter with same mode (e.g., books.length changed)
      if (phase !== 'idle') setPhase('idle');
      return;
    }

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

  // Server spine settings - subscribe to lightweight version counter instead of the full
  // dimensions object to avoid re-rendering every spine when ANY book's dimensions change
  const useServerSpines = useSpineCacheStore((state) => state.useServerSpines);
  const serverDimsVersion = useSpineCacheStore((state) => state.serverSpineDimensionsVersion);
  const isHydrated = useSpineCacheStore((state) => state.isHydrated);
  const colorVersion = useSpineCacheStore((state) => state.colorVersion);

  // Calculate book dimensions - uses cache when available
  // Re-calculates when responsive scale changes (iPad vs phone)
  // Server spines use fixed height for consistent shelf alignment
  const bookInfo = useMemo(() => {
    let nextLeanAt = 5;
    const totalBooks = books.length;
    const isLastIndex = (index: number) => index === totalBooks - 1;

    return books.map((book, index) => {
      // Try to get from cache first
      const cached = getSpineData(book.id);

      // Read dimensions via getState() - version counter in deps triggers recalc
      const allDims = useSpineCacheStore.getState().serverSpineDimensions;
      const cachedServerDims = isHydrated ? allDims[book.id] : undefined;

      let dims;
      let bookHash: number;

      // Duration-based scaling applied to bounding box
      const duration = book.duration || 6 * 60 * 60;
      const durationScale = getDurationScale(duration);

      // Server spines: Scale to fit within max bounds while preserving exact aspect ratio
      // Unlike procedural spines, server spines have actual artwork that must not be distorted
      if (useServerSpines && cachedServerDims) {
        const { width: serverWidth, height: serverHeight } = cachedServerDims;
        bookHash = cached?.hash ?? hashString(book.id);

        const maxW = SERVER_SPINE_BOX.MAX_WIDTH * shelfScale * durationScale * fillScale;
        const maxH = SERVER_SPINE_BOX.MAX_HEIGHT * shelfScale * durationScale * fillScale;
        const { width, height } = fitToBoundingBox(serverWidth, serverHeight, maxW, maxH);
        const touchPadding = Math.max(0, Math.ceil((MIN_TOUCH_TARGET - width) / 2));

        dims = { width, height, touchPadding };

      } else if (cached) {
        // Procedural spines: clamp width and height independently
        // Width driven by duration, height driven by genre — no aspect ratio coupling
        bookHash = cached.hash;

        const maxW = PROCEDURAL_SPINE_BOX.MAX_WIDTH * shelfScale * durationScale * fillScale;
        const maxH = PROCEDURAL_SPINE_BOX.MAX_HEIGHT * shelfScale * durationScale * fillScale;
        const width = Math.round(Math.min(cached.baseWidth * shelfScale * durationScale * fillScale, maxW));
        const height = Math.round(Math.min(cached.baseHeight * shelfScale * durationScale * fillScale, maxH));
        const touchPadding = Math.max(0, Math.ceil((MIN_TOUCH_TARGET - width) / 2));

        dims = { width, height, touchPadding };
      } else {
        // Fallback: calculate on the fly
        const genres = book.genres || [];
        const tags = book.tags || [];
        const hasGenreData = genres.length > 0 || tags.length > 0;

        let baseWidth: number;
        let baseHeight: number;

        if (hasGenreData) {
          const calculated = calculateBookDimensions({
            id: book.id,
            genres,
            tags,
            duration,
            seriesName: book.seriesName,
          });
          baseWidth = calculated.width;
          baseHeight = calculated.height;
        } else {
          const baseDims = getSpineDimensions(book.id, genres, duration, book.seriesName);
          baseWidth = baseDims.width;
          baseHeight = baseDims.height;
        }

        const maxW = PROCEDURAL_SPINE_BOX.MAX_WIDTH * shelfScale * durationScale * fillScale;
        const maxH = PROCEDURAL_SPINE_BOX.MAX_HEIGHT * shelfScale * durationScale * fillScale;
        const width = Math.round(Math.min(baseWidth * shelfScale * durationScale * fillScale, maxW));
        const height = Math.round(Math.min(baseHeight * shelfScale * durationScale * fillScale, maxH));
        const touchPadding = Math.max(0, Math.ceil((MIN_TOUCH_TARGET - width) / 2));

        dims = { width, height, touchPadding };
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
  }, [books, getSpineData, shelfScale, fillScale, useServerSpines, serverDimsVersion, isHydrated]);

  // Enrich books with cached colors from spine cache
  const enrichedBooks = useMemo(() => {
    return books.map((book) => {
      // Skip if already has colors
      if (book.backgroundColor && book.textColor) {
        return book;
      }

      // Get colors from cache
      const cached = getSpineData(book.id);
      if (cached && cached.backgroundColor) {
        return {
          ...book,
          backgroundColor: cached.backgroundColor,
          textColor: cached.textColor,
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

  const handleLongPress = useCallback((book: BookSpineVerticalData) => {
    setActiveIndex(null);
    onBookLongPress?.(book);
  }, [onBookLongPress]);

  const isStackMode = displayMode === 'stack';

  // Fast inline dimension getter for stack mode (avoids pre-computing all 200+ books)
  const getStackItemDims = useCallback((book: BookSpineVerticalData) => {
    const duration = book.duration || 6 * 60 * 60;
    const durationScale = getDurationScale(duration);

    // Read via getState() - version counter in deps triggers recalc
    const allDims = useSpineCacheStore.getState().serverSpineDimensions;
    const serverDims = allDims[book.id];
    if (useServerSpines && serverDims) {
      const maxW = SERVER_SPINE_BOX.MAX_WIDTH * shelfScale * durationScale;
      const maxH = SERVER_SPINE_BOX.MAX_HEIGHT * shelfScale * durationScale;
      return fitToBoundingBox(serverDims.width, serverDims.height, maxW, maxH);
    }
    // Fallback to cache or default
    const cached = getSpineData(book.id);
    if (cached) {
      const maxW = PROCEDURAL_SPINE_BOX.MAX_WIDTH * shelfScale * durationScale;
      const maxH = PROCEDURAL_SPINE_BOX.MAX_HEIGHT * shelfScale * durationScale;
      const width = Math.round(Math.min(cached.baseWidth * shelfScale * durationScale, maxW));
      const height = Math.round(Math.min(cached.baseHeight * shelfScale * durationScale, maxH));
      return { width, height, scaleFactor: 1 };
    }
    // Default fallback
    return { width: 40, height: 300, scaleFactor: 1 };
  }, [serverDimsVersion, useServerSpines, shelfScale, getSpineData]);

  // Memoized render function for FlatList (stack mode) - computes dimensions inline
  const renderStackItem = useCallback(({ item }: { item: BookSpineVerticalData }) => {
    const dims = getStackItemDims(item);
    return (
      <StaticStackItem
        book={item}
        spineWidth={dims.width}
        spineHeight={dims.height}
        onPress={handlePress}
        onLongPress={onBookLongPress ? handleLongPress : undefined}
        shelfScale={shelfScale}
        stackScale={stackScale}
      />
    );
  }, [getStackItemDims, handlePress, handleLongPress, onBookLongPress, shelfScale, stackScale]);

  const keyExtractor = useCallback((item: BookSpineVerticalData) => item.id, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.white }, !isStackMode && { paddingBottom: bottomPadding }]} onLayout={handleContainerLayout}>
      {/* Stack mode: Virtualized FlatList for performance with 200+ items */}
      {isStackMode ? (
        <FlatList
          data={enrichedBooks}
          renderItem={renderStackItem}
          keyExtractor={keyExtractor}
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContentStack,
            {
              paddingBottom: insets.bottom + bottomPadding + 20,
              paddingTop: 20,
            },
          ]}
          showsVerticalScrollIndicator={false}
          // Performance optimizations for large lists
          removeClippedSubviews={Platform.OS === 'android'}
          maxToRenderPerBatch={15}
          updateCellsBatchingPeriod={50}
          initialNumToRender={15}
          windowSize={5}
        />
      ) : (
        <ScrollView
          horizontal
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContentShelf,
            {
              paddingRight: insets.right + SHELF_PADDING_H,
              paddingBottom: 0,
              gap: bookGap,
            },
          ]}
          showsHorizontalScrollIndicator={false}
          removeClippedSubviews
        >
          {/* Shelf mode: Animated upright spines */}
          {enrichedBooks.map((book, index) => (
            <AnimatedBookWrapper
              key={book.id}
              book={book}
              info={bookInfo[index]}
              index={index}
              totalBooks={enrichedBooks.length}
              phase={phase}
              isActive={activeIndex === index}
              onPress={handlePress}
              onLongPress={onBookLongPress ? handleLongPress : undefined}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
            />
          ))}

          {/* "Find More Books" card - only in shelf mode */}
          {onDiscoverPress && recommendations.length > 0 && (
            <DiscoverMoreCard
              recommendations={recommendations}
              onPress={onDiscoverPress}
              onBookPress={onRecommendationPress}
              height={bookInfo[0]?.height || 320}
            />
          )}
        </ScrollView>
      )}
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
    // gap is set dynamically via inline style for iPad responsiveness
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
    justifyContent: 'flex-end',
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