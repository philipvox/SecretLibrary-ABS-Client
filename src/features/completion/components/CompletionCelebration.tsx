/**
 * src/features/completion/components/CompletionCelebration.tsx
 *
 * Celebration modals for book and series completion based on UX research.
 * Features:
 * - Book completion modal with series progress
 * - Series completion celebration with trophy
 * - Milestone celebrations (25%, 50%, 75%)
 * - Gamification elements
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCoverUrl } from '@/core/cache';
import { LibraryItem } from '@/core/types';
import { colors, scale, wp, hp } from '@/shared/theme';

const SCREEN_WIDTH = wp(100);
const SCREEN_HEIGHT = hp(100);

const ACCENT = colors.accent;

type CelebrationType = 'book_complete' | 'series_complete' | 'milestone';

interface CompletionCelebrationProps {
  visible: boolean;
  type: CelebrationType;
  // For book completion
  completedBook?: LibraryItem | null;
  nextBook?: LibraryItem | null;
  seriesName?: string;
  booksInSeries?: number;
  booksCompleted?: number;
  // For series completion
  totalListeningTime?: number;
  daysToComplete?: number;
  // For milestone
  milestonePercent?: number;
  // Callbacks
  onStartNext?: () => void;
  onTakeBreak?: () => void;
  onShare?: () => void;
  onFindSimilar?: () => void;
  onDismiss: () => void;
}

// Progress dot component
function ProgressDot({ filled }: { filled: boolean }) {
  return (
    <View
      style={[
        styles.progressDot,
        filled && styles.progressDotFilled,
      ]}
    />
  );
}

// Format listening time
function formatListeningTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  if (hours > 0) {
    return `${hours} hours`;
  }
  const minutes = Math.floor(seconds / 60);
  return `${minutes} minutes`;
}

export function CompletionCelebration({
  visible,
  type,
  completedBook,
  nextBook,
  seriesName,
  booksInSeries = 0,
  booksCompleted = 0,
  totalListeningTime = 0,
  daysToComplete,
  milestonePercent,
  onStartNext,
  onTakeBreak,
  onShare,
  onFindSimilar,
  onDismiss,
}: CompletionCelebrationProps) {
  const [scaleAnim] = useState(new Animated.Value(0.8));
  const [opacityAnim] = useState(new Animated.Value(0));

  const completedCoverUrl = useCoverUrl(completedBook?.id || '');
  const nextCoverUrl = useCoverUrl(nextBook?.id || '');

  useEffect(() => {
    if (visible) {
      // Trigger haptic
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Animate in
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.8);
      opacityAnim.setValue(0);
    }
  }, [visible, scaleAnim, opacityAnim]);

  const handleDismiss = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDismiss();
  }, [onDismiss]);

  const handleStartNext = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onStartNext?.();
    onDismiss();
  }, [onStartNext, onDismiss]);

  const handleTakeBreak = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onTakeBreak?.();
    onDismiss();
  }, [onTakeBreak, onDismiss]);

  const handleShare = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onShare?.();
  }, [onShare]);

  const handleFindSimilar = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onFindSimilar?.();
    onDismiss();
  }, [onFindSimilar, onDismiss]);

  const progressPercent = booksInSeries > 0
    ? Math.round((booksCompleted / booksInSeries) * 100)
    : 0;

  const bookTitle = (completedBook?.media?.metadata as any)?.title || 'Unknown';
  const nextBookTitle = (nextBook?.media?.metadata as any)?.title || 'Next Book';
  const nextBookDuration = (nextBook?.media as any)?.duration || 0;

  const renderBookCompletion = () => (
    <View style={styles.content}>
      {/* Celebration icon */}
      <View style={styles.celebrationIcon}>
        <Text style={styles.celebrationEmoji}>🎉</Text>
      </View>

      {/* Title */}
      <Text style={styles.title}>Book Complete!</Text>

      {/* Progress info */}
      {seriesName && booksInSeries > 1 && (
        <View style={styles.progressSection}>
          <Text style={styles.progressLabel}>
            You've finished {progressPercent}% of the series
          </Text>
          <View style={styles.progressDots}>
            {Array.from({ length: booksInSeries }).map((_, i) => (
              <ProgressDot key={i} filled={i < booksCompleted} />
            ))}
          </View>
          <Text style={styles.progressCount}>
            {booksCompleted} of {booksInSeries} books
          </Text>
        </View>
      )}

      {/* Next book preview */}
      {nextBook && (
        <View style={styles.nextBookSection}>
          <Image
            source={nextCoverUrl}
            style={styles.nextBookCover}
            contentFit="cover"
          />
          <View style={styles.nextBookInfo}>
            <Text style={styles.nextBookLabel}>Up Next</Text>
            <Text style={styles.nextBookTitle} numberOfLines={2}>
              {nextBookTitle}
            </Text>
            <Text style={styles.nextBookDuration}>
              {formatListeningTime(nextBookDuration)}
            </Text>
          </View>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        {nextBook && (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleStartNext}
            activeOpacity={0.8}
          >
            <Ionicons name="play" size={scale(18)} color="#000" />
            <Text style={styles.primaryButtonText}>Start Next Book</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleTakeBreak}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryButtonText}>Take a Break</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSeriesCompletion = () => (
    <View style={styles.content}>
      {/* Trophy icon */}
      <View style={styles.trophyIcon}>
        <Ionicons name="trophy" size={scale(48)} color={ACCENT} />
      </View>

      {/* Title */}
      <Text style={styles.titleLarge}>Series Complete!</Text>

      {/* Series name */}
      {seriesName && (
        <Text style={styles.seriesName}>{seriesName}</Text>
      )}

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{booksInSeries}</Text>
          <Text style={styles.statLabel}>Books</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{formatListeningTime(totalListeningTime)}</Text>
          <Text style={styles.statLabel}>Listened</Text>
        </View>
        {daysToComplete && (
          <>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{daysToComplete}</Text>
              <Text style={styles.statLabel}>Days</Text>
            </View>
          </>
        )}
      </View>

      {/* All completed dots */}
      <View style={styles.completedDots}>
        {Array.from({ length: booksInSeries }).map((_, i) => (
          <View key={i} style={styles.completedDot} />
        ))}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.shareButton}
          onPress={handleShare}
          activeOpacity={0.8}
        >
          <Ionicons name="share-outline" size={scale(18)} color={ACCENT} />
          <Text style={styles.shareButtonText}>Share Achievement</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleFindSimilar}
          activeOpacity={0.8}
        >
          <Ionicons name="compass-outline" size={scale(18)} color="#000" />
          <Text style={styles.primaryButtonText}>Find Next Series</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderMilestone = () => (
    <View style={styles.content}>
      {/* Milestone icon */}
      <View style={styles.milestoneIcon}>
        <Text style={styles.milestoneEmoji}>
          {milestonePercent === 25 ? '🚀' : milestonePercent === 50 ? '🎯' : '⭐'}
        </Text>
      </View>

      {/* Title */}
      <Text style={styles.milestoneTitle}>
        {milestonePercent === 50 ? 'Halfway There!' : `${milestonePercent}% Complete!`}
      </Text>

      {/* Series info */}
      {seriesName && (
        <Text style={styles.milestoneSubtitle}>{seriesName}</Text>
      )}

      {/* Progress bar */}
      <View style={styles.milestoneProgress}>
        <View style={styles.milestoneProgressTrack}>
          <View style={[styles.milestoneProgressFill, { width: `${milestonePercent || 0}%` }]} />
        </View>
        <Text style={styles.milestoneProgressText}>{milestonePercent || 0}%</Text>
      </View>

      {/* Dismiss */}
      <TouchableOpacity
        style={styles.dismissButton}
        onPress={handleDismiss}
        activeOpacity={0.8}
      >
        <Text style={styles.dismissButtonText}>Keep Going!</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleDismiss}
    >
      <BlurView intensity={30} style={styles.backdrop} tint="dark">
        <TouchableOpacity
          style={styles.backdropTouch}
          onPress={handleDismiss}
          activeOpacity={1}
        >
          <Animated.View
            style={[
              styles.modal,
              {
                transform: [{ scale: scaleAnim }],
                opacity: opacityAnim,
              },
            ]}
          >
            <TouchableOpacity activeOpacity={1}>
              {/* Close button */}
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleDismiss}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={scale(24)} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>

              {type === 'book_complete' && renderBookCompletion()}
              {type === 'series_complete' && renderSeriesCompletion()}
              {type === 'milestone' && renderMilestone()}
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdropTouch: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: SCREEN_WIDTH * 0.88,
    maxWidth: 400,
    backgroundColor: 'rgba(30,30,30,0.98)',
    borderRadius: scale(20),
    padding: scale(24),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  closeButton: {
    position: 'absolute',
    top: scale(-8),
    right: scale(-8),
    zIndex: 10,
  },
  content: {
    alignItems: 'center',
  },

  // Celebration icons
  celebrationIcon: {
    width: scale(72),
    height: scale(72),
    borderRadius: scale(36),
    backgroundColor: 'rgba(244,182,12,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: scale(16),
  },
  celebrationEmoji: {
    fontSize: scale(36),
  },
  trophyIcon: {
    width: scale(88),
    height: scale(88),
    borderRadius: scale(44),
    backgroundColor: 'rgba(244,182,12,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: scale(16),
  },
  milestoneIcon: {
    width: scale(64),
    height: scale(64),
    borderRadius: scale(32),
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: scale(12),
  },
  milestoneEmoji: {
    fontSize: scale(32),
  },

  // Titles
  title: {
    fontSize: scale(22),
    fontWeight: '700',
    color: '#fff',
    marginBottom: scale(16),
    textAlign: 'center',
  },
  titleLarge: {
    fontSize: scale(26),
    fontWeight: '700',
    color: '#fff',
    marginBottom: scale(4),
    textAlign: 'center',
  },
  seriesName: {
    fontSize: scale(15),
    color: 'rgba(255,255,255,0.6)',
    marginBottom: scale(20),
    textAlign: 'center',
  },
  milestoneTitle: {
    fontSize: scale(20),
    fontWeight: '700',
    color: ACCENT,
    marginBottom: scale(4),
    textAlign: 'center',
  },
  milestoneSubtitle: {
    fontSize: scale(14),
    color: 'rgba(255,255,255,0.5)',
    marginBottom: scale(16),
    textAlign: 'center',
  },

  // Progress section
  progressSection: {
    alignItems: 'center',
    marginBottom: scale(20),
  },
  progressLabel: {
    fontSize: scale(14),
    color: 'rgba(255,255,255,0.7)',
    marginBottom: scale(10),
  },
  progressDots: {
    flexDirection: 'row',
    gap: scale(6),
    marginBottom: scale(8),
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  progressDot: {
    width: scale(10),
    height: scale(10),
    borderRadius: scale(5),
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  progressDotFilled: {
    backgroundColor: ACCENT,
  },
  progressCount: {
    fontSize: scale(12),
    color: 'rgba(255,255,255,0.5)',
  },

  // Next book section
  nextBookSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: scale(12),
    borderRadius: scale(12),
    marginBottom: scale(20),
    width: '100%',
  },
  nextBookCover: {
    width: scale(56),
    height: scale(56),
    borderRadius: scale(8),
    backgroundColor: '#262626',
  },
  nextBookInfo: {
    flex: 1,
    marginLeft: scale(12),
  },
  nextBookLabel: {
    fontSize: scale(10),
    fontWeight: '600',
    color: ACCENT,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: scale(2),
  },
  nextBookTitle: {
    fontSize: scale(14),
    fontWeight: '600',
    color: '#fff',
    marginBottom: scale(2),
  },
  nextBookDuration: {
    fontSize: scale(12),
    color: 'rgba(255,255,255,0.5)',
  },

  // Stats row (series completion)
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: scale(16),
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: scale(16),
  },
  statValue: {
    fontSize: scale(18),
    fontWeight: '700',
    color: '#fff',
    marginBottom: scale(2),
  },
  statLabel: {
    fontSize: scale(11),
    color: 'rgba(255,255,255,0.5)',
  },
  statDivider: {
    width: 1,
    height: scale(30),
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  completedDots: {
    flexDirection: 'row',
    gap: scale(6),
    marginBottom: scale(24),
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  completedDot: {
    width: scale(8),
    height: scale(8),
    borderRadius: scale(4),
    backgroundColor: ACCENT,
  },

  // Milestone progress
  milestoneProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    width: '100%',
    marginBottom: scale(20),
  },
  milestoneProgressTrack: {
    flex: 1,
    height: scale(8),
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: scale(4),
    overflow: 'hidden',
  },
  milestoneProgressFill: {
    height: '100%',
    backgroundColor: ACCENT,
    borderRadius: scale(4),
  },
  milestoneProgressText: {
    fontSize: scale(14),
    fontWeight: '600',
    color: ACCENT,
  },

  // Actions
  actions: {
    width: '100%',
    gap: scale(10),
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    backgroundColor: ACCENT,
    paddingVertical: scale(14),
    borderRadius: scale(12),
  },
  primaryButtonText: {
    fontSize: scale(15),
    fontWeight: '600',
    color: '#000',
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(12),
  },
  secondaryButtonText: {
    fontSize: scale(14),
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    borderWidth: 1.5,
    borderColor: ACCENT,
    paddingVertical: scale(12),
    borderRadius: scale(12),
  },
  shareButtonText: {
    fontSize: scale(14),
    fontWeight: '600',
    color: ACCENT,
  },
  dismissButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT,
    paddingVertical: scale(12),
    paddingHorizontal: scale(24),
    borderRadius: scale(10),
  },
  dismissButtonText: {
    fontSize: scale(14),
    fontWeight: '600',
    color: '#000',
  },
});
