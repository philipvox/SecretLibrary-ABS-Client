/**
 * src/features/onboarding/screens/CachePromptScreen.tsx
 *
 * First-login prompt to cache all library images for instant loading.
 * Shows book count, estimated size, and caching progress with speed/ETA.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Timer, Download, Check, X, Play } from 'lucide-react-native';
import { LibraryItem } from '@/core/types';
import { imageCacheService, estimateCacheSize } from '@/core/services/imageCacheService';
import { useLibraryCache } from '@/core/cache';
import {
  useImageCacheProgressStore,
  formatSpeed,
  formatTimeRemaining,
} from '@/core/stores/imageCacheProgressStore';
import { CandleLoading } from '@/shared/components';
import { scale } from '@/shared/theme';
import {
  useSecretLibraryColors,
  secretLibraryFonts as fonts,
} from '@/shared/theme/secretLibrary';
import { logger } from '@/shared/utils/logger';

// =============================================================================
// TYPES
// =============================================================================

type CacheState = 'prompt' | 'caching' | 'complete' | 'error';

interface CachePromptScreenProps {
  onComplete: () => void;
  libraryItems?: LibraryItem[];
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function CachePromptScreen({ onComplete, libraryItems }: CachePromptScreenProps) {
  const insets = useSafeAreaInsets();
  const colors = useSecretLibraryColors();

  const [state, setState] = useState<CacheState>('prompt');
  const [items, setItems] = useState<LibraryItem[]>(libraryItems || []);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Global progress store
  const {
    progress,
    speedBytesPerSecond,
    estimatedSecondsRemaining,
    startCaching,
    updateProgress,
    setBackground,
    complete: completeProgress,
    reset: resetProgress,
  } = useImageCacheProgressStore();

  // Progress bar animation
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Load library items if not provided
  useEffect(() => {
    if (!libraryItems || libraryItems.length === 0) {
      const cachedItems = useLibraryCache.getState().items;
      if (cachedItems.length > 0) {
        setItems(cachedItems);
      }
    }
  }, [libraryItems]);

  // Animate progress bar
  useEffect(() => {
    if (progress) {
      Animated.timing(progressAnim, {
        toValue: progress.percentComplete / 100,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [progress?.percentComplete]);

  const bookCount = items.length;
  const { formatted: sizeFormatted, audiobookEquivalent } = estimateCacheSize(bookCount);

  const handleCacheNow = useCallback(async () => {
    if (items.length === 0) {
      setErrorMessage('No library items available to cache');
      setState('error');
      return;
    }

    setState('caching');
    setErrorMessage('');
    startCaching();

    try {
      await imageCacheService.cacheAllImages(items, (p) => {
        updateProgress(p);
      });

      // Enable auto-cache for new books
      await imageCacheService.setAutoCacheEnabled(true);

      setState('complete');
      completeProgress();

      // Mark prompt as seen
      await imageCacheService.setHasSeenCachePrompt();

      // Auto-dismiss after a brief moment
      setTimeout(() => {
        onComplete();
      }, 1500);
    } catch (err) {
      logger.error('[CachePrompt] Caching failed:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Caching failed');
      setState('error');
      resetProgress();
    }
  }, [items, onComplete, startCaching, updateProgress, completeProgress, resetProgress]);

  const handleSkip = useCallback(async () => {
    // Mark prompt as seen even when skipping
    await imageCacheService.setHasSeenCachePrompt();
    resetProgress();
    onComplete();
  }, [onComplete, resetProgress]);

  const handleRunInBackground = useCallback(() => {
    // Set background mode and dismiss the screen
    setBackground(true);
    onComplete();
  }, [onComplete, setBackground]);

  const handleRetry = useCallback(() => {
    setState('prompt');
    resetProgress();
    setErrorMessage('');
  }, [resetProgress]);

  // Format bytes for display
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.isDark ? 'light-content' : 'dark-content'} />

      <View style={[styles.content, { paddingTop: insets.top + scale(60), paddingBottom: insets.bottom + scale(40) }]}>
        {/* Icon / Loading Animation */}
        {state === 'caching' ? (
          <View style={styles.skullContainer}>
            <CandleLoading size={scale(60)} />
          </View>
        ) : (
          <View style={[styles.iconContainer, { backgroundColor: colors.backgroundSecondary }]}>
            {state === 'complete' ? (
              <Check size={scale(32)} color={colors.gold} strokeWidth={2} />
            ) : state === 'error' ? (
              <X size={scale(32)} color={colors.coral} strokeWidth={2} />
            ) : (
              <Timer size={scale(32)} color={colors.text} strokeWidth={1.5} />
            )}
          </View>
        )}

        {/* Title */}
        <Text style={[styles.title, { color: colors.text }]}>
          {state === 'caching'
            ? 'Caching Library...'
            : state === 'complete'
            ? 'Cache Complete'
            : state === 'error'
            ? 'Caching Failed'
            : 'Cache Library Images?'}
        </Text>

        {/* Description */}
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          {state === 'caching'
            ? `Downloading ${progress?.phase === 'covers' ? 'covers' : 'spines'}...`
            : state === 'complete'
            ? 'Your library will load instantly now.'
            : state === 'error'
            ? errorMessage || 'Something went wrong. You can try again or skip for now.'
            : 'Download all book covers and spines for instant loading.'}
        </Text>

        {/* Stats for prompt state */}
        {state === 'prompt' && bookCount > 0 && (
          <View style={styles.statsContainer}>
            <View style={[styles.statItem, { borderRightWidth: 1, borderRightColor: colors.border }]}>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {bookCount.toLocaleString()}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>BOOKS</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text }]}>{sizeFormatted}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{audiobookEquivalent}</Text>
            </View>
          </View>
        )}

        {/* Progress */}
        {state === 'caching' && progress && (
          <View style={styles.progressContainer}>
            {/* Progress bar */}
            <View style={[styles.progressBarBg, { backgroundColor: colors.backgroundSecondary }]}>
              <Animated.View
                style={[
                  styles.progressBarFill,
                  {
                    backgroundColor: colors.gold,
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>

            {/* Progress percentage */}
            <Text style={[styles.percentText, { color: colors.gold }]}>
              {progress.percentComplete}%
            </Text>

            {/* Speed and time remaining */}
            <View style={styles.speedTimeRow}>
              <View style={styles.speedTimeItem}>
                <Text style={[styles.speedTimeValue, { color: colors.text }]}>
                  {formatSpeed(speedBytesPerSecond)}
                </Text>
                <Text style={[styles.speedTimeLabel, { color: colors.textSecondary }]}>SPEED</Text>
              </View>
              <View style={[styles.speedTimeDivider, { backgroundColor: colors.border }]} />
              <View style={styles.speedTimeItem}>
                <Text style={[styles.speedTimeValue, { color: colors.text }]}>
                  {formatTimeRemaining(estimatedSecondsRemaining)}
                </Text>
                <Text style={[styles.speedTimeLabel, { color: colors.textSecondary }]}>REMAINING</Text>
              </View>
              <View style={[styles.speedTimeDivider, { backgroundColor: colors.border }]} />
              <View style={styles.speedTimeItem}>
                <Text style={[styles.speedTimeValue, { color: colors.text }]}>
                  {formatBytes(progress.bytesDownloaded)}
                </Text>
                <Text style={[styles.speedTimeLabel, { color: colors.textSecondary }]}>DOWNLOADED</Text>
              </View>
            </View>

            {/* Item count */}
            <Text style={[styles.itemCountText, { color: colors.textSecondary }]}>
              {progress.current.toLocaleString()} / {progress.total.toLocaleString()} images
            </Text>
          </View>
        )}

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          {state === 'prompt' && (
            <>
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: colors.text }]}
                onPress={handleCacheNow}
                activeOpacity={0.8}
              >
                <Download size={scale(18)} color={colors.background} strokeWidth={2} />
                <Text style={[styles.primaryButtonText, { color: colors.background }]}>
                  Cache Now
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: colors.border }]}
                onPress={handleSkip}
                activeOpacity={0.7}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                  Skip for Now
                </Text>
              </TouchableOpacity>
            </>
          )}

          {state === 'caching' && (
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: colors.border }]}
              onPress={handleRunInBackground}
              activeOpacity={0.7}
            >
              <Play size={scale(16)} color={colors.text} strokeWidth={2} />
              <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                Run in Background
              </Text>
            </TouchableOpacity>
          )}

          {state === 'complete' && (
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.gold }]}
              onPress={onComplete}
              activeOpacity={0.8}
            >
              <Text style={[styles.primaryButtonText, { color: colors.background }]}>
                Continue
              </Text>
            </TouchableOpacity>
          )}

          {state === 'error' && (
            <>
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: colors.text }]}
                onPress={handleRetry}
                activeOpacity={0.8}
              >
                <Text style={[styles.primaryButtonText, { color: colors.background }]}>
                  Try Again
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryButton, { borderColor: colors.border }]}
                onPress={handleSkip}
                activeOpacity={0.7}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                  Skip for Now
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Footer note */}
        {state === 'prompt' && (
          <Text style={[styles.footerNote, { color: colors.textMuted }]}>
            You can always cache later in Settings &gt; Storage
          </Text>
        )}
      </View>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(32),
  },
  iconContainer: {
    width: scale(80),
    height: scale(80),
    borderRadius: scale(40),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: scale(24),
  },
  skullContainer: {
    width: scale(80),
    height: scale(80),
    borderRadius: scale(40),
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: scale(24),
    overflow: 'hidden',
  },
  title: {
    fontFamily: fonts.playfair.regular,
    fontSize: scale(28),
    textAlign: 'center',
    marginBottom: scale(12),
  },
  description: {
    fontFamily: fonts.inter.regular,
    fontSize: scale(15),
    textAlign: 'center',
    lineHeight: scale(22),
    marginBottom: scale(32),
    paddingHorizontal: scale(8),
  },
  statsContainer: {
    flexDirection: 'row',
    marginBottom: scale(40),
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: scale(32),
  },
  statValue: {
    fontFamily: fonts.playfair.regular,
    fontSize: scale(32),
    marginBottom: scale(4),
  },
  statValueSmall: {
    fontFamily: fonts.playfair.regular,
    fontSize: scale(18),
    marginTop: scale(4),
  },
  statLabel: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(10),
    letterSpacing: 1,
  },
  progressContainer: {
    width: '100%',
    marginBottom: scale(32),
    alignItems: 'center',
  },
  progressBarBg: {
    width: '100%',
    height: scale(8),
    borderRadius: scale(4),
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: scale(4),
  },
  percentText: {
    fontFamily: fonts.playfair.regular,
    fontSize: scale(48),
    marginTop: scale(16),
    marginBottom: scale(8),
  },
  speedTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: scale(16),
    marginBottom: scale(12),
  },
  speedTimeItem: {
    alignItems: 'center',
    paddingHorizontal: scale(16),
  },
  speedTimeValue: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(14),
    marginBottom: scale(4),
  },
  speedTimeLabel: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(9),
    letterSpacing: 0.5,
  },
  speedTimeDivider: {
    width: 1,
    height: scale(24),
  },
  itemCountText: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(11),
  },
  buttonContainer: {
    width: '100%',
    gap: scale(12),
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(16),
    borderRadius: scale(8),
    gap: scale(8),
  },
  primaryButtonText: {
    fontFamily: fonts.inter.medium,
    fontSize: scale(15),
    fontWeight: '500',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(16),
    borderRadius: scale(8),
    borderWidth: 1,
    gap: scale(8),
  },
  secondaryButtonText: {
    fontFamily: fonts.inter.regular,
    fontSize: scale(15),
  },
  footerNote: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(11),
    textAlign: 'center',
    marginTop: scale(24),
  },
});

export default CachePromptScreen;
