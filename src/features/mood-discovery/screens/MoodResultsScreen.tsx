/**
 * src/features/mood-discovery/screens/MoodResultsScreen.tsx
 *
 * Results screen showing books that match the active mood session.
 * Features quick-tune bar, grouped results, and improved empty/sparse states (Tier 1.4).
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { QuickTuneBar } from '../components/QuickTuneBar';
import { MoodBookCard } from '../components/MoodBookCard';
import {
  useActiveSession,
  useHasActiveSession,
} from '../stores/moodSessionStore';
import { useMoodRecommendationsByQuality } from '../hooks/useMoodRecommendations';
import { useLibraryCache } from '@/core/cache/libraryCache';
import { Icon } from '@/shared/components/Icon';
import { Loading } from '@/shared/components/Loading';
import { spacing, radius, useTheme } from '@/shared/theme';
import { secretLibraryColors } from '@/shared/theme/secretLibrary';
import { MOODS, MoodSession } from '../types';

// ============================================================================
// TIER 1.4: IMPROVED EMPTY/SPARSE MESSAGING
// ============================================================================

/**
 * Get mood-specific suggestion for empty results
 */
function getMoodSuggestion(mood: string): string {
  switch (mood) {
    case 'comfort':
      return 'cozy mysteries, romance, or slice-of-life';
    case 'thrills':
      return 'thrillers, mysteries, or suspense';
    case 'escape':
      return 'fantasy, sci-fi, or adventure';
    case 'laughs':
      return 'humor, romantic comedy, or satire';
    case 'feels':
      return 'literary fiction, drama, or love stories';
    case 'thinking':
      return 'philosophy, literary, or thought-provoking';
    default:
      return 'more books in this genre';
  }
}

/**
 * Get context-aware empty state content (Tier 1.4)
 */
function getEmptyStateContent(
  session: MoodSession | null,
  librarySize: number
): { emoji: string; title: string; subtitle: string; buttonText: string } {
  const moodLabel = session?.mood
    ? MOODS.find(m => m.id === session.mood)?.label || session.mood
    : 'this mood';

  // Small library (< 20 books)
  if (librarySize < 20) {
    return {
      emoji: '📖',
      title: 'Your library is focused',
      subtitle: `With ${librarySize} books, we don't have enough variety to match "${moodLabel}" preferences. Consider expanding your library with ${getMoodSuggestion(session?.mood || '')}.`,
      buttonText: 'Adjust Preferences',
    };
  }

  // Strict filters (user selected multiple non-any options)
  const filterCount = [
    session?.pace !== 'any' ? 1 : 0,
    session?.weight !== 'any' ? 1 : 0,
    session?.world !== 'any' ? 1 : 0,
    session?.length !== 'any' ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  if (filterCount >= 3) {
    return {
      emoji: '🎯',
      title: 'Nothing quite fits',
      subtitle: `Your preferences are very specific. Try relaxing one or two filters — maybe let pace or length be "any"?`,
      buttonText: 'Loosen Filters',
    };
  }

  // Generic empty state
  return {
    emoji: '📚',
    title: 'No matches found',
    subtitle: `We couldn't find books matching your "${moodLabel}" mood. Try adjusting your preferences or checking if your books have genre tags.`,
    buttonText: 'Adjust Preferences',
  };
}

/**
 * Get sparse results banner text (Tier 1.4)
 * Shown when < 3 perfect matches
 */
function getSparseResultsBanner(
  perfectCount: number,
  totalCount: number,
  session: MoodSession | null
): { show: boolean; text: string } {
  // Show banner if we have some results but few perfect ones
  if (totalCount > 0 && perfectCount < 3 && totalCount < 10) {
    const moodLabel = session?.mood
      ? MOODS.find(m => m.id === session.mood)?.label || session.mood
      : 'this mood';

    if (perfectCount === 0) {
      return {
        show: true,
        text: `Showing the best "${moodLabel}" options from your library`,
      };
    }
    return {
      show: true,
      text: `Only ${perfectCount} perfect ${perfectCount === 1 ? 'match' : 'matches'} — showing best available`,
    };
  }

  return { show: false, text: '' };
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - spacing.lg * 2 - spacing.sm * 2) / 3;

type SectionType = 'perfect' | 'great' | 'good' | 'partial';

interface Section {
  type: SectionType;
  title: string;
  subtitle: string;
  data: string[]; // Book IDs
}

export function MoodResultsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const accent = secretLibraryColors.gold;

  const session = useActiveSession();
  const hasSession = useHasActiveSession();
  const getItem = useLibraryCache((s) => s.getItem);
  const libraryItems = useLibraryCache((s) => s.items);
  const librarySize = libraryItems.length;

  const { perfect, great, good, partial, isLoading } =
    useMoodRecommendationsByQuality(session);

  // Build sections from grouped results
  const sections = useMemo<Section[]>(() => {
    const result: Section[] = [];

    if (perfect.length > 0) {
      result.push({
        type: 'perfect',
        title: 'Perfect for You',
        subtitle: '80%+ match',
        data: perfect.map((r) => r.item.id),
      });
    }

    if (great.length > 0) {
      result.push({
        type: 'great',
        title: 'Great Matches',
        subtitle: '60-79% match',
        data: great.map((r) => r.item.id),
      });
    }

    if (good.length > 0) {
      result.push({
        type: 'good',
        title: 'Good Options',
        subtitle: '40-59% match',
        data: good.map((r) => r.item.id),
      });
    }

    if (partial.length > 0) {
      result.push({
        type: 'partial',
        title: 'Might Interest You',
        subtitle: '20-39% match',
        data: partial.map((r) => r.item.id),
      });
    }

    return result;
  }, [perfect, great, good, partial]);

  // Get score data for a book
  const getScoreData = useCallback(
    (id: string) => {
      return (
        perfect.find((r) => r.item.id === id) ||
        great.find((r) => r.item.id === id) ||
        good.find((r) => r.item.id === id) ||
        partial.find((r) => r.item.id === id)
      );
    },
    [perfect, great, good, partial]
  );

  const handleClose = () => {
    navigation.goBack();
  };

  const handleEditMood = () => {
    navigation.navigate('MoodDiscovery');
  };

  const handleClearSession = () => {
    navigation.goBack();
  };

  const handleBookPress = (id: string) => {
    navigation.navigate('BookDetail', { id });
  };

  const totalCount =
    perfect.length + great.length + good.length + partial.length;

  // No session state
  if (!hasSession || !session) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background.primary }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Icon
              name="X"
              size={24}
              color={colors.text.primary}
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text.primary }]}>No Active Mood</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🎭</Text>
          <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>No mood set</Text>
          <Text style={[styles.emptySubtitle, { color: colors.text.secondary }]}>
            Set your current mood to discover books that match what you're
            looking for.
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('MoodDiscovery')}
            style={[styles.emptyButton, { backgroundColor: accent }]}
          >
            <Text style={[styles.emptyButtonText, { color: colors.text.inverse }]}>Set Your Mood</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background.primary }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Icon
              name="X"
              size={24}
              color={colors.text.primary}
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text.primary }]}>Finding Matches...</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <Loading text="Finding matches..." />
        </View>
      </View>
    );
  }

  // Empty results - use improved messaging (Tier 1.4)
  if (sections.length === 0) {
    const emptyContent = getEmptyStateContent(session, librarySize);

    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background.primary }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Icon
              name="X"
              size={24}
              color={colors.text.primary}
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text.primary }]}>Results</Text>
          <View style={styles.placeholder} />
        </View>

        <QuickTuneBar
          session={session}
          onEditPress={handleEditMood}
          onClear={handleClearSession}
        />

        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>{emptyContent.emoji}</Text>
          <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>{emptyContent.title}</Text>
          <Text style={[styles.emptySubtitle, { color: colors.text.secondary }]}>
            {emptyContent.subtitle}
          </Text>
          <TouchableOpacity
            onPress={handleEditMood}
            style={[styles.emptyButton, { backgroundColor: accent }]}
          >
            <Text style={[styles.emptyButtonText, { color: colors.text.inverse }]}>{emptyContent.buttonText}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Calculate sparse banner (Tier 1.4)
  const sparseBanner = getSparseResultsBanner(perfect.length, totalCount, session);

  // Results view
  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background.primary }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <Icon
            name="X"
            size={24}
            color={colors.text.primary}
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text.primary }]}>
          {totalCount} {totalCount === 1 ? 'Match' : 'Matches'}
        </Text>
        <View style={styles.placeholder} />
      </View>

      {/* Quick Tune Bar */}
      <QuickTuneBar
        session={session}
        onEditPress={handleEditMood}
        onClear={handleClearSession}
      />

      {/* Sparse Results Banner (Tier 1.4) */}
      {sparseBanner.show && (
        <View style={[styles.sparseBanner, { backgroundColor: colors.background.tertiary }]}>
          <Icon name="Info" size={14} color={colors.text.tertiary} />
          <Text style={[styles.sparseBannerText, { color: colors.text.secondary }]}>
            {sparseBanner.text}
          </Text>
        </View>
      )}

      {/* Results */}
      <FlatList
        data={sections}
        keyExtractor={(item) => item.type}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        windowSize={5}
        maxToRenderPerBatch={5}
        initialNumToRender={4}
        renderItem={({ item: section }) => (
          <Animated.View
            entering={FadeIn.duration(300)}
            style={styles.section}
          >
            {/* Section header */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>{section.title}</Text>
              <Text style={[styles.sectionSubtitle, { color: colors.text.tertiary }]}>
                {section.data.length} {section.data.length === 1 ? 'book' : 'books'} · {section.subtitle}
              </Text>
            </View>

            {/* Books grid */}
            <View style={styles.booksGrid}>
              {section.data.map((id) => {
                const item = getItem(id);
                if (!item) return null;
                return (
                  <MoodBookCard
                    key={id}
                    item={item}
                    scoreData={getScoreData(id)}
                    onPress={() => handleBookPress(id)}
                    width={CARD_WIDTH}
                  />
                );
              })}
            </View>
          </Animated.View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor set via themeColors in JSX
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  closeButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    // color set via themeColors in JSX
    textAlign: 'center',
  },
  placeholder: {
    width: 44,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    // color set via themeColors in JSX
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    // color set via themeColors in JSX
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  emptyButton: {
    // backgroundColor set dynamically via accent in JSX
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    // color set via themeColors in JSX (text.inverse for contrast on accent backgrounds)
  },
  listContent: {
    paddingHorizontal: spacing.lg,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    // color set via themeColors in JSX
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 13,
    // color set via themeColors in JSX
  },
  booksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginRight: -spacing.sm,
  },
  // Sparse banner styles (Tier 1.4)
  sparseBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.sm,
    gap: spacing.xs,
  },
  sparseBannerText: {
    fontSize: 13,
    flex: 1,
  },
});
