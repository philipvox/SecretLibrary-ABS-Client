/**
 * src/features/reading-history-wizard/screens/MarkBooksScreen.tsx
 *
 * Redesigned swipe interface for marking books as finished.
 * Features:
 * - Portrait card aspect ratio (2:3) matching book covers
 * - Card stack visual with 3 cards (peek behind effect)
 * - Swipe overlays with color-coded feedback
 * - Progress bar showing library completion
 * - Pill-style view tabs
 * - Redesigned stats row and action buttons
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  PartyPopper,
  X,
  Check,
  CheckCircle,
  Clock,
  Circle,
  Undo2,
  ArrowRight,
  ArrowLeft,
  User,
  Library,
  BookOpen,
  ChevronDown,
} from 'lucide-react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { useGalleryStore } from '../stores/galleryStore';
import { useFinishedBookIds, useUndoableMarkFinished } from '@/core/hooks/useUserBooks';
import { useLibraryCache, getAllAuthors, getAllSeries } from '@/core/cache/libraryCache';
import { useQueueStore } from '@/features/queue/stores/queueStore';
import { getCoverUrl } from '@/core/cache';
import { LibraryItem } from '@/core/types';
import { useTheme, wp, hp, moderateScale, spacing, ACCENT, colors } from '@/shared/theme';

// =============================================================================
// LAYOUT CONSTANTS (from spec)
// =============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const LAYOUT = {
  // Card dimensions
  CARD_WIDTH: wp(65),
  get CARD_HEIGHT() { return this.CARD_WIDTH * 1.5; }, // 2:3 aspect ratio
  CARD_RADIUS: wp(65) * 0.04,

  // Card stack
  STACK_OFFSET_Y: wp(2),
  STACK_SCALE_STEP: 0.05,
  STACK_OPACITY_STEP: 0.3,

  // Swipe thresholds
  SWIPE_THRESHOLD: wp(25),
  SWIPE_UP_THRESHOLD: hp(10),

  // Action buttons
  ACTION_BUTTON_SIZE: wp(14),
  ACTION_BUTTON_SMALL: wp(12),

  // Spacing
  HORIZONTAL_PADDING: wp(5.5),
};

// =============================================================================
// THEME COLORS INTERFACE (for createStyles)
// =============================================================================

interface ThemeColorsConfig {
  accent: string;
  accentDim: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textHint: string;
  textInverse: string;
  surface: string;
  surfaceBorder: string;
  success: string;
  info: string;
  skip: string;
  badgeBook: string;
  badgeAuthor: string;
  badgeSeries: string;
  background: string;
}

// =============================================================================
// TYPES
// =============================================================================

type CardType = 'author' | 'series' | 'book';
type ViewLevel = 'top' | 'author-series' | 'series-books' | 'author-books';
type TabView = 'books' | 'authors' | 'series';

interface CardData {
  type: CardType;
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  count?: number;
  coverUrl?: string | null;
  bookIds?: string[];
  seriesNames?: string[];
  unmarkedCount?: number;
}

interface UndoEntry {
  action: 'mark' | 'skip' | 'mark-all';
  cardType: CardType;
  ids: string[];
  title: string;
  level: ViewLevel;
  context?: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getMetadata(item: LibraryItem): any {
  return (item.media?.metadata as any) || {};
}

function getTitle(item: LibraryItem): string {
  return getMetadata(item).title || 'Unknown Title';
}

function getAuthorName(item: LibraryItem): string {
  return getMetadata(item).authorName || '';
}

function getSeriesName(item: LibraryItem): string {
  const name = getMetadata(item).seriesName || '';
  return name.replace(/\s*#[\d.]+$/, '').trim();
}

function getDuration(item: LibraryItem): string {
  const duration = (item.media as any)?.duration || 0;
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function getGenres(item: LibraryItem): string[] {
  return getMetadata(item).genres || [];
}

// =============================================================================
// PROGRESS BAR COMPONENT
// =============================================================================

interface ProgressBarProps {
  processed: number;
  total: number;
  finished: number;
}

function ProgressBar({ processed, total, finished }: ProgressBarProps) {
  const progress = total > 0 ? (processed / total) * 100 : 0;
  const remaining = total - processed;

  let label = '';
  if (progress === 0) {
    label = 'Start marking books you\'ve finished';
  } else if (progress >= 100) {
    label = `All done! ${finished} books marked as finished`;
  } else {
    label = `${Math.round(progress)}% through library • ${finished} finished • ${remaining} remaining`;
  }

  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressFill,
            { width: `${Math.min(progress, 100)}%` }
          ]}
        />
      </View>
      <Text style={styles.progressLabel}>{label}</Text>
    </View>
  );
}

// =============================================================================
// VIEW TABS COMPONENT
// =============================================================================

interface ViewTabsProps {
  activeTab: TabView;
  onTabChange: (tab: TabView) => void;
  counts: { books: number; authors: number; series: number };
}

function ViewTabs({ activeTab, onTabChange, counts }: ViewTabsProps) {
  const tabs: { key: TabView; label: string; count: number }[] = [
    { key: 'books', label: 'Books', count: counts.books },
    { key: 'authors', label: 'Authors', count: counts.authors },
    { key: 'series', label: 'Series', count: counts.series },
  ];

  return (
    <View style={styles.tabsContainer}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabPill, isActive && styles.tabPillActive]}
            onPress={() => {
              Haptics.selectionAsync();
              onTabChange(tab.key);
            }}
          >
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
              {tab.label} {tab.count}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// =============================================================================
// STATS ROW COMPONENT
// =============================================================================

interface StatsRowProps {
  finished: number;
  queued: number;
  remaining: number;
  onFinishedPress: () => void;
}

function StatsRow({ finished, queued, remaining, onFinishedPress }: StatsRowProps) {
  return (
    <View style={styles.statsContainer}>
      <TouchableOpacity style={styles.statItem} onPress={onFinishedPress}>
        <View style={styles.statIconRow}>
          <CheckCircle size={wp(4.5)} color={COLORS.success} strokeWidth={2} />
          <Text style={styles.statValue}>{finished}</Text>
        </View>
        <Text style={[styles.statLabel, { color: COLORS.accent }]}>Finished →</Text>
      </TouchableOpacity>

      <View style={styles.statDivider} />

      <View style={styles.statItem}>
        <View style={styles.statIconRow}>
          <Clock size={wp(4.5)} color={COLORS.info} strokeWidth={2} />
          <Text style={styles.statValue}>{queued}</Text>
        </View>
        <Text style={styles.statLabel}>Queued</Text>
      </View>

      <View style={styles.statDivider} />

      <View style={styles.statItem}>
        <View style={styles.statIconRow}>
          <Circle size={wp(4.5)} color={COLORS.textTertiary} strokeWidth={2} />
          <Text style={styles.statValue}>{remaining}</Text>
        </View>
        <Text style={styles.statLabel}>Remaining</Text>
      </View>
    </View>
  );
}

// =============================================================================
// ACTION BUTTONS COMPONENT
// =============================================================================

interface ActionButtonsProps {
  onSkip: () => void;
  onUndo: () => void;
  onQueue?: () => void;
  onFinished: () => void;
  canUndo: boolean;
  undoCount: number;
  cardType: CardType;
}

function ActionButtons({
  onSkip,
  onUndo,
  onQueue,
  onFinished,
  canUndo,
  undoCount,
  cardType,
}: ActionButtonsProps) {
  const handlePress = (action: () => void) => {
    Haptics.selectionAsync();
    action();
  };

  const rightHint = cardType === 'book'
    ? 'Finished →'
    : 'View books →';

  return (
    <View style={styles.actionContainer}>
      <View style={styles.actionRow}>
        {/* Skip */}
        <TouchableOpacity
          style={[styles.actionButton, styles.skipButton]}
          onPress={() => handlePress(onSkip)}
        >
          <X size={wp(6)} color={COLORS.skip} strokeWidth={2.5} />
        </TouchableOpacity>

        {/* Undo */}
        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.undoButton,
            !canUndo && styles.actionButtonDisabled,
          ]}
          onPress={() => canUndo && handlePress(onUndo)}
          disabled={!canUndo}
        >
          <Undo2
            size={wp(5)}
            color={canUndo ? COLORS.textTertiary : 'rgba(255,255,255,0.2)'}
            strokeWidth={2}
          />
          {undoCount > 0 && (
            <View style={styles.undoBadge}>
              <Text style={styles.undoBadgeText}>{undoCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Queue (books only) */}
        {cardType === 'book' && onQueue && (
          <TouchableOpacity
            style={[styles.actionButton, styles.queueButton]}
            onPress={() => handlePress(onQueue)}
          >
            <Clock size={wp(6)} color={COLORS.info} strokeWidth={2} />
          </TouchableOpacity>
        )}

        {/* Finished/View */}
        <TouchableOpacity
          style={[styles.actionButton, styles.finishedButton]}
          onPress={() => handlePress(onFinished)}
        >
          {cardType === 'book' ? (
            <Check size={wp(7)} color={COLORS.textInverse} strokeWidth={3} />
          ) : (
            <ArrowRight size={wp(7)} color={COLORS.textInverse} strokeWidth={2.5} />
          )}
        </TouchableOpacity>
      </View>

      {/* Hints */}
      <View style={styles.hintsRow}>
        <Text style={styles.hintText}>← Skip</Text>
        {cardType === 'book' && <Text style={styles.hintText}>↑ Queue</Text>}
        <Text style={styles.hintText}>{rightHint}</Text>
      </View>
    </View>
  );
}

// =============================================================================
// SWIPE CARD COMPONENT
// =============================================================================

interface SwipeCardProps {
  card: CardData;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onSwipeUp?: () => void;
  stackIndex: number;
}

function SwipeCard({
  card,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  stackIndex,
}: SwipeCardProps) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const isGestureActive = useSharedValue(false);

  const triggerThresholdHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const triggerActionHaptic = useCallback((type: 'finished' | 'skip' | 'queue') => {
    if (type === 'finished') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (type === 'queue') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const panGesture = Gesture.Pan()
    .enabled(stackIndex === 0)
    .onStart(() => {
      'worklet';
      isGestureActive.value = true;
    })
    .onUpdate((event) => {
      'worklet';
      const isSwipingUp =
        event.translationY < -30 &&
        Math.abs(event.translationY) > Math.abs(event.translationX);

      if (isSwipingUp && onSwipeUp) {
        translateY.value = event.translationY;
        translateX.value = 0;
      } else {
        translateX.value = event.translationX;
        translateY.value = event.translationY * 0.3;
      }

      // Threshold haptic
      const threshold = LAYOUT.SWIPE_THRESHOLD;
      if (
        (Math.abs(event.translationX) > threshold - 5 &&
          Math.abs(event.translationX) < threshold + 5) ||
        (event.translationY < -(LAYOUT.SWIPE_UP_THRESHOLD - 5) &&
          event.translationY > -(LAYOUT.SWIPE_UP_THRESHOLD + 5))
      ) {
        runOnJS(triggerThresholdHaptic)();
      }
    })
    .onEnd((event) => {
      'worklet';
      isGestureActive.value = false;

      const isSwipingUp =
        event.translationY < -LAYOUT.SWIPE_UP_THRESHOLD &&
        Math.abs(event.translationY) > Math.abs(event.translationX);

      if (isSwipingUp && onSwipeUp) {
        translateY.value = withTiming(-SCREEN_HEIGHT, { duration: 350 });
        runOnJS(triggerActionHaptic)('queue');
        runOnJS(onSwipeUp)();
      } else if (event.translationX > LAYOUT.SWIPE_THRESHOLD) {
        translateX.value = withTiming(SCREEN_WIDTH * 1.5, { duration: 300 });
        runOnJS(triggerActionHaptic)('finished');
        runOnJS(onSwipeRight)();
      } else if (event.translationX < -LAYOUT.SWIPE_THRESHOLD) {
        translateX.value = withTiming(-SCREEN_WIDTH * 1.5, { duration: 300 });
        runOnJS(triggerActionHaptic)('skip');
        runOnJS(onSwipeLeft)();
      } else {
        translateX.value = withSpring(0, { damping: 15 });
        translateY.value = withSpring(0, { damping: 15 });
      }
    });

  // Card transform style
  const cardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
      [-15, 0, 15],
      Extrapolation.CLAMP
    );

    // Stack positioning
    const stackScale = 1 - stackIndex * LAYOUT.STACK_SCALE_STEP;
    const stackTranslateY = stackIndex * LAYOUT.STACK_OFFSET_Y;
    const stackOpacity = 1 - stackIndex * LAYOUT.STACK_OPACITY_STEP;

    return {
      transform: [
        { translateX: stackIndex === 0 ? translateX.value : 0 },
        { translateY: stackIndex === 0 ? translateY.value + stackTranslateY : stackTranslateY },
        { rotate: stackIndex === 0 ? `${rotate}deg` : '0deg' },
        { scale: stackScale },
      ],
      opacity: stackOpacity,
      zIndex: 10 - stackIndex,
    };
  });

  // Overlay styles
  const rightOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, LAYOUT.SWIPE_THRESHOLD],
      [0, 0.5],
      Extrapolation.CLAMP
    ),
  }));

  const leftOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-LAYOUT.SWIPE_THRESHOLD, 0],
      [0.5, 0],
      Extrapolation.CLAMP
    ),
  }));

  const upOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.value,
      [-LAYOUT.SWIPE_UP_THRESHOLD, 0],
      [0.5, 0],
      Extrapolation.CLAMP
    ),
  }));

  // Badge colors
  const badgeColors: Record<CardType, { bg: string; text: string }> = {
    book: { bg: COLORS.badgeBook, text: COLORS.textInverse },
    author: { bg: COLORS.badgeAuthor, text: COLORS.textPrimary },
    series: { bg: COLORS.badgeSeries, text: COLORS.textPrimary },
  };

  const overlayText = card.type === 'book' ? '✓ FINISHED' : '→ VIEW';

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.card, cardStyle]}>
        {/* Cover Image */}
        {card.coverUrl ? (
          <Image source={card.coverUrl} style={styles.cardCover} contentFit="cover" />
        ) : (
          <View style={[styles.cardCover, styles.cardCoverPlaceholder]}>
            {card.type === 'author' ? (
              <User size={wp(20)} color="rgba(255,255,255,0.3)" strokeWidth={1.5} />
            ) : card.type === 'series' ? (
              <Library size={wp(20)} color="rgba(255,255,255,0.3)" strokeWidth={1.5} />
            ) : (
              <BookOpen size={wp(20)} color="rgba(255,255,255,0.3)" strokeWidth={1.5} />
            )}
          </View>
        )}

        {/* Gradient Overlay */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.85)']}
          style={styles.cardGradient}
        />

        {/* Badge */}
        <View style={[styles.cardBadge, { backgroundColor: badgeColors[card.type].bg }]}>
          <Text style={[styles.cardBadgeText, { color: badgeColors[card.type].text }]}>
            {card.type.toUpperCase()}
          </Text>
          <ChevronDown
            size={moderateScale(10)}
            color={badgeColors[card.type].text}
            strokeWidth={2.5}
          />
        </View>

        {/* Swipe Overlays */}
        <Animated.View style={[styles.swipeOverlay, styles.rightOverlay, rightOverlayStyle]}>
          <Text style={styles.swipeOverlayText}>{overlayText}</Text>
        </Animated.View>

        <Animated.View style={[styles.swipeOverlay, styles.leftOverlay, leftOverlayStyle]}>
          <Text style={styles.swipeOverlayText}>✕ SKIP</Text>
        </Animated.View>

        {onSwipeUp && (
          <Animated.View style={[styles.swipeOverlay, styles.upOverlay, upOverlayStyle]}>
            <Text style={styles.swipeOverlayText}>+ QUEUE</Text>
          </Animated.View>
        )}

        {/* Text Content */}
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {card.title}
          </Text>
          {card.subtitle && (
            <Text style={styles.cardSubtitle} numberOfLines={1}>
              {card.subtitle}
            </Text>
          )}
          {card.meta && (
            <Text style={styles.cardMeta} numberOfLines={1}>
              {card.meta}
            </Text>
          )}
          {card.count !== undefined && card.type !== 'book' && (
            <Text style={styles.cardMeta}>
              {card.count} {card.type === 'author' ? (card.seriesNames?.length ? 'series' : 'books') : 'books'}
            </Text>
          )}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

// =============================================================================
// EMPTY STATE COMPONENT
// =============================================================================

interface EmptyStateProps {
  markedCount: number;
  viewLevel: ViewLevel;
  onViewHistory: () => void;
  onStartOver: () => void;
  onBackToTop: () => void;
}

function EmptyState({
  markedCount,
  viewLevel,
  onViewHistory,
  onStartOver,
  onBackToTop,
}: EmptyStateProps) {
  return (
    <Animated.View style={styles.emptyState} entering={FadeIn.duration(300)}>
      <View style={styles.emptyIconContainer}>
        <PartyPopper size={moderateScale(48)} color={colors.accent.primary} strokeWidth={1.5} />
      </View>
      <Text style={styles.emptyTitle}>
        {viewLevel === 'top' ? 'All caught up!' : 'Section complete!'}
      </Text>
      <Text style={styles.emptySubtitle}>
        You've gone through all {viewLevel === 'top' ? 'books' : 'items'} in this view.
      </Text>

      <TouchableOpacity style={styles.emptyButtonPrimary} onPress={onViewHistory}>
        <Text style={styles.emptyButtonPrimaryText}>
          View History ({markedCount})
        </Text>
      </TouchableOpacity>

      {viewLevel !== 'top' ? (
        <TouchableOpacity style={styles.emptyButtonSecondary} onPress={onBackToTop}>
          <Text style={styles.emptyButtonSecondaryText}>Back to All</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.emptyButtonSecondary} onPress={onStartOver}>
          <Text style={styles.emptyButtonSecondaryText}>Start Over</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// =============================================================================
// MAIN SCREEN COMPONENT
// =============================================================================

export function MarkBooksScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  // Theme-aware colors
  const { colors: themeColors } = useTheme();
  const COLORS: ThemeColorsConfig = useMemo(() => ({
    accent: colors.accent.primary,
    accentDim: themeColors.accent.primarySubtle,
    textPrimary: themeColors.text.primary,
    textSecondary: themeColors.text.secondary,
    textTertiary: themeColors.text.tertiary,
    textHint: themeColors.text.disabled,
    textInverse: themeColors.text.inverse,
    surface: themeColors.surface.default,
    surfaceBorder: themeColors.border.default,
    success: themeColors.semantic.success,
    info: themeColors.semantic.info,
    skip: themeColors.text.disabled,
    badgeBook: themeColors.accent.primary,
    badgeAuthor: '#8B5CF6', // Feature-specific purple - kept as-is
    badgeSeries: themeColors.semantic.info,
    background: themeColors.background.primary,
  }), [themeColors]);

  // Theme-aware styles
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  // Library data
  const items = useLibraryCache((s) => s.items);

  // Finished books from SQLite (single source of truth)
  const finishedBookIds = useFinishedBookIds();
  const { mark: markBookFinished, unmark: unmarkBookFinished, undo: _undoLastMark, _canUndo, _isProcessing } = useUndoableMarkFinished();

  // Gallery store for session/wizard UI state only
  const startSession = useGalleryStore((s) => s.startSession);
  const endSession = useGalleryStore((s) => s.endSession);
  const processedAuthors = useGalleryStore((s) => s.processedAuthors);
  const processedSeries = useGalleryStore((s) => s.processedSeries);
  const markAuthorProcessed = useGalleryStore((s) => s.markAuthorProcessed);
  const markSeriesProcessed = useGalleryStore((s) => s.markSeriesProcessed);

  // Queue store
  const addToQueue = useQueueStore((s) => s.addToQueue);

  // Session state
  const [queuedBooks, setQueuedBooks] = useState<Set<string>>(new Set());
  const [viewLevel, setViewLevel] = useState<ViewLevel>('top');
  const [currentAuthor, setCurrentAuthor] = useState<string | null>(null);
  const [currentSeries, setCurrentSeries] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<TabView>('books');

  // Skipped items
  const [skippedAuthors, setSkippedAuthors] = useState<Set<string>>(new Set());
  const [skippedSeries, setSkippedSeries] = useState<Set<string>>(new Set());
  const [skippedBooks, setSkippedBooks] = useState<Set<string>>(new Set());

  // Undo history
  const [undoHistory, setUndoHistory] = useState<UndoEntry[]>([]);

  // Data aggregation
  const authorsData = useMemo(() => {
    const authors = getAllAuthors();
    return authors.map((author) => {
      const seriesSet = new Set<string>();
      author.books.forEach((book) => {
        const series = getSeriesName(book);
        if (series) seriesSet.add(series);
      });
      return {
        ...author,
        seriesNames: Array.from(seriesSet),
      };
    }).filter((a) => a.books.length > 0);
  }, []);

  const seriesData = useMemo(() => getAllSeries(), []);

  // Affinity scores
  const authorAffinityScores = useMemo(() => {
    const scores: Record<string, number> = {};
    for (const bookId of finishedBookIds) {
      const item = items.find((i) => i.id === bookId);
      if (item) {
        const authorName = getAuthorName(item);
        if (authorName) {
          scores[authorName] = (scores[authorName] || 0) + 1;
        }
      }
    }
    return scores;
  }, [finishedBookIds, items]);

  const seriesAffinityScores = useMemo(() => {
    const scores: Record<string, number> = {};
    for (const bookId of finishedBookIds) {
      const item = items.find((i) => i.id === bookId);
      if (item) {
        const seriesName = getSeriesName(item);
        if (seriesName) {
          scores[seriesName] = (scores[seriesName] || 0) + 1;
        }
      }
    }
    return scores;
  }, [finishedBookIds, items]);

  // Tab counts
  const tabCounts = useMemo(() => {
    const unmarkedBooks = items.filter(
      (b) => !skippedBooks.has(b.id) && !finishedBookIds.has(b.id)
    ).length;

    const unmarkedAuthors = authorsData.filter((a) => {
      if (skippedAuthors.has(a.name)) return false;
      return a.books.some((b) => !finishedBookIds.has(b.id));
    }).length;

    const unmarkedSeries = seriesData.filter((s) => {
      if (skippedSeries.has(s.name)) return false;
      return s.books.some((b) => !finishedBookIds.has(b.id));
    }).length;

    return {
      books: unmarkedBooks,
      authors: unmarkedAuthors,
      series: unmarkedSeries,
    };
  }, [items, authorsData, seriesData, skippedBooks, skippedAuthors, skippedSeries, finishedBookIds]);

  // Build cards
  const cards = useMemo((): CardData[] => {
    if (viewLevel === 'top') {
      if (activeTab === 'books') {
        const bookCards = items
          .filter((book) => !skippedBooks.has(book.id) && !finishedBookIds.has(book.id))
          .map((book) => {
            const authorName = getAuthorName(book);
            const seriesName = getSeriesName(book);
            const duration = getDuration(book);
            const genres = getGenres(book);
            return {
              type: 'book' as CardType,
              id: book.id,
              title: getTitle(book),
              subtitle: authorName || undefined,
              meta: [duration, genres[0]].filter(Boolean).join(' • '),
              coverUrl: getCoverUrl(book.id),
              _authorName: authorName,
              _seriesName: seriesName,
            } as CardData & { _authorName?: string; _seriesName?: string };
          });

        return bookCards.sort((a, b) => {
          const aExt = a as CardData & { _authorName?: string; _seriesName?: string };
          const bExt = b as CardData & { _authorName?: string; _seriesName?: string };
          const totalA = (authorAffinityScores[aExt._authorName || ''] || 0) +
                         (seriesAffinityScores[aExt._seriesName || ''] || 0);
          const totalB = (authorAffinityScores[bExt._authorName || ''] || 0) +
                         (seriesAffinityScores[bExt._seriesName || ''] || 0);
          if (totalA !== totalB) return totalB - totalA;
          return a.title.localeCompare(b.title);
        });
      } else if (activeTab === 'authors') {
        return authorsData
          .filter((a) => !skippedAuthors.has(a.name))
          .map((author) => {
            const unmarkedBooks = author.books.filter((b) => !finishedBookIds.has(b.id));
            return {
              type: 'author' as CardType,
              id: author.name,
              title: author.name,
              count: author.seriesNames.length > 0 ? author.seriesNames.length : author.books.length,
              coverUrl: author.books[0] ? getCoverUrl(author.books[0].id) : null,
              bookIds: author.books.map((b) => b.id),
              seriesNames: author.seriesNames,
              unmarkedCount: unmarkedBooks.length,
            };
          })
          .filter((a) => (a.unmarkedCount || 0) > 0)
          .sort((a, b) => {
            const aProcessed = processedAuthors.has(a.id);
            const bProcessed = processedAuthors.has(b.id);
            if (aProcessed !== bProcessed) return aProcessed ? 1 : -1;
            const affinityA = authorAffinityScores[a.id] || 0;
            const affinityB = authorAffinityScores[b.id] || 0;
            if (affinityA !== affinityB) return affinityB - affinityA;
            return (b.count || 0) - (a.count || 0);
          });
      } else {
        return seriesData
          .filter((s) => !skippedSeries.has(s.name))
          .map((series) => {
            const unmarkedBooks = series.books.filter((b) => !finishedBookIds.has(b.id));
            return {
              type: 'series' as CardType,
              id: series.name,
              title: series.name,
              subtitle: getAuthorName(series.books[0]) || undefined,
              count: series.books.length,
              coverUrl: series.books[0] ? getCoverUrl(series.books[0].id) : null,
              bookIds: series.books.map((b) => b.id),
              unmarkedCount: unmarkedBooks.length,
            };
          })
          .filter((s) => (s.unmarkedCount || 0) > 0)
          .sort((a, b) => {
            const aProcessed = processedSeries.has(a.id);
            const bProcessed = processedSeries.has(b.id);
            if (aProcessed !== bProcessed) return aProcessed ? 1 : -1;
            const affinityA = seriesAffinityScores[a.id] || 0;
            const affinityB = seriesAffinityScores[b.id] || 0;
            if (affinityA !== affinityB) return affinityB - affinityA;
            return (b.count || 0) - (a.count || 0);
          });
      }
    }

    if (viewLevel === 'author-series' && currentAuthor) {
      const author = authorsData.find((a) => a.name === currentAuthor);
      if (!author) return [];

      const seriesCards: CardData[] = author.seriesNames
        .filter((s) => !skippedSeries.has(s))
        .map((seriesName) => {
          const seriesInfo = seriesData.find((s) => s.name === seriesName);
          const books = seriesInfo?.books || [];
          return {
            type: 'series' as CardType,
            id: seriesName,
            title: seriesName,
            subtitle: currentAuthor,
            count: books.length,
            coverUrl: books[0] ? getCoverUrl(books[0].id) : null,
            bookIds: books.map((b) => b.id),
          };
        });

      const booksNotInSeries = author.books.filter((b) => !getSeriesName(b));
      if (booksNotInSeries.length > 0) {
        seriesCards.push({
          type: 'series' as CardType,
          id: `${currentAuthor}-other`,
          title: 'Other Books',
          subtitle: currentAuthor,
          count: booksNotInSeries.length,
          coverUrl: getCoverUrl(booksNotInSeries[0].id),
          bookIds: booksNotInSeries.map((b) => b.id),
        });
      }

      return seriesCards;
    }

    if (viewLevel === 'author-books' && currentAuthor) {
      const author = authorsData.find((a) => a.name === currentAuthor);
      if (!author) return [];

      return author.books
        .filter((b) => !skippedBooks.has(b.id) && !finishedBookIds.has(b.id))
        .map((book) => ({
          type: 'book' as CardType,
          id: book.id,
          title: getTitle(book),
          subtitle: currentAuthor,
          meta: getDuration(book),
          coverUrl: getCoverUrl(book.id),
        }));
    }

    if (viewLevel === 'series-books' && currentSeries) {
      const series = seriesData.find((s) => s.name === currentSeries);
      if (!series) {
        if (currentSeries.endsWith('-other') && currentAuthor) {
          const author = authorsData.find((a) => a.name === currentAuthor);
          const booksNotInSeries = author?.books.filter((b) => !getSeriesName(b)) || [];
          return booksNotInSeries
            .filter((b) => !skippedBooks.has(b.id) && !finishedBookIds.has(b.id))
            .map((book) => ({
              type: 'book' as CardType,
              id: book.id,
              title: getTitle(book),
              subtitle: currentAuthor || undefined,
              meta: getDuration(book),
              coverUrl: getCoverUrl(book.id),
            }));
        }
        return [];
      }

      return series.books
        .filter((b) => !skippedBooks.has(b.id) && !finishedBookIds.has(b.id))
        .map((book) => ({
          type: 'book' as CardType,
          id: book.id,
          title: getTitle(book),
          subtitle: currentSeries,
          meta: getDuration(book),
          coverUrl: getCoverUrl(book.id),
        }));
    }

    return [];
  }, [
    viewLevel, activeTab, currentAuthor, currentSeries, items, authorsData, seriesData,
    skippedAuthors, skippedSeries, skippedBooks, finishedBookIds,
    authorAffinityScores, seriesAffinityScores, processedAuthors, processedSeries,
  ]);

  // Start session
  useEffect(() => {
    startSession();
  }, [startSession]);

  // Handlers
  const handleSwipeRight = useCallback(() => {
    const currentCard = cards[0];
    if (!currentCard) return;

    if (currentCard.type === 'author') {
      const author = authorsData.find((a) => a.name === currentCard.id);
      markAuthorProcessed(currentCard.id);

      setUndoHistory((prev) => [...prev, {
        action: 'skip',
        cardType: 'author',
        ids: [currentCard.id],
        title: currentCard.title,
        level: viewLevel,
      }]);

      if (author?.seriesNames && author.seriesNames.length > 0) {
        setCurrentAuthor(currentCard.id);
        setBreadcrumb([currentCard.title]);
        setViewLevel('author-series');
      } else {
        setCurrentAuthor(currentCard.id);
        setBreadcrumb([currentCard.title]);
        setViewLevel('author-books');
      }
    } else if (currentCard.type === 'series') {
      markSeriesProcessed(currentCard.id);

      setUndoHistory((prev) => [...prev, {
        action: 'skip',
        cardType: 'series',
        ids: [currentCard.id],
        title: currentCard.title,
        level: viewLevel,
        context: currentAuthor || undefined,
      }]);

      setCurrentSeries(currentCard.id);
      setBreadcrumb((prev) => [...prev, currentCard.title]);
      setViewLevel('series-books');
    } else if (currentCard.type === 'book') {
      setUndoHistory((prev) => [...prev, {
        action: 'mark',
        cardType: 'book',
        ids: [currentCard.id],
        title: currentCard.title,
        level: viewLevel,
      }]);
      markBookFinished(currentCard.id, 'manual');
    }
  }, [cards, authorsData, viewLevel, currentAuthor, markBookFinished, markAuthorProcessed, markSeriesProcessed]);

  const handleSwipeLeft = useCallback(() => {
    const currentCard = cards[0];
    if (!currentCard) return;

    setUndoHistory((prev) => [...prev, {
      action: 'skip',
      cardType: currentCard.type,
      ids: [currentCard.id],
      title: currentCard.title,
      level: viewLevel,
    }]);

    if (currentCard.type === 'author') {
      setSkippedAuthors((prev) => new Set(prev).add(currentCard.id));
      markAuthorProcessed(currentCard.id);
    } else if (currentCard.type === 'series') {
      setSkippedSeries((prev) => new Set(prev).add(currentCard.id));
      markSeriesProcessed(currentCard.id);
    } else {
      setSkippedBooks((prev) => new Set(prev).add(currentCard.id));
    }
  }, [cards, viewLevel, markAuthorProcessed, markSeriesProcessed]);

  const handleSwipeUp = useCallback(() => {
    const currentCard = cards[0];
    if (!currentCard || currentCard.type !== 'book') return;

    const item = items.find((i) => i.id === currentCard.id);
    if (item) {
      addToQueue(item);
      setQueuedBooks((prev) => new Set(prev).add(currentCard.id));
    }
    setSkippedBooks((prev) => new Set(prev).add(currentCard.id));
  }, [cards, items, addToQueue]);

  const handleUndo = useCallback(() => {
    if (undoHistory.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const lastEntry = undoHistory[undoHistory.length - 1];

    if (lastEntry.action === 'mark') {
      lastEntry.ids.forEach((id) => unmarkBookFinished(id));
    } else if (lastEntry.action === 'mark-all') {
      lastEntry.ids.forEach((id) => unmarkBookFinished(id));
      if (lastEntry.cardType === 'author') {
        setSkippedAuthors((prev) => {
          const newSet = new Set(prev);
          newSet.delete(lastEntry.title);
          return newSet;
        });
      } else if (lastEntry.cardType === 'series') {
        setSkippedSeries((prev) => {
          const newSet = new Set(prev);
          newSet.delete(lastEntry.title);
          return newSet;
        });
      }
    } else if (lastEntry.action === 'skip') {
      if (lastEntry.cardType === 'author') {
        if (lastEntry.level !== viewLevel) {
          setViewLevel(lastEntry.level);
          if (lastEntry.level === 'top') {
            setCurrentAuthor(null);
            setCurrentSeries(null);
            setBreadcrumb([]);
          }
        } else {
          setSkippedAuthors((prev) => {
            const newSet = new Set(prev);
            newSet.delete(lastEntry.ids[0]);
            return newSet;
          });
        }
      } else if (lastEntry.cardType === 'series') {
        if (lastEntry.level !== viewLevel) {
          setViewLevel(lastEntry.level);
          setCurrentSeries(null);
          setBreadcrumb((prev) => prev.slice(0, -1));
        } else {
          setSkippedSeries((prev) => {
            const newSet = new Set(prev);
            newSet.delete(lastEntry.ids[0]);
            return newSet;
          });
        }
      } else {
        setSkippedBooks((prev) => {
          const newSet = new Set(prev);
          newSet.delete(lastEntry.ids[0]);
          return newSet;
        });
      }
    }

    setUndoHistory((prev) => prev.slice(0, -1));
  }, [undoHistory, unmarkBookFinished, viewLevel]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (viewLevel === 'series-books') {
      if (currentAuthor) {
        setViewLevel('author-series');
        setCurrentSeries(null);
        setBreadcrumb((prev) => prev.slice(0, -1));
      } else {
        setViewLevel('top');
        setCurrentSeries(null);
        setBreadcrumb([]);
      }
    } else if (viewLevel === 'author-series' || viewLevel === 'author-books') {
      setViewLevel('top');
      setCurrentAuthor(null);
      setBreadcrumb([]);
    }
  }, [viewLevel, currentAuthor]);

  const handleClose = useCallback(async () => {
    await endSession();
    navigation.goBack();
  }, [endSession, navigation]);

  const handleViewHistory = useCallback(() => {
    navigation.navigate('ReadingHistory');
  }, [navigation]);

  const handleStartOver = useCallback(() => {
    setSkippedBooks(new Set());
    setSkippedAuthors(new Set());
    setSkippedSeries(new Set());
    setUndoHistory([]);
  }, []);

  const handleBackToTop = useCallback(() => {
    setViewLevel('top');
    setCurrentAuthor(null);
    setCurrentSeries(null);
    setBreadcrumb([]);
  }, []);

  // Derived state
  const currentCard = cards[0];
  const markedCount = finishedBookIds.size;
  const processedCount = markedCount + skippedBooks.size;
  const isDone = cards.length === 0;
  const canUndoLocal = undoHistory.length > 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        {viewLevel !== 'top' ? (
          <TouchableOpacity style={styles.headerButton} onPress={handleBack}>
            <ArrowLeft size={moderateScale(22)} color={COLORS.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.headerButton} onPress={handleClose}>
            <X size={moderateScale(24)} color={COLORS.textPrimary} strokeWidth={2} />
          </TouchableOpacity>
        )}

        <Text style={styles.headerTitle}>
          {breadcrumb.length > 0 ? breadcrumb.join(' › ') : 'Mark as Finished'}
        </Text>

        <TouchableOpacity style={styles.historyButton} onPress={handleViewHistory}>
          <Text style={styles.historyLink}>History →</Text>
        </TouchableOpacity>
      </View>

      {/* Progress Bar */}
      <ProgressBar
        processed={processedCount}
        total={items.length}
        finished={markedCount}
      />

      {/* View Tabs (only at top level) */}
      {viewLevel === 'top' && (
        <ViewTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          counts={tabCounts}
        />
      )}

      {/* Card Stack */}
      <View style={styles.cardContainer}>
        {isDone ? (
          <EmptyState
            markedCount={markedCount}
            viewLevel={viewLevel}
            onViewHistory={handleViewHistory}
            onStartOver={handleStartOver}
            onBackToTop={handleBackToTop}
          />
        ) : (
          <View style={styles.cardStack}>
            {/* Show up to 3 cards in stack */}
            {cards.slice(0, 3).reverse().map((card, reverseIndex) => {
              const stackIndex = Math.min(2, cards.length - 1) - reverseIndex;
              return (
                <SwipeCard
                  key={card.id}
                  card={card}
                  onSwipeLeft={handleSwipeLeft}
                  onSwipeRight={handleSwipeRight}
                  onSwipeUp={card.type === 'book' ? handleSwipeUp : undefined}
                  stackIndex={stackIndex}
                />
              );
            })}
          </View>
        )}
      </View>

      {/* Bottom Controls */}
      <View style={[styles.bottomControls, { paddingBottom: insets.bottom + spacing.md }]}>
        {/* Stats Row */}
        <StatsRow
          finished={markedCount}
          queued={queuedBooks.size}
          remaining={cards.length}
          onFinishedPress={handleViewHistory}
        />

        {/* Action Buttons */}
        {!isDone && currentCard && (
          <ActionButtons
            onSkip={handleSwipeLeft}
            onUndo={handleUndo}
            onQueue={currentCard.type === 'book' ? handleSwipeUp : undefined}
            onFinished={handleSwipeRight}
            canUndo={canUndoLocal}
            undoCount={undoHistory.length}
            cardType={currentCard.type}
          />
        )}
      </View>
    </View>
  );
}

// =============================================================================
// STYLES (factory function for theme support)
// =============================================================================

const createStyles = (COLORS: ThemeColorsConfig) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: LAYOUT.HORIZONTAL_PADDING,
    height: hp(6),
  },
  headerButton: {
    width: wp(10),
    height: wp(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: moderateScale(17),
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  historyButton: {
    paddingHorizontal: wp(2),
    paddingVertical: wp(2),
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyLink: {
    fontSize: moderateScale(14),
    fontWeight: '500',
    color: COLORS.accent,
  },

  // Progress Bar
  progressContainer: {
    paddingHorizontal: LAYOUT.HORIZONTAL_PADDING,
    paddingVertical: hp(1),
  },
  progressTrack: {
    height: hp(0.6),
    backgroundColor: COLORS.surface,
    borderRadius: hp(0.3),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: hp(0.3),
  },
  progressLabel: {
    fontSize: moderateScale(11),
    color: COLORS.textTertiary,
    marginTop: wp(1.5),
    textAlign: 'center',
  },

  // View Tabs
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: wp(2),
    paddingHorizontal: LAYOUT.HORIZONTAL_PADDING,
    paddingVertical: hp(1.5),
  },
  tabPill: {
    paddingHorizontal: wp(4),
    paddingVertical: hp(1),
    borderRadius: hp(2),
    backgroundColor: COLORS.surface,
  },
  tabPillActive: {
    backgroundColor: COLORS.accent,
  },
  tabText: {
    fontSize: moderateScale(14),
    fontWeight: '500',
    color: COLORS.textTertiary,
  },
  tabTextActive: {
    fontWeight: '600',
    color: COLORS.textInverse,
  },

  // Card Container
  cardContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardStack: {
    width: LAYOUT.CARD_WIDTH,
    height: LAYOUT.CARD_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Card
  card: {
    position: 'absolute',
    width: LAYOUT.CARD_WIDTH,
    height: LAYOUT.CARD_HEIGHT,
    borderRadius: LAYOUT.CARD_RADIUS,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 10,
  },
  cardCover: {
    width: '100%',
    height: '100%',
  },
  cardCoverPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  cardGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
  },
  cardBadge: {
    position: 'absolute',
    top: wp(3),
    left: wp(3),
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1),
    paddingHorizontal: wp(2),
    paddingVertical: wp(1),
    borderRadius: wp(1),
  },
  cardBadgeText: {
    fontSize: moderateScale(10),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: wp(4),
  },
  cardTitle: {
    fontSize: moderateScale(18),
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  cardSubtitle: {
    fontSize: moderateScale(14),
    color: COLORS.textSecondary,
    marginTop: wp(1),
  },
  cardMeta: {
    fontSize: moderateScale(12),
    color: COLORS.textTertiary,
    marginTop: wp(0.5),
  },

  // Swipe Overlays
  swipeOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: LAYOUT.CARD_RADIUS,
  },
  rightOverlay: {
    backgroundColor: 'rgba(34, 197, 94, 0.5)',
  },
  leftOverlay: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  upOverlay: {
    backgroundColor: 'rgba(59, 130, 246, 0.5)',
  },
  swipeOverlayText: {
    fontSize: moderateScale(24),
    fontWeight: '700',
    color: COLORS.textPrimary,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },

  // Stats Row
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: LAYOUT.HORIZONTAL_PADDING,
    paddingVertical: hp(1.5),
    paddingHorizontal: wp(4),
    backgroundColor: COLORS.surface,
    borderRadius: wp(3),
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1.5),
  },
  statValue: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  statLabel: {
    fontSize: moderateScale(11),
    fontWeight: '500',
    color: COLORS.textTertiary,
    marginTop: wp(0.5),
  },
  statDivider: {
    width: 1,
    height: hp(3),
    backgroundColor: COLORS.surfaceBorder,
  },

  // Action Buttons
  actionContainer: {
    paddingHorizontal: LAYOUT.HORIZONTAL_PADDING,
    paddingTop: hp(2),
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: wp(6),
  },
  actionButton: {
    width: LAYOUT.ACTION_BUTTON_SIZE,
    height: LAYOUT.ACTION_BUTTON_SIZE,
    borderRadius: LAYOUT.ACTION_BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  skipButton: {
    borderColor: COLORS.skip,
  },
  undoButton: {
    width: LAYOUT.ACTION_BUTTON_SMALL,
    height: LAYOUT.ACTION_BUTTON_SMALL,
    borderRadius: LAYOUT.ACTION_BUTTON_SMALL / 2,
    borderColor: COLORS.textTertiary,
  },
  queueButton: {
    borderColor: COLORS.info,
  },
  finishedButton: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  actionButtonDisabled: {
    opacity: 0.3,
  },
  undoBadge: {
    position: 'absolute',
    top: -wp(1),
    right: -wp(1),
    backgroundColor: COLORS.accent,
    borderRadius: wp(2),
    paddingHorizontal: wp(1.5),
    paddingVertical: wp(0.5),
    minWidth: wp(4),
    alignItems: 'center',
  },
  undoBadgeText: {
    fontSize: moderateScale(9),
    fontWeight: '700',
    color: COLORS.textInverse,
  },
  hintsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: wp(3),
    paddingHorizontal: wp(4),
  },
  hintText: {
    fontSize: moderateScale(12),
    color: COLORS.textHint,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    padding: wp(8),
  },
  emptyIconContainer: {
    marginBottom: hp(1),
  },
  emptyTitle: {
    fontSize: moderateScale(24),
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: hp(2),
  },
  emptySubtitle: {
    fontSize: moderateScale(14),
    color: COLORS.textSecondary,
    marginTop: hp(1),
    textAlign: 'center',
  },
  emptyButtonPrimary: {
    marginTop: hp(3),
    paddingHorizontal: wp(8),
    paddingVertical: hp(1.5),
    backgroundColor: COLORS.accent,
    borderRadius: wp(6),
  },
  emptyButtonPrimaryText: {
    fontSize: moderateScale(16),
    fontWeight: '600',
    color: COLORS.textInverse,
  },
  emptyButtonSecondary: {
    marginTop: hp(2),
    paddingHorizontal: wp(6),
    paddingVertical: hp(1),
  },
  emptyButtonSecondaryText: {
    fontSize: moderateScale(14),
    color: COLORS.textSecondary,
    textDecorationLine: 'underline',
  },

  // Bottom Controls
  bottomControls: {
    paddingHorizontal: LAYOUT.HORIZONTAL_PADDING,
    paddingTop: hp(1),
  },
});

// Default dark theme colors (used by helper components outside main component)
// These match the dark theme values from colors.ts
const COLORS: ThemeColorsConfig = {
  accent: ACCENT,
  accentDim: 'rgba(229, 57, 53, 0.15)', // matches darkColors.accent.primarySubtle
  textPrimary: '#FFFFFF', // matches darkColors.text.primary
  textSecondary: 'rgba(255, 255, 255, 0.7)', // matches darkColors.text.secondary
  textTertiary: 'rgba(255, 255, 255, 0.5)', // matches darkColors.text.tertiary
  textHint: 'rgba(255, 255, 255, 0.3)', // matches darkColors.text.disabled
  textInverse: '#000000', // matches darkColors.text.inverse
  surface: '#1A1A1A', // matches darkColors.surface.default
  surfaceBorder: 'rgba(255, 255, 255, 0.1)', // matches darkColors.border.default
  success: '#66BB6A', // matches darkColors.semantic.success
  info: '#42A5F5', // matches darkColors.semantic.info
  skip: 'rgba(255, 255, 255, 0.3)', // matches darkColors.text.disabled
  badgeBook: ACCENT,
  badgeAuthor: '#8B5CF6', // Feature-specific purple - kept as-is
  badgeSeries: '#42A5F5', // matches darkColors.semantic.info
  background: '#000000', // matches darkColors.background.primary
};

// Default styles (used by helper components outside main component)
const styles = createStyles(COLORS);

export default MarkBooksScreen;
