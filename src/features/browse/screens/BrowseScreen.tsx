/**
 * src/features/browse/screens/BrowseScreen.tsx
 *
 * Discover page using app design system.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useCoverUrl } from '@/core/cache';
import { Icon } from '@/shared/components/Icon';
import { Shimmer } from '@/shared/components';
import { colors, scale, spacing, layout } from '@/shared/theme';
import {
  useDiscoverData,
  HeroSection,
  QuickFilterChips,
  BrowsePills,
  ContentRowCarousel,
  CategoryGrid,
  PopularSeriesSection,
  TopAuthorsSection,
  MoodFilterPills,
  GENRE_CHIPS,
} from '@/features/discover';
import {
  MoodDiscoveryCard,
  useHasActiveSession,
  useActiveSession,
} from '@/features/mood-discovery';
import { TOP_NAV_HEIGHT, SCREEN_BOTTOM_PADDING } from '@/constants/layout';

export function BrowseScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  // Selected genre filter
  const [selectedGenre, setSelectedGenre] = useState('All');

  // Mood session state
  const hasMoodSession = useHasActiveSession();
  const moodSession = useActiveSession();

  // Discover data (mood-aware when session active)
  const {
    rows,
    hero,
    availableGenres,
    isLoading,
    isRefreshing,
    refresh,
  } = useDiscoverData(selectedGenre, moodSession);

  // Navigation handlers
  const handleSearchPress = useCallback(() => {
    navigation.navigate('Search');
  }, [navigation]);

  const handleGenreSelect = useCallback((genre: string) => {
    setSelectedGenre(genre);
  }, []);

  const handleMoodEdit = useCallback(() => {
    navigation.navigate('MoodDiscovery');
  }, [navigation]);

  const handleMoodClear = useCallback(() => {
    // Session cleared - browse returns to default state
    // No additional action needed, hasMoodSession will become false
  }, []);

  // Show skeleton only on true first load (no cached data exists)
  const showSkeleton = isLoading && rows.length === 0 && !hero;

  // Empty state
  const hasContent = hero || rows.length > 0;

  // Get cached cover URL for hero background
  const heroCoverUrl = useCoverUrl(hero?.book.id || '');
  const showHeroBackground = hero && selectedGenre === 'All';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Full-screen Hero Background - extends behind header and pills */}
      {showHeroBackground && (
        <View style={styles.heroBackground}>
          <Image
            source={heroCoverUrl || hero.book.coverUrl}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            blurRadius={60}
          />
          {/* BlurView for Android (blurRadius only works on iOS) */}
          <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.95)']}
            style={StyleSheet.absoluteFill}
          />
        </View>
      )}

      {/* TopNav is rendered at navigator level */}

      {/* Main Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + TOP_NAV_HEIGHT + 8, paddingBottom: SCREEN_BOTTOM_PADDING + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            tintColor={colors.accent}
          />
        }
      >
        {/* Quick Filter Chips OR Mood Filter Pills */}
        {hasMoodSession && moodSession ? (
          <MoodFilterPills
            session={moodSession}
            onEditPress={handleMoodEdit}
            onClear={handleMoodClear}
          />
        ) : (
          <QuickFilterChips
            chips={availableGenres.length > 0 ? availableGenres : GENRE_CHIPS}
            selectedChip={selectedGenre}
            onSelect={handleGenreSelect}
          />
        )}

        {/* Mood Discovery Entry Point - only show when NO mood session */}
        {!showSkeleton && selectedGenre === 'All' && !hasMoodSession && (
          <MoodDiscoveryCard />
        )}

        {/* Skeleton Loading State */}
        {showSkeleton && (
          <View style={styles.skeletonContainer}>
            {/* Hero skeleton */}
            <View style={styles.heroSkeleton}>
              <Shimmer width={scale(160)} height={scale(240)} borderRadius={scale(12)} />
              <View style={styles.heroSkeletonText}>
                <Shimmer width={scale(200)} height={scale(24)} style={{ marginTop: scale(16) }} />
                <Shimmer width={scale(140)} height={scale(16)} style={{ marginTop: scale(8) }} />
              </View>
            </View>
            {/* Row skeletons */}
            {[1, 2, 3].map((i) => (
              <View key={i} style={styles.rowSkeleton}>
                <Shimmer width={scale(120)} height={scale(20)} style={{ marginBottom: scale(12), marginLeft: scale(16) }} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingLeft: scale(16) }}>
                  {[1, 2, 3, 4].map((j) => (
                    <View key={j} style={{ marginRight: scale(12) }}>
                      <Shimmer width={scale(140)} height={scale(140)} borderRadius={scale(8)} />
                      <Shimmer width={scale(100)} height={scale(14)} style={{ marginTop: scale(8) }} />
                    </View>
                  ))}
                </ScrollView>
              </View>
            ))}
          </View>
        )}

        {/* Hero Recommendation Content */}
        {!showSkeleton && showHeroBackground && (
          <HeroSection hero={hero} />
        )}

        {/* Browse Pills - Category Navigation (hidden when mood active) */}
        {!showSkeleton && selectedGenre === 'All' && !hasMoodSession && (
          <BrowsePills />
        )}

        {/* Content Rows */}
        {!showSkeleton && rows.map((row) => (
          <ContentRowCarousel key={row.id} row={row} />
        ))}

        {/* Popular Series */}
        {selectedGenre === 'All' && (
          <PopularSeriesSection limit={10} />
        )}

        {/* Top Authors */}
        {selectedGenre === 'All' && (
          <TopAuthorsSection limit={10} />
        )}

        {/* Browse by Category */}
        {selectedGenre === 'All' && (
          <CategoryGrid />
        )}

        {/* Empty State - only show when not loading and no content */}
        {!showSkeleton && !hasContent && (
          <View style={styles.emptyState}>
            <Icon name="library-outline" size={scale(48)} color="rgba(255,255,255,0.3)" set="ionicons" />
            <Text style={styles.emptyTitle}>Your library is waiting</Text>
            <Text style={styles.emptySubtitle}>
              Add audiobooks to your server to start discovering.
            </Text>
          </View>
        )}

        {/* No Results for Filter */}
        {hasContent && rows.length === 0 && selectedGenre !== 'All' && (
          <View style={styles.emptyState}>
            <Icon name="search-outline" size={scale(48)} color="rgba(255,255,255,0.3)" set="ionicons" />
            <Text style={styles.emptyTitle}>No books match "{selectedGenre}"</Text>
            <TouchableOpacity
              style={styles.clearFilterButton}
              onPress={() => setSelectedGenre('All')}
            >
              <Text style={styles.clearFilterText}>Show All</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundPrimary,
  },
  heroBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: scale(500), // Adjusted for larger square hero cover
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: scale(8),
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPaddingH,
    paddingBottom: spacing.md,
    zIndex: 1,
  },
  headerTitle: {
    fontSize: scale(28),
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerButton: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    borderRadius: scale(20),
    backgroundColor: colors.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingTop: scale(60),
    paddingHorizontal: scale(40),
  },
  emptyTitle: {
    marginTop: spacing.lg,
    fontSize: scale(16),
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  emptySubtitle: {
    marginTop: spacing.sm,
    fontSize: scale(13),
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: scale(18),
  },
  clearFilterButton: {
    marginTop: spacing.xl,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: scale(20),
  },
  clearFilterText: {
    fontSize: scale(14),
    fontWeight: '600',
    color: '#000',
  },

  // Skeleton styles
  skeletonContainer: {
    paddingTop: spacing.lg,
  },
  heroSkeleton: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xxl,
  },
  heroSkeletonText: {
    alignItems: 'center',
  },
  rowSkeleton: {
    marginBottom: spacing.xxl,
  },
});
