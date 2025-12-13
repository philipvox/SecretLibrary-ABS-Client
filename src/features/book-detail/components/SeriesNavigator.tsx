/**
 * src/features/book-detail/components/SeriesNavigator.tsx
 *
 * Series navigation component for Book Detail screen.
 * Shows previous/next book arrows and series info.
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

export function SeriesNavigator({ book }: SeriesNavigatorProps) {
  const navigation = useNavigation<any>();

  // Get series navigation info
  const seriesInfo = useMemo(() => {
    return getSeriesNavigationInfo(book);
  }, [book]);

  // Navigate to previous book
  const handlePreviousPress = useCallback(() => {
    if (seriesInfo?.previousBook) {
      navigation.replace('BookDetail', { id: seriesInfo.previousBook.id });
    }
  }, [navigation, seriesInfo?.previousBook]);

  // Navigate to next book
  const handleNextPress = useCallback(() => {
    if (seriesInfo?.nextBook) {
      navigation.replace('BookDetail', { id: seriesInfo.nextBook.id });
    }
  }, [navigation, seriesInfo?.nextBook]);

  // Navigate to series detail
  const handleSeriesPress = useCallback(() => {
    if (seriesInfo?.seriesName) {
      navigation.navigate('SeriesDetail', { seriesName: seriesInfo.seriesName });
    }
  }, [navigation, seriesInfo?.seriesName]);

  // Don't render if not part of a series
  if (!seriesInfo) {
    return null;
  }

  const { seriesName, currentSequence, totalBooks, previousBook, nextBook } = seriesInfo;

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
        {previousBook && (
          <>
            <Ionicons name="chevron-back" size={scale(18)} color="rgba(255,255,255,0.6)" />
            <Text style={styles.arrowText}>{getPreviousLabel()}</Text>
          </>
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
          #{Math.floor(currentSequence)} of {totalBooks}
        </Text>
      </TouchableOpacity>

      {/* Next Book Arrow */}
      <TouchableOpacity
        style={[styles.arrowButton, styles.arrowButtonRight, !nextBook && styles.arrowButtonDisabled]}
        onPress={handleNextPress}
        disabled={!nextBook}
        activeOpacity={0.7}
      >
        {nextBook && (
          <>
            <Text style={styles.arrowText}>{getNextLabel()}</Text>
            <Ionicons name="chevron-forward" size={scale(18)} color="rgba(255,255,255,0.6)" />
          </>
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
    paddingHorizontal: scale(8),
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: scale(12),
  },
  arrowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: scale(90),
    gap: scale(4),
  },
  arrowButtonRight: {
    justifyContent: 'flex-end',
  },
  arrowButtonDisabled: {
    opacity: 0,
  },
  arrowText: {
    fontSize: scale(12),
    color: 'rgba(255,255,255,0.6)',
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
