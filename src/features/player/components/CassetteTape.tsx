/**
 * src/features/player/components/CassetteTape.tsx
 *
 * Cassette tape visualization with spinning reels.
 * Reels animate to position and clip outside the window.
 * Slides in from top when loading, out to bottom when unloading.
 * Animation triggers on book change or chapter change.
 *
 * Enhanced with robust seek handling:
 * - Smooth animation transitions during seek
 * - Chapter change animations only trigger on manual navigation, not during seeking
 * - Rotation speed adjusts based on seek direction
 */

import React, { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Line, Defs, Rect, LinearGradient, Stop } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withRepeat,
  withTiming,
  withSequence,
  withSpring,
  Easing,
  cancelAnimation,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const TAPE_HEIGHT = 80;
const REEL_MAX_RADIUS = 120;
const REEL_MIN_RADIUS = 15;
const HUB_RADIUS = 10;
const DEFAULT_COLOR = '#F55F05';
const SLIDE_DURATION = 250;

// Animation durations
const PLAYBACK_ROTATION_DURATION = 2000;
const SEEK_ROTATION_DURATION = 500;
const REEL_TRANSITION_DURATION = 150;

// Inset shadow config
const SHADOW = {
  top:    { opacity: 0.5, depth: 0.30 },
  bottom: { opacity: 0.3, depth: 0.30 },
  left:   { opacity: 0.4, depth: 0.25 },
  right:  { opacity: 0.4, depth: 0.25 },
};

interface CassetteTapeProps {
  progress: number; // 0-1
  isPlaying: boolean;
  isRewinding?: boolean;
  isFastForwarding?: boolean;
  isChangingChapter?: boolean; // New prop for chapter transition
  accentColor?: string;
  bookId?: string; // Used to detect book changes
  chapterIndex?: number; // Used to detect chapter changes
}

export function CassetteTape({
  progress,
  isPlaying,
  isRewinding = false,
  isFastForwarding = false,
  isChangingChapter = false,
  accentColor = DEFAULT_COLOR,
  bookId,
  chapterIndex = 0,
}: CassetteTapeProps) {
  const rotation = useSharedValue(0);
  const leftRadius = useSharedValue(REEL_MAX_RADIUS);
  const rightRadius = useSharedValue(REEL_MIN_RADIUS);
  const isSpinningToPosition = useSharedValue(false);
  const hasInitialized = useSharedValue(false);

  // Slide animation for load/unload effect
  const slideY = useSharedValue(0);
  const prevBookId = useRef<string | undefined>(undefined);
  const prevChapterIndex = useRef<number>(0);
  const isFirstRender = useRef(true);

  // Track seeking state (combined for any type of seek)
  const isSeeking = useMemo(() => isRewinding || isFastForwarding, [isRewinding, isFastForwarding]);
  const isSeekingRef = useRef(isSeeking);

  // Keep ref in sync
  useEffect(() => {
    isSeekingRef.current = isSeeking;
  }, [isSeeking]);

  // Trigger slide animation
  const triggerSlideAnimation = (resetReels: boolean = false) => {
    slideY.value = withSequence(
      // Slide out (current cassette goes down and out)
      withTiming(TAPE_HEIGHT + 20, { 
        duration: SLIDE_DURATION, 
        easing: Easing.in(Easing.cubic) 
      }),
      // Jump to top (new cassette starts above)
      withTiming(-TAPE_HEIGHT - 20, { duration: 0 }),
      // Slide in (new cassette comes down from top)
      withTiming(0, { 
        duration: SLIDE_DURATION, 
        easing: Easing.out(Easing.cubic) 
      })
    );
    
    if (resetReels) {
      hasInitialized.value = false;
    }
  };

  // Detect book or chapter changes
  useEffect(() => {
    // Skip first render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevBookId.current = bookId;
      prevChapterIndex.current = chapterIndex;
      
      // Initial load - slide in from top
      if (bookId) {
        slideY.value = -TAPE_HEIGHT - 20;
        slideY.value = withTiming(0, { 
          duration: SLIDE_DURATION, 
          easing: Easing.out(Easing.cubic) 
        });
      }
      return;
    }

    // Book changed
    if (bookId && prevBookId.current && bookId !== prevBookId.current) {
      triggerSlideAnimation(true);
      prevBookId.current = bookId;
      prevChapterIndex.current = chapterIndex;
      return;
    }
    
    // First book load
    if (bookId && !prevBookId.current) {
      slideY.value = -TAPE_HEIGHT - 20;
      slideY.value = withTiming(0, { 
        duration: SLIDE_DURATION, 
        easing: Easing.out(Easing.cubic) 
      });
      prevBookId.current = bookId;
      prevChapterIndex.current = chapterIndex;
      return;
    }

    // Chapter changed (same book) - but NOT while seeking/rewinding/changing chapter
    // This prevents the slide animation from triggering during continuous seek
    // when we cross chapter boundaries
    if (chapterIndex !== prevChapterIndex.current && !isSeekingRef.current && !isChangingChapter) {
      triggerSlideAnimation(false);
    }
    prevChapterIndex.current = chapterIndex;
    prevBookId.current = bookId;
  }, [bookId, chapterIndex, isChangingChapter]);
  
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

    // During seeking - use fast, responsive updates
    if (isSeeking) {
      leftRadius.value = withTiming(targetLeft, {
        duration: REEL_TRANSITION_DURATION,
        easing: Easing.out(Easing.linear),
      });
      rightRadius.value = withTiming(targetRight, {
        duration: REEL_TRANSITION_DURATION,
        easing: Easing.out(Easing.linear),
      });
      return;
    }

    // Only do spin animation if significant change (> 5px) and not playing/seeking
    if (maxDelta > 5 && !isPlaying) {
      isSpinningToPosition.value = true;

      // Cancel any existing rotation animation first
      cancelAnimation(rotation);

      // Normalize rotation to prevent accumulation
      const currentRotation = rotation.value % 360;

      // Duration based on how far we need to go
      const duration = Math.min(Math.max(maxDelta * 15, 400), 1500);

      // Spin while transitioning
      rotation.value = withTiming(currentRotation + 360 * (duration / 500), {
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
      leftRadius.value = withTiming(targetLeft, { duration: REEL_TRANSITION_DURATION });
      rightRadius.value = withTiming(targetRight, { duration: REEL_TRANSITION_DURATION });
    }
  }, [progress, isSeeking]);

  // Continuous rotation animation for playback and seeking
  useEffect(() => {
    // Don't interfere with spin-to-position animation
    if (isSpinningToPosition.value) {
      return;
    }

    // Cancel any existing rotation animation
    cancelAnimation(rotation);

    // Determine if we should be spinning
    const shouldSpin = isPlaying || isRewinding || isFastForwarding;

    if (shouldSpin) {
      // Use faster rotation during seeking for visual feedback
      const duration = isSeeking ? SEEK_ROTATION_DURATION : PLAYBACK_ROTATION_DURATION;
      // Reverse direction when rewinding
      const direction = isRewinding ? -360 : 360;

      // Normalize rotation to 0-360 range to prevent accumulation issues
      const currentRotation = rotation.value % 360;
      rotation.value = currentRotation;

      // Start fresh continuous rotation from normalized position
      rotation.value = withRepeat(
        withTiming(currentRotation + direction, {
          duration,
          easing: Easing.linear,
        }),
        -1,
        false
      );
    }

    return () => {
      if (!isSpinningToPosition.value) {
        cancelAnimation(rotation);
      }
    };
  }, [isPlaying, isRewinding, isFastForwarding, isSeeking]);

  const leftReelStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const rightReelStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideY.value }],
  }));

  return (
    <View style={styles.outerContainer}>
      {/* Background stays fixed */}
      <View style={styles.tapeBg} />
      
      {/* Inset shadow overlay - stays fixed */}
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
      
      {/* Reels container - this slides */}
      <Animated.View style={[styles.reelsContainer, containerStyle]}>
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
      </Animated.View>
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
  outerContainer: {
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
  reelsContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
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