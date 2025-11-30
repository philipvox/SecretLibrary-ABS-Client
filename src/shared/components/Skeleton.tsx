/**
 * src/shared/components/Skeleton.tsx
 *
 * Skeleton loading components with shimmer animation.
 * Uses react-native-reanimated for smooth 60fps animations.
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';

// ============================================================================
// SHIMMER ANIMATION
// ============================================================================

interface ShimmerProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Shimmer({ width, height, borderRadius = 4, style }: ShimmerProps) {
  const translateX = useSharedValue(-1);

  useEffect(() => {
    translateX.value = withRepeat(
      withTiming(1, {
        duration: 1200,
        easing: Easing.linear,
      }),
      -1, // Infinite repeat
      false // Don't reverse
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    const translateXValue = interpolate(
      translateX.value,
      [-1, 1],
      [-200, 200]
    );
    return {
      transform: [{ translateX: translateXValue }],
    };
  });

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: theme.colors.neutral[200],
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
        <LinearGradient
          colors={[
            'transparent',
            'rgba(255, 255, 255, 0.3)',
            'transparent',
          ]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ flex: 1, width: 200 }}
        />
      </Animated.View>
    </View>
  );
}

// ============================================================================
// SKELETON COMPONENTS
// ============================================================================

/**
 * Skeleton for a book card in the library grid
 */
export function BookCardSkeleton() {
  return (
    <View style={skeletonStyles.bookCard}>
      <Shimmer width="100%" height={150} borderRadius={theme.radius.medium} />
      <View style={skeletonStyles.bookCardContent}>
        <Shimmer width="90%" height={14} style={{ marginTop: 8 }} />
        <Shimmer width="60%" height={12} style={{ marginTop: 4 }} />
      </View>
    </View>
  );
}

/**
 * Skeleton for a series/author card
 */
export function SquareCardSkeleton() {
  return (
    <View style={skeletonStyles.squareCard}>
      <Shimmer width="100%" height={120} borderRadius={theme.radius.large} />
      <Shimmer width="80%" height={14} style={{ marginTop: 8 }} />
      <Shimmer width="50%" height={12} style={{ marginTop: 4 }} />
    </View>
  );
}

/**
 * Skeleton for a horizontal list item
 */
export function ListItemSkeleton() {
  return (
    <View style={skeletonStyles.listItem}>
      <Shimmer width={60} height={60} borderRadius={theme.radius.medium} />
      <View style={skeletonStyles.listItemContent}>
        <Shimmer width="70%" height={16} />
        <Shimmer width="50%" height={14} style={{ marginTop: 6 }} />
      </View>
    </View>
  );
}

/**
 * Skeleton for the player screen header
 */
export function PlayerHeaderSkeleton() {
  return (
    <View style={skeletonStyles.playerHeader}>
      <Shimmer width={280} height={280} borderRadius={theme.radius.large} />
      <Shimmer width="80%" height={24} style={{ marginTop: 20 }} />
      <Shimmer width="50%" height={18} style={{ marginTop: 8 }} />
    </View>
  );
}

/**
 * Skeleton for the book detail header
 */
export function BookDetailSkeleton() {
  return (
    <View style={skeletonStyles.bookDetail}>
      <View style={skeletonStyles.bookDetailHeader}>
        <Shimmer width={140} height={210} borderRadius={theme.radius.medium} />
        <View style={skeletonStyles.bookDetailInfo}>
          <Shimmer width="100%" height={22} />
          <Shimmer width="70%" height={18} style={{ marginTop: 8 }} />
          <Shimmer width="50%" height={16} style={{ marginTop: 12 }} />
          <Shimmer width="40%" height={14} style={{ marginTop: 8 }} />
        </View>
      </View>
      <View style={skeletonStyles.bookDetailActions}>
        <Shimmer width="48%" height={48} borderRadius={theme.radius.full} />
        <Shimmer width="48%" height={48} borderRadius={theme.radius.full} />
      </View>
      <Shimmer width="100%" height={100} style={{ marginTop: 20 }} borderRadius={theme.radius.medium} />
    </View>
  );
}

// ============================================================================
// SKELETON GRIDS
// ============================================================================

interface SkeletonGridProps {
  count?: number;
  columns?: number;
}

/**
 * Grid of book card skeletons
 */
export function BookGridSkeleton({ count = 9, columns = 3 }: SkeletonGridProps) {
  return (
    <View style={[skeletonStyles.grid, { flexWrap: 'wrap' }]}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ width: `${100 / columns}%`, padding: 4 }}>
          <BookCardSkeleton />
        </View>
      ))}
    </View>
  );
}

/**
 * Grid of square card skeletons (for series/authors)
 */
export function SquareGridSkeleton({ count = 6, columns = 2 }: SkeletonGridProps) {
  return (
    <View style={[skeletonStyles.grid, { flexWrap: 'wrap' }]}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ width: `${100 / columns}%`, padding: 4 }}>
          <SquareCardSkeleton />
        </View>
      ))}
    </View>
  );
}

/**
 * List of item skeletons
 */
export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <ListItemSkeleton key={i} />
      ))}
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const skeletonStyles = StyleSheet.create({
  bookCard: {
    flex: 1,
  },
  bookCardContent: {
    paddingVertical: 4,
  },
  squareCard: {
    flex: 1,
    marginBottom: theme.spacing[4],
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
  },
  listItemContent: {
    flex: 1,
    marginLeft: theme.spacing[3],
  },
  playerHeader: {
    alignItems: 'center',
    paddingTop: theme.spacing[8],
    paddingHorizontal: theme.spacing[6],
  },
  bookDetail: {
    padding: theme.spacing[5],
  },
  bookDetailHeader: {
    flexDirection: 'row',
  },
  bookDetailInfo: {
    flex: 1,
    marginLeft: theme.spacing[4],
    justifyContent: 'center',
  },
  bookDetailActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing[5],
  },
  grid: {
    flexDirection: 'row',
    padding: theme.spacing[4],
  },
});
