/**
 * src/features/browse/screens/BrowseScreen.tsx
 *
 * Recommendations screen with interactive map-style layout
 * Users can pan/drag around a large canvas of book covers
 * Book sizes are based on recommendation score (bigger = more likely to enjoy)
 */

import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { apiClient } from '@/core/api';
import { useLibraryCache } from '@/core/cache';
import { usePlayerStore } from '@/features/player';
import { usePreferencesStore } from '@/features/recommendations';
import { useContinueListening } from '@/features/home/hooks/useContinueListening';
import { Icon } from '@/shared/components/Icon';
import { LoadingSpinner } from '@/shared/components';
import { LibraryItem } from '@/core/types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Map canvas is larger than screen - user can pan around
const CANVAS_WIDTH = SCREEN_WIDTH * 3;
const CANVAS_HEIGHT = SCREEN_HEIGHT * 3;

const BG_COLOR = '#0d0d0d';
const ACCENT = '#CCFF00';

// Book size ranges based on score
const MIN_BOOK_SIZE = 70;
const MAX_BOOK_SIZE = 180;

interface BookPosition {
  id: string;
  coverUrl: string;
  title: string;
  author: string;
  x: number;
  y: number;
  size: number;
  score: number;
}

// Deterministic hash for stable positioning
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// Seeded random for stable positions based on book ID
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Score a book based on user preferences and history (no randomness!)
function scoreBook(
  item: LibraryItem,
  preferences: {
    favoriteGenres: string[];
    favoriteAuthors: string[];
    favoriteNarrators: string[];
    prefersSeries: boolean | null;
    preferredLength: string;
  },
  historyAuthors: Set<string>,
  historyGenres: Set<string>,
  historyNarrators: Set<string>,
  alreadyListening: Set<string>
): number {
  let score = 0;
  const metadata = (item.media?.metadata as any) || {};
  const author = metadata.authorName || '';
  const narrator = (metadata.narratorName || '').replace(/^Narrated by\s*/i, '').trim();
  const genres: string[] = metadata.genres || [];
  const duration = item.media?.duration || 0;
  const isSeries = !!metadata.seriesName;
  const progress = item.userMediaProgress?.progress || 0;

  // Skip books already in progress (they show in continue listening)
  if (alreadyListening.has(item.id)) {
    return -1000;
  }

  // Heavily penalize finished books
  if (progress >= 0.95) {
    return -500;
  }

  // Boost unstarted books slightly
  if (progress === 0) {
    score += 5;
  }

  // Match favorite genres (high weight)
  for (const genre of genres) {
    if (preferences.favoriteGenres.some(g => genre.toLowerCase().includes(g.toLowerCase()))) {
      score += 20;
    }
    // Also boost if genre matches history
    if (historyGenres.has(genre.toLowerCase())) {
      score += 10;
    }
  }

  // Match favorite authors (high weight)
  if (preferences.favoriteAuthors.some(a => author.toLowerCase().includes(a.toLowerCase()))) {
    score += 25;
  }
  // Boost authors from history
  if (historyAuthors.has(author.toLowerCase())) {
    score += 15;
  }

  // Match favorite narrators
  if (preferences.favoriteNarrators.some(n => narrator.toLowerCase().includes(n.toLowerCase()))) {
    score += 15;
  }
  if (historyNarrators.has(narrator.toLowerCase())) {
    score += 10;
  }

  // Series preference
  if (preferences.prefersSeries === true && isSeries) {
    score += 10;
  } else if (preferences.prefersSeries === false && !isSeries) {
    score += 10;
  }

  // Length preference
  const hours = duration / 3600;
  if (preferences.preferredLength === 'short' && hours < 8) {
    score += 10;
  } else if (preferences.preferredLength === 'medium' && hours >= 8 && hours <= 20) {
    score += 10;
  } else if (preferences.preferredLength === 'long' && hours > 20) {
    score += 10;
  }

  return score;
}

// Generate stable positions for books on the canvas
function generateBookPositions(
  items: Array<{ item: LibraryItem; score: number }>,
  maxScore: number,
  minScore: number
): BookPosition[] {
  const positions: BookPosition[] = [];
  const occupiedAreas: Array<{ x: number; y: number; size: number }> = [];

  // Center area for highest scored books
  const centerX = CANVAS_WIDTH / 2;
  const centerY = CANVAS_HEIGHT / 2;

  for (const { item, score } of items) {
    // Calculate size based on score (higher score = bigger)
    const normalizedScore = maxScore === minScore
      ? 0.5
      : (score - minScore) / (maxScore - minScore);
    const size = MIN_BOOK_SIZE + (MAX_BOOK_SIZE - MIN_BOOK_SIZE) * normalizedScore;

    // Use hash for deterministic positioning
    const hash = hashString(item.id);

    // Higher scored books closer to center
    const distanceFromCenter = (1 - normalizedScore) * (Math.min(CANVAS_WIDTH, CANVAS_HEIGHT) / 2 - MAX_BOOK_SIZE);
    const angle = seededRandom(hash) * Math.PI * 2;

    let x = centerX + Math.cos(angle) * distanceFromCenter * seededRandom(hash + 1);
    let y = centerY + Math.sin(angle) * distanceFromCenter * seededRandom(hash + 2);

    // Add some spread using seeded random
    x += (seededRandom(hash + 3) - 0.5) * 300;
    y += (seededRandom(hash + 4) - 0.5) * 300;

    // Keep within canvas bounds
    x = Math.max(size / 2 + 20, Math.min(CANVAS_WIDTH - size / 2 - 20, x));
    y = Math.max(size / 2 + 20, Math.min(CANVAS_HEIGHT - size / 2 - 20, y));

    // Simple collision avoidance - nudge if overlapping
    for (const occupied of occupiedAreas) {
      const dx = x - occupied.x;
      const dy = y - occupied.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const minDist = (size + occupied.size) / 2 + 10;

      if (distance < minDist && distance > 0) {
        const pushFactor = (minDist - distance) / distance;
        x += dx * pushFactor * 0.5;
        y += dy * pushFactor * 0.5;
      }
    }

    // Keep within bounds after collision avoidance
    x = Math.max(size / 2 + 20, Math.min(CANVAS_WIDTH - size / 2 - 20, x));
    y = Math.max(size / 2 + 20, Math.min(CANVAS_HEIGHT - size / 2 - 20, y));

    occupiedAreas.push({ x, y, size });

    const metadata = (item.media?.metadata as any) || {};
    positions.push({
      id: item.id,
      coverUrl: apiClient.getItemCoverUrl(item.id),
      title: metadata.title || 'Unknown',
      author: metadata.authorName || 'Unknown',
      x,
      y,
      size,
      score,
    });
  }

  return positions;
}

// Individual book component with touch handling
const BookCover = React.memo(function BookCover({
  book,
  onPress,
}: {
  book: BookPosition;
  onPress: (id: string) => void;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.bookCover,
        {
          left: book.x - book.size / 2,
          top: book.y - book.size / 2,
          width: book.size,
          height: book.size,
        },
      ]}
      onPress={() => onPress(book.id)}
      activeOpacity={0.85}
    >
      <Image
        source={book.coverUrl}
        style={styles.bookImage}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
    </TouchableOpacity>
  );
});

export function BrowseScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { loadBook } = usePlayerStore();

  // Pan/zoom state
  const translateX = useSharedValue(-(CANVAS_WIDTH - SCREEN_WIDTH) / 2);
  const translateY = useSharedValue(-(CANVAS_HEIGHT - SCREEN_HEIGHT) / 2);
  const scale = useSharedValue(1);
  const savedTranslateX = useSharedValue(-(CANVAS_WIDTH - SCREEN_WIDTH) / 2);
  const savedTranslateY = useSharedValue(-(CANVAS_HEIGHT - SCREEN_HEIGHT) / 2);
  const savedScale = useSharedValue(1);

  // Get user preferences
  const {
    favoriteGenres,
    favoriteAuthors,
    favoriteNarrators,
    prefersSeries,
    preferredLength,
  } = usePreferencesStore();

  // Get continue listening for history context
  const { items: continueItems } = useContinueListening();

  // Use library cache (already loaded on app startup)
  const { items: libraryItems, isLoaded, isLoading } = useLibraryCache();

  // Extract history context from continue listening
  const historyContext = useMemo(() => {
    const authors = new Set<string>();
    const genres = new Set<string>();
    const narrators = new Set<string>();
    const listeningIds = new Set<string>();

    for (const item of continueItems) {
      listeningIds.add(item.id);
      const metadata = (item.media?.metadata as any) || {};
      if (metadata.authorName) authors.add(metadata.authorName.toLowerCase());
      if (metadata.narratorName) {
        const narrator = metadata.narratorName.replace(/^Narrated by\s*/i, '').trim();
        if (narrator) narrators.add(narrator.toLowerCase());
      }
      for (const genre of (metadata.genres || [])) {
        genres.add(genre.toLowerCase());
      }
    }

    return { authors, genres, narrators, listeningIds };
  }, [continueItems]);

  // Score and sort all items based on preferences (stable - no randomness)
  const scoredItems = useMemo(() => {
    if (!isLoaded || !libraryItems.length) return [];
    const preferences = { favoriteGenres, favoriteAuthors, favoriteNarrators, prefersSeries, preferredLength };

    const scored = libraryItems.map((item: LibraryItem) => ({
      item,
      score: scoreBook(
        item,
        preferences,
        historyContext.authors,
        historyContext.genres,
        historyContext.narrators,
        historyContext.listeningIds
      ),
    }));

    // Filter out very negative scores and sort by score descending
    return scored
      .filter(s => s.score > -100)
      .sort((a, b) => b.score - a.score)
      .slice(0, 60); // Limit for performance
  }, [libraryItems, isLoaded, favoriteGenres, favoriteAuthors, favoriteNarrators, prefersSeries, preferredLength, historyContext]);

  // Generate stable book positions
  const bookPositions = useMemo(() => {
    if (scoredItems.length === 0) return [];

    const scores = scoredItems.map(s => s.score);
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);

    return generateBookPositions(scoredItems, maxScore, minScore);
  }, [scoredItems]);

  // Pan gesture
  const panGesture = Gesture.Pan()
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      translateX.value = savedTranslateX.value + event.translationX;
      translateY.value = savedTranslateY.value + event.translationY;
    })
    .onEnd((event) => {
      // Apply momentum
      const velocityFactor = 0.2;
      translateX.value = withSpring(
        translateX.value + event.velocityX * velocityFactor,
        { damping: 20, stiffness: 100 }
      );
      translateY.value = withSpring(
        translateY.value + event.velocityY * velocityFactor,
        { damping: 20, stiffness: 100 }
      );
    });

  // Pinch gesture for zoom
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((event) => {
      scale.value = Math.max(0.5, Math.min(2.5, savedScale.value * event.scale));
    })
    .onEnd(() => {
      // Snap to reasonable zoom levels
      if (scale.value < 0.7) {
        scale.value = withTiming(0.5, { duration: 200 });
      } else if (scale.value > 2) {
        scale.value = withTiming(2.5, { duration: 200 });
      }
    });

  // Combine gestures
  const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture);

  // Animated canvas style
  const canvasStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  // Handle book press - open player without autoplay
  const handleBookPress = useCallback(async (bookId: string) => {
    try {
      const fullBook = await apiClient.getItem(bookId);
      await loadBook(fullBook, { autoPlay: false });
    } catch (err) {
      console.error('Failed to open book:', err);
    }
  }, [loadBook]);

  // Reset view to center
  const handleResetView = useCallback(() => {
    translateX.value = withSpring(-(CANVAS_WIDTH - SCREEN_WIDTH) / 2, { damping: 15 });
    translateY.value = withSpring(-(CANVAS_HEIGHT - SCREEN_HEIGHT) / 2, { damping: 15 });
    scale.value = withSpring(1, { damping: 15 });
  }, []);

  if (isLoading || !isLoaded) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={BG_COLOR} />
        <LoadingSpinner text="Loading recommendations..." />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BG_COLOR} />

      {/* Interactive map canvas */}
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={[styles.canvas, canvasStyle]}>
          {bookPositions.map((book) => (
            <BookCover
              key={book.id}
              book={book}
              onPress={handleBookPress}
            />
          ))}
        </Animated.View>
      </GestureDetector>

      {/* Header overlay */}
      <View style={[styles.headerOverlay, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Icon name="chevron-back" size={24} color="#FFFFFF" set="ionicons" />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Discover</Text>
            <Text style={styles.headerSubtitle}>
              Drag to explore • Bigger = Better match
            </Text>
          </View>
          <TouchableOpacity
            style={styles.preferencesButton}
            onPress={() => navigation.navigate('Preferences')}
          >
            <Icon name="options-outline" size={22} color={ACCENT} set="ionicons" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom controls */}
      <View style={[styles.bottomControls, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity style={styles.controlButton} onPress={handleResetView}>
          <Icon name="locate-outline" size={22} color="#FFFFFF" set="ionicons" />
          <Text style={styles.controlText}>Center</Text>
        </TouchableOpacity>

        <View style={styles.bookCount}>
          <Text style={styles.countText}>{bookPositions.length} books</Text>
        </View>
      </View>

      {/* Empty state */}
      {bookPositions.length === 0 && (
        <View style={styles.emptyState}>
          <Icon name="library-outline" size={48} color="rgba(255,255,255,0.3)" set="ionicons" />
          <Text style={styles.emptyTitle}>No recommendations yet</Text>
          <Text style={styles.emptySubtitle}>
            Start listening to some books and we'll personalize your recommendations
          </Text>
        </View>
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_COLOR,
  },
  canvas: {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    position: 'absolute',
  },
  bookCover: {
    position: 'absolute',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#2a2a2a',
    // Shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  bookImage: {
    width: '100%',
    height: '100%',
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(13, 13, 13, 0.85)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  preferencesButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(204, 255, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: 'rgba(13, 13, 13, 0.85)',
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  controlText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bookCount: {
    backgroundColor: 'rgba(204, 255, 0, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  countText: {
    fontSize: 14,
    fontWeight: '600',
    color: ACCENT,
  },
  emptyState: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 20,
  },
});
