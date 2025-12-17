/**
 * src/features/mood-discovery/screens/MoodResultsScreen.tsx
 *
 * Results screen showing books that match the active mood session.
 * Features quick-tune bar, grouped results, and empty state.
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
import { LoadingSpinner } from '@/shared/components/LoadingSpinner';
import { colors, spacing, radius } from '@/shared/theme';

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

  const session = useActiveSession();
  const hasSession = useHasActiveSession();
  const getItem = useLibraryCache((s) => s.getItem);

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
        data: perfect.map((r) => r.id),
      });
    }

    if (great.length > 0) {
      result.push({
        type: 'great',
        title: 'Great Matches',
        subtitle: '60-79% match',
        data: great.map((r) => r.id),
      });
    }

    if (good.length > 0) {
      result.push({
        type: 'good',
        title: 'Good Options',
        subtitle: '40-59% match',
        data: good.map((r) => r.id),
      });
    }

    if (partial.length > 0) {
      result.push({
        type: 'partial',
        title: 'Might Interest You',
        subtitle: '20-39% match',
        data: partial.map((r) => r.id),
      });
    }

    return result;
  }, [perfect, great, good, partial]);

  // Get score data for a book
  const getScoreData = useCallback(
    (id: string) => {
      return (
        perfect.find((r) => r.id === id) ||
        great.find((r) => r.id === id) ||
        good.find((r) => r.id === id) ||
        partial.find((r) => r.id === id)
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
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Icon
              name="close"
              size={24}
              color={colors.textPrimary}
              set="ionicons"
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>No Active Mood</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🎭</Text>
          <Text style={styles.emptyTitle}>No mood set</Text>
          <Text style={styles.emptySubtitle}>
            Set your current mood to discover books that match what you're
            looking for.
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('MoodDiscovery')}
            style={styles.emptyButton}
          >
            <Text style={styles.emptyButtonText}>Set Your Mood</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Icon
              name="close"
              size={24}
              color={colors.textPrimary}
              set="ionicons"
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Finding Matches...</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <LoadingSpinner size="large" />
        </View>
      </View>
    );
  }

  // Empty results
  if (sections.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Icon
              name="close"
              size={24}
              color={colors.textPrimary}
              set="ionicons"
            />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Results</Text>
          <View style={styles.placeholder} />
        </View>

        <QuickTuneBar
          session={session}
          onEditPress={handleEditMood}
          onClear={handleClearSession}
        />

        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📚</Text>
          <Text style={styles.emptyTitle}>No matches found</Text>
          <Text style={styles.emptySubtitle}>
            Try adjusting your mood preferences or adding more vibes to find
            books in your library.
          </Text>
          <TouchableOpacity
            onPress={handleEditMood}
            style={styles.emptyButton}
          >
            <Text style={styles.emptyButtonText}>Adjust Mood</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Results view
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <Icon
            name="close"
            size={24}
            color={colors.textPrimary}
            set="ionicons"
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
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
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionSubtitle}>
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
    backgroundColor: colors.backgroundPrimary,
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
    color: colors.textPrimary,
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
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  emptyButton: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
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
    color: colors.textPrimary,
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: colors.textTertiary,
  },
  booksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginRight: -spacing.sm,
  },
});
