/**
 * src/features/discover/components/PopularSeriesSection.tsx
 *
 * Series section sorted by user reading history
 * Series you've read/started appear first
 */

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { getAllSeries, useLibraryCache } from '@/core/cache';
import { apiClient } from '@/core/api';
import { sqliteCache } from '@/core/services/sqliteCache';
import { accentColors, scale, spacing, layout, radius, useTheme } from '@/shared/theme';
import { useIsDarkMode } from '@/shared/theme/themeStore';
import { SeriesHeartButton } from '@/shared/components';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PADDING = 16;
const GAP = 12;
const CARD_WIDTH = (SCREEN_WIDTH - PADDING * 2 - GAP) / 2;

// Fanned cover dimensions
const COVER_SIZE = 60;
const FAN_OFFSET = 18;
const FAN_ROTATION = 8;
const FAN_VERTICAL_OFFSET = 6;
const MAX_VISIBLE_BOOKS = 5;

interface SeriesCardProps {
  series: {
    name: string;
    bookCount: number;
    books: any[];
  };
  onPress: () => void;
  textColor: string;
  textSecondaryColor: string;
  cardBgColor: string;
}

const SeriesCard = React.memo(function SeriesCard({
  series,
  onPress,
  textColor,
  textSecondaryColor,
  cardBgColor,
}: SeriesCardProps) {
  // Get cover URLs for up to 5 books
  const bookCovers = useMemo(() => {
    return series.books.slice(0, MAX_VISIBLE_BOOKS).map(book => apiClient.getItemCoverUrl(book.id, { width: 400, height: 400 }));
  }, [series.books]);

  const numCovers = bookCovers.length;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: cardBgColor }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Heart button - top right */}
      <SeriesHeartButton
        seriesName={series.name}
        size={10}
        showCircle
        style={styles.heartButton}
      />

      {/* Fanned covers */}
      <View style={styles.coverFan}>
        {numCovers > 0 ? (
          <View style={[
            styles.fanContainer,
            { width: COVER_SIZE + (numCovers - 1) * FAN_OFFSET }
          ]}>
            {bookCovers.map((coverUrl, idx) => {
              const middleIndex = (numCovers - 1) / 2;
              const rotation = (idx - middleIndex) * FAN_ROTATION;
              const distanceFromCenter = Math.abs(idx - middleIndex);
              const zIndex = numCovers - Math.floor(distanceFromCenter);
              const scaleValue = 1 - (distanceFromCenter * 0.12);
              const coverSize = COVER_SIZE * scaleValue;
              const sizeOffset = (COVER_SIZE - coverSize) / 2;
              const verticalOffset = sizeOffset + (distanceFromCenter * FAN_VERTICAL_OFFSET);
              const horizontalOffset = idx * FAN_OFFSET + sizeOffset;

              return (
                <Image
                  key={idx}
                  source={coverUrl}
                  style={[
                    styles.fanCover,
                    {
                      width: coverSize,
                      height: coverSize,
                      left: horizontalOffset,
                      top: verticalOffset,
                      zIndex,
                      transform: [{ rotate: `${rotation}deg` }],
                    },
                  ]}
                  contentFit="cover"
                  transition={150}
                />
              );
            })}
          </View>
        ) : null}
      </View>

      {/* Series name */}
      <Text style={[styles.seriesName, { color: textColor }]} numberOfLines={2}>
        {series.name}
      </Text>
      <Text style={[styles.bookCount, { color: textSecondaryColor }]}>
        {series.bookCount} {series.bookCount === 1 ? 'book' : 'books'}
      </Text>
    </TouchableOpacity>
  );
});

interface PopularSeriesSectionProps {
  limit?: number;
}

export function PopularSeriesSection({ limit = 2 }: PopularSeriesSectionProps) {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const isDarkMode = useIsDarkMode();
  const { isLoaded } = useLibraryCache();

  // Load user's finished books to boost series they've started
  const [finishedBookIds, setFinishedBookIds] = useState<Set<string>>(new Set());
  const [hasHistory, setHasHistory] = useState(false);

  useEffect(() => {
    sqliteCache.getFinishedUserBooks().then(books => {
      if (books.length > 0) {
        setFinishedBookIds(new Set(books.map(b => b.bookId)));
        setHasHistory(true);
      }
    }).catch(() => {});
  }, []);

  const popularSeries = useMemo(() => {
    if (!isLoaded) return [];
    const allSeries = getAllSeries();

    // Calculate how many books the user has finished in each series
    return allSeries
      .filter(s => s.bookCount >= 2)
      .map(s => {
        // Count finished books in this series
        const finishedInSeries = s.books.filter(b => finishedBookIds.has(b.id)).length;
        return {
          ...s,
          userProgress: finishedInSeries,
        };
      })
      .sort((a, b) => {
        // Series with user progress first
        if (a.userProgress !== b.userProgress) {
          return b.userProgress - a.userProgress;
        }
        // Then by book count
        return b.bookCount - a.bookCount;
      })
      .slice(0, limit);
  }, [isLoaded, limit, finishedBookIds]);

  // Title changes based on whether we have history
  const sectionTitle = hasHistory ? 'Your Series' : 'Series';

  const handleViewAll = useCallback(() => {
    navigation.navigate('SeriesList');
  }, [navigation]);

  const handleSeriesPress = useCallback((seriesName: string) => {
    navigation.navigate('SeriesDetail', { seriesName });
  }, [navigation]);

  const cardBgColor = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';

  if (!isLoaded || popularSeries.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text.primary }]}>{sectionTitle}</Text>
        <TouchableOpacity
          style={styles.viewAllButton}
          onPress={handleViewAll}
          activeOpacity={0.7}
        >
          <Text style={[styles.viewAllText, { color: colors.text.secondary }]}>View All</Text>
        </TouchableOpacity>
      </View>

      {/* 2-column grid */}
      <View style={styles.grid}>
        {popularSeries.slice(0, 2).map((series) => (
          <SeriesCard
            key={series.name}
            series={series}
            onPress={() => handleSeriesPress(series.name)}
            textColor={colors.text.primary}
            textSecondaryColor={colors.text.secondary}
            cardBgColor={cardBgColor}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: PADDING,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: scale(18),
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  viewAllButton: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  viewAllText: {
    fontSize: scale(14),
    fontWeight: '500',
  },
  grid: {
    flexDirection: 'row',
    paddingHorizontal: PADDING,
    gap: GAP,
  },
  card: {
    width: CARD_WIDTH,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  heartButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
  },
  coverFan: {
    height: COVER_SIZE + 10,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fanContainer: {
    position: 'relative',
    height: COVER_SIZE,
  },
  fanCover: {
    position: 'absolute',
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: 5,
    backgroundColor: 'rgba(128,128,128,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  seriesName: {
    fontSize: scale(13),
    fontWeight: '600',
    lineHeight: scale(17),
    textAlign: 'center',
  },
  bookCount: {
    fontSize: scale(11),
    textAlign: 'center',
    marginTop: 2,
  },
});
