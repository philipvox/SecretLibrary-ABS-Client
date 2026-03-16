/**
 * CassettePlayer.tsx
 *
 * Animated cassette tape visualization for audiobook playback.
 * Cover image fills the card, with a blurred cassette section at the bottom.
 */

import React, { useState, useRef, useEffect, useMemo, memo } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Easing,
  Pressable,
  Text,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, {
  Path,
  Circle,
  Line,
  Defs,
  LinearGradient,
  Stop,
  Rect,
  ClipPath,
  Image as SvgImage,
} from 'react-native-svg';
import { useTheme } from '@/shared/theme';

interface CassettePlayerProps {
  /** Cover image URL to display in the card */
  coverUrl?: string;
  /** External progress (0-1) - if provided, controls tape position */
  progress?: number;
  /** External playing state - if provided, controls spin animation */
  isPlaying?: boolean;
  /** Callback when internal play state changes (standalone mode) */
  onPlayStateChange?: (isPlaying: boolean) => void;
  /** Callback when progress changes (standalone mode) */
  onProgressChange?: (progress: number) => void;
  /** Scale factor for responsive sizing (default 1.0) */
  scale?: number;
  /** Hide controls (for integration mode) */
  hideControls?: boolean;
}

// Base dimensions - slightly taller card
const BASE_WIDTH = 263;
const BASE_HEIGHT = 280;
const MIN_SPOOL = 38;
const MAX_SPOOL = 160;

// Cassette pill dimensions (relative to card)
const PILL_TOP = 203;
const PILL_LEFT = 20;
const PILL_WIDTH = 223;
const PILL_HEIGHT = 51;
const PILL_RADIUS = 25.5;

// Spindle positions (from left edge of pill) - moved 15px outward from center
const LEFT_SPINDLE_CENTER_X = 29;
const RIGHT_SPINDLE_CENTER_X = 194;
const SPINDLE_CENTER_Y = 25.5;
const SPINDLE_SIZE = 38;

// Memoized Spindle component to prevent re-renders
const Spindle = memo(function Spindle({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 38 38">
      <Circle cx={19} cy={19} r={14} stroke="#AAAAAA" strokeWidth={1.5} fill="none" />
      <Circle cx={19} cy={19} r={9} stroke="#AAAAAA" strokeWidth={1} fill="none" />
      <Circle cx={19} cy={19} r={5} fill="#AAAAAA" />
      <Circle cx={19} cy={19} r={2} fill="#666666" />
      <Line x1={10} y1={12} x2={14} y2={14} stroke="#AAAAAA" strokeWidth={1.5} strokeLinecap="round" />
      <Line x1={14} y1={28} x2={16} y2={25} stroke="#AAAAAA" strokeWidth={1.5} strokeLinecap="round" />
      <Line x1={26} y1={18} x2={30} y2={17.5} stroke="#AAAAAA" strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
});

const CassettePlayer: React.FC<CassettePlayerProps> = ({
  coverUrl,
  progress: externalProgress,
  isPlaying: externalIsPlaying,
  onPlayStateChange,
  onProgressChange,
  scale: scaleProp = 1,
  hideControls = false,
}) => {
  const { colors } = useTheme();
  const isControlled = externalProgress !== undefined;

  const [internalProgress, setInternalProgress] = useState(0);
  const [internalIsPlaying, setInternalIsPlaying] = useState(false);
  const [status, setStatus] = useState('Ready');

  const progress = isControlled ? externalProgress : internalProgress;
  const isPlaying = externalIsPlaying !== undefined ? externalIsPlaying : internalIsPlaying;

  // Calculate spool sizes from progress
  const leftSize = MAX_SPOOL - (progress * (MAX_SPOOL - MIN_SPOOL));
  const rightSize = MIN_SPOOL + (progress * (MAX_SPOOL - MIN_SPOOL));

  const leftSpinAnim = useRef(new Animated.Value(0)).current;
  const rightSpinAnim = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<number | null>(null);
  const spinAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

  const s = (size: number) => size * scaleProp;

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (spinAnimationRef.current) spinAnimationRef.current.stop();
    };
  }, []);

  useEffect(() => {
    if (isPlaying) {
      startSpinAnimation(1500);
    } else {
      stopSpinAnimation();
    }
  }, [isPlaying]);

  const startSpinAnimation = (speed: number, reverse: boolean = false) => {
    if (spinAnimationRef.current) spinAnimationRef.current.stop();

    leftSpinAnim.setValue(0);
    rightSpinAnim.setValue(0);

    const createSpinLoop = (animValue: Animated.Value) => {
      return Animated.loop(
        Animated.timing(animValue, {
          toValue: reverse ? -1 : 1,
          duration: speed,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
    };

    spinAnimationRef.current = Animated.parallel([
      createSpinLoop(leftSpinAnim),
      createSpinLoop(rightSpinAnim),
    ]);

    spinAnimationRef.current.start();
  };

  const stopSpinAnimation = () => {
    if (spinAnimationRef.current) {
      spinAnimationRef.current.stop();
      spinAnimationRef.current = null;
    }
  };

  const togglePlay = () => {
    if (isControlled) return;

    if (internalIsPlaying) {
      stopAll();
      return;
    }

    if (animationRef.current) cancelAnimationFrame(animationRef.current);

    setInternalIsPlaying(true);
    onPlayStateChange?.(true);
    setStatus('Playing');

    let currentProgress = internalProgress;
    let frameCount = 0;
    const animate = () => {
      if (currentProgress < 1) {
        currentProgress = Math.min(1, currentProgress + 0.001);
        frameCount++;
        // Only update state every 3 frames to reduce re-renders
        if (frameCount % 3 === 0) {
          setInternalProgress(currentProgress);
          onProgressChange?.(currentProgress);
        }
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setInternalProgress(1);
        stopAll();
        setStatus('End of Tape');
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  };

  const startFastForward = () => {
    if (isControlled) return;
    if (animationRef.current) cancelAnimationFrame(animationRef.current);

    setInternalIsPlaying(false);
    onPlayStateChange?.(false);
    setStatus('Fast Forward');
    startSpinAnimation(200);

    let currentProgress = internalProgress;
    let frameCount = 0;
    const animate = () => {
      if (currentProgress < 1) {
        currentProgress = Math.min(1, currentProgress + 0.008);
        frameCount++;
        if (frameCount % 2 === 0) {
          setInternalProgress(currentProgress);
          onProgressChange?.(currentProgress);
        }
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  };

  const startRewind = () => {
    if (isControlled) return;
    if (animationRef.current) cancelAnimationFrame(animationRef.current);

    setInternalIsPlaying(false);
    onPlayStateChange?.(false);
    setStatus('Rewinding');
    startSpinAnimation(200, true);

    let currentProgress = internalProgress;
    let frameCount = 0;
    const animate = () => {
      if (currentProgress > 0) {
        currentProgress = Math.max(0, currentProgress - 0.008);
        frameCount++;
        if (frameCount % 2 === 0) {
          setInternalProgress(currentProgress);
          onProgressChange?.(currentProgress);
        }
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  };

  const stopAll = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    stopSpinAnimation();
    setInternalIsPlaying(false);
    onPlayStateChange?.(false);
    setStatus('Stopped');
  };

  const leftSpinInterpolate = leftSpinAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-360deg', '0deg', '360deg'],
  });

  const rightSpinInterpolate = rightSpinAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-360deg', '0deg', '360deg'],
  });

  const showControls = !isControlled && !hideControls;

  // Memoize spindle size to prevent unnecessary re-renders
  const spindleSize = useMemo(() => s(SPINDLE_SIZE), [scaleProp]);

  return (
    <View style={styles.container}>
      <View style={[styles.playerCard, { width: s(BASE_WIDTH), height: s(showControls ? 316 : BASE_HEIGHT) }]}>

        {/* Layer 1: Cover image with pill cutout */}
        <View style={[
          styles.coverContainer,
          {
            width: s(BASE_WIDTH),
            height: s(BASE_HEIGHT),
          }
        ]}>
          {coverUrl ? (
            <Svg width={s(BASE_WIDTH)} height={s(BASE_HEIGHT)} viewBox="0 0 263 280">
              <Defs>
                <ClipPath id="coverClip">
                  {/* Card shape with pill cutout */}
                  <Path
                    d="M8.79 0C3.936 0 0 3.936 0 8.79V271.21C0 276.064 3.936 280 8.79 280H254.21C259.064 280 263 276.064 263 271.21V8.79C263 3.936 259.064 0 254.21 0H8.79ZM45.42 203C31.381 203 20 214.381 20 228.42C20 242.459 31.381 253.84 45.42 253.84H217.58C231.619 253.84 243 242.459 243 228.42C243 214.381 231.619 203 217.58 203H45.42Z"
                    fillRule="evenodd"
                    clipRule="evenodd"
                  />
                </ClipPath>
              </Defs>
              <SvgImage
                href={coverUrl}
                width={263}
                height={280}
                preserveAspectRatio="xMidYMid slice"
                clipPath="url(#coverClip)"
              />
            </Svg>
          ) : (
            <Svg width={s(BASE_WIDTH)} height={s(BASE_HEIGHT)} viewBox="0 0 263 280">
              <Path
                d="M8.79 0C3.936 0 0 3.936 0 8.79V271.21C0 276.064 3.936 280 8.79 280H254.21C259.064 280 263 276.064 263 271.21V8.79C263 3.936 259.064 0 254.21 0H8.79ZM45.42 203C31.381 203 20 214.381 20 228.42C20 242.459 31.381 253.84 45.42 253.84H217.58C231.619 253.84 243 242.459 243 228.42C243 214.381 231.619 203 217.58 203H45.42Z"
                fillRule="evenodd"
                clipRule="evenodd"
                fill={colors.background.tertiary}
              />
            </Svg>
          )}
        </View>

        {/* Layer 2: Cassette pill area with blur */}
        <View style={[
          styles.cassetteContainer,
          {
            top: s(PILL_TOP),
            left: s(PILL_LEFT),
            width: s(PILL_WIDTH),
            height: s(PILL_HEIGHT),
            borderRadius: s(PILL_RADIUS),
          }
        ]}>
          {/* Subtle dark background for cassette */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.15)' }]} />

          {/* Left Reel */}
          <View style={[
            styles.reelContainer,
            {
              left: s(LEFT_SPINDLE_CENTER_X - SPINDLE_SIZE / 2),
              top: s(SPINDLE_CENTER_Y - SPINDLE_SIZE / 2),
              width: s(SPINDLE_SIZE),
              height: s(SPINDLE_SIZE),
            }
          ]}>
            <View
              style={[
                styles.tapeSpool,
                {
                  width: s(leftSize),
                  height: s(leftSize),
                  borderRadius: s(leftSize / 2),
                  left: s((SPINDLE_SIZE - leftSize) / 2),
                  top: s((SPINDLE_SIZE - leftSize) / 2),
                },
              ]}
            />
            <Animated.View
              style={[
                styles.spindle,
                {
                  width: spindleSize,
                  height: spindleSize,
                  transform: [{ rotate: leftSpinInterpolate }],
                }
              ]}
            >
              <Spindle size={spindleSize} />
            </Animated.View>
          </View>

          {/* Right Reel */}
          <View style={[
            styles.reelContainer,
            {
              left: s(RIGHT_SPINDLE_CENTER_X - SPINDLE_SIZE / 2),
              top: s(SPINDLE_CENTER_Y - SPINDLE_SIZE / 2),
              width: s(SPINDLE_SIZE),
              height: s(SPINDLE_SIZE),
            }
          ]}>
            <View
              style={[
                styles.tapeSpool,
                {
                  width: s(rightSize),
                  height: s(rightSize),
                  borderRadius: s(rightSize / 2),
                  left: s((SPINDLE_SIZE - rightSize) / 2),
                  top: s((SPINDLE_SIZE - rightSize) / 2),
                },
              ]}
            />
            <Animated.View
              style={[
                styles.spindle,
                {
                  width: spindleSize,
                  height: spindleSize,
                  transform: [{ rotate: rightSpinInterpolate }],
                }
              ]}
            >
              <Spindle size={spindleSize} />
            </Animated.View>
          </View>

          {/* LEFT blur panel - covers left spindle area */}
          <View style={[
            styles.blurPanel,
            {
              left: 0,
              top: 0,
              width: s(74),
              height: s(PILL_HEIGHT),
              borderTopLeftRadius: s(PILL_RADIUS),
              borderBottomLeftRadius: s(PILL_RADIUS),
            }
          ]}>
            <BlurView style={StyleSheet.absoluteFill} intensity={10} tint="dark" />
          </View>

          {/* RIGHT blur panel - covers right spindle area */}
          <View style={[
            styles.blurPanel,
            {
              right: 0,
              top: 0,
              width: s(74),
              height: s(PILL_HEIGHT),
              borderTopRightRadius: s(PILL_RADIUS),
              borderBottomRightRadius: s(PILL_RADIUS),
            }
          ]}>
            <BlurView style={StyleSheet.absoluteFill} intensity={10} tint="dark" />
          </View>

          {/* TOP blur panel - above tape window */}
          <View style={[
            styles.blurPanel,
            {
              left: s(74),
              top: 0,
              width: s(75),
              height: s(16),
            }
          ]}>
            <BlurView style={StyleSheet.absoluteFill} intensity={10} tint="dark" />
          </View>

          {/* BOTTOM blur panel - below tape window */}
          <View style={[
            styles.blurPanel,
            {
              left: s(74),
              bottom: 0,
              width: s(75),
              height: s(16),
            }
          ]}>
            <BlurView style={StyleSheet.absoluteFill} intensity={10} tint="dark" />
          </View>

          {/* CENTER tape window is CLEAR - no blur here */}
        </View>

        {/* Layer 3: Cassette pill stroke (gradient border) */}
        <View style={[
          styles.pillStroke,
          {
            top: s(PILL_TOP),
            left: s(PILL_LEFT),
            width: s(PILL_WIDTH),
            height: s(PILL_HEIGHT),
          }
        ]}>
          <Svg width={s(PILL_WIDTH)} height={s(PILL_HEIGHT)} viewBox="0 0 223 51">
            <Defs>
              <LinearGradient id="pillStroke" x1="111.5" y1="0" x2="111.5" y2="51" gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor="#000000" stopOpacity={0.4} />
                <Stop offset="1" stopColor="#ffffff" stopOpacity={0.2} />
              </LinearGradient>
            </Defs>
            <Rect
              x={0.5}
              y={0.5}
              width={222}
              height={50}
              rx={25}
              stroke="url(#pillStroke)"
              strokeWidth={1}
              fill="none"
            />
          </Svg>
        </View>

        {/* Layer 4: Tape window stroke */}
        <View style={[
          styles.windowStroke,
          {
            top: s(PILL_TOP + 16),
            left: s(PILL_LEFT + 74),
            width: s(75),
            height: s(19),
          }
        ]}>
          <Svg width={s(75)} height={s(19)} viewBox="0 0 75 19">
            <Defs>
              <LinearGradient id="windowStroke" x1="37.5" y1="0" x2="37.5" y2="19" gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor="#000000" stopOpacity={0.3} />
                <Stop offset="1" stopColor="#ffffff" stopOpacity={0.15} />
              </LinearGradient>
            </Defs>
            <Rect
              x={0.5}
              y={0.5}
              width={74}
              height={18}
              rx={9}
              stroke="url(#windowStroke)"
              strokeWidth={1}
              fill="none"
            />
          </Svg>
        </View>

        {/* Controls */}
        {showControls && (
          <View style={[styles.controls, { bottom: 0, gap: s(4) }]}>
            <Pressable
              style={({ pressed }) => [
                styles.controlBtn,
                { width: s(53), height: s(56), borderRadius: s(5), backgroundColor: colors.surface.raised, borderColor: colors.border.light },
                pressed && [styles.controlBtnPressed, { backgroundColor: colors.surface.card }],
              ]}
              onPressIn={startRewind}
              onPressOut={stopAll}
            >
              <Svg width={s(24)} height={s(24)} viewBox="0 0 24 24">
                <Path d="M11 12L17 7v10l-6-5zm-6 0l6-5v10l-6-5z" fill={colors.icon.primary} />
              </Svg>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.controlBtn,
                { width: s(53), height: s(56), borderRadius: s(5), backgroundColor: colors.surface.raised, borderColor: colors.border.light },
                pressed && [styles.controlBtnPressed, { backgroundColor: colors.surface.card }],
              ]}
              onPressIn={startFastForward}
              onPressOut={stopAll}
            >
              <Svg width={s(24)} height={s(24)} viewBox="0 0 24 24">
                <Path d="M13 12L7 17V7l6 5zm6 0l-6 5V7l6 5z" fill={colors.icon.primary} />
              </Svg>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.playBtn,
                { width: s(53), height: s(56), borderRadius: s(5), backgroundColor: colors.surface.card, borderColor: colors.border.default },
                pressed && [styles.playBtnPressed, { backgroundColor: colors.surface.cardHover }],
              ]}
              onPress={togglePlay}
            >
              <Svg width={s(24)} height={s(24)} viewBox="0 0 24 24">
                {isPlaying ? (
                  <Path d="M6 4h4v16H6zm8 0h4v16h-4z" fill={colors.accent.primary} />
                ) : (
                  <Path d="M8 5v14l11-7z" fill={colors.accent.primary} />
                )}
              </Svg>
            </Pressable>
          </View>
        )}

        {showControls && (
          <Text style={[styles.status, { bottom: s(-30), fontSize: s(11), color: colors.text.tertiary }]}>
            {status.toUpperCase()}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerCard: {
    position: 'relative',
  },

  // Cover image - on top of cassette
  coverContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
    zIndex: 10,
    // Card shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 10,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  placeholderCover: {
    width: '100%',
    height: '100%',
    // backgroundColor set via themeColors in JSX
  },

  // Cassette area
  cassetteContainer: {
    position: 'absolute',
    overflow: 'hidden',
  },
  blurPanel: {
    position: 'absolute',
    overflow: 'hidden',
  },

  // Reels
  reelContainer: {
    position: 'absolute',
  },
  tapeSpool: {
    position: 'absolute',
    backgroundColor: '#0a0a0a',
  },
  spindle: {
    position: 'absolute',
    left: 0,
    top: 0,
  },


  // Strokes
  pillStroke: {
    position: 'absolute',
    pointerEvents: 'none',
  },
  windowStroke: {
    position: 'absolute',
    pointerEvents: 'none',
  },

  // Controls
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlBtn: {
    // backgroundColor and borderColor set via themeColors in JSX
    borderWidth: 0.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlBtnPressed: {
    transform: [{ scale: 0.95 }],
    // backgroundColor set via themeColors in JSX
  },
  playBtn: {
    // backgroundColor and borderColor set via themeColors in JSX
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playBtnPressed: {
    transform: [{ scale: 0.95 }],
    // backgroundColor set via themeColors in JSX
  },

  // Status
  status: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    // color set via themeColors in JSX
    letterSpacing: 2,
  },
});

export default CassettePlayer;
