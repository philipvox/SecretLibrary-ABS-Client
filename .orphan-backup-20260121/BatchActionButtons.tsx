/**
 * src/features/series/components/BatchActionButtons.tsx
 *
 * Clean batch action buttons for series.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native';
import { BlurView } from 'expo-blur';
import {
  ArrowDownCircle,
  CheckCircle,
  Play,
  RefreshCw,
  Compass,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { LibraryItem, BookMedia, BookMetadata } from '@/core/types';
import { useDownloads } from '@/core/hooks/useDownloads';

// Helper to get book metadata safely
function getBookMetadata(item: LibraryItem): BookMetadata | null {
  if (item.mediaType !== 'book' || !item.media?.metadata) return null;
  return item.media.metadata as BookMetadata;
}

// Type guard for book media
function isBookMedia(media: LibraryItem['media'] | undefined): media is BookMedia {
  return media !== undefined && 'duration' in media;
}
import { usePlayerStore } from '@/features/player';
import { scale, useTheme } from '@/shared/theme';
import { useIsDarkMode } from '@/shared/theme/themeStore';

const MAX_BATCH_DOWNLOAD = 3;

// Custom Alert Modal Component
interface CustomAlertProps {
  visible: boolean;
  title: string;
  message: string;
  buttons: { text: string; onPress?: () => void; style?: 'default' | 'cancel' }[];
  onDismiss: () => void;
}

function CustomAlert({ visible, title, message, buttons, onDismiss }: CustomAlertProps) {
  const { colors } = useTheme();
  const isDarkMode = useIsDarkMode();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.modalOverlay} onPress={onDismiss}>
        <BlurView
          intensity={40}
          tint={isDarkMode ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        <Pressable
          style={[
            styles.modalContent,
            { backgroundColor: isDarkMode ? 'rgba(40,40,40,0.95)' : 'rgba(255,255,255,0.95)' }
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.modalTitle, { color: colors.text.primary }]}>{title}</Text>
          <Text style={[styles.modalMessage, { color: colors.text.secondary }]}>{message}</Text>

          <View style={styles.modalButtons}>
            {buttons.map((button, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.modalButton,
                  index < buttons.length - 1 && [styles.modalButtonBorder, { borderBottomColor: colors.border.default }]
                ]}
                onPress={() => {
                  onDismiss();
                  button.onPress?.();
                }}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.modalButtonText,
                  { color: button.style === 'cancel' ? colors.text.secondary : '#007AFF' }
                ]}>
                  {button.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

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
  hasRealSequences?: boolean;
}

function getRawSequence(item: LibraryItem): number | null {
  const metadata = getBookMetadata(item);
  if (!metadata) return null;
  if (metadata.series && metadata.series.length > 0) {
    const primarySeries = metadata.series[0];
    if (primarySeries.sequence !== undefined && primarySeries.sequence !== null) {
      const parsed = parseFloat(primarySeries.sequence);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
  }
  const seriesName = metadata.seriesName || '';
  const match = seriesName.match(/#([\d.]+)/);
  return match ? parseFloat(match[1]) : null;
}

function getSequenceForDisplay(item: LibraryItem, hasReal: boolean): number | null {
  if (!hasReal) return null;
  return getRawSequence(item);
}

function getTitle(item: LibraryItem): string {
  return getBookMetadata(item)?.title || 'Unknown';
}

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
  hasRealSequences = true,
}: BatchActionButtonsProps) {
  const navigation = useNavigation<any>();
  const { queueDownload } = useDownloads();
  const { loadBook } = usePlayerStore();
  const { colors } = useTheme();

  // Alert state
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    buttons: { text: string; onPress?: () => void; style?: 'default' | 'cancel' }[];
  }>({
    visible: false,
    title: '',
    message: '',
    buttons: [],
  });

  const showAlert = useCallback((
    title: string,
    message: string,
    buttons: { text: string; onPress?: () => void; style?: 'default' | 'cancel' }[]
  ) => {
    setAlertConfig({ visible: true, title, message, buttons });
  }, []);

  const hideAlert = useCallback(() => {
    setAlertConfig(prev => ({ ...prev, visible: false }));
  }, []);

  const seriesState = useMemo(() => {
    if (seriesComplete) return 'completed';
    if (inProgressBook && inProgressPercent > 0) return 'mid_book';
    if (nextBook) {
      const seq = getSequenceForDisplay(nextBook, hasRealSequences);
      if (seq === 1) return 'not_started';
      if (!hasRealSequences) return 'not_started';
      return 'between_books';
    }
    return 'not_started';
  }, [seriesComplete, inProgressBook, inProgressPercent, nextBook, hasRealSequences]);

  const currentBookRemaining = useMemo(() => {
    if (!inProgressBook) return 0;
    const duration = isBookMedia(inProgressBook.media) ? inProgressBook.media.duration || 0 : 0;
    return duration * (1 - (inProgressPercent / 100));
  }, [inProgressBook, inProgressPercent]);

  const handleDownloadNext = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const toDownload = booksToDownload.slice(0, MAX_BATCH_DOWNLOAD);
    if (toDownload.length === 0) return;

    for (const book of toDownload) {
      await queueDownload(book);
    }

    const bookNames = toDownload.map((b, i) => {
      if (i === 0) return getTitle(b);
      const seq = getSequenceForDisplay(b, hasRealSequences);
      return seq !== null ? `Book ${seq}` : getTitle(b);
    }).join(', ');

    showAlert(
      'Downloads Started',
      toDownload.length === 1
        ? `"${getTitle(toDownload[0])}" is downloading.`
        : `${toDownload.length} books queued: ${bookNames}`,
      [{ text: 'OK' }]
    );
  }, [booksToDownload, queueDownload, showAlert]);

  const handleContinue = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const targetBook = inProgressBook || nextBook;
    if (!targetBook) return;

    const isDownloaded = nextBookDownloaded || (inProgressBook && nextBookDownloaded);

    if (!isDownloaded && !inProgressBook) {
      showAlert(
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
  }, [inProgressBook, nextBook, nextBookDownloaded, loadBook, queueDownload, showAlert]);

  const handleFindSimilar = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('Main', { screen: 'DiscoverTab' });
  }, [navigation]);

  const handleListenAgain = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (booksToDownload.length > 0 || nextBook) {
      const firstBook = nextBook;
      if (firstBook) {
        await loadBook(firstBook, { autoPlay: true, showPlayer: true });
      }
    }
  }, [nextBook, booksToDownload, loadBook]);

  const downloadCount = Math.min(booksToDownload.length, MAX_BATCH_DOWNLOAD);
  const canDownload = downloadCount > 0 && !seriesComplete;
  const nextSeq = nextBook ? getSequenceForDisplay(nextBook, hasRealSequences) : null;
  const hasSequence = nextSeq !== null;
  const isNearEnd = hasSequence && nextSeq >= totalBooks - 1;
  const isFinalBook = hasSequence && nextSeq === totalBooks;

  // Download button text - cleaner format
  let downloadText = 'All Downloaded';
  let DownloadIcon = CheckCircle;
  let showDownloadButton = true;

  if (seriesComplete) {
    showDownloadButton = false;
  } else if (canDownload) {
    DownloadIcon = ArrowDownCircle;
    if (downloadCount === 1 && hasSequence) {
      // Format single book number nicely
      const bookNum = Number.isInteger(nextSeq) ? nextSeq : nextSeq?.toFixed(1);
      downloadText = `Download Book ${bookNum}`;
    } else if (downloadCount === 1) {
      downloadText = `Download Next`;
    } else {
      // Just show count, not ugly decimal numbers
      downloadText = `Download Next ${downloadCount}`;
    }
  }

  // Continue button text
  let continueText = 'Continue Series';
  let ContinueIcon = Play;
  let continueEnabled = true;

  if (seriesComplete) {
    continueText = 'Listen Again';
    ContinueIcon = RefreshCw;
  } else if (seriesState === 'mid_book' && inProgressPercent > 0) {
    continueText = `Continue (${inProgressPercent}%)`;
    if (currentBookRemaining > 0) {
      continueText = `Continue · ${formatTimeRemaining(currentBookRemaining)} left`;
    }
  } else if (seriesState === 'not_started') {
    continueText = hasSequence ? 'Start Book 1' : 'Start Series';
  } else if (seriesState === 'between_books' && nextBook) {
    const seq = getSequenceForDisplay(nextBook, hasRealSequences);
    if (seq !== null) {
      const bookNum = Number.isInteger(seq) ? seq : seq.toFixed(1);
      continueText = `Start Book ${bookNum}`;
    } else {
      continueText = 'Start Next';
    }
  }

  // Completed state
  if (seriesComplete) {
    return (
      <>
        <CustomAlert
          visible={alertConfig.visible}
          title={alertConfig.title}
          message={alertConfig.message}
          buttons={alertConfig.buttons}
          onDismiss={hideAlert}
        />
        <View style={styles.container}>
          <TouchableOpacity
            style={[styles.button, styles.outlineButton, { borderColor: colors.text.primary }]}
            onPress={handleListenAgain}
            activeOpacity={0.7}
          >
            <RefreshCw size={scale(18)} color={colors.text.primary} strokeWidth={2} />
            <Text style={[styles.outlineButtonText, { color: colors.text.primary }]}>Listen Again</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.continueButton, { backgroundColor: colors.text.primary }]}
            onPress={handleFindSimilar}
            activeOpacity={0.7}
          >
            <Compass size={scale(18)} color={colors.background.primary} strokeWidth={2} />
            <Text style={[styles.continueButtonText, { color: colors.background.primary }]}>Find Similar</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  return (
    <>
      <CustomAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        onDismiss={hideAlert}
      />
      <View style={styles.container}>
        {/* Download Button - black outline style */}
        {showDownloadButton && (
          <TouchableOpacity
            style={[
              styles.button,
              styles.outlineButton,
              { borderColor: canDownload ? colors.text.primary : colors.border.default },
            ]}
            onPress={handleDownloadNext}
            disabled={!canDownload}
            activeOpacity={0.7}
          >
            <DownloadIcon
              size={scale(18)}
              color={canDownload ? colors.text.primary : colors.text.tertiary}
              strokeWidth={2}
            />
            <Text style={[
              styles.outlineButtonText,
              { color: canDownload ? colors.text.primary : colors.text.tertiary },
            ]}>
              {downloadText}
            </Text>
          </TouchableOpacity>
        )}

        {/* Continue Button - black outline, no fill */}
        <TouchableOpacity
          style={[
            styles.button,
            styles.outlineButton,
            { borderColor: colors.text.primary },
            !showDownloadButton && styles.buttonFull,
          ]}
          onPress={handleContinue}
          disabled={!continueEnabled}
          activeOpacity={0.7}
        >
          <ContinueIcon
            size={scale(18)}
            color={colors.text.primary}
            strokeWidth={2}
            fill={ContinueIcon === Play ? colors.text.primary : undefined}
          />
          <Text style={[styles.outlineButtonText, { color: colors.text.primary }]}>
            {continueText}
          </Text>
        </TouchableOpacity>
      </View>
    </>
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
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
  },
  continueButton: {
    // backgroundColor set dynamically
  },
  continueButtonText: {
    fontSize: scale(13),
    fontWeight: '600',
  },
  outlineButtonText: {
    fontSize: scale(13),
    fontWeight: '600',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(40),
  },
  modalContent: {
    width: '100%',
    maxWidth: scale(320),
    borderRadius: scale(14),
    overflow: 'hidden',
  },
  modalTitle: {
    fontSize: scale(17),
    fontWeight: '600',
    textAlign: 'center',
    paddingTop: scale(20),
    paddingHorizontal: scale(20),
  },
  modalMessage: {
    fontSize: scale(13),
    textAlign: 'center',
    paddingHorizontal: scale(20),
    paddingTop: scale(8),
    paddingBottom: scale(20),
    lineHeight: scale(18),
  },
  modalButtons: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  modalButton: {
    paddingVertical: scale(14),
    alignItems: 'center',
  },
  modalButtonBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalButtonText: {
    fontSize: scale(17),
    fontWeight: '400',
  },
});
