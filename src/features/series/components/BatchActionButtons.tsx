/**
 * src/features/series/components/BatchActionButtons.tsx
 *
 * Enhanced batch action buttons based on UX research.
 * Features:
 * - Smart dynamic button text based on series state
 * - Specific book names in CTAs
 * - Progress percentage in continue button
 * - Context-aware actions
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { LibraryItem } from '@/core/types';
import { useDownloads } from '@/core/hooks/useDownloads';
import { usePlayerStore } from '@/features/player';
import { colors, scale, spacing, radius } from '@/shared/theme';

const ACCENT = colors.accent;
const MAX_BATCH_DOWNLOAD = 3;

interface BatchActionButtonsProps {
  booksToDownload: LibraryItem[];
  nextBook: LibraryItem | null;
  nextBookDownloaded: boolean;
  allDownloaded: boolean;
  seriesComplete: boolean;
  totalBooks: number;
  inProgressBook?: LibraryItem | null;
  inProgressPercent?: number;
  onContinue: () => void;
}

// Get sequence number for book - returns null if unknown
function getSequence(item: LibraryItem): number | null {
  const metadata = (item.media?.metadata as any) || {};

  // First check series array (preferred - has explicit sequence)
  if (metadata.series?.length > 0) {
    const primarySeries = metadata.series[0];
    if (primarySeries.sequence !== undefined && primarySeries.sequence !== null) {
      const parsed = parseFloat(primarySeries.sequence);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
  }

  // Fallback: check seriesName for #N pattern
  const seriesName = metadata.seriesName || '';
  const match = seriesName.match(/#([\d.]+)/);
  return match ? parseFloat(match[1]) : null;
}

// Get book title
function getTitle(item: LibraryItem): string {
  return (item.media?.metadata as any)?.title || 'Unknown';
}

// Format time remaining
function formatTimeRemaining(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function BatchActionButtons({
  booksToDownload,
  nextBook,
  nextBookDownloaded,
  allDownloaded,
  seriesComplete,
  totalBooks,
  inProgressBook,
  inProgressPercent = 0,
  onContinue,
}: BatchActionButtonsProps) {
  const navigation = useNavigation<any>();
  const { queueDownload } = useDownloads();
  const { loadBook } = usePlayerStore();

  // Determine series state
  const seriesState = useMemo(() => {
    if (seriesComplete) return 'completed';
    if (inProgressBook && inProgressPercent > 0) return 'mid_book';
    if (nextBook) {
      const seq = getSequence(nextBook);
      if (seq === 1) return 'not_started';
      return 'between_books';
    }
    return 'not_started';
  }, [seriesComplete, inProgressBook, inProgressPercent, nextBook]);

  // Calculate remaining time for current book
  const currentBookRemaining = useMemo(() => {
    if (!inProgressBook) return 0;
    const duration = (inProgressBook.media as any)?.duration || 0;
    return duration * (1 - (inProgressPercent / 100));
  }, [inProgressBook, inProgressPercent]);

  // Handle batch download
  const handleDownloadNext = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const toDownload = booksToDownload.slice(0, MAX_BATCH_DOWNLOAD);
    if (toDownload.length === 0) return;

    // Queue all downloads
    for (const book of toDownload) {
      await queueDownload(book);
    }

    // Show feedback
    const bookNames = toDownload.map((b, i) => {
      if (i === 0) return getTitle(b);
      const seq = getSequence(b);
      return seq !== null ? `Book ${seq}` : getTitle(b);
    }).join(', ');

    Alert.alert(
      'Downloads Started',
      toDownload.length === 1
        ? `"${getTitle(toDownload[0])}" is downloading.`
        : `${toDownload.length} books queued: ${bookNames}`,
      [{ text: 'OK' }]
    );
  }, [booksToDownload, queueDownload]);

  // Handle continue/start series
  const handleContinue = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const targetBook = inProgressBook || nextBook;
    if (!targetBook) return;

    const isDownloaded = nextBookDownloaded || (inProgressBook && nextBookDownloaded);

    if (!isDownloaded && !inProgressBook) {
      // Offer to download or stream
      Alert.alert(
        'Book Not Downloaded',
        `"${getTitle(targetBook)}" needs to be downloaded for offline listening. Stream it now?`,
        [
          { text: 'Download First', onPress: () => queueDownload(targetBook) },
          {
            text: 'Stream Now',
            onPress: () => loadBook(targetBook, { autoPlay: true, showPlayer: true })
          },
        ]
      );
      return;
    }

    await loadBook(targetBook, { autoPlay: true, showPlayer: true });
  }, [inProgressBook, nextBook, nextBookDownloaded, loadBook, queueDownload]);

  // Handle similar series (for completed state)
  const handleFindSimilar = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('Main', { screen: 'DiscoverTab' });
  }, [navigation]);

  // Handle listen again
  const handleListenAgain = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // For completed series, start from book 1
    if (booksToDownload.length > 0 || nextBook) {
      const firstBook = nextBook; // nextBook should be book 1 for completed series
      if (firstBook) {
        await loadBook(firstBook, { autoPlay: true, showPlayer: true });
      }
    }
  }, [nextBook, booksToDownload, loadBook]);

  // Determine button configurations
  const downloadCount = Math.min(booksToDownload.length, MAX_BATCH_DOWNLOAD);
  const canDownload = downloadCount > 0 && !seriesComplete;
  const nextSeq = nextBook ? getSequence(nextBook) : null;
  const hasSequence = nextSeq !== null;
  const isNearEnd = hasSequence && nextSeq >= totalBooks - 1;
  const isFinalBook = hasSequence && nextSeq === totalBooks;

  // Download button text & icon
  let downloadText = 'All Downloaded';
  let downloadIcon: keyof typeof Ionicons.glyphMap = 'checkmark-circle';
  let showDownloadButton = true;

  if (seriesComplete) {
    showDownloadButton = false;
  } else if (canDownload) {
    downloadIcon = 'arrow-down-circle-outline';
    if (seriesState === 'not_started' && hasSequence) {
      downloadText = `Download Book 1`;
    } else if (isFinalBook) {
      downloadText = `Download Final Book`;
    } else if (downloadCount === 1 && hasSequence) {
      downloadText = `Download Book ${nextSeq}`;
    } else if (downloadCount === 1) {
      downloadText = `Download Next`;
    } else if (isNearEnd) {
      downloadText = `Download Last ${downloadCount}`;
    } else {
      downloadText = `Download Next ${downloadCount}`;
    }
  }

  // Continue button text & icon
  let continueText = 'Continue Series';
  let continueIcon: keyof typeof Ionicons.glyphMap = 'play';
  let continueEnabled = true;

  if (seriesComplete) {
    continueText = 'Listen Again';
    continueIcon = 'refresh';
  } else if (seriesState === 'mid_book' && inProgressPercent > 0) {
    continueText = `Continue (${inProgressPercent}%)`;
    if (currentBookRemaining > 0) {
      continueText = `Continue · ${formatTimeRemaining(currentBookRemaining)} left`;
    }
  } else if (seriesState === 'not_started') {
    continueText = hasSequence ? 'Start Book 1' : 'Start Series';
  } else if (seriesState === 'between_books' && nextBook) {
    const seq = getSequence(nextBook);
    const title = getTitle(nextBook);
    // Truncate title if too long
    const shortTitle = title.length > 15 ? title.substring(0, 15) + '...' : title;
    continueText = seq !== null ? `Start Book ${seq}` : `Start ${shortTitle}`;
  }

  // Completed state has special buttons
  if (seriesComplete) {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={[styles.button, styles.outlineButton]}
          onPress={handleListenAgain}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh" size={scale(18)} color={ACCENT} />
          <Text style={styles.outlineButtonText}>Listen Again</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.continueButton]}
          onPress={handleFindSimilar}
          activeOpacity={0.7}
        >
          <Ionicons name="compass-outline" size={scale(18)} color="#000" />
          <Text style={styles.continueButtonText}>Find Similar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Download Button */}
      {showDownloadButton && (
        <TouchableOpacity
          style={[
            styles.button,
            styles.downloadButton,
            !canDownload && styles.buttonDisabled,
          ]}
          onPress={handleDownloadNext}
          disabled={!canDownload}
          activeOpacity={0.7}
        >
          <Ionicons
            name={downloadIcon}
            size={scale(18)}
            color={canDownload ? 'rgba(255,255,255,0.9)' : ACCENT}
          />
          <Text style={[
            styles.buttonText,
            !canDownload && styles.buttonTextDisabled,
          ]}>
            {downloadText}
          </Text>
        </TouchableOpacity>
      )}

      {/* Continue Button */}
      <TouchableOpacity
        style={[
          styles.button,
          styles.continueButton,
          !showDownloadButton && styles.buttonFull,
        ]}
        onPress={handleContinue}
        disabled={!continueEnabled}
        activeOpacity={0.7}
      >
        <Ionicons
          name={continueIcon}
          size={scale(18)}
          color="#000"
        />
        <Text style={styles.continueButtonText}>
          {continueText}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: scale(16),
    marginBottom: scale(16),
    gap: scale(10),
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: scale(48),
    borderRadius: scale(12),
    gap: scale(8),
  },
  buttonFull: {
    flex: 2,
  },
  downloadButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  continueButton: {
    backgroundColor: ACCENT,
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: ACCENT,
  },
  buttonDisabled: {
    backgroundColor: 'rgba(244,182,12,0.1)',
  },
  buttonText: {
    fontSize: scale(13),
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  buttonTextDisabled: {
    color: ACCENT,
  },
  continueButtonText: {
    fontSize: scale(13),
    fontWeight: '600',
    color: '#000',
  },
  outlineButtonText: {
    fontSize: scale(13),
    fontWeight: '600',
    color: ACCENT,
  },
});
