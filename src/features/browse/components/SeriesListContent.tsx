import React, { useState, useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import { LibraryIcon } from '@/shared/components';
import { useSeries } from '@/features/series';
import { useDefaultLibrary } from '@/features/library/hooks/useDefaultLibrary';
import { SearchBar } from '@/features/search/components/SearchBar';
import { Loading, EmptyState, ErrorView, SkullRefreshControl } from '@/shared/components';
import { SeriesInfo } from '@/features/series';
import { apiClient } from '@/core/api';
import { spacing, radius, useTheme } from '@/shared/theme';
import { useIsDarkMode } from '@/shared/theme/themeStore';
const SCREEN_WIDTH = Dimensions.get('window').width;

// Fanned card dimensions matching GenreCardLarge
const CARD_WIDTH = (SCREEN_WIDTH - 32 - 12) / 2;
const COVER_WIDTH = 65;
const COVER_HEIGHT = 95;
const FAN_OFFSET = 28;
const FAN_ROTATION = 8;
const MAX_VISIBLE_BOOKS = 3;

// =============================================================================
// SeriesFannedCard - Fanned cover design matching genre cards
// =============================================================================

interface SeriesFannedCardProps {
  series: SeriesInfo;
}

const SeriesFannedCard = memo(function SeriesFannedCard({ series }: SeriesFannedCardProps) {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const isDarkMode = useIsDarkMode();
  const accent = colors.accent.primary;

  const handlePress = () => {
    navigation.navigate('SeriesDetail', { seriesName: series.name });
  };

  // Get cover URLs for fan effect
  const covers = useMemo(() => {
    if (series.books && series.books.length > 0) {
      return series.books
        .slice(0, MAX_VISIBLE_BOOKS)
        .map(book => apiClient.getItemCoverUrl(book.id, { width: 400, height: 400 }));
    }
    return [];
  }, [series.books]);

  return (
    <TouchableOpacity
      style={[
        styles.fannedCard,
        {
          width: CARD_WIDTH,
          backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
        },
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {/* Cover Fan */}
      <View style={styles.coverFan}>
        {covers.length > 0 ? (
          <View style={styles.fanContainer}>
            {covers.map((url, index) => (
              <Image
                key={index}
                source={url}
                style={[
                  styles.fanCover,
                  {
                    left: index * FAN_OFFSET,
                    zIndex: covers.length - index,
                    transform: [{ rotate: `${(index - 1) * FAN_ROTATION}deg` }],
                  },
                ]}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ))}
          </View>
        ) : (
          <View style={[styles.fanPlaceholder, { backgroundColor: accent + '30' }]}>
            <LibraryIcon size={40} color={accent} />
          </View>
        )}
      </View>

      {/* Series Info */}
      <Text style={[styles.seriesName, { color: colors.text.primary }]} numberOfLines={2}>
        {series.name}
      </Text>
      <Text style={[styles.seriesCount, { color: colors.text.tertiary }]}>
        {series.bookCount} {series.bookCount === 1 ? 'book' : 'books'}
      </Text>
    </TouchableOpacity>
  );
});

// =============================================================================
// SeriesListContent - Main list component
// =============================================================================

export function SeriesListContent() {
  const [searchQuery, setSearchQuery] = useState('');
  const { colors } = useTheme();
  const accent = colors.accent.primary;
  const { library, isLoading: isLoadingLibrary } = useDefaultLibrary();
  const { series, seriesCount, isLoading, error, refetch } = useSeries(
    library?.id || '',
    { sortBy: 'name-asc', searchQuery }
  );

  if (isLoadingLibrary || isLoading) {
    return <Loading text="Loading series..." />;
  }

  if (error) {
    return <ErrorView message="Failed to load series" onRetry={refetch} />;
  }

  if (seriesCount === 0 && !searchQuery) {
    return (
      <EmptyState
        icon="📚"
        title="No series found"
        description="Your library doesn't have any series"
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
      <View style={styles.searchContainer}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search series..."
          autoFocus={false}
        />
      </View>

      {/* Series count */}
      <View style={styles.countContainer}>
        <Text style={[styles.countText, { color: colors.text.secondary }]}>
          {seriesCount} {seriesCount === 1 ? 'series' : 'series'}
        </Text>
      </View>

      <SkullRefreshControl refreshing={isLoading} onRefresh={refetch}>
        <FlashList
          data={series}
          renderItem={({ item }) => (
            <View style={styles.itemWrapper}>
              <SeriesFannedCard series={item} />
            </View>
          )}
          keyExtractor={(item: SeriesInfo) => item.id}
          numColumns={2}
          estimatedItemSize={200}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="🔍"
              title="No series found"
              description={`No series match "${searchQuery}"`}
            />
          }
        />
      </SkullRefreshControl>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  countContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  countText: {
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 188,
  },
  itemWrapper: {
    flex: 1,
    paddingHorizontal: 6,
    paddingBottom: 12,
  },
  // Fanned card styles
  fannedCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  coverFan: {
    height: COVER_HEIGHT,
    marginBottom: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fanContainer: {
    position: 'relative',
    width: 120,
    height: COVER_HEIGHT,
  },
  fanCover: {
    position: 'absolute',
    width: COVER_WIDTH,
    height: COVER_HEIGHT,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 4,
  },
  fanPlaceholder: {
    width: COVER_WIDTH,
    height: COVER_HEIGHT,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  seriesName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.xxs,
    textAlign: 'center',
  },
  seriesCount: {
    fontSize: 13,
    textAlign: 'center',
  },
});