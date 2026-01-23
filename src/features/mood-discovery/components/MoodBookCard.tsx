/**
 * src/features/mood-discovery/components/MoodBookCard.tsx
 *
 * Book card with match percentage badge for mood discovery results.
 * Shows match attribution tags for why the book matched.
 * Tier 1.3: Long-press shows tooltip explaining the match.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useCoverUrl } from '@/core/cache';
import type { LibraryItem } from '@/core/types';
import { ScoredBook } from '../types';
import { Icon } from '@/shared/components/Icon';
import { spacing, radius, formatDuration, useTheme, accentColors, type ThemeColors } from '@/shared/theme';
import { secretLibraryColors } from '@/shared/theme/secretLibrary';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface MoodBookCardProps {
  /** Library item to display */
  item: LibraryItem;
  /** Score data for this book */
  scoreData?: ScoredBook;
  /** Callback when card is pressed */
  onPress: () => void;
  /** Card width */
  width?: number;
}

/**
 * Get match quality label and color
 */
function getMatchQuality(percent: number, colors: ThemeColors): { label: string; color: string } {
  if (percent >= 80) return { label: 'Great Match', color: colors.semantic.success };
  if (percent >= 60) return { label: 'Good Match', color: secretLibraryColors.gold };
  if (percent >= 40) return { label: 'Partial', color: colors.semantic.warning };
  return { label: '', color: colors.text.tertiary };
}

/**
 * Check if we should show low confidence badge (Tier 2.3)
 */
function shouldShowLowConfidenceBadge(scoreData: ScoredBook | undefined): boolean {
  if (!scoreData) return false;
  // Show badge for low confidence matches with decent match percent
  return scoreData.confidence === 'low' && scoreData.matchPercent >= 40;
}

/**
 * Get matched dimensions from score breakdown
 */
function getMatchedDimensions(scoreData: ScoredBook): { icon: string; label: string; detail: string }[] {
  const matches: { icon: string; label: string; detail: string }[] = [];
  const score = scoreData.score;

  if (score.moodScore > 0) {
    matches.push({
      icon: 'Heart',
      label: 'Mood',
      detail: score.isPrimaryMoodMatch ? 'Primary mood match via genre' : 'Secondary mood match via themes',
    });
  }
  if (score.paceScore > 0) {
    matches.push({
      icon: 'Flame',
      label: 'Pace',
      detail: 'Pacing matches your preference',
    });
  }
  if (score.weightScore > 0) {
    matches.push({
      icon: 'Sun',
      label: 'Tone',
      detail: 'Emotional weight matches your preference',
    });
  }
  if (score.worldScore > 0) {
    matches.push({
      icon: 'Globe',
      label: 'World',
      detail: 'Setting/genre matches your preference',
    });
  }
  if (score.lengthScore > 0) {
    matches.push({
      icon: 'Timer',
      label: 'Length',
      detail: 'Duration fits your preference',
    });
  }
  if (score.themeScore > 0) {
    matches.push({
      icon: 'Tag',
      label: 'Themes',
      detail: 'Themes and tropes match your mood',
    });
  }

  return matches;
}

/**
 * Get explanation text for the match (Tier 1.3, updated for Tier 2.3)
 */
function getMatchExplanation(scoreData: ScoredBook, matchedDimensions: ReturnType<typeof getMatchedDimensions>): string {
  if (matchedDimensions.length === 0) {
    return 'Limited match - missing genre/tag data';
  }

  const percent = scoreData.matchPercent;
  let explanation = '';

  if (percent >= 80) {
    explanation = 'Excellent match! This book aligns with your mood across multiple dimensions.';
  } else if (percent >= 60) {
    explanation = 'Good match. This book fits most of your preferences.';
  } else if (percent >= 40) {
    explanation = 'Partial match. Some elements align with your mood.';
  } else {
    explanation = 'Light match based on available metadata.';
  }

  // Add confidence note for low-confidence matches (Tier 2.3)
  if (scoreData.confidence === 'low') {
    explanation += ' Note: This book has limited metadata, so the match may not be accurate.';
  }

  return explanation;
}

export function MoodBookCard({
  item,
  scoreData,
  onPress,
  width = 140,
}: MoodBookCardProps) {
  const { colors } = useTheme();
  const [showTooltip, setShowTooltip] = useState(false);
  const metadata = (item.media?.metadata as any) || {};
  const title = metadata.title || 'Unknown Title';
  const author = metadata.authorName || 'Unknown Author';
  const duration = (item.media as any)?.duration || 0;
  const coverUrl = useCoverUrl(item.id);

  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 200 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  // Tier 1.3: Long-press to show match explanation tooltip
  const handleLongPress = useCallback(() => {
    if (scoreData) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setShowTooltip(true);
    }
  }, [scoreData]);

  const handleCloseTooltip = useCallback(() => {
    setShowTooltip(false);
  }, []);

  const matchQuality = scoreData
    ? getMatchQuality(scoreData.matchPercent, colors)
    : null;

  const matchedDimensions = scoreData ? getMatchedDimensions(scoreData) : [];
  const matchExplanation = scoreData ? getMatchExplanation(scoreData, matchedDimensions) : '';

  return (
    <>
      <AnimatedPressable
        onPress={handlePress}
        onLongPress={handleLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        delayLongPress={400}
        style={[styles.container, { width }, animatedStyle]}
      >
        {/* Cover */}
        <View style={[styles.coverContainer, { width, height: width, backgroundColor: colors.background.tertiary }]}>
          <Image
            source={{ uri: coverUrl }}
            style={styles.cover}
            contentFit="cover"
            transition={200}
          />
          {/* Match badge */}
          {scoreData && scoreData.matchPercent >= 40 && (
            <View
              style={[
                styles.matchBadge,
                { backgroundColor: matchQuality?.color || secretLibraryColors.gold },
              ]}
            >
              <Text style={[styles.matchPercent, { color: colors.text.inverse }]}>{scoreData.matchPercent}%</Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text style={[styles.title, { color: colors.text.primary }]} numberOfLines={2}>
            {title}
          </Text>
          <Text style={[styles.author, { color: colors.text.secondary }]} numberOfLines={1}>
            {author}
          </Text>
          <Text style={[styles.duration, { color: colors.text.tertiary }]}>
            {formatDuration.short(duration)}
          </Text>
          {/* Low confidence badge (Tier 2.3) */}
          {shouldShowLowConfidenceBadge(scoreData) && (
            <View style={[styles.lowConfidenceBadge, { backgroundColor: colors.background.tertiary }]}>
              <Icon name="AlertCircle" size={10} color={colors.text.tertiary} />
              <Text style={[styles.lowConfidenceText, { color: colors.text.tertiary }]}>
                Limited info
              </Text>
            </View>
          )}
          {/* Match attribution icons */}
          {matchedDimensions.length > 0 && (
            <View style={styles.matchTags}>
              {matchedDimensions.slice(0, 3).map((dim, i) => (
                <View key={dim.label} style={[styles.matchTag, { backgroundColor: colors.background.tertiary }]}>
                  <Icon
                    name={dim.icon}
                    size={10}
                    color={colors.text.tertiary}
                  />
                </View>
              ))}
              {matchedDimensions.length > 3 && (
                <Text style={[styles.moreMatches, { color: colors.text.tertiary }]}>
                  +{matchedDimensions.length - 3}
                </Text>
              )}
            </View>
          )}
        </View>
      </AnimatedPressable>

      {/* Match Explanation Tooltip (Tier 1.3) */}
      <Modal
        visible={showTooltip}
        transparent
        animationType="fade"
        onRequestClose={handleCloseTooltip}
      >
        <TouchableOpacity
          style={styles.tooltipOverlay}
          activeOpacity={1}
          onPress={handleCloseTooltip}
        >
          <View style={[styles.tooltipContainer, { backgroundColor: colors.background.secondary }]}>
            {/* Header */}
            <View style={styles.tooltipHeader}>
              <Text style={[styles.tooltipTitle, { color: colors.text.primary }]}>
                Why this matches
              </Text>
              {scoreData && (
                <View style={[styles.tooltipBadge, { backgroundColor: matchQuality?.color || secretLibraryColors.gold }]}>
                  <Text style={[styles.tooltipPercent, { color: colors.text.inverse }]}>
                    {scoreData.matchPercent}%
                  </Text>
                </View>
              )}
            </View>

            {/* Explanation */}
            <Text style={[styles.tooltipExplanation, { color: colors.text.secondary }]}>
              {matchExplanation}
            </Text>

            {/* Dimension breakdown */}
            {matchedDimensions.length > 0 && (
              <View style={styles.tooltipDimensions}>
                {matchedDimensions.map((dim) => (
                  <View key={dim.label} style={styles.tooltipDimensionRow}>
                    <View style={[styles.tooltipDimensionIcon, { backgroundColor: colors.background.tertiary }]}>
                      <Icon name={dim.icon} size={12} color={secretLibraryColors.gold} />
                    </View>
                    <View style={styles.tooltipDimensionText}>
                      <Text style={[styles.tooltipDimensionLabel, { color: colors.text.primary }]}>
                        {dim.label}
                      </Text>
                      <Text style={[styles.tooltipDimensionDetail, { color: colors.text.tertiary }]}>
                        {dim.detail}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Hint */}
            <Text style={[styles.tooltipHint, { color: colors.text.tertiary }]}>
              Tap anywhere to close
            </Text>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    marginRight: spacing.sm,
  },
  coverContainer: {
    borderRadius: radius.md,
    overflow: 'hidden',
    // backgroundColor set via themeColors in JSX
    marginBottom: spacing.xs,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  matchBadge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
  },
  matchPercent: {
    fontSize: 11,
    fontWeight: '700',
    // color set via themeColors in JSX (text.inverse for contrast on accent backgrounds)
  },
  info: {
    paddingHorizontal: 2,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    // color set via themeColors in JSX
    lineHeight: 17,
    marginBottom: 2,
  },
  author: {
    fontSize: 12,
    // color set via themeColors in JSX
    marginBottom: 2,
  },
  duration: {
    fontSize: 11,
    // color set via themeColors in JSX
  },
  matchTags: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xxs,
    gap: 4,
  },
  matchTag: {
    width: 16,
    height: 16,
    borderRadius: 8,
    // backgroundColor set via themeColors in JSX
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreMatches: {
    fontSize: 9,
    // color set via themeColors in JSX
    fontWeight: '500',
  },
  // Low confidence badge styles (Tier 2.3)
  lowConfidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: spacing.xxs,
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  lowConfidenceText: {
    fontSize: 9,
    // color set via themeColors in JSX
  },
  // Tooltip styles (Tier 1.3)
  tooltipOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  tooltipContainer: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    maxWidth: 320,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  tooltipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  tooltipTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  tooltipBadge: {
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  tooltipPercent: {
    fontSize: 14,
    fontWeight: '700',
  },
  tooltipExplanation: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  tooltipDimensions: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tooltipDimensionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tooltipDimensionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tooltipDimensionText: {
    flex: 1,
  },
  tooltipDimensionLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  tooltipDimensionDetail: {
    fontSize: 11,
  },
  tooltipHint: {
    fontSize: 11,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
