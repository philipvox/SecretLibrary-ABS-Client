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
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LibraryItem } from '@/core/types';
import { getSeriesNavigationInfo } from '@/core/cache';
import { colors, scale, spacing, radius } from '@/shared/theme';

const ACCENT = colors.accent;

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
      >
        {previousBook ? (
          <>
            <Ionicons name="chevron-back" size={scale(16)} color="rgba(255,255,255,0.5)" />
            <Text style={styles.arrowText}>{getPreviousLabel()}</Text>
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
      >
        <Text style={styles.seriesName} numberOfLines={1}>
          {seriesName}
        </Text>
        <Text style={styles.seriesPosition}>
          #{Math.floor(currentSequence)}{totalBooks > 0 ? ` of ${totalBooks}` : ''}
        </Text>
      </TouchableOpacity>

      {/* Next Book Arrow */}
      <TouchableOpacity
        style={[styles.arrowButton, styles.arrowButtonRight, !nextBook && styles.arrowButtonDisabled]}
        onPress={handleNextPress}
        disabled={!nextBook}
        activeOpacity={0.7}
      >
        {nextBook ? (
          <>
            <Text style={styles.arrowText}>{getNextLabel()}</Text>
            <Ionicons name="chevron-forward" size={scale(16)} color="rgba(255,255,255,0.5)" />
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
    marginHorizontal: scale(20),
    marginVertical: scale(8),
    paddingVertical: scale(12),
    paddingHorizontal: scale(12),
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: scale(12),
  },
  arrowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: scale(80),
    gap: scale(4),
  },
  arrowButtonRight: {
    justifyContent: 'flex-end',
  },
  arrowButtonDisabled: {
    // Keep visible but non-interactive
  },
  arrowPlaceholder: {
    width: scale(80),
  },
  arrowText: {
    fontSize: scale(12),
    color: 'rgba(255,255,255,0.5)',
  },
  seriesInfo: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: scale(8),
  },
  seriesName: {
    fontSize: scale(13),
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  seriesPosition: {
    fontSize: scale(11),
    color: 'rgba(255,255,255,0.5)',
    marginTop: scale(2),
  },
});
