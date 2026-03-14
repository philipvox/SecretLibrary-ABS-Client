/**
 * src/features/book-detail/components/SeriesSwipeContainer.tsx
 *
 * Carousel-style navigation between books in a series.
 * Shows full book detail content for adjacent books side-by-side.
 * TopNav stays fixed while content slides.
 */

import React, { useMemo, useCallback, useRef, createContext, useContext } from 'react';
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
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { PlayIcon } from '@/features/player/components/PlayerIcons';
import { useNavigation } from '@react-navigation/native';
import { LibraryItem } from '@/core/types';
import { getSeriesNavigationInfo, useCoverUrl } from '@/core/cache';
import { CoverStars } from '@/shared/components/CoverStars';
import { scale } from '@/shared/theme';
import { useSecretLibraryColors } from '@/shared/theme';
import { haptics } from '@/core/native/haptics';
import { useSpineCacheStore } from '@/shared/spine';
import { useBookProgress } from '@/core/hooks/useUserBooks';
import {
  secretLibraryColors as staticColors,
} from '@/shared/theme/secretLibrary';

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
  /** Ref to the Pan gesture so inner Tap gestures can declare simultaneity */
  panGestureRef?: React.MutableRefObject<any>;
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
    marginLeft: 'auto',
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

// Full book detail preview - matches SecretLibraryBookDetailScreen layout exactly

function AdjacentBookPage({ book, seriesName: parentSeriesName, bookSequence }: { book: LibraryItem; seriesName: string; bookSequence?: string }) {
  const colors = useSecretLibraryColors();
  const navigation = useNavigation<any>();
  const coverUrl = useCoverUrl(book.id, { width: 600 });

  const metadata = book.media?.metadata as any;
  const title = metadata?.title || 'Unknown Title';
  const author = metadata?.authorName || metadata?.authors?.[0]?.name || 'Unknown Author';
  const narrator = metadata?.narratorName ||
    (metadata?.narrators && metadata.narrators.length > 0
      ? metadata.narrators.join(', ')
      : '');
  const genres: string[] = metadata?.genres || [];
  const description: string = metadata?.description || '';

  // Get cached spine data for progress/duration
  const cachedSpineData = useSpineCacheStore((s) => s.cache.get(book.id));

  // Get local progress from SQLite
  const { progress: localProgress, currentTime: localCurrentTime } = useBookProgress(book.id);

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

  // Title typography - matches real detail screen (Georgia/serif, weight 600)
  const titleFontFamily = Platform.select({ ios: 'Georgia', android: 'serif' });
  const titleFontWeight = '600';

  // Split title
  const { line1, line2 } = splitTitle(title);

  // Duration and meta
  const duration = cachedSpineData?.duration || book.media?.duration || 0;
  const formattedDuration = formatDuration(duration);
  const chapters = book.media?.chapters || [];
  const chapterCount = chapters.length || (book.media as any)?.numAudioFiles || 0;
  const publishedYear = metadata?.publishedYear || '';

  // Progress - prioritize local SQLite, then spine cache, then server
  const serverProgress = book.userMediaProgress?.progress || 0;
  const serverCurrentTime = book.userMediaProgress?.currentTime || 0;
  const cachedProgress = cachedSpineData?.progress || 0;
  const progress = localProgress > 0 ? localProgress :
                   cachedProgress > 0 ? cachedProgress :
                   serverProgress;
  const currentTime = localCurrentTime > 0 ? localCurrentTime :
                      cachedProgress > 0 ? cachedProgress * duration :
                      serverCurrentTime;
  const isFinished = progress >= 0.95;
  const timeListened = currentTime;
  const timeRemaining = duration - currentTime;
  const progressPercent = Math.round(progress * 100);

  // Navigation handlers
  const handleAuthorPress = useCallback((name: string) => {
    haptics.selection();
    navigation.navigate('AuthorDetail', { authorName: name.trim() });
  }, [navigation]);

  const handleNarratorPress = useCallback((name: string) => {
    haptics.selection();
    navigation.navigate('NarratorDetail', { narratorName: name.trim() });
  }, [navigation]);

  const handleSeriesPress = useCallback(() => {
    if (seriesName) {
      haptics.selection();
      navigation.navigate('SeriesDetail', { seriesName });
    }
  }, [seriesName, navigation]);

  const handleGenrePress = useCallback((genreName: string) => {
    haptics.selection();
    navigation.navigate('GenreDetail', { genreName });
  }, [navigation]);

  return (
    <ScrollView
      style={[styles.adjacentPage, { backgroundColor: colors.white }]}
      contentContainerStyle={styles.hero}
      showsVerticalScrollIndicator={false}
    >
      {/* Cover - Square 320x320 matching hero */}
      <View style={styles.heroCover}>
        {coverUrl ? (
          <Image source={{ uri: coverUrl }} style={styles.coverImage} contentFit="cover" />
        ) : (
          <View style={[styles.coverImage, styles.coverPlaceholder]}>
            <Text style={styles.coverPlaceholderText}>{title.substring(0, 3).toUpperCase()}</Text>
          </View>
        )}
        <CoverStars bookId={book.id} starSize={scale(32)} />
      </View>

      {/* Title - Split into two lines with Georgia/serif */}
      <View style={styles.titleContainer}>
        <Text style={[
          styles.titleLine1,
          {
            fontFamily: titleFontFamily,
            fontWeight: titleFontWeight as any,
            color: colors.black,
          }
        ]}>
          {line1}
        </Text>
        {line2 ? (
          <Text style={[
            styles.titleLine2,
            {
              fontFamily: titleFontFamily,
              fontWeight: titleFontWeight as any,
              color: colors.black,
            }
          ]}>
            {line2}
          </Text>
        ) : null}
      </View>

      {/* Byline: By Author · Narrated by Narrator - with tappable links */}
      <View style={styles.byline}>
        <Text style={[styles.bylineText, { color: colors.gray }]}>By </Text>
        {author.split(',').map((name: string, idx: number, arr: string[]) => (
          <React.Fragment key={idx}>
            <TouchableOpacity onPress={() => handleAuthorPress(name)} activeOpacity={0.7}>
              <Text style={[styles.bylineLink, { color: colors.black }]}>{name.trim()}</Text>
            </TouchableOpacity>
            {idx < arr.length - 1 && <Text style={[styles.bylineText, { color: colors.gray }]}>, </Text>}
          </React.Fragment>
        ))}
        {narrator ? (
          <>
            <Text style={[styles.bylineDot, { color: colors.gray }]}> · </Text>
            <Text style={[styles.bylineText, { color: colors.gray }]}>Narrated by </Text>
            {narrator.split(',').map((name: string, idx: number, arr: string[]) => (
              <React.Fragment key={idx}>
                <TouchableOpacity onPress={() => handleNarratorPress(name)} activeOpacity={0.7}>
                  <Text style={[styles.bylineLink, { color: colors.black }]}>{name.trim()}</Text>
                </TouchableOpacity>
                {idx < arr.length - 1 && <Text style={[styles.bylineText, { color: colors.gray }]}>, </Text>}
              </React.Fragment>
            ))}
          </>
        ) : null}
      </View>

      {/* Series Link - tappable */}
      {seriesName ? (
        <TouchableOpacity onPress={handleSeriesPress} activeOpacity={0.7} style={styles.seriesRow}>
          <Text style={[styles.seriesLink, { color: colors.gray }]}>
            {seriesName}{seriesSequence ? ` · Book ${seriesSequence}` : ''}
          </Text>
        </TouchableOpacity>
      ) : null}

      {/* Meta Grid: Duration | Chapters | Year */}
      <View style={[styles.metaGrid, { borderColor: colors.grayLine }]}>
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
      </View>

      {/* Action Buttons: Play + Download (visual-only in preview) */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={[styles.btnPlay, { backgroundColor: colors.black }]} activeOpacity={0.7}>
          <PlayIcon color={colors.white} size={16} />
          <Text style={[styles.btnText, styles.btnTextActive, { color: colors.white }]}>Play</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btnDownload, { borderColor: colors.black }]} activeOpacity={0.7}>
          <DownloadIcon color={colors.black} size={16} />
          <Text style={[styles.btnText, { color: colors.black }]}>Download</Text>
        </TouchableOpacity>
      </View>

      {/* Progress Section */}
      {(progress > 0 || isFinished) && (
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <View style={styles.progressLeft}>
              <Text style={[styles.progressLabel, { color: colors.gray }]}>Progress</Text>
              <Text style={[styles.progressPercent, { color: colors.black }]}>
                {isFinished ? 'Complete' : `${progressPercent}%`}
              </Text>
            </View>
          </View>
          <View style={[styles.progressBar, { backgroundColor: colors.grayLine }]}>
            <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: colors.black }]} />
          </View>
          <View style={styles.progressTimes}>
            <Text style={[styles.timeText, { color: colors.gray }]}>{formatDuration(timeListened)} listened</Text>
            <Text style={[styles.timeText, { color: colors.gray }]}>{formatDuration(timeRemaining)} remaining</Text>
          </View>
        </View>
      )}

      {/* Description (simplified - no drop cap in preview) */}
      {description ? (
        <View style={[styles.descriptionSection, { borderBottomColor: colors.grayLine }]}>
          <Text
            style={[styles.descriptionText, { color: colors.black }]}
            numberOfLines={4}
          >
            {description}
          </Text>
        </View>
      ) : null}

      {/* Genre Pills */}
      {genres.length > 0 && (
        <View style={styles.genreRow}>
          {genres.map((genre: string, idx: number) => (
            <TouchableOpacity
              key={`genre-${idx}`}
              style={[styles.genrePill, { borderColor: colors.grayLine }]}
              onPress={() => handleGenrePress(genre)}
              activeOpacity={0.7}
            >
              <Text style={[styles.genrePillText, { color: colors.gray }]}>{genre}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
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

  // Swipe gesture completion — animate carousel, then replace
  const swipeToPrevious = useCallback(() => {
    if (previousBook) animateToBook(previousBook, 'left');
  }, [previousBook, animateToBook]);

  const swipeToNext = useCallback(() => {
    if (nextBook) animateToBook(nextBook, 'right');
  }, [nextBook, animateToBook]);

  // Arrow tap — instant replace (skips AdjacentBookPage preview)
  const arrowToPrevious = useCallback(() => {
    if (previousBook) navigateToBook(previousBook);
  }, [previousBook, navigateToBook]);

  const arrowToNext = useCallback(() => {
    if (nextBook) navigateToBook(nextBook);
  }, [nextBook, navigateToBook]);

  const panGestureRef = useRef<any>();
  const panGesture = useMemo(() => Gesture.Pan()
    .withRef(panGestureRef)
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
        runOnJS(swipeToPrevious)();
      } else if (translationX < 0 && (pastThreshold || fastSwipe) && hasNext) {
        runOnJS(swipeToNext)();
      } else {
        translateX.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) });
      }
    }), [hasPrevious, hasNext, translateX, isAnimating, swipeToPrevious, swipeToNext]);

  const carouselStyle = useAnimatedStyle(() => {
    'worklet';
    return { transform: [{ translateX: translateX.value }] };
  });

  // Context value for arrows — uses instant replace (no carousel animation)
  const navigationContextValue = useMemo(() => ({
    hasPrevious,
    hasNext,
    navigateToPrevious: arrowToPrevious,
    navigateToNext: arrowToNext,
    panGestureRef,
  }), [hasPrevious, hasNext, arrowToPrevious, arrowToNext]);

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
    paddingBottom: scale(20),
  },
  heroCover: {
    width: scale(320),
    height: scale(320),
    marginBottom: scale(20),
    shadowColor: staticColors.black,
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
    backgroundColor: staticColors.orange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverPlaceholderText: {
    fontSize: scale(48),
    fontWeight: '700',
    color: 'rgba(255,255,255,0.15)',
    letterSpacing: -2,
  },

  // Title - Split headline (matches real screen)
  titleContainer: {
    alignItems: 'center',
    alignSelf: 'stretch',
    marginBottom: scale(12),
  },
  titleLine1: {
    fontSize: scale(28),
    letterSpacing: 0.5,
    color: staticColors.black,
    textAlign: 'center',
    lineHeight: scale(32),
  },
  titleLine2: {
    fontSize: scale(28),
    letterSpacing: 0.5,
    color: staticColors.black,
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
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
    fontSize: scale(13),
    color: staticColors.gray,
  },
  bylineLink: {
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
    fontSize: scale(13),
    color: staticColors.black,
    textDecorationLine: 'underline',
  },
  bylineDot: {
    fontSize: scale(13),
    color: staticColors.gray,
  },

  // Series
  seriesRow: {
    marginTop: scale(4),
  },
  seriesLink: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: scale(14),
    fontStyle: 'italic',
    color: staticColors.gray,
    textDecorationLine: 'underline',
  },

  // Meta Grid
  metaGrid: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: staticColors.grayLine,
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
    borderColor: staticColors.grayLine,
  },
  metaLabel: {
    fontSize: scale(9),
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: staticColors.gray,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    marginBottom: scale(4),
  },
  metaValue: {
    fontSize: scale(16),
    fontWeight: '600',
    color: staticColors.black,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },

  // Action Row
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
    backgroundColor: staticColors.black,
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
    borderColor: staticColors.black,
    paddingVertical: scale(14),
    borderRadius: scale(6),
  },
  btnText: {
    color: staticColors.black,
    fontSize: scale(14),
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },
  btnTextActive: {
    color: staticColors.white,
  },

  // Progress Section (matches real screen)
  progressSection: {
    paddingVertical: scale(12),
    width: '100%',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(8),
  },
  progressLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  progressLabel: {
    fontSize: scale(11),
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: staticColors.gray,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },
  progressPercent: {
    fontSize: scale(11),
    fontWeight: '600',
    color: staticColors.black,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },
  progressBar: {
    height: scale(3),
    backgroundColor: staticColors.grayLine,
    borderRadius: scale(2),
    marginBottom: scale(8),
  },
  progressFill: {
    height: '100%',
    backgroundColor: staticColors.black,
    borderRadius: scale(2),
  },
  progressTimes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeText: {
    fontSize: scale(10),
    color: staticColors.gray,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
  },

  // Description (simplified - no drop cap in preview)
  descriptionSection: {
    paddingTop: scale(24),
    paddingBottom: scale(16),
    borderBottomWidth: 1,
    borderBottomColor: staticColors.grayLine,
    width: '100%',
  },
  descriptionText: {
    fontSize: scale(14),
    lineHeight: scale(22),
    color: staticColors.black,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    textAlign: 'justify',
  },

  // Genre Pills
  genreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(8),
    marginTop: scale(12),
    width: '100%',
    justifyContent: 'flex-start',
  },
  genrePill: {
    paddingHorizontal: scale(12),
    paddingVertical: scale(6),
    borderWidth: 1,
    borderColor: staticColors.grayLine,
    borderRadius: scale(16),
  },
  genrePillText: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: scale(11),
    color: staticColors.gray,
  },
});

export default SeriesSwipeContainer;
