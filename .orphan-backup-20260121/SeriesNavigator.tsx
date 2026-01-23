/**
 * src/features/book-detail/components/SeriesNavigator.tsx
 *
 * Series navigation component for Book Detail screen.
 * Shows previous/next book arrows and series info.
 * Styled consistently with the duration/chapters info row.
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { LibraryItem } from '@/core/types';
import { getSeriesNavigationInfo } from '@/core/cache';
import { scale, spacing, radius, useTheme } from '@/shared/theme';

interface SeriesNavigatorProps {
  book: LibraryItem;
}

/**
 * Extract series info directly from book metadata.
 * More reliable than cache lookup which may not be ready.
 */
function getSeriesFromMetadata(book: LibraryItem): {
  seriesName: string;
  sequence: number;
} | null {
  const metadata = (book.media?.metadata as any) || {};

  // Try series array first (expanded API data)
  if (metadata.series?.length > 0) {
    const seriesEntry = metadata.series[0];
    const name = seriesEntry.name || seriesEntry;
    const seq = parseFloat(seriesEntry.sequence) || 1;
    if (name && typeof name === 'string') {
      return { seriesName: name, sequence: seq };
    }
  }

  // Try seriesName string (format: "Series Name #N")
  const seriesNameRaw = metadata.seriesName || '';
  if (seriesNameRaw) {
    const seqMatch = seriesNameRaw.match(/#([\d.]+)/);
    if (seqMatch) {
      const seq = parseFloat(seqMatch[1]);
      const name = seriesNameRaw.replace(/\s*#[\d.]+$/, '').trim();
      return { seriesName: name, sequence: seq };
    }
  }

  return null;
}

export function SeriesNavigator({ book }: SeriesNavigatorProps) {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();

  // Get series info from book metadata (always available if book has series)
  const metadataSeries = useMemo(() => getSeriesFromMetadata(book), [book]);

  // Get navigation info from cache (may not be immediately available)
  const navInfo = useMemo(() => getSeriesNavigationInfo(book), [book]);

  // Navigate to previous book
  const handlePreviousPress = useCallback(() => {
    if (navInfo?.previousBook) {
      navigation.replace('BookDetail', { id: navInfo.previousBook.id });
    }
  }, [navigation, navInfo?.previousBook]);

  // Navigate to next book
  const handleNextPress = useCallback(() => {
    if (navInfo?.nextBook) {
      navigation.replace('BookDetail', { id: navInfo.nextBook.id });
    }
  }, [navigation, navInfo?.nextBook]);

  // Navigate to series detail
  const handleSeriesPress = useCallback(() => {
    const seriesName = metadataSeries?.seriesName || navInfo?.seriesName;
    if (seriesName) {
      navigation.navigate('SeriesDetail', { seriesName });
    }
  }, [navigation, metadataSeries?.seriesName, navInfo?.seriesName]);

  // Don't render if book has no series info at all
  if (!metadataSeries && !navInfo) {
    return null;
  }

  // Use metadata series as primary source (always available), navInfo for navigation
  const seriesName = metadataSeries?.seriesName || navInfo?.seriesName || '';
  const currentSequence = metadataSeries?.sequence || navInfo?.currentSequence || 1;
  const totalBooks = navInfo?.totalBooks || 0;
  const previousBook = navInfo?.previousBook || null;
  const nextBook = navInfo?.nextBook || null;

  // Get display text for previous/next
  const getPreviousLabel = () => {
    if (!previousBook) return null;
    const seq = currentSequence - 1;
    return `Book ${Math.floor(seq)}`;
  };

  const getNextLabel = () => {
    if (!nextBook) return null;
    const seq = currentSequence + 1;
    return `Book ${Math.ceil(seq)}`;
  };

  return (
    <View style={styles.container}>
      {/* Previous Book Arrow */}
      <TouchableOpacity
        style={[styles.arrowButton, !previousBook && styles.arrowButtonDisabled]}
        onPress={handlePreviousPress}
        disabled={!previousBook}
        activeOpacity={0.7}
        accessibilityLabel={previousBook ? `Previous book in series` : undefined}
        accessibilityRole={previousBook ? 'button' : undefined}
        accessibilityHint={previousBook ? 'Double tap to go to previous book' : undefined}
        accessible={!!previousBook}
      >
        {previousBook ? (
          <>
            <ChevronLeft size={scale(16)} color={colors.text.secondary} strokeWidth={2} />
            <Text style={[styles.arrowText, { color: colors.text.secondary }]}>{getPreviousLabel()}</Text>
          </>
        ) : (
          <View style={styles.arrowPlaceholder} />
        )}
      </TouchableOpacity>

      {/* Series Info (Center) */}
      <TouchableOpacity
        style={styles.seriesInfo}
        onPress={handleSeriesPress}
        activeOpacity={0.7}
        accessibilityLabel={`${seriesName}, book ${Math.floor(currentSequence)}${totalBooks > 0 ? ` of ${totalBooks}` : ''}`}
        accessibilityRole="button"
        accessibilityHint="Double tap to view series details"
      >
        <Text style={[styles.seriesName, { color: colors.text.primary }]} numberOfLines={1}>
          {seriesName}
        </Text>
        <Text style={[styles.seriesPosition, { color: colors.text.secondary }]}>
          #{Math.floor(currentSequence)}{totalBooks > 0 ? ` of ${totalBooks}` : ''}
        </Text>
      </TouchableOpacity>

      {/* Next Book Arrow */}
      <TouchableOpacity
        style={[styles.arrowButton, styles.arrowButtonRight, !nextBook && styles.arrowButtonDisabled]}
        onPress={handleNextPress}
        disabled={!nextBook}
        activeOpacity={0.7}
        accessibilityLabel={nextBook ? `Next book in series` : undefined}
        accessibilityRole={nextBook ? 'button' : undefined}
        accessibilityHint={nextBook ? 'Double tap to go to next book' : undefined}
        accessible={!!nextBook}
      >
        {nextBook ? (
          <>
            <Text style={[styles.arrowText, { color: colors.text.secondary }]}>{getNextLabel()}</Text>
            <ChevronRight size={scale(16)} color={colors.text.secondary} strokeWidth={2} />
          </>
        ) : (
          <View style={styles.arrowPlaceholder} />
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(20),
    marginBottom: scale(16),
  },
  arrowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: scale(70),
    gap: scale(4),
  },
  arrowButtonRight: {
    justifyContent: 'flex-end',
  },
  arrowButtonDisabled: {
    // Keep space but hide content
  },
  arrowPlaceholder: {
    width: scale(70),
  },
  arrowText: {
    fontSize: scale(13),
    // color set via themeColors in JSX
  },
  seriesInfo: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: scale(8),
  },
  seriesName: {
    fontSize: scale(13),
    fontWeight: '600',
    // color set via themeColors in JSX
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  seriesPosition: {
    fontSize: scale(13),
    // color set via themeColors in JSX
    marginTop: scale(2),
  },
});
