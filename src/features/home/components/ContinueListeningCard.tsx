/**
 * src/features/home/components/ContinueListeningCard.tsx
 * 
 * Continue Listening card with:
 * - Background color extracted from cover
 * - Cover image as full background
 * - Play button / download % in top right
 * - Title at bottom
 * - Row below: Chapter (left) | Time (center) | Heart (right)
 * - Swipe left to hide from continue listening
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, ImageBackground, TouchableOpacity, StyleSheet, Animated, ActivityIndicator } from 'react-native';
import { Swipeable, RectButton } from 'react-native-gesture-handler';
import { getColors } from 'react-native-image-colors';
import Svg, { Circle } from 'react-native-svg';
import { LibraryItem } from '@/core/types';
import { apiClient, hideFromContinueListening } from '@/core/api';
import { usePlayerStore } from '@/features/player';
import { useMyLibraryStore } from '@/features/library/stores/myLibraryStore';
import { Icon } from '@/shared/components/Icon';
import { getTitle } from '@/shared/utils/metadata';
import { matchToPalette } from '@/shared/utils/colorPalette';
import { isColorLight, pickMostSaturated } from '@/features/player/utils';
import { autoDownloadService, DownloadStatus } from '@/features/downloads';

const DEBOUNCE_MS = 300;
const PROGRESS_SIZE = 44;
const PROGRESS_STROKE = 3;
const SWIPE_THRESHOLD = 80;

// Shared constants
const CARD_RADIUS = 5;
export const CARD_HEIGHT = 180;
export const CARD_OVERLAP = 5;
export const CARD_MARGIN_BOTTOM = 5;

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
  onRemove?: (bookId: string) => void;
  onPress?: () => void;
}

// Download status hook
function useDownloadStatus(bookId: string) {
  const [status, setStatus] = useState<DownloadStatus>(() => 
    autoDownloadService.getStatus(bookId)
  );
  const [progress, setProgress] = useState<number>(() => 
    autoDownloadService.getProgress(bookId)
  );

  useEffect(() => {
    setStatus(autoDownloadService.getStatus(bookId));
    setProgress(autoDownloadService.getProgress(bookId));
    
    const unsubProgress = autoDownloadService.onProgress((id, pct) => {
      if (id === bookId) setProgress(pct);
    });
    const unsubStatus = autoDownloadService.onStatus((id, newStatus) => {
      if (id === bookId) setStatus(newStatus);
    });
    
    return () => {
      unsubProgress();
      unsubStatus();
    };
  }, [bookId]);

  return { status, progress };
}

// Color extraction hook - matches to palette exactly like PlayerScreen
function useExtractedColor(imageUrl: string, bookId: string) {
  const [bgColor, setBgColor] = useState('#2a2a3e');
  const [textIsLight, setTextIsLight] = useState(false);
  
  useEffect(() => {
    if (!imageUrl) return;
    let mounted = true;
    
    const extractColors = async () => {
      try {
        const result = await getColors(imageUrl, { 
          fallback: '#2a2a3e', 
          cache: true, 
          key: bookId 
        });
        
        if (!mounted) return;
        
        let dominant = '#2a2a3e';
        
        if (result.platform === 'ios') {
          // iOS: prefer detail or primary for more vibrant color (same as PlayerScreen)
          dominant = result.detail || result.primary || result.secondary || '#2a2a3e';
        } else if (result.platform === 'android') {
          // Android: use pickMostSaturated like PlayerScreen
          const candidates = [
            result.vibrant,
            result.darkVibrant, 
            result.lightVibrant,
            result.muted,
            result.darkMuted,
            result.lightMuted,
            result.dominant,
          ];
          dominant = pickMostSaturated(candidates) || result.dominant || '#2a2a3e';
        }
        
        // Match to palette - same as PlayerScreen
        const paletteHex = matchToPalette(dominant);
        setBgColor(paletteHex);
        setTextIsLight(isColorLight(paletteHex));
      } catch (err) {
        console.log('[Card] Color extraction error:', err);
      }
    };
      
    extractColors();
    return () => { mounted = false; };
  }, [imageUrl, bookId]);
  
  return { bgColor, textIsLight };
}

// Progress Circle for download
function ProgressCircle({ 
  progress, 
  color = '#FFFFFF',
  size = PROGRESS_SIZE,
  strokeWidth = PROGRESS_STROKE,
  showPercent = true,
}: { 
  progress: number; 
  color?: string;
  size?: number;
  strokeWidth?: number;
  showPercent?: boolean;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  const strokeDashoffset = circumference - (clampedProgress * circumference);

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          stroke={color + '4D'} // 30% opacity
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        <Circle
          stroke={color}
          fill="none"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      {showPercent && (
        <Text style={{ color, fontSize: size > 30 ? 12 : 8, fontWeight: '700' }}>
          {Math.round(clampedProgress * 100)}
        </Text>
      )}
    </View>
  );
}

// Format time as "MM:SS" or "H:MM:SS"
function formatTime(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Get current chapter from position
function getCurrentChapter(book: LibraryItem, currentTime: number): string | null {
  const chapters = book.media?.chapters;
  if (!chapters?.length) return null;
  
  for (let i = chapters.length - 1; i >= 0; i--) {
    const chapterStart = chapters[i].start ?? 0;
    if (currentTime >= chapterStart) {
      const title = chapters[i].title;
      if (!title) return `Chapter ${i + 1}`;
      return title;
    }
  }
  
  return chapters[0]?.title || 'Chapter 1';
}

export function ContinueListeningCard({ book, style, zIndex = 1, onRemove, onPress }: ContinueListeningCardProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const lastPressRef = useRef(0);
  const swipeableRef = useRef<Swipeable>(null);
  
  const { loadBook, isLoading: playerLoading, currentBook, isPlaying } = usePlayerStore();
  const { isInLibrary, addToLibrary, removeFromLibrary } = useMyLibraryStore();
  const { status: downloadStatus, progress: downloadProgress } = useDownloadStatus(book.id);

  const isThisBookInPlayer = currentBook?.id === book.id;
  const isDownloading = downloadStatus === 'downloading' || downloadStatus === 'queued';
  const isLoading = playerLoading && isThisBookInPlayer;
  const isFavorite = isInLibrary(book.id);

  const coverUrl = apiClient.getItemCoverUrl(book.id);
  const title = getTitle(book);
  
  // Extract color from cover - same logic as PlayerScreen
  const { bgColor, textIsLight } = useExtractedColor(coverUrl, book.id);
  
  // Text colors based on background
  const textColor = textIsLight ? '#000000' : '#FFFFFF';
  const secondaryTextColor = textIsLight ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.8)';

  // Time info
  const duration = book.userMediaProgress?.duration || book.media?.duration || 0;
  const currentTime = book.userMediaProgress?.currentTime || 0;
  
  // Chapter info
  const chapter = getCurrentChapter(book, currentTime);

  // Hide from continue listening
  const handleRemove = useCallback(async () => {
    console.log('[Card] Hide button tapped for:', book.id);
    try {
      await hideFromContinueListening(book.id);
      console.log('[Card] Hidden from continue listening:', book.id);
      
      // Close swipeable
      swipeableRef.current?.close();
      
      // Notify parent to update list
      onRemove?.(book.id);
    } catch (err: any) {
      console.error('[Card] Failed to hide:', err.message);
      // Close swipeable on error
      swipeableRef.current?.close();
    }
  }, [book.id, onRemove]);

  // Render right swipe action
  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-SWIPE_THRESHOLD, 0],
      outputRange: [1, 0.8],
      extrapolate: 'clamp',
    });

    const opacity = dragX.interpolate({
      inputRange: [-SWIPE_THRESHOLD, -20, 0],
      outputRange: [1, 0.5, 0],
      extrapolate: 'clamp',
    });

    return (
      <RectButton style={styles.removeAction} onPress={handleRemove}>
        <Animated.View style={[styles.removeButton, { opacity, transform: [{ scale }] }]}>
          <Icon name="eye-off-outline" size={28} color="#FFFFFF" />
          <Text style={styles.removeText}>Hide</Text>
        </Animated.View>
      </RectButton>
    );
  };

  const isPlayingRef = useRef(false);
  
  const handlePlay = useCallback(async () => {
    const t0 = Date.now();
    console.log(`[Card] ⏱ [0ms] Tap received`);
    
    const now = Date.now();
    if (now - lastPressRef.current < DEBOUNCE_MS) {
      console.log(`[Card] ⏱ Debounced, skipping`);
      return;
    }
    lastPressRef.current = now;

    if (isPlayingRef.current) {
      console.log('[Card] Already playing, skipping');
      return;
    }
    
    if (isLoading) {
      console.log('[Card] isLoading=true, skipping');
      return;
    }

    isPlayingRef.current = true;
    console.log(`[Card] ⏱ [${Date.now() - t0}ms] Calling loadBook...`);
    
    try {
      await loadBook(book as any);
      console.log(`[Card] ⏱ [${Date.now() - t0}ms] loadBook returned`);
      
    } catch (err: any) {
      console.error('[Card] Failed:', err.message);
    } finally {
      isPlayingRef.current = false;
    }
  }, [book, loadBook, isLoading]);

  const handleCardPress = useCallback(() => {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1.02, tension: 100, friction: 8, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 100, friction: 8, useNativeDriver: true }),
    ]).start();
    onPress?.();
  }, [onPress, scaleAnim]);

  const handleHeartPress = () => {
    if (isFavorite) {
      removeFromLibrary(book.id);
    } else {
      addToLibrary(book.id);
    }
  };

  // Handle download button press
  const handleDownload = useCallback(() => {
    if (downloadStatus === 'completed' || downloadStatus === 'downloading' || downloadStatus === 'queued') {
      return;
    }
    autoDownloadService.startDownload(book as LibraryItem);
  }, [book, downloadStatus]);

  // Render download button in top left
  const renderDownloadButton = () => {
    if (downloadStatus === 'completed') {
      return (
        <View style={styles.downloadButton}>
          <Icon name="checkmark-circle" size={22} color={textColor} set="ionicons" />
        </View>
      );
    }

    if (downloadStatus === 'downloading' || downloadStatus === 'queued') {
      return (
        <View style={styles.downloadButton}>
          <ProgressCircle progress={downloadProgress} color={textColor} size={28} strokeWidth={2} />
        </View>
      );
    }

    return (
      <View style={styles.downloadButton}>
        <Icon name="download-outline" size={22} color={textColor} set="ionicons" />
      </View>
    );
  };

  // Top right button - play/pause/loading
  const renderTopRightButton = () => {
    // Show loading indicator when this book is loading
    if (isLoading) {
      return (
        <View style={styles.playButton}>
          <ActivityIndicator size="small" color={textColor} />
        </View>
      );
    }

    return (
      <View style={styles.playButton}>
        <Icon
          name={isThisBookInPlayer && isPlaying ? 'pause' : 'play'}
          size={28}
          color={textColor}
        />
      </View>
    );
  };

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }], zIndex }, style]}>
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        rightThreshold={SWIPE_THRESHOLD}
        overshootRight={false}
      >
        <TouchableOpacity
          activeOpacity={0.95}
          onPress={handleCardPress}
          disabled={isLoading}
        >
          <View style={[styles.card, { backgroundColor: bgColor }]}>
            <ImageBackground
              source={{ uri: coverUrl }}
              style={styles.imageBackground}
              imageStyle={styles.cardImage}
            >
              {/* Top left - Download button */}
              <TouchableOpacity 
                style={styles.topLeft} 
                onPress={handleDownload}
                disabled={downloadStatus === 'downloading' || downloadStatus === 'queued'}
              >
                {renderDownloadButton()}
              </TouchableOpacity>

              {/* Top right - Play / Download progress */}
              <TouchableOpacity 
                style={styles.topRight} 
                onPress={handlePlay}
                disabled={isLoading}
              >
                {renderTopRightButton()}
              </TouchableOpacity>

              {/* Bottom content */}
              <View style={styles.bottomContent}>
                {/* Title */}
                <Text style={[styles.title, { color: textColor }]} numberOfLines={2}>
                  {title}
                </Text>

                {/* Bottom row: Chapter (left) | Time (center) | Heart (right) */}
                <View style={styles.bottomRow}>
                  <Text style={[styles.chapter, { color: secondaryTextColor }]} numberOfLines={1}>
                    {chapter || 'Chapter 1'}
                  </Text>
                  
                  <Text style={[styles.timeText, { color: secondaryTextColor }]}>
                    {formatTime(currentTime)} : {formatTime(duration)}
                  </Text>

                  <TouchableOpacity 
                    style={styles.heartButton} 
                    onPress={handleHeartPress}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Icon 
                      name={isFavorite ? 'heart' : 'heart-outline'} 
                      size={22} 
                      color={isFavorite ? '#FF6B6B' : secondaryTextColor} 
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </ImageBackground>
          </View>
        </TouchableOpacity>
      </Swipeable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    height: CARD_HEIGHT,
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
    marginHorizontal: 2.5,
  },
  imageBackground: {
    flex: 1,
  },
  cardImage: {
    borderRadius: CARD_RADIUS,
    opacity: 0.3,
  },
  topRight: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  topLeft: {
    position: 'absolute',
    top: 16,
    left: 16,
  },
  playButton: {
    width: PROGRESS_SIZE,
    height: PROGRESS_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chapter: {
    fontSize: 14,
    fontWeight: '600',
  },
  timeText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 24,
    flex: 1,
  },
  heartButton: {
    padding: 4,
  },
  // Swipe to remove styles
  removeAction: {
    height: CARD_HEIGHT,
    width: 100,
    backgroundColor: '#FF6B6B',
    borderRadius: CARD_RADIUS,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButton: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  removeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});