/**
 * src/features/discover/components/HeroSection.tsx
 *
 * Immersive hero section with large centered cover art (Option B).
 * Background is rendered in BrowseScreen for seamless blur effect.
 * Uses book-detail-style Play and Download buttons.
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useCoverUrl } from '@/core/cache';
import { Icon } from '@/shared/components/Icon';
import { colors, scale, spacing, radius, layout, elevation } from '@/shared/theme';
import { CompleteBadgeOverlay } from '@/features/completion';
import { usePlayerStore } from '@/features/player';
import { useDownloadStatus } from '@/core/hooks/useDownloads';
import { downloadManager } from '@/core/services/downloadManager';
import { apiClient } from '@/core/api';
import { haptics } from '@/core/native/haptics';
import { HeroRecommendation } from '../types';

// Immersive hero with larger cover
const COVER_SIZE = scale(250); // Square cover

const ACCENT = colors.accent;

// Format duration
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// Format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

interface HeroSectionProps {
  hero: HeroRecommendation;
}

export function HeroSection({ hero }: HeroSectionProps) {
  const navigation = useNavigation<any>();
  const loadBook = usePlayerStore((s) => s.loadBook);
  const currentBook = usePlayerStore((s) => s.currentBook);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  // Download status
  const {
    isDownloaded,
    isDownloading,
    isPending,
    isPaused,
    progress: downloadProgress,
    bytesDownloaded,
    totalBytes,
  } = useDownloadStatus(hero.book.id);

  // Use cached cover URL
  const coverUrl = useCoverUrl(hero.book.id);

  // Check if this book is currently loaded and playing
  const isCurrentBook = currentBook?.id === hero.book.id;
  const isCurrentlyPlaying = isCurrentBook && isPlaying;

  const handlePress = useCallback(() => {
    navigation.navigate('BookDetail', { id: hero.book.id });
  }, [navigation, hero.book.id]);

  const handlePlay = useCallback(async () => {
    haptics.buttonPress();
    try {
      const fullBook = await apiClient.getItem(hero.book.id);
      await loadBook(fullBook, { autoPlay: true, showPlayer: false });
    } catch {
      navigation.navigate('BookDetail', { id: hero.book.id });
    }
  }, [hero.book.id, loadBook, navigation]);

  const handleDownload = useCallback(async () => {
    haptics.buttonPress();

    if (isDownloaded) return;

    if (isDownloading) {
      haptics.toggle();
      await downloadManager.pauseDownload(hero.book.id);
      return;
    }

    if (isPaused) {
      haptics.toggle();
      await downloadManager.resumeDownload(hero.book.id);
      return;
    }

    if (isPending) {
      haptics.warning();
      await downloadManager.cancelDownload(hero.book.id);
      return;
    }

    // Queue download - need full book data
    try {
      const fullBook = await apiClient.getItem(hero.book.id);
      haptics.success();
      await downloadManager.queueDownload(fullBook);
    } catch {
      console.warn('[HeroSection] Failed to queue download');
    }
  }, [hero.book.id, isDownloaded, isDownloading, isPaused, isPending]);

  const { book, reason } = hero;

  // Get file size from book data
  const fileSize = book.duration ? Math.round(book.duration * 16000) : 0; // Rough estimate: ~128kbps

  return (
    <View style={styles.container}>
      {/* Centered cover with shadow */}
      <TouchableOpacity
        style={styles.coverWrapper}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        <View style={styles.coverContainer}>
          <Image
            source={coverUrl || book.coverUrl}
            style={styles.cover}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={200}
          />
          <CompleteBadgeOverlay bookId={book.id} size="medium" />
        </View>
      </TouchableOpacity>

      {/* Title and metadata below cover */}
      <View style={styles.infoContainer}>
        {/* Recommendation reason */}
        <View style={styles.reasonRow}>
          <Icon name="sparkles" size={scale(12)} color={colors.accent} set="ionicons" />
          <Text style={styles.reason}>{reason || 'Recommended for you'}</Text>
        </View>

        <Text style={styles.title} numberOfLines={2}>{book.title}</Text>
        <Text style={styles.author} numberOfLines={1}>by {book.author}</Text>

        {/* Meta info row */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Icon name="time-outline" size={scale(12)} color={colors.textTertiary} set="ionicons" />
            <Text style={styles.metaText}>{formatDuration(book.duration)}</Text>
          </View>
          {book.genres[0] && (
            <>
              <View style={styles.metaDot} />
              <Text style={styles.metaText}>{book.genres[0]}</Text>
            </>
          )}
        </View>

        {/* Action buttons - book detail style */}
        <View style={styles.actionRow}>
          {/* Download Button */}
          {isDownloading || isPending || isPaused ? (
            <TouchableOpacity
              style={styles.downloadProgressButton}
              onPress={handleDownload}
              activeOpacity={0.7}
            >
              <View style={styles.downloadProgressHeader}>
                <View style={styles.downloadStatusRow}>
                  {isPending ? (
                    <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" />
                  ) : isPaused ? (
                    <Ionicons name="play" size={scale(14)} color="rgba(255,255,255,0.6)" />
                  ) : (
                    <Ionicons name="pause" size={scale(14)} color="rgba(255,255,255,0.6)" />
                  )}
                  <Text style={styles.downloadStatusText}>
                    {isPending ? 'Queued' : isPaused ? 'Paused' : `${Math.round(downloadProgress * 100)}%`}
                  </Text>
                </View>
              </View>
              <View style={styles.downloadProgressTrack}>
                <View style={[
                  styles.downloadProgressFill,
                  { width: `${downloadProgress * 100}%` },
                  isPaused && styles.downloadProgressFillPaused,
                ]} />
              </View>
              <Text style={styles.downloadBytesText}>
                {formatBytes(bytesDownloaded)} / {formatBytes(totalBytes)}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.primaryButton,
                isDownloaded && styles.primaryButtonDownloaded,
              ]}
              onPress={handleDownload}
              activeOpacity={0.7}
              disabled={isDownloaded}
            >
              <Ionicons
                name={isDownloaded ? 'checkmark-circle' : 'arrow-down-circle-outline'}
                size={scale(18)}
                color={isDownloaded ? ACCENT : 'rgba(255,255,255,0.7)'}
              />
              <View style={styles.buttonTextContainer}>
                <Text style={[styles.buttonText, isDownloaded && styles.buttonTextAccent]}>
                  {isDownloaded ? 'Downloaded' : 'Download'}
                </Text>
                {!isDownloaded && fileSize > 0 && (
                  <Text style={styles.buttonSubtext}>{formatBytes(fileSize)}</Text>
                )}
              </View>
            </TouchableOpacity>
          )}

          {/* Play Button */}
          <TouchableOpacity
            style={[
              styles.playButton,
              isCurrentlyPlaying && styles.playButtonActive,
              !isDownloaded && styles.playButtonStream,
            ]}
            onPress={handlePlay}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isCurrentlyPlaying ? 'pause' : 'play'}
              size={scale(18)}
              color={isCurrentlyPlaying ? '#000' : (isDownloaded ? '#000' : 'rgba(255,255,255,0.9)')}
            />
            <View style={styles.buttonTextContainer}>
              <Text style={[
                styles.playButtonText,
                isCurrentlyPlaying && styles.playButtonTextActive,
                !isDownloaded && styles.playButtonTextStream,
              ]}>
                {isCurrentlyPlaying ? 'Pause' : (isDownloaded ? 'Play' : 'Stream')}
              </Text>
              {!isDownloaded && !isCurrentlyPlaying && (
                <Text style={styles.streamSubtext}>May buffer</Text>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    marginBottom: layout.sectionGap,
  },
  coverWrapper: {
    marginBottom: spacing.lg,
  },
  coverContainer: {
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: radius.md,
    overflow: 'hidden',
    ...elevation.large,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  infoContainer: {
    alignItems: 'center',
    paddingHorizontal: layout.screenPaddingH,
    width: '100%',
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  reason: {
    fontSize: scale(11),
    color: colors.accent,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  title: {
    fontSize: scale(20),
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: scale(26),
    marginBottom: spacing.xs,
  },
  author: {
    fontSize: scale(14),
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaDot: {
    width: scale(3),
    height: scale(3),
    borderRadius: scale(1.5),
    backgroundColor: colors.textTertiary,
    marginHorizontal: spacing.sm,
  },
  metaText: {
    fontSize: scale(12),
    color: colors.textTertiary,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: scale(10),
    width: '100%',
    maxWidth: scale(320),
  },

  // Primary Button (Download)
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: scale(52),
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: scale(12),
    gap: scale(8),
    paddingHorizontal: scale(12),
  },
  primaryButtonDownloaded: {
    backgroundColor: 'rgba(193,244,12,0.1)',
  },

  // Button text
  buttonTextContainer: {
    alignItems: 'flex-start',
  },
  buttonText: {
    fontSize: scale(13),
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  buttonTextAccent: {
    color: ACCENT,
  },
  buttonSubtext: {
    fontSize: scale(10),
    color: 'rgba(255,255,255,0.5)',
    marginTop: scale(1),
  },

  // Play Button
  playButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: scale(52),
    backgroundColor: ACCENT,
    borderRadius: scale(12),
    gap: scale(8),
    paddingHorizontal: scale(12),
  },
  playButtonActive: {
    backgroundColor: '#fff',
  },
  playButtonStream: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  playButtonText: {
    fontSize: scale(13),
    fontWeight: '600',
    color: '#000',
  },
  playButtonTextActive: {
    color: '#000',
  },
  playButtonTextStream: {
    color: 'rgba(255,255,255,0.9)',
  },
  streamSubtext: {
    fontSize: scale(10),
    color: 'rgba(255,255,255,0.4)',
    marginTop: scale(1),
  },

  // Download Progress Button
  downloadProgressButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: scale(12),
    paddingHorizontal: scale(12),
    paddingVertical: scale(8),
    justifyContent: 'center',
  },
  downloadProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(6),
  },
  downloadStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  downloadStatusText: {
    fontSize: scale(13),
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  downloadProgressTrack: {
    height: scale(4),
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: scale(2),
    overflow: 'hidden',
  },
  downloadProgressFill: {
    height: '100%',
    backgroundColor: ACCENT,
    borderRadius: scale(2),
  },
  downloadProgressFillPaused: {
    backgroundColor: '#FF9800',
  },
  downloadBytesText: {
    fontSize: scale(10),
    color: 'rgba(255,255,255,0.4)',
    marginTop: scale(4),
  },
});
