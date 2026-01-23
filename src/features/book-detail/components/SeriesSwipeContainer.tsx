/**
 * src/features/book-detail/components/SeriesSwipeContainer.tsx
 *
 * Carousel-style navigation between books in a series.
 * Shows full book detail content for adjacent books side-by-side.
 * TopNav stays fixed while content slides.
 */

import React, { useMemo, useCallback, createContext, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
  Easing,
  FadeIn,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { PlayIcon } from '@/features/player/components/PlayerIcons';
import { useNavigation } from '@react-navigation/native';
import { LibraryItem } from '@/core/types';
import { getSeriesNavigationInfo, getCoverUrl } from '@/core/cache';
import { scale } from '@/shared/theme';
import { useSecretLibraryColors } from '@/shared/theme';
import { haptics } from '@/core/native/haptics';
import { getTypographyForGenres, getSeriesStyle } from '@/features/home/utils/spine/adapter';
import { useSpineCacheStore } from '@/features/home/stores/spineCache';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.2;
const VELOCITY_THRESHOLD = 500;
const RUBBER_BAND_FACTOR = 0.3;
const ANIMATION_DURATION = 250;

// Context for series navigation - allows book detail screen to render arrows inside its ScrollView
interface SeriesNavigationContextType {
  hasPrevious: boolean;
  hasNext: boolean;
  navigateToPrevious: () => void;
  navigateToNext: () => void;
}

const SeriesNavigationContext = createContext<SeriesNavigationContextType | null>(null);

export function useSeriesNavigation() {
  return useContext(SeriesNavigationContext);
}

interface SeriesSwipeContainerProps {
  book: LibraryItem;
  children: React.ReactNode;
}

// Chevron icons
const ChevronLeftIcon = ({ color }: { color: string }) => (
  <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
    <Path d="M15 18l-6-6 6-6" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const ChevronRightIcon = ({ color }: { color: string }) => (
  <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
    <Path d="M9 18l6-6-6-6" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// Exportable arrows component - render inside ScrollView at title level
export function SeriesNavigationArrows() {
  const nav = useSeriesNavigation();
  const colors = useSecretLibraryColors();

  if (!nav) return null;

  const { hasPrevious, hasNext, navigateToPrevious, navigateToNext } = nav;

  if (!hasPrevious && !hasNext) return null;

  return (
    <View style={arrowStyles.container} pointerEvents="box-none">
      {hasPrevious && (
        <TouchableOpacity
          style={arrowStyles.arrowLeft}
          onPress={navigateToPrevious}
          activeOpacity={0.7}
          hitSlop={{ top: 20, bottom: 20, left: 10, right: 30 }}
        >
          <ChevronLeftIcon color={colors.gray} />
        </TouchableOpacity>
      )}
      {hasNext && (
        <TouchableOpacity
          style={arrowStyles.arrowRight}
          onPress={navigateToNext}
          activeOpacity={0.7}
          hitSlop={{ top: 20, bottom: 20, left: 30, right: 10 }}
        >
          <ChevronRightIcon color={colors.gray} />
        </TouchableOpacity>
      )}
    </View>
  );
}

// Hero has paddingHorizontal: scale(24), so we need to offset by that to reach screen edge
const HERO_PADDING = scale(24);
const ARROW_CONTAINER_OFFSET = -HERO_PADDING + scale(8); // Offset to screen edge + small margin

const arrowStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: ARROW_CONTAINER_OFFSET,
    right: ARROW_CONTAINER_OFFSET,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  arrowLeft: {
    padding: scale(8),
  },
  arrowRight: {
    padding: scale(8),
  },
});

const DownloadIcon = ({ color = '#000', size = 16 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5}>
    <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <Path d="M7 10l5 5 5-5" />
    <Path d="M12 15V3" />
  </Svg>
);

// Format duration in hours/minutes
function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0m';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) {
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  }
  return `${mins}m`;
}

// Split title into two lines if more than 3 words
function splitTitle(title: string): { line1: string; line2: string } {
  const words = title.split(' ');
  if (words.length <= 3) {
    return { line1: title, line2: '' };
  }
  const midPoint = Math.ceil(words.length / 2);
  return {
    line1: words.slice(0, midPoint).join(' '),
    line2: words.slice(midPoint).join(' '),
  };
}

// Full book detail preview - matches hero section exactly
function AdjacentBookPage({ book, seriesName: parentSeriesName, bookSequence }: { book: LibraryItem; seriesName: string; bookSequence?: string }) {
  const colors = useSecretLibraryColors();
  const coverUrl = getCoverUrl(book.id);

  const metadata = book.media?.metadata as any;
  const title = metadata?.title || 'Unknown Title';
  const author = metadata?.authorName || metadata?.authors?.[0]?.name || 'Unknown Author';
  const narrator = metadata?.narratorName || metadata?.narrators?.[0] || '';
  const genres = metadata?.genres || [];

  // Get cached spine data (same as book detail hero)
  const cachedSpineData = useSpineCacheStore((s) => s.cache.get(book.id));

  // Get series info - use parent-provided name (most reliable), then try metadata
  let seriesName = parentSeriesName || '';
  let seriesSequence = bookSequence || '';

  // Try to get sequence from metadata if not provided
  if (!seriesSequence) {
    if (metadata?.series?.length > 0) {
      const s = metadata.series[0];
      seriesSequence = s.sequence || '';
      if (!seriesName) seriesName = s.name || '';
    } else if (metadata?.seriesName) {
      const seqMatch = metadata.seriesName.match(/#([\d.]+)/);
      seriesSequence = seqMatch ? seqMatch[1] : '';
      if (!seriesName) {
        const match = metadata.seriesName.match(/^(.+?)(?:\s*#[\d.]+)?$/);
        seriesName = match ? match[1].trim() : metadata.seriesName;
      }
    }
  }

  // Fallback to spine cache
  if (!seriesName && cachedSpineData?.seriesName) {
    seriesName = cachedSpineData.seriesName;
  }

  const seriesDisplay = seriesName
    ? (seriesSequence ? `${seriesName} · Book ${seriesSequence}` : seriesName)
    : '';

  // Get typography - USE CACHED TYPOGRAPHY for consistency (same as book detail hero)
  const spineTypography = useMemo(() => {
    // FIRST: Use pre-computed typography from spine cache
    if (cachedSpineData?.typography) {
      return cachedSpineData.typography;
    }

    // FALLBACK: Recalculate if not in cache
    const cachedSeriesName = cachedSpineData?.seriesName || seriesName;
    const cachedGenres = cachedSpineData?.genres || genres;

    if (cachedSeriesName) {
      const seriesStyle = getSeriesStyle(cachedSeriesName);
      if (seriesStyle?.typography) {
        return seriesStyle.typography;
      }
    }
    // Genre-based typography (fallback)
    return getTypographyForGenres(cachedGenres, book.id);
  }, [cachedSpineData?.typography, cachedSpineData?.seriesName, cachedSpineData?.genres, seriesName, genres, book.id]);

  const titleFontFamily = spineTypography.fontFamily || Platform.select({ ios: 'Georgia', android: 'serif' });
  const titleFontWeight = spineTypography.titleWeight || spineTypography.fontWeight || '500';
  const titleFontStyle = spineTypography.fontStyle || 'normal';
  const titleTransform = spineTypography.titleTransform || 'none';

  // Apply text transform and split title
  const { line1, line2 } = splitTitle(title);
  const displayLine1 = titleTransform === 'uppercase' ? line1.toUpperCase() : line1;
  const displayLine2 = titleTransform === 'uppercase' ? line2.toUpperCase() : line2;

  // Get duration, chapters, and published year
  const duration = cachedSpineData?.duration || book.media?.duration || 0;
  const formattedDuration = formatDuration(duration);
  // Chapters may not be loaded in cached items - use numAudioFiles as fallback indicator
  const chapters = book.media?.chapters || [];
  const chapterCount = chapters.length || (book.media as any)?.numAudioFiles || 0;
  const publishedYear = metadata?.publishedYear || '';

  return (
    <ScrollView
      style={[styles.adjacentPage, { backgroundColor: colors.white }]}
      contentContainerStyle={styles.hero}
      showsVerticalScrollIndicator={false}
    >
      {/* Cover - Square 320x320 matching hero */}
      <Animated.View entering={FadeIn.duration(300)} style={styles.heroCover}>
        {coverUrl ? (
          <Image source={{ uri: coverUrl }} style={styles.coverImage} contentFit="cover" />
        ) : (
          <View style={[styles.coverImage, styles.coverPlaceholder]}>
            <Text style={styles.coverPlaceholderText}>{title.substring(0, 3).toUpperCase()}</Text>
          </View>
        )}
      </Animated.View>

      {/* Title - Split into two lines with genre-based typography */}
      <Animated.View entering={FadeIn.duration(300).delay(100)} style={styles.titleContainer}>
        <Text style={[
          styles.titleLine1,
          {
            fontFamily: titleFontFamily,
            fontWeight: titleFontWeight as any,
            fontStyle: titleFontStyle as any,
            color: colors.black,
          }
        ]}>
          {displayLine1}
        </Text>
        {displayLine2 ? (
          <Text style={[
            styles.titleLine2,
            {
              fontFamily: titleFontFamily,
              fontWeight: titleFontWeight as any,
              fontStyle: titleFontStyle as any,
              color: colors.black,
            }
          ]}>
            {displayLine2}
          </Text>
        ) : null}
      </Animated.View>

      {/* Byline: By Author · Narrated by Narrator */}
      <Animated.View entering={FadeIn.duration(300).delay(150)} style={styles.byline}>
        <Text style={[styles.bylineText, { color: colors.gray }]}>By </Text>
        <Text style={[styles.bylineLink, { color: colors.black }]}>{author}</Text>
        {narrator ? (
          <>
            <Text style={[styles.bylineDot, { color: colors.gray }]}> · </Text>
            <Text style={[styles.bylineText, { color: colors.gray }]}>Narrated by </Text>
            <Text style={[styles.bylineLink, { color: colors.black }]}>{narrator}</Text>
          </>
        ) : null}
      </Animated.View>

      {/* Series Link */}
      {seriesDisplay ? (
        <Animated.View entering={FadeIn.duration(300).delay(200)} style={styles.seriesRow}>
          <Text style={[styles.seriesLink, { color: colors.gray }]}>
            {seriesDisplay}
          </Text>
        </Animated.View>
      ) : null}

      {/* Meta Grid: Duration | Chapters | Year */}
      <Animated.View entering={FadeIn.duration(300).delay(250)} style={[styles.metaGrid, { borderColor: colors.grayLine }]}>
        <View style={styles.metaItem}>
          <Text style={[styles.metaLabel, { color: colors.gray }]}>Duration</Text>
          <Text style={[styles.metaValue, { color: colors.black }]}>{formattedDuration}</Text>
        </View>
        <View style={[styles.metaItemCenter, { borderColor: colors.grayLine }]}>
          <Text style={[styles.metaLabel, { color: colors.gray }]}>Chapters</Text>
          <Text style={[styles.metaValue, { color: colors.black }]}>{chapterCount || '—'}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={[styles.metaLabel, { color: colors.gray }]}>Published</Text>
          <Text style={[styles.metaValue, { color: colors.black }]}>{publishedYear || '—'}</Text>
        </View>
      </Animated.View>

      {/* Action Buttons: Play + Download */}
      <Animated.View entering={FadeIn.duration(300).delay(300)} style={styles.actionRow}>
        <TouchableOpacity style={[styles.btnPlay, { backgroundColor: colors.black }]} activeOpacity={0.7}>
          <PlayIcon color={colors.white} size={16} />
          <Text style={[styles.btnText, styles.btnTextActive, { color: colors.white }]}>Play</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btnDownload, { borderColor: colors.black }]} activeOpacity={0.7}>
          <DownloadIcon color={colors.black} size={16} />
          <Text style={[styles.btnText, { color: colors.black }]}>Download</Text>
        </TouchableOpacity>
      </Animated.View>
    </ScrollView>
  );
}

export function SeriesSwipeContainer({ book, children }: SeriesSwipeContainerProps) {
  const navigation = useNavigation<any>();
  const colors = useSecretLibraryColors();

  const navInfo = useMemo(() => getSeriesNavigationInfo(book), [book]);

  const previousBook = navInfo?.previousBook ?? null;
  const nextBook = navInfo?.nextBook ?? null;
  const hasPrevious = !!previousBook;
  const hasNext = !!nextBook;
  const isInSeries = !!navInfo && navInfo.totalBooks > 1;
  const seriesName = navInfo?.seriesName ?? '';
  const currentSequence = navInfo?.currentSequence ?? 0;

  // Helper to extract sequence from a book
  const getBookSequence = (b: LibraryItem | null): string => {
    if (!b) return '';
    const meta = b.media?.metadata as any;
    if (meta?.series?.length > 0 && meta.series[0]?.sequence) {
      return String(meta.series[0].sequence);
    }
    if (meta?.seriesName) {
      const match = meta.seriesName.match(/#([\d.]+)/);
      if (match) return match[1];
    }
    return '';
  };

  // Get actual sequence from adjacent books, fallback to calculated
  const previousSequence = getBookSequence(previousBook) || (currentSequence > 1 ? String(currentSequence - 1) : '');
  const nextSequence = getBookSequence(nextBook) || (currentSequence > 0 ? String(currentSequence + 1) : '');

  const translateX = useSharedValue(0);
  const isAnimating = useSharedValue(false);

  const navigateToBook = useCallback((targetBook: LibraryItem) => {
    haptics.selection();
    navigation.replace('BookDetail', {
      id: targetBook.id,
      animationDirection: 'none',
    });
  }, [navigation]);

  const animateToBook = useCallback((targetBook: LibraryItem, direction: 'left' | 'right') => {
    if (isAnimating.value) return;
    isAnimating.value = true;

    const targetX = direction === 'left' ? SCREEN_WIDTH : -SCREEN_WIDTH;
    translateX.value = withTiming(targetX, {
      duration: ANIMATION_DURATION,
      easing: Easing.out(Easing.cubic),
    }, () => {
      runOnJS(navigateToBook)(targetBook);
    });
  }, [translateX, isAnimating, navigateToBook]);

  const navigateToPrevious = useCallback(() => {
    if (previousBook) animateToBook(previousBook, 'left');
  }, [previousBook, animateToBook]);

  const navigateToNext = useCallback(() => {
    if (nextBook) animateToBook(nextBook, 'right');
  }, [nextBook, animateToBook]);

  const panGesture = useMemo(() => Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-15, 15])
    .onUpdate((event) => {
      'worklet';
      if (isAnimating.value) return;
      const { translationX } = event;

      if (translationX > 0) {
        translateX.value = hasPrevious ? translationX : translationX * RUBBER_BAND_FACTOR;
      } else {
        translateX.value = hasNext ? translationX : translationX * RUBBER_BAND_FACTOR;
      }
    })
    .onEnd((event) => {
      'worklet';
      if (isAnimating.value) return;
      const { translationX, velocityX } = event;
      const pastThreshold = Math.abs(translationX) > SWIPE_THRESHOLD;
      const fastSwipe = Math.abs(velocityX) > VELOCITY_THRESHOLD;

      if (translationX > 0 && (pastThreshold || fastSwipe) && hasPrevious) {
        runOnJS(navigateToPrevious)();
      } else if (translationX < 0 && (pastThreshold || fastSwipe) && hasNext) {
        runOnJS(navigateToNext)();
      } else {
        translateX.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) });
      }
    }), [hasPrevious, hasNext, translateX, isAnimating, navigateToPrevious, navigateToNext]);

  const carouselStyle = useAnimatedStyle(() => {
    'worklet';
    return { transform: [{ translateX: translateX.value }] };
  });

  // Context value for arrows
  const navigationContextValue = useMemo(() => ({
    hasPrevious,
    hasNext,
    navigateToPrevious,
    navigateToNext,
  }), [hasPrevious, hasNext, navigateToPrevious, navigateToNext]);

  if (!isInSeries) {
    return <>{children}</>;
  }

  // Calculate track width and offset based on available adjacent books
  const numPanels = 1 + (hasPrevious ? 1 : 0) + (hasNext ? 1 : 0);
  const trackWidth = SCREEN_WIDTH * numPanels;
  const offsetLeft = hasPrevious ? -SCREEN_WIDTH : 0;

  return (
    <View style={styles.container}>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[
          styles.carouselTrack,
          { width: trackWidth, marginLeft: offsetLeft },
          carouselStyle
        ]}>
          {/* Previous book (full page preview) */}
          {previousBook && <AdjacentBookPage book={previousBook} seriesName={seriesName} bookSequence={previousSequence} />}

          {/* Current book content - wrapped with navigation context */}
          <View style={styles.currentContent}>
            <SeriesNavigationContext.Provider value={navigationContextValue}>
              {children}
            </SeriesNavigationContext.Provider>
          </View>

          {/* Next book (full page preview) */}
          {nextBook && <AdjacentBookPage book={nextBook} seriesName={seriesName} bookSequence={nextSequence} />}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  carouselTrack: {
    flex: 1,
    flexDirection: 'row',
  },
  currentContent: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
  adjacentPage: {
    width: SCREEN_WIDTH,
    flex: 1,
  },

  // Hero section - matches SecretLibraryBookDetailScreen exactly
  hero: {
    alignItems: 'center',
    paddingTop: scale(8),
    paddingHorizontal: scale(24),
    paddingBottom: scale(100),
  },
  heroCover: {
    width: scale(320),
    height: scale(320),
    marginBottom: scale(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    backgroundColor: '#F5A623', // Orange from theme
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverPlaceholderText: {
    fontSize: scale(48),
    fontWeight: '700',
    color: 'rgba(255,255,255,0.15)',
    letterSpacing: -2,
  },

  // Title - Split headline
  titleContainer: {
    alignItems: 'center',
    marginBottom: scale(12),
  },
  titleLine1: {
    fontSize: scale(28),
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
    lineHeight: scale(32),
  },
  titleLine2: {
    fontSize: scale(28),
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
    lineHeight: scale(32),
  },

  // Byline
  byline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: scale(6),
  },
  bylineText: {
    fontSize: scale(13),
  },
  bylineLink: {
    fontSize: scale(13),
    textDecorationLine: 'underline',
  },
  bylineDot: {
    fontSize: scale(13),
  },

  // Series
  seriesRow: {
    marginTop: scale(4),
  },
  seriesLink: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontStyle: 'italic',
    fontSize: scale(14),
    textDecorationLine: 'underline',
  },

  // Meta Grid - marginTop matches hero paddingBottom from book detail
  metaGrid: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginTop: scale(20),
    width: '100%',
  },
  metaItem: {
    flex: 1,
    paddingVertical: scale(16),
    alignItems: 'center',
  },
  metaItemCenter: {
    flex: 1,
    paddingVertical: scale(16),
    alignItems: 'center',
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  metaLabel: {
    fontSize: scale(9),
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    marginBottom: scale(4),
  },
  metaValue: {
    fontSize: scale(16),
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },

  // Action Buttons
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(12),
    paddingVertical: scale(16),
    width: '100%',
  },
  btnPlay: {
    flex: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    paddingVertical: scale(14),
    borderRadius: scale(6),
  },
  btnDownload: {
    flex: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    backgroundColor: 'transparent',
    borderWidth: 1,
    paddingVertical: scale(14),
    borderRadius: scale(6),
  },
  btnText: {
    fontSize: scale(14),
    fontWeight: '600',
  },
  btnTextActive: {
    fontWeight: '600',
  },
});

export default SeriesSwipeContainer;
