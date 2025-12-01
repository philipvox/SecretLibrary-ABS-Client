/**
 * src/features/player/components/CassetteTape.tsx
 *
 * Cassette tape visualization with spinning reels.
 * Reels animate to position and clip outside the window.
 */

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Line, Defs, Rect, LinearGradient, Stop } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const TAPE_HEIGHT = 80;
const REEL_MAX_RADIUS = 120;
const REEL_MIN_RADIUS = 15;
const HUB_RADIUS = 10;
const DEFAULT_COLOR = '#F55F05';

// Inset shadow config
// opacity: darkness at edge (0-1)
// depth: how far shadow extends inward (0-1, where 0.3 = 30% of container)
const SHADOW = {
  top:    { opacity: .65, depth: 0.25},
  bottom: { opacity: .2, depth: 0.1},
  cover: { opacity: 0.5, depth: 1 },
  left:   { opacity: 0, depth: 0.05 },
  right:  { opacity: 0.5, depth: 0.05 },
};


interface CassetteTapeProps {
  progress: number; // 0-1
  isPlaying: boolean;
  isRewinding?: boolean;
  isFastForwarding?: boolean;
  accentColor?: string;
}

export function CassetteTape({
  progress,
  isPlaying,
  isRewinding = false,
  isFastForwarding = false,
  accentColor = DEFAULT_COLOR,
}: CassetteTapeProps) {
  const rotation = useSharedValue(0);
  const leftRadius = useSharedValue(REEL_MAX_RADIUS);
  const rightRadius = useSharedValue(REEL_MIN_RADIUS);
  const isSpinningToPosition = useSharedValue(false);
  const hasInitialized = useSharedValue(false);
  
  // Animate reel sizes to match progress with rotation
  useEffect(() => {
    const targetLeft = REEL_MAX_RADIUS - (progress * (REEL_MAX_RADIUS - REEL_MIN_RADIUS));
    const targetRight = REEL_MIN_RADIUS + (progress * (REEL_MAX_RADIUS - REEL_MIN_RADIUS));
    
    // First load - set position immediately without animation
    if (!hasInitialized.value) {
      leftRadius.value = targetLeft;
      rightRadius.value = targetRight;
      hasInitialized.value = true;
      return;
    }
    
    // Calculate how much the reels need to change
    const leftDelta = Math.abs(leftRadius.value - targetLeft);
    const rightDelta = Math.abs(rightRadius.value - targetRight);
    const maxDelta = Math.max(leftDelta, rightDelta);
    
    // Only do spin animation if significant change (> 5px) and not playing
    if (maxDelta > 5 && !isPlaying && !isRewinding && !isFastForwarding) {
      isSpinningToPosition.value = true;
      
      // Duration based on how far we need to go
      const duration = Math.min(Math.max(maxDelta * 15, 400), 1500);
      
      // Spin while transitioning
      rotation.value = withTiming(rotation.value + 360 * (duration / 500), {
        duration,
        easing: Easing.out(Easing.cubic),
      }, () => {
        isSpinningToPosition.value = false;
      });
      
      leftRadius.value = withTiming(targetLeft, {
        duration,
        easing: Easing.out(Easing.cubic),
      });
      rightRadius.value = withTiming(targetRight, {
        duration,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      // Small change, just update directly
      leftRadius.value = withTiming(targetLeft, { duration: 150 });
      rightRadius.value = withTiming(targetRight, { duration: 150 });
    }
  }, [progress]);

  // Continuous rotation animation for playback
  useEffect(() => {
    if (isPlaying || isRewinding || isFastForwarding) {
      const duration = isRewinding || isFastForwarding ? 500 : 2000;
      const direction = isRewinding ? -360 : 360;
      rotation.value = withRepeat(
        withTiming(rotation.value + direction, {
          duration,
          easing: Easing.linear,
        }),
        -1,
        false
      );
    } else if (!isSpinningToPosition.value) {
      cancelAnimation(rotation);
    }

    return () => {
      if (!isSpinningToPosition.value) {
        cancelAnimation(rotation);
      }
    };
  }, [isPlaying, isRewinding, isFastForwarding]);

  const leftReelStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const rightReelStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={styles.container}>
      {/* Background */}
      <View style={styles.tapeBg} />
      
      {/* Inset shadow overlay */}
      <View style={styles.insetShadow} pointerEvents="none">
        <Svg width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="topShadow" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="black" stopOpacity={SHADOW.top.opacity} />
              <Stop offset={SHADOW.top.depth / 2} stopColor="black" stopOpacity={SHADOW.top.opacity * 0.4} />
              <Stop offset={SHADOW.top.depth} stopColor="black" stopOpacity="0" />
            </LinearGradient>
            <LinearGradient id="bottomShadow" x1="0" y1="1" x2="0" y2="0">
              <Stop offset="0" stopColor="black" stopOpacity={SHADOW.bottom.opacity} />
              <Stop offset={SHADOW.bottom.depth / 2} stopColor="black" stopOpacity={SHADOW.bottom.opacity * 0.4} />
              <Stop offset={SHADOW.bottom.depth} stopColor="black" stopOpacity="0" />
            </LinearGradient>
             <LinearGradient id="coverShadow" x1="0" y1="0" x2="0" y2="0">
              <Stop offset="0" stopColor="black" stopOpacity={SHADOW.bottom.opacity} />
              <Stop offset={SHADOW.cover.depth / 2} stopColor="black" stopOpacity={SHADOW.bottom.opacity * 0.4} />
              <Stop offset={SHADOW.cover.depth} stopColor="black" stopOpacity="0" />
            </LinearGradient>
            <LinearGradient id="leftShadow" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="black" stopOpacity={SHADOW.left.opacity} />
              <Stop offset={SHADOW.left.depth / 2} stopColor="black" stopOpacity={SHADOW.left.opacity * 0.4} />
              <Stop offset={SHADOW.left.depth} stopColor="black" stopOpacity="0" />
            </LinearGradient>
            <LinearGradient id="rightShadow" x1="1" y1="0" x2="0" y2="0">
              <Stop offset="0" stopColor="black" stopOpacity={SHADOW.right.opacity} />
              <Stop offset={SHADOW.right.depth / 2} stopColor="black" stopOpacity={SHADOW.right.opacity * 0.4} />
              <Stop offset={SHADOW.right.depth} stopColor="black" stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#topShadow)" />
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#bottomShadow)" />
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#leftShadow)" />
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#rightShadow)" />
        </Svg>
      </View>
      
      {/* Left Reel */}
      <View style={styles.leftReelContainer}>
        <Animated.View style={leftReelStyle}>
          <AnimatedReel radius={leftRadius} linePosition="bottom" color={accentColor} />
        </Animated.View>
      </View>
      
      {/* Right Reel */}
      <View style={styles.rightReelContainer}>
        <Animated.View style={rightReelStyle}>
          <AnimatedReel radius={rightRadius} linePosition="top" color={accentColor} />
        </Animated.View>
      </View>
    </View>
  );
}

function AnimatedReel({ 
  radius, 
  linePosition,
  color,
}: { 
  radius: Animated.SharedValue<number>; 
  linePosition: 'top' | 'bottom';
  color: string;
}) {
  const size = REEL_MAX_RADIUS * 2 + 20;
  const center = size / 2;
  const hubEdgeRadius = HUB_RADIUS + 6;
  
  const lineY1 = linePosition === 'top' 
    ? center - hubEdgeRadius 
    : center + hubEdgeRadius;
  const lineY2 = linePosition === 'top' 
    ? center - hubEdgeRadius - 14 
    : center + hubEdgeRadius + 14;

  const animatedProps = useAnimatedProps(() => ({
    r: radius.value,
  }));
  
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Outer Tape Ring - Animated */}
      <AnimatedCircle
        cx={center}
        cy={center}
        fill={color}
        animatedProps={animatedProps}
      />
      
      {/* Inner dark hub area */}
      <Circle
        cx={center}
        cy={center}
        r={hubEdgeRadius}
        fill="black"
      />
      
      {/* Hub ring */}
      <Circle
        cx={center}
        cy={center}
        r={HUB_RADIUS}
        fill="none"
        stroke={color}
        strokeWidth={10}
      />
      
      {/* Single line indicator for rotation */}
      <Line
        x1={center}
        y1={lineY1}
        x2={center}
        y2={lineY2}
        stroke="black"
        strokeWidth={1}
        strokeLinecap="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: TAPE_HEIGHT,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  tapeBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'black',
    borderRadius: 8,
  },
  insetShadow: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    borderRadius: 8,
  },
  leftReelContainer: {
    position: 'absolute',
    left: -40,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightReelContainer: {
    position: 'absolute',
    right: -40,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
});