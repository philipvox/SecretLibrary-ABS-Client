/**
 * src/shared/components/SkullRefreshControl.tsx
 *
 * Custom pull-to-refresh component that replaces the native iOS RefreshControl
 * with an animated candle. Works with FlashList, ScrollView, and FlatList.
 *
 * Usage:
 *   <SkullRefreshControl refreshing={isLoading} onRefresh={refetch}>
 *     <FlashList ... />
 *   </SkullRefreshControl>
 */

import React, { useRef, useCallback, useState, useEffect, cloneElement } from 'react';
import { View, StyleSheet, Animated, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import { scale, useTheme } from '../theme';

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Pull distance threshold to trigger refresh (in pixels) */
const REFRESH_THRESHOLD = 80;

/** Height of the refresh indicator area */
const INDICATOR_HEIGHT = 100;

/** Size of the candle animation */
const CANDLE_SIZE = 60;

// =============================================================================
// CANDLE ANIMATION DATA (from Loading.tsx)
// =============================================================================

const CANDLE_HOLDER_PATH =
  'M69.94,87.22c-4.31-4.3-10.62-6.77-17.32-8.01-.12-7.79-.18-15.58-.22-23.37-.01-2.04.07-4.11-.05-6.15l-.2-3.52c-.04-1.19-.17-2.32-.14-3.56.08-1.06.21-2.06-.27-2.67-2.23,1.17-4.55,2.19-6.96,2.93-7.52,2.43-15.85,2.3-23.38.26-.38-.14-.83.15-.8.59.15,6.46.04,12.94.04,19.4-.01,5.93-.01,11.86-.04,17.8C7.84,84.75-.66,92.07.04,99.87c2.01,22.17,44.75,17.95,59.82,11.98,15.87-6.29,14.49-20.23,10.08-24.63ZM59.77,108.7c-13.49,5.29-54.29,10.05-56.1-9.17-.61-6.45,6.31-12.52,16.92-15.95,0,1.49,0,2.98-.01,4.47-.01,4.12-.7,8.41.63,12.41,2.25,6.8,16.8,5.16,22.11,3.93,2.54-.59,5.07-1.48,7.06-3.15.27-.23.52-.46.74-.69,1.88-1.93,2.25-4.03,1.93-6.7-.46-3.91-.32-7.95-.39-11.88v-.05c5.43,1.16,10.47,3.23,14.01,6.63,2.25,2.16,3.23,4.42,3.26,6.63.08,5.31-1.85,10.26-10.16,13.52Z';

const CANDLE_FLAME_FRAMES = [
  'M83,44.4c.5,4.3-1.6,8.3-3.9,12.8-1.3,2-2,4.7-4.4,5.5-1.7.3-3.6-1.3-5.4-2.8-3-3-6.3-6.1-6.8-10.5-.3-4.6.5-9.8,2.7-14,1.3-2.5,2.4-5.2,4.1-7.4.9-1.1,3.3-4.7,4.9-3,.9,1.3-.5,4.3,0,5.7,1.3,3.1,4.1,5.2,6.1,8,1.4,2,2.2,3.9,2.4,5.8h.3Z',
  'M62.6,44.4c-.5,5,2.5,21.1,10.2,17.9,5.7-3.3,8.7-11.2,6.3-17.5-3-6.8-8.7-14.2-5.4-21.7.3-1.1,1.1-4.4.6-5-.9.9-1.6,2.8-2.7,3.9-4.9,6.3-9,14-9.1,22v.3h0Z',
  'M78.9,47.5c-.2,2.5-.2,5.7-1.7,8.7,0,0,0,.3-.2.5-3.1,6.9-7.4,7.7-12.1,3.5-.2-.2-.5-.5-.6-.6-7.4-11,9.9-18.9,5-31.5v-.8c-.3-1.6-.5-3.1-.3-4.7.5-4.9,6.6-12.8,12.3-11.8.2.3-.9.9-1.3,1.1-5.8,3.5-11.8,9.9-7.7,16.7,0,.3.3.5.5.8,2.8,5,6,11.3,6.3,17.9v.3h-.2Z',
  'M72.7,20c.2,2.4,0,5,.6,7.4.8,2.8,3,4.9,3.9,7.6,2.2,7.4,2.7,17-1.1,23.5-1.9,3.3-7.1,6.1-10.1,2.7-2-3.1-3.5-7.2-3.5-11,0-6.1,4.4-10.9,5.5-16.7.8-4.6,2.4-9.6,4.6-13.4h0Z',
  'M74.7,60.3c-4.8,3.8-9.9,3.1-11.7-2,0-.3-.2-.6-.3-.9-1.1-6.1,1.8-11.4,4.3-16.9,0-.3.3-.6.4-.9,3-5.2,0-9.9,3-14.6,1.6,6.3,9.4,11,8,18.3v.9c-.3,3.9.3,13-3.6,16.1h-.1Z',
  'M80.2,56.5c-.9,2-3.1,3.9-5.7,4.9-.3,0-.5.2-.8.3-3.8,2.2-6.9.6-8.5-.9-3.5-5.4-3.1-10.7-1.6-15.9,0-.3.2-.6.3-.9,1.3-2.2,2.2-4.3,2.8-6.5,0-.3,0-.5.2-.8,2-5.7-2.7-8.8-2.7-15.1,6.3,3.1,9.4,11,12.4,15.9,0,.3.3.5.5.8.3.5.6.9,1.1,1.4,0,.3.3.5.3.8,1.4,3,2.7,6.1,2.7,9.6v.9c0,1.7-.3,3.6-1.1,5.4v.3h0v-.2h.1Z',
  'M83.1,44.4c.5,4.3-1.6,8.3-3.9,12.8-1.3,2-2,4.7-4.4,5.5-1.7.3-3.6-1.3-5.4-2.8-2.8-2.8-6-5.8-6.8-10.1-.9-5.4,3.5-9.4,5.4-14,.8-1.9,1.9-5,3.6-6.1,2.5-1.7,3.1,2.4,4.6,4.1s3,3.1,4.4,4.9c1.4,2,2.2,3.9,2.4,5.8h.2,0Z',
  'M83.3,44.4c.5,4.3-1.6,8.3-3.9,12.8-1.3,2-2,4.7-4.4,5.5-1.7.3-3.6-1.3-5.4-2.8-2.5-2.5-5.4-5.2-6.4-8.7s-.9-7.7-.2-11.6c.6-3.8,1.6-7.5,1.8-11.4s-.2-7.9-2.4-11.1c4.7,2.2,8.6,6,11.7,10.2s3.7,5.7,5.4,8.7,1.6,3,2.4,4.6,1.4,3.8,1.2,3.8h.3Z',
  'M62.5,44.4c0,.2,0,.4,0,.7,0,1.9.2,3.8.5,5.7.7,3.7,1.9,9,5.4,11.2s2.9.9,4.4.3c4.9-2.1,7.5-9.7,6.4-14.5s-2.5-5.7-4.2-8.3c-3.3-4.9-6.8-9.9-11.6-13.3,1.1,2.8,1.2,5.9.9,8.8-.3,2.1-.7,4.1-1.3,6.1s-.4,2.2-.4,3.3Z',
  'M79.2,47.5c.2,3-.3,6-1.7,8.7,0,0,0,.3-.2.5-3.1,6.9-7.4,7.7-12.1,3.5-.2-.2-.5-.5-.6-.6-2.7-2.7-2-7.6-.7-10.7s2.1-2.8,3.1-4.3,1.7-3.5,2.1-5.5c.5-3.3,0-6.7-1.7-9.6-1.5-2.6-3.7-4.8-4.5-7.7-.7-2.6-.1-5.3.5-7.9.3,5.4,1.7,10.9,5.1,15.2,1.8,2.2,4.1,4,6,6.2,2.8,3.3,4.6,7.7,4.9,12.2Z',
  'M63.7,24.7c2.7,5,7.8,8.3,11.1,13,3.6,5.1,4.6,11.8,3,17.8-.7,2.7-2.2,4.3-4.5,5.9s-5.4,2-7.3-.2c-1.6-2.5-2.8-5.3-3.3-8.2s.2-5.8.7-8.9c1-6.7,1-13.5,0-20.2.1.3.3.5.4.8Z',
  'M74.8,60.3c-1.2,1.3-2.7,2.2-4.5,2.4s-3,.2-4.4-.7-2.7-2.3-2.7-3.6c0-.3-.2-.6-.3-.9-.6-3.1-.8-6,.4-9.1.8-2,1.8-3.8,2.6-5.8,1.7-4.7,1.4-9.9,1.1-14.9.9,4.3,4.6,7.4,7.1,11.1,1.5,2.3,2.6,5,3.2,7.7.7,3.1,1,6.4,0,9.4s-1.3,3.1-2.5,4.3Z',
  'M80.2,56.5c-.9,2-3.1,3.9-5.7,4.9-.3,0-.5.2-.8.3-3.8,2.2-6.9.6-8.5-.9-3.2-3-3.2-10.2-2-14.1s3.4-10.1,6.3-14.4c2.8-4.3,7.1-8,12.1-9.1-3.6,1.4-5.6,5.5-5.5,9.3.1,3.7,2.1,6.2,3.5,9.5s1.6,5.6,1.6,8.1v.9c0,1.7-.3,3.6-1.1,5.4v.3-.2h.1Z',
  'M83.1,44.4c.5,4.3-1.6,8.3-3.9,12.8-1.3,2-2,4.7-4.4,5.5-1.7.3-3.6-1.3-5.4-2.8-2.8-2.8-6-5.8-6.8-10.1-.9-4.7,2.5-8.5,4.6-12.2s3.9-8.9,4.6-13.6c.3-1.9.7-4.1,2.5-4.8-.6.2.4,6,.6,6.6.4,2.3,1.1,4.6,2,6.7,1.7,4.1,5.7,7.6,6.2,12h.2,0Z',
];

const CANDLE_VIEWBOX_WIDTH = 72.87;
const CANDLE_VIEWBOX_HEIGHT = 116.62;
const CANDLE_ASPECT_RATIO = CANDLE_VIEWBOX_WIDTH / CANDLE_VIEWBOX_HEIGHT;
const FRAME_DURATION_MS = 1000 / 8; // 8fps - slower, more relaxed flicker
const FLAME_COLOR = '#f1574d'; // Red flame

// =============================================================================
// TYPES
// =============================================================================

/** Props for scroll components that can have refresh handlers */
interface ScrollableProps {
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScrollEndDrag?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle?: number;
  refreshControl?: React.ReactElement;
  bounces?: boolean;
}

export interface SkullRefreshControlProps {
  /** Whether the list is currently refreshing */
  refreshing: boolean;
  /** Callback when refresh is triggered */
  onRefresh: () => void;
  /** Children (scroll view) to wrap */
  children: React.ReactElement<ScrollableProps>;
  /** Additional offset for the indicator position */
  progressViewOffset?: number;
}

// =============================================================================
// CANDLE ANIMATION COMPONENT
// =============================================================================

interface CandleAnimationProps {
  size: number;
  holderColor: string;
}

function CandleAnimation({ size, holderColor }: CandleAnimationProps) {
  const [frameIndex, setFrameIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % CANDLE_FLAME_FRAMES.length);
    }, FRAME_DURATION_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const scaledHeight = scale(size);
  const scaledWidth = scaledHeight * CANDLE_ASPECT_RATIO;

  return (
    <Svg
      width={scaledWidth}
      height={scaledHeight}
      viewBox={`0 0 ${CANDLE_VIEWBOX_WIDTH} ${CANDLE_VIEWBOX_HEIGHT}`}
    >
      {/* Flame - scaled and positioned (same transform as Loading.tsx) */}
      <G transform="translate(36, 38) scale(0.825) translate(-72, -62)">
        <Path d={CANDLE_FLAME_FRAMES[frameIndex]} fill={FLAME_COLOR} />
      </G>
      {/* Candle holder */}
      <Path d={CANDLE_HOLDER_PATH} fill={holderColor} />
    </Svg>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function SkullRefreshControl({
  refreshing,
  onRefresh,
  children,
  progressViewOffset = 0,
}: SkullRefreshControlProps) {
  const { colors } = useTheme();
  const pullDistance = useRef(new Animated.Value(0)).current;
  const [_isRefreshing, setIsRefreshing] = useState(false);
  const hasTriggeredRefresh = useRef(false);

  // Sync internal state with prop
  useEffect(() => {
    if (refreshing) {
      setIsRefreshing(true);
      // Animate to show indicator
      Animated.spring(pullDistance, {
        toValue: INDICATOR_HEIGHT,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    } else {
      // Animate to hide indicator
      Animated.timing(pullDistance, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setIsRefreshing(false);
        hasTriggeredRefresh.current = false;
      });
    }
  }, [refreshing, pullDistance]);

  // Handle scroll events
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;

      // Only track negative offsets (pulling down)
      if (offsetY < 0 && !refreshing) {
        const pullAmount = Math.abs(offsetY);
        pullDistance.setValue(Math.min(pullAmount, INDICATOR_HEIGHT * 1.5));
      }
    },
    [refreshing, pullDistance]
  );

  // Handle scroll end (release)
  const handleScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;

      if (offsetY < -REFRESH_THRESHOLD && !refreshing && !hasTriggeredRefresh.current) {
        hasTriggeredRefresh.current = true;
        onRefresh();
      }
    },
    [refreshing, onRefresh]
  );

  // Calculate animated styles
  const indicatorOpacity = pullDistance.interpolate({
    inputRange: [0, REFRESH_THRESHOLD / 2, REFRESH_THRESHOLD],
    outputRange: [0, 0.5, 1],
    extrapolate: 'clamp',
  });

  const indicatorScale = pullDistance.interpolate({
    inputRange: [0, REFRESH_THRESHOLD],
    outputRange: [0.5, 1],
    extrapolate: 'clamp',
  });

  // Content pushes down as user pulls
  const contentTranslateY = pullDistance.interpolate({
    inputRange: [0, INDICATOR_HEIGHT],
    outputRange: [0, INDICATOR_HEIGHT],
    extrapolate: 'clamp',
  });

  // Clone the child to inject scroll handlers
  const childWithProps = cloneElement(children, {
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      handleScroll(event);
      // Call original onScroll if exists
      if (children.props.onScroll) {
        children.props.onScroll(event);
      }
    },
    onScrollEndDrag: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      handleScrollEndDrag(event);
      // Call original handler if exists
      if (children.props.onScrollEndDrag) {
        children.props.onScrollEndDrag(event);
      }
    },
    scrollEventThrottle: children.props.scrollEventThrottle || 16,
    // Remove the native RefreshControl
    refreshControl: undefined,
    // Add bounces for iOS pull-to-refresh feel
    bounces: children.props.bounces !== false,
  });

  return (
    <View style={styles.container}>
      {/* Candle indicator - fixed at top */}
      <Animated.View
        style={[
          styles.indicatorContainer,
          {
            top: progressViewOffset,
            opacity: indicatorOpacity,
            transform: [{ scale: indicatorScale }],
          },
        ]}
        pointerEvents="none"
      >
        <CandleAnimation size={CANDLE_SIZE} holderColor={colors.text.primary} />
      </Animated.View>

      {/* Scroll view child - pushes down when pulling */}
      <Animated.View
        style={[
          styles.contentWrapper,
          {
            transform: [{ translateY: contentTranslateY }],
          },
        ]}
      >
        {childWithProps}
      </Animated.View>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  indicatorContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: INDICATOR_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  contentWrapper: {
    flex: 1,
  },
});

export default SkullRefreshControl;
