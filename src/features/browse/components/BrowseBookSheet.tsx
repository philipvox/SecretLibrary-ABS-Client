/**
 * src/features/browse/components/BrowseBookSheet.tsx
 *
 * Bottom sheet for book details on the Browse screen.
 * Shown when tapping a book spine/cover in Browse (instead of navigating).
 * Shows cover, title, author, narrator, progress, and 3 action buttons.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle } from 'react-native-svg';
import { Play, Download, BookOpen, X, Check, Pause } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CoverStars } from '@/shared/components/CoverStars';
import { secretLibraryColors as colors, secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { scale } from '@/shared/theme';
import { LibraryItem, BookMetadata } from '@/core/types';
import { apiClient } from '@/core/api';
import { usePlayerStore } from '@/features/player/stores';
import { useDownloadStatus } from '@/core/hooks/useDownloads';
import { downloadManager } from '@/core/services/downloadManager';

interface BrowseBookSheetProps {
  book: LibraryItem | null;
  visible: boolean;
  onClose: () => void;
  onViewDetails: (bookId: string) => void;
}

function getMetadata(item: LibraryItem): BookMetadata | null {
  if (!item?.media?.metadata) return null;
  return item.media.metadata as BookMetadata;
}

function formatProgress(progress: number): string {
  if (progress <= 0) return 'Not started';
  if (progress >= 0.95) return 'Finished';
  return `${Math.round(progress * 100)}% complete`;
}

export function BrowseBookSheet({ book, visible, onClose, onViewDetails }: BrowseBookSheetProps) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Player state
  const loadBook = usePlayerStore((s) => s.loadBook);
  const play = usePlayerStore((s) => s.play);
  const pause = usePlayerStore((s) => s.pause);
  const currentBook = usePlayerStore((s) => s.currentBook);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  // Download status
  const { isDownloaded, isDownloading, progress: dlProgress } = useDownloadStatus(book?.id || '');

  const isCurrentBook = currentBook?.id === book?.id;
  const isCurrentlyPlaying = isCurrentBook && isPlaying;

  // Animate in/out
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 12 }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start(() => onClose());
  }, [onClose, slideAnim, fadeAnim]);

  const handlePlay = useCallback(async () => {
    if (!book) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (isCurrentlyPlaying) {
      pause();
      return;
    }
    if (isCurrentBook) {
      play();
      return;
    }

    try {
      const fullBook = await apiClient.getItem(book.id);
      await loadBook(fullBook, { autoPlay: true, showPlayer: false });
    } catch {
      // Silent
    }
  }, [book, isCurrentlyPlaying, isCurrentBook, play, pause, loadBook]);

  const handleDownload = useCallback(async () => {
    if (!book || isDownloaded || isDownloading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const fullBook = await apiClient.getItem(book.id);
      await downloadManager.queueDownload(fullBook);
    } catch {
      // Silent
    }
  }, [book, isDownloaded, isDownloading]);

  const handleDetails = useCallback(() => {
    if (!book) return;
    handleClose();
    setTimeout(() => onViewDetails(book.id), 250);
  }, [book, handleClose, onViewDetails]);

  if (!book) return null;

  const metadata = getMetadata(book);
  const title = metadata?.title || 'Unknown';
  const author = (metadata as any)?.authorName || 'Unknown Author';
  const narrator = (metadata as any)?.narratorName || '';
  const progress = book.userMediaProgress?.progress || 0;
  const coverUrl = apiClient.getItemCoverUrl(book.id, { width: 300, height: 300 });

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [400, 0],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.sheet,
                {
                  transform: [{ translateY }],
                  paddingBottom: insets.bottom + scale(16),
                },
              ]}
            >
              {/* Handle bar */}
              <View style={styles.handleBar} />

              {/* Close button */}
              <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
                <X size={16} color={colors.gray} />
              </TouchableOpacity>

              {/* Book info */}
              <View style={styles.bookRow}>
                <View style={{ width: scale(80), height: scale(80), borderRadius: scale(4), overflow: 'hidden' }}>
                  <Image
                    source={{ uri: coverUrl }}
                    style={styles.cover}
                    contentFit="cover"
                  />
                  <CoverStars bookId={book.id} starSize={scale(14)} />
                </View>
                <View style={styles.bookInfo}>
                  <Text style={styles.title} numberOfLines={2}>{title}</Text>
                  <Text style={styles.author} numberOfLines={1}>{author}</Text>
                  {narrator ? (
                    <Text style={styles.narrator} numberOfLines={1}>Read by {narrator}</Text>
                  ) : null}
                  <Text style={styles.progress}>{formatProgress(progress)}</Text>
                  {progress > 0 && progress < 0.95 && (
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                    </View>
                  )}
                </View>
              </View>

              {/* Action buttons */}
              <View style={styles.actions}>
                <TouchableOpacity style={[styles.actionBtn, styles.actionBtnFilled]} onPress={handlePlay}>
                  {isCurrentlyPlaying ? (
                    <Pause size={18} color={colors.black} />
                  ) : (
                    <Play size={18} color={colors.black} />
                  )}
                  <Text style={styles.actionBtnTextDark}>
                    {isCurrentlyPlaying ? 'Pause' : 'Play'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnOutline, isDownloaded && styles.actionBtnFilled]}
                  onPress={isDownloading ? () => downloadManager.cancelDownload(book!.id) : handleDownload}
                  disabled={isDownloaded}
                >
                  {isDownloading ? (
                    <>
                      <View style={{ width: 20, height: 20, justifyContent: 'center', alignItems: 'center' }}>
                        <Svg width={20} height={20}>
                          <Circle cx={10} cy={10} r={8} stroke="rgba(255,255,255,0.15)" strokeWidth={3} fill="none" />
                          <Circle
                            cx={10} cy={10} r={8}
                            stroke="#4ADE80"
                            strokeWidth={3}
                            fill="none"
                            strokeDasharray={`${2 * Math.PI * 8}`}
                            strokeDashoffset={`${2 * Math.PI * 8 * (1 - dlProgress)}`}
                            strokeLinecap="round"
                            rotation={-90}
                            origin="10, 10"
                          />
                        </Svg>
                      </View>
                      <Text style={styles.actionBtnText}>{Math.round(dlProgress * 100)}%</Text>
                    </>
                  ) : isDownloaded ? (
                    <>
                      <Check size={16} color={colors.black} />
                      <Text style={styles.actionBtnTextDark}>Saved</Text>
                    </>
                  ) : (
                    <>
                      <Download size={16} color={colors.white} />
                      <Text style={styles.actionBtnText}>Download</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOutline]} onPress={handleDetails}>
                  <BookOpen size={16} color={colors.white} />
                  <Text style={styles.actionBtnText}>Details</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: scale(16),
    borderTopRightRadius: scale(16),
    padding: scale(20),
    paddingTop: scale(12),
  },
  handleBar: {
    width: scale(36),
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
    marginBottom: scale(12),
  },
  closeBtn: {
    position: 'absolute',
    top: scale(12),
    right: scale(16),
    width: scale(28),
    height: scale(28),
    borderRadius: scale(14),
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  bookRow: {
    flexDirection: 'row',
    gap: scale(14),
    marginBottom: scale(20),
  },
  cover: {
    width: scale(80),
    height: scale(80),
    borderRadius: scale(4),
  },
  bookInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontFamily: secretLibraryFonts.playfair.regular,
    fontSize: scale(17),
    color: colors.white,
    marginBottom: scale(4),
  },
  author: {
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
    fontSize: scale(13),
    color: colors.gray,
    marginBottom: scale(2),
  },
  narrator: {
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
    fontSize: scale(11),
    color: 'rgba(255, 255, 255, 0.4)',
    marginBottom: scale(4),
  },
  progress: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(10),
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: scale(2),
  },
  progressBar: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 1.5,
    marginTop: scale(6),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.gold,
    borderRadius: 1.5,
  },
  actions: {
    flexDirection: 'row',
    gap: scale(8),
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(10),
    borderRadius: scale(6),
    gap: scale(6),
  },
  actionBtnOutline: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    backgroundColor: 'transparent',
  },
  actionBtnFilled: {
    backgroundColor: colors.white,
    borderWidth: 0,
  },
  actionBtnText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(12),
    color: colors.white,
    fontWeight: '500',
  },
  actionBtnTextDark: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(12),
    color: colors.black,
    fontWeight: '500',
  },
});
