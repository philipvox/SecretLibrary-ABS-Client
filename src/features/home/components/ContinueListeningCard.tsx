/**
 * src/features/home/components/ContinueListeningCard.tsx
 * 
 * Continue Listening card with:
 * - Waits for download before playing
 * - Static download progress percentage
 * - Checkmark badge when downloaded
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, Image, Pressable, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { getColors } from 'react-native-image-colors';
import Svg, { Circle } from 'react-native-svg';
import { LibraryItem } from '@/core/types';
import { apiClient } from '@/core/api';
import { usePlayerStore } from '@/features/player';
import { useMyLibraryStore } from '@/features/library/stores/myLibraryStore';
import { Icon } from '@/shared/components/Icon';
import { theme } from '@/shared/theme';
import { getTitle } from '@/shared/utils/metadata';
import { matchToPalette } from '@/shared/utils/colorPalette';
// import { autoDownloadService, DownloadStatus } from '@/features/downloads/services/autoDownloadService';

const COVER_SIZE = 40;
const PROGRESS_SIZE = 36;
const PROGRESS_STROKE = 3;

interface ContinueListeningCardProps {
  book: LibraryItem & {
    userMediaProgress?: {
      progress?: number;
      currentTime?: number;
      duration?: number;
    };
  };
  style?: any;
  zIndex?: number;
}

// ========================================
// Color Utilities
// ========================================

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const color = hex.replace('#', '');
  if (color.length !== 6) return null;
  return {
    r: parseInt(color.substr(0, 2), 16),
    g: parseInt(color.substr(2, 2), 16),
    b: parseInt(color.substr(4, 2), 16),
  };
}

function isColorLight(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return true;
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.5;
}

function getColorSaturation(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const { r, g, b } = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0) return 0;
  return (max - min) / max;
}

function pickMostSaturated(colors: (string | undefined)[]): string | null {
  let best: string | null = null;
  let bestSat = -1;
  for (const c of colors) {
    if (!c) continue;
    const sat = getColorSaturation(c);
    if (sat > bestSat) {
      bestSat = sat;
      best = c;
    }
  }
  return best;
}

// ========================================
// Download Status Hook
// ========================================

function useDownloadStatus(bookId: string) {
  // const [status, setStatus] = useState<DownloadStatus>(() => 
  //   // autoDownloadService.getStatus(bookId)
  // // );
  // const [progress, setProgress] = useState<number>(() => 
  //   // autoDownloadService.getProgress(bookId)
  // );

  useEffect(() => {
    // Get initial state
    // setStatus(autoDownloadService.getStatus(bookId));
    // setProgress(autoDownloadService.getProgress(bookId));

    // Subscribe to updates
    // const unsubProgress = autoDownloadService.onProgress((id, pct) => {
    //   if (id === bookId) setProgress(pct);
    // });

    // const unsubStatus = autoDownloadService.onStatus((id, newStatus) => {
    //   if (id === bookId) setStatus(newStatus);
    // });

    return () => {
      // unsubProgress();
      // unsubStatus();
    };
  }, [bookId]);

  return { };
}

// ========================================
// Static Progress Circle
// ========================================

function ProgressCircle({ 
  progress, 
  size = PROGRESS_SIZE, 
  strokeWidth = PROGRESS_STROKE,
  color = '#FFFFFF',
  bgColor = 'rgba(255,255,255,0.3)',
}: { 
  progress: number; 
  size?: number; 
  strokeWidth?: number;
  color?: string;
  bgColor?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  const strokeDashoffset = circumference - (clampedProgress * circumference);

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }], position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={bgColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </Svg>
      {/* Static percentage text */}
      <Text style={{ fontSize: 9, fontWeight: '700', color }}>
        {Math.round(clampedProgress * 100)}
      </Text>
    </View>
  );
}

// ========================================
// Main Component
// ========================================

export function ContinueListeningCard({ book, style, zIndex = 1 }: ContinueListeningCardProps) {
  const { loadBook, isLoading: playerLoading, currentBook } = usePlayerStore();
  const bookIds = useMyLibraryStore((state) => state.bookIds) ?? [];
  const addBook = useMyLibraryStore((state) => state.addBook);
  const removeBook = useMyLibraryStore((state) => state.removeBook);
  
  const [bgColor, setBgColor] = useState(theme.colors.neutral[200]);
  const [isLight, setIsLight] = useState(true);
  const [isWaitingForDownload, setIsWaitingForDownload] = useState(false);
  
  // Debounce
  const lastPressRef = useRef(0);
  const DEBOUNCE_MS = 800;

  // Download status
  const { status: downloadStatus, progress: downloadProgress } = useDownloadStatus(book.id);

  const isInLibrary = bookIds.includes(book.id);
  const coverUrl = apiClient.getItemCoverUrl(book.id);
  const title = getTitle(book);
  const isThisBookInPlayer = currentBook?.id === book.id;
  const isLoading = isWaitingForDownload || (playerLoading && isThisBookInPlayer);
  
  const currentTime = book.userMediaProgress?.currentTime ?? 0;
  const duration = book.media?.duration ?? book.userMediaProgress?.duration ?? 0;
  
  // Calculate current chapter
  const chapters = book.media?.chapters ?? [];
  let chapterNumber = 1;
  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    const nextCh = chapters[i + 1];
    if (currentTime >= ch.start && (!nextCh || currentTime < nextCh.start)) {
      chapterNumber = i + 1;
      break;
    }
  }

  // Extract colors from cover
  useEffect(() => {
    let mounted = true;
    
    const extractColors = async () => {
      try {
        const result = await getColors(coverUrl, {
          fallback: theme.colors.neutral[200],
          cache: true,
          key: book.id,
        });
        
        if (!mounted) return;

        let dominant = theme.colors.neutral[200];
        
        if (result.platform === 'ios') {
          dominant = result.detail || result.primary || result.secondary || theme.colors.neutral[200];
        } else if (result.platform === 'android') {
          const candidates = [
            result.vibrant,
            result.darkVibrant, 
            result.lightVibrant,
            result.muted,
            result.darkMuted,
            result.lightMuted,
            result.dominant,
          ];
          dominant = pickMostSaturated(candidates) || result.dominant || theme.colors.neutral[200];
        }
        
        const paletteColor = matchToPalette(dominant);
        setBgColor(paletteColor);
        setIsLight(isColorLight(paletteColor));
      } catch {}
    };

    extractColors();
    return () => { mounted = false; };
  }, [coverUrl, book.id]);

  const textColor = isLight ? '#000000' : '#FFFFFF';
  const secondaryColor = isLight ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)';
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle play press - WAITS for download
  const handlePlay = useCallback(async () => {
    // Debounce
    const now = Date.now();
    if (now - lastPressRef.current < DEBOUNCE_MS) return;
    lastPressRef.current = now;

    if (isLoading) return;

    try {
      // Check if book is downloaded
      // const isDownloaded = autoDownloadService.isDownloaded(book.id);
      // const isDownloading = autoDownloadService.isDownloading(book.id);

      if (isDownloaded) {
        // Already downloaded - play immediately
        console.log('[Card] Playing downloaded book');
        const fullBook = await apiClient.getItem(book.id);
        await loadBook(fullBook);
        
      } else if (isDownloading) {
        // Currently downloading - wait for it
        console.log('[Card] Waiting for download...');
        setIsWaitingForDownload(true);
        
        // const localPath = await autoDownloadService.waitForDownload(book.id);
        
        if (localPath) {
          console.log('[Card] Download complete, playing');
          const fullBook = await apiClient.getItem(book.id);
          await loadBook(fullBook);
        } else {
          console.log('[Card] Download failed or cancelled');
        }
        
      } else {
        // Not downloaded and not downloading - shouldn't happen normally
        // but stream anyway
        console.log('[Card] Streaming (not downloaded)');
        const fullBook = await apiClient.getItem(book.id);
        await loadBook(fullBook);
      }
      
    } catch (err: any) {
      console.error('[Card] Failed:', err.message);
    } finally {
      setIsWaitingForDownload(false);
    }
  }, [book, loadBook, isLoading]);

  const handleCardPress = useCallback(() => {
    // Scale animation
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1.02, tension: 100, friction: 8, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 100, friction: 8, useNativeDriver: true }),
    ]).start();
    handlePlay();
  }, [handlePlay, scaleAnim]);

  const handleHeartPress = () => {
    if (isInLibrary) removeBook(book.id);
    else addBook(book.id);
  };

  // ========================================
  // Render Play Button
  // ========================================
  const renderPlayButton = () => {
    const isDownloading = downloadStatus === 'downloading';
    const isQueued = downloadStatus === 'queued';
    const isDownloaded = downloadStatus === 'completed';

    // Downloading - show progress circle with percentage
    if (isDownloading || isWaitingForDownload) {
      return (
        <TouchableOpacity 
          style={styles.playButton} 
          onPress={handlePlay} 
          activeOpacity={0.7}
          disabled={isWaitingForDownload}
        >
          <ProgressCircle 
            progress={downloadProgress} 
            size={PROGRESS_SIZE}
            color={textColor}
            bgColor={secondaryColor}
          />
        </TouchableOpacity>
      );
    }

    // Queued - show clock
    if (isQueued) {
      return (
        <TouchableOpacity style={styles.playButton} onPress={handlePlay} activeOpacity={0.7}>
          <Icon name="time-outline" size={24} color={secondaryColor} set="ionicons" />
        </TouchableOpacity>
      );
    }

    // Downloaded or not - show play (with checkmark if downloaded)
    return (
      <TouchableOpacity style={styles.playButton} onPress={handlePlay} activeOpacity={0.7}>
        <View style={styles.playIconContainer}>
          <Icon name="play" size={26} color={textColor} set="ionicons" />
          {isDownloaded && (
            <View style={[styles.downloadBadge, { backgroundColor: textColor }]}>
              <Icon name="checkmark" size={8} color={bgColor} set="ionicons" />
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable 
        style={[styles.card, { backgroundColor: bgColor, zIndex }, style]} 
        onPress={handleCardPress}
        disabled={isLoading}
      > 
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: textColor }]} numberOfLines={2}>{title}</Text>
        </View>
        
        <View style={styles.topRow}>
          <View style={styles.coverContainer}>
            <Image source={{ uri: coverUrl }} style={styles.cover} resizeMode="cover" />
          </View>

          <View style={styles.chapterInfo}>
            <Text style={[styles.chapterLabel, { color: textColor }]}>Chapter {chapterNumber}</Text>
            <Text style={[styles.timeInfo, { color: secondaryColor }]}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </Text>
          </View>

          <TouchableOpacity style={styles.heartButton} onPress={handleHeartPress} activeOpacity={0.7}>
            <Icon 
              name={isInLibrary ? 'heart' : 'heart-outline'} 
              size={22} 
              color={isInLibrary ? '#FF69B4' : secondaryColor} 
              set="ionicons" 
            />
          </TouchableOpacity>

          {renderPlayButton()}
        </View>
      </Pressable>
    </Animated.View>
  );
}

export const CARD_HEIGHT = 120;
export const CARD_OVERLAP = -5;

const styles = StyleSheet.create({
  card: {
    borderRadius: 25,
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 16,
    marginHorizontal: 5,
    height: CARD_HEIGHT,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 5,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coverContainer: {
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  chapterInfo: {
    flex: 1,
    marginLeft: 12,
  },
  chapterLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  timeInfo: {
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  playButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 22,
    letterSpacing: -0.5,
    flex: 1,
  },
  heartButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  playIconContainer: {
    position: 'relative',
  },
  downloadBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
});