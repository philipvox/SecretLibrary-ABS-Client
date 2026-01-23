/**
 * src/features/player/components/LiquidSlider.tsx
 * 
 * Liquid glass slider with magnification effect and proper shadow clipping
 */

import React, { useCallback, useEffect } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  runOnJS,
  clamp,
  interpolate,
} from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';
import { useTheme } from '@/shared/theme';

// SVG with drop shadow filter included
const THUMB_SVG = `<svg viewBox="-20 -20 294 236" fill="none" xmlns="http://www.w3.org/2000/svg">
<mask id="mask0_80_42" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="40" y="32" width="174" height="116">
<rect x="40" y="32" width="174" height="115.691" rx="57.8457" fill="black"/>
</mask>
<g mask="url(#mask0_80_42)">
<g filter="url(#filter0_f_80_42)">
<path d="M99.8457 148.691C94.6983 148.604 89.5945 147.843 84.6794 146.409C60.4789 139.715 43.3804 115.622 44.2107 91.2477C44.3323 82.7248 46.328 74.2771 49.9755 66.6259C58.8464 47.5412 78.8738 34.033 99.8457 34.3822C107.397 34.4146 114.949 34.4415 122.5 34.4613C131.935 34.4861 141.37 34.5 150.805 34.5C155.144 34.5 159.484 34.4753 163.823 34.4258C178.887 34.1994 194.053 40.0292 205.304 50.6969C208.987 54.1722 212.257 58.1416 215 62.5C212.855 57.8182 210.034 53.3997 206.63 49.4338C196.273 37.2374 180.224 29.6693 163.823 29.5742C159.484 29.5247 155.144 29.5 150.805 29.5C141.37 29.5 131.935 29.5139 122.5 29.5387C114.949 29.5585 107.397 29.5854 99.8457 29.6178C76.9364 29.4434 55.5123 44.4433 46.3516 64.9326C42.5664 73.1598 40.6531 82.2272 40.7893 91.2477C40.6913 117.19 59.9053 141.233 84.5317 146.955C89.5481 148.21 94.6986 148.78 99.8457 148.691Z" fill="black"/>
</g>
</g>
<g filter="url(#filter1_di_80_42)">
<rect x="40" y="32" width="174" height="115.691" rx="57.8457" fill="white" fill-opacity="0.01" shape-rendering="crispEdges"/>
</g>
<g style="mix-blend-mode:screen" opacity="0.44">
<rect x="40" y="32" width="174" height="115.691" rx="57.8457" fill="url(#paint0_radial_80_42)" fill-opacity="0.25"/>
<rect x="40" y="32" width="174" height="115.691" rx="57.8457" fill="url(#paint1_radial_80_42)" fill-opacity="0.5"/>
<rect x="40" y="32" width="174" height="115.691" rx="57.8457" stroke="white" stroke-opacity="0.01"/>
</g>
<g style="mix-blend-mode:screen">
<mask id="path-5-inside-1_80_42" fill="white">
<path d="M40 89.8457C40 57.8984 65.8984 32 97.8457 32H156.154C188.102 32 214 57.8984 214 89.8457V89.8457C214 121.793 188.102 147.691 156.154 147.691H97.8457C65.8984 147.691 40 121.793 40 89.8457V89.8457Z"/>
</mask>
<path d="M97.8457 31C97.8457 31.6667 97.8457 32.3333 97.8457 33C105.847 32.8707 113.849 32.754 121.85 32.6498C133.285 32.5008 144.72 32.3775 156.154 32.2798C178.001 31.825 199.382 45.327 208.53 65.2591C212.14 72.9153 213.986 81.3876 213.939 89.8457C214.512 120.671 186.639 147.951 156.154 147.191C136.718 147.191 117.282 147.308 97.8457 147.429C77.0168 147.788 56.5346 135.628 46.8119 117.104C42.3355 108.766 40.0047 99.3055 40.0566 89.8457C40.0566 89.8457 40.0566 89.8457 40.0566 89.8457C39.8636 67.4308 54.3049 45.9387 74.7764 37.4797C82.0588 34.3765 89.979 32.8581 97.8457 33C97.8457 32.3333 97.8457 31.6667 97.8457 31C89.7071 31.1264 81.6186 32.9417 74.2614 36.3124C53.5854 45.5457 39.5858 67.4121 39.9434 89.8457C39.9677 99.3238 42.3363 108.766 46.8119 117.104C56.5253 135.601 76.8086 148.036 97.8457 147.954C117.282 148.075 136.718 148.191 156.154 148.191C156.154 148.191 156.154 148.191 156.154 148.191C187.294 148.931 214.986 120.645 214.061 89.8457C214.061 89.8457 214.061 89.8457 214.061 89.8457C214.033 81.3693 212.139 72.9148 208.53 65.2591C199.374 45.3475 178.212 31.6612 156.154 31.7202C144.72 31.6225 133.285 31.4992 121.85 31.3502C113.849 31.246 105.847 31.1293 97.8457 31ZM97.8457 33V31V33Z" fill="url(#paint2_linear_80_42)" mask="url(#path-5-inside-1_80_42)"/>
<path d="M97.8457 31C97.8457 31.6667 97.8457 32.3333 97.8457 33C105.847 32.8707 113.849 32.754 121.85 32.6498C133.285 32.5008 144.72 32.3775 156.154 32.2798C178.001 31.825 199.382 45.327 208.53 65.2591C212.14 72.9153 213.986 81.3876 213.939 89.8457C214.512 120.671 186.639 147.951 156.154 147.191C136.718 147.191 117.282 147.308 97.8457 147.429C77.0168 147.788 56.5346 135.628 46.8119 117.104C42.3355 108.766 40.0047 99.3055 40.0566 89.8457C40.0566 89.8457 40.0566 89.8457 40.0566 89.8457C39.8636 67.4308 54.3049 45.9387 74.7764 37.4797C82.0588 34.3765 89.979 32.8581 97.8457 33C97.8457 32.3333 97.8457 31.6667 97.8457 31C89.7071 31.1264 81.6186 32.9417 74.2614 36.3124C53.5854 45.5457 39.5858 67.4121 39.9434 89.8457C39.9677 99.3238 42.3363 108.766 46.8119 117.104C56.5253 135.601 76.8086 148.036 97.8457 147.954C117.282 148.075 136.718 148.191 156.154 148.191C156.154 148.191 156.154 148.191 156.154 148.191C187.294 148.931 214.986 120.645 214.061 89.8457C214.061 89.8457 214.061 89.8457 214.061 89.8457C214.033 81.3693 212.139 72.9148 208.53 65.2591C199.374 45.3475 178.212 31.6612 156.154 31.7202C144.72 31.6225 133.285 31.4992 121.85 31.3502C113.849 31.246 105.847 31.1293 97.8457 31ZM97.8457 33V31V33Z" fill="url(#paint3_linear_80_42)" mask="url(#path-5-inside-1_80_42)"/>
</g>
<defs>
<filter id="filter0_f_80_42" x="39.7825" y="28.5" width="176.218" height="121.2" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<feFlood flood-opacity="0" result="BackgroundImageFix"/>
<feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
<feGaussianBlur stdDeviation="0.5" result="effect1_foregroundBlur_80_42"/>
</filter>
<filter id="filter1_di_80_42" x="0" y="0" width="254" height="195.692" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
<feFlood flood-opacity="0" result="BackgroundImageFix"/>
<feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
<feOffset dy="4"/>
<feGaussianBlur stdDeviation="8"/>
<feComposite in2="hardAlpha" operator="out"/>
<feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.2 0"/>
<feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_80_42"/>
<feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_80_42" result="shape"/>
<feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
<feOffset dy="4"/>
<feGaussianBlur stdDeviation="4"/>
<feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
<feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.15 0"/>
<feBlend mode="normal" in2="shape" result="effect2_innerShadow_80_42"/>
</filter>
<radialGradient id="paint0_radial_80_42" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(162 161) rotate(-90) scale(86 109)">
<stop stop-color="white"/>
<stop offset="0.783654" stop-color="white" stop-opacity="0"/>
</radialGradient>
<radialGradient id="paint1_radial_80_42" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(127 47.9998) rotate(90) scale(18 87)">
<stop stop-color="white"/>
<stop offset="0.846154" stop-color="white" stop-opacity="0"/>
</radialGradient>
<linearGradient id="paint2_linear_80_42" x1="92.5" y1="23" x2="114" y2="88" gradientUnits="userSpaceOnUse">
<stop stop-color="white"/>
<stop offset="0.846154" stop-color="white" stop-opacity="0"/>
</linearGradient>
<linearGradient id="paint3_linear_80_42" x1="188" y1="146" x2="163.096" y2="81.9787" gradientUnits="userSpaceOnUse">
<stop stop-color="white"/>
<stop offset="0.783654" stop-color="white" stop-opacity="0"/>
</linearGradient>
</defs>
</svg>`;

// SVG dimensions - full size to include shadow
const SVG_WIDTH = 294;
const SVG_HEIGHT = 236;
// Pill position within SVG (accounting for viewBox offset of -20, -20)
const PILL_X = 60;  // 40 - (-20)
const PILL_Y = 52;  // 32 - (-20)
const PILL_WIDTH = 174;
const PILL_HEIGHT = 116;

const THUMB_WIDTH = 68;
const THUMB_HEIGHT = 45;
const TRACK_HEIGHT = 4;
const SHADOW_PADDING = 30; // Extra space for SVG shadow
const CONTAINER_HEIGHT = THUMB_HEIGHT + SHADOW_PADDING;

// Scale factor to render pill at THUMB_WIDTH
const SVG_SCALE = THUMB_WIDTH / PILL_WIDTH;

// Magnification settings
const MAGNIFY_SCALE = 2.5;
const MAGNIFIED_TRACK_HEIGHT = TRACK_HEIGHT * MAGNIFY_SCALE;

const SPRING_CONFIG = {
  damping: 25,
  stiffness: 200,
  mass: 0.8,
};

interface LiquidSliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onValueChange: (value: number) => void;
  onSlidingStart?: () => void;
  onSlidingComplete?: (value: number) => void;
  /** @deprecated Use theme instead. This prop is ignored. */
  isDark?: boolean;
}

export function LiquidSlider({
  value,
  min,
  max,
  step = 0.05,
  onValueChange,
  onSlidingStart,
  onSlidingComplete,
}: LiquidSliderProps) {
  const { colors } = useTheme();
  const trackWidth = useSharedValue(300);
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);
  const isFocused = useSharedValue(0); // 0 = not focused, 1 = focused

  const valueToPosition = (val: number, width: number): number => {
    'worklet';
    const normalized = (val - min) / (max - min);
    return normalized * width - THUMB_WIDTH / 2;
  };

  const positionToValue = (pos: number, width: number): number => {
    'worklet';
    const normalized = (pos + THUMB_WIDTH / 2) / width;
    const raw = min + normalized * (max - min);
    const stepped = Math.round(raw / step) * step;
    return Math.min(max, Math.max(min, stepped));
  };

  useEffect(() => {
    translateX.value = withSpring(valueToPosition(value, trackWidth.value), SPRING_CONFIG);
  }, [value]);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    trackWidth.value = width;
    translateX.value = valueToPosition(value, width);
  }, [value]);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      startX.value = translateX.value;
      isFocused.value = withTiming(1, { duration: 150 });
      if (onSlidingStart) runOnJS(onSlidingStart)();
    })
    .onUpdate((e) => {
      const minX = -THUMB_WIDTH / 2;
      const maxX = trackWidth.value - THUMB_WIDTH / 2;
      translateX.value = clamp(startX.value + e.translationX, minX, maxX);
      const newValue = positionToValue(translateX.value, trackWidth.value);
      runOnJS(onValueChange)(newValue);
    })
    .onEnd(() => {
      const finalValue = positionToValue(translateX.value, trackWidth.value);
      translateX.value = withSpring(valueToPosition(finalValue, trackWidth.value), SPRING_CONFIG);
      isFocused.value = withTiming(0, { duration: 200 });
      if (onSlidingComplete) runOnJS(onSlidingComplete)(finalValue);
    });

  const tapGesture = Gesture.Tap()
    .onEnd((e) => {
      const minX = -THUMB_WIDTH / 2;
      const maxX = trackWidth.value - THUMB_WIDTH / 2;
      const tapX = clamp(e.x - THUMB_WIDTH / 2, minX, maxX);
      if (onSlidingStart) runOnJS(onSlidingStart)();
      isFocused.value = withTiming(1, { duration: 150 });
      translateX.value = withSpring(tapX, SPRING_CONFIG);
      const newValue = positionToValue(tapX, trackWidth.value);
      runOnJS(onValueChange)(newValue);
      isFocused.value = withDelay(300, withTiming(0, { duration: 200 }));
      if (onSlidingComplete) runOnJS(onSlidingComplete)(newValue);
    });

  const gesture = Gesture.Race(panGesture, tapGesture);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { scale: interpolate(isFocused.value, [0, 1], [1, 1.15]) },
    ],
  }));

  const filledTrackStyle = useAnimatedStyle(() => ({
    width: Math.max(0, translateX.value + THUMB_WIDTH / 2),
  }));

  // Magnified track: offset to keep it aligned under the pill
  const magnifiedTrackStyle = useAnimatedStyle(() => {
    const thumbCenter = translateX.value + THUMB_WIDTH / 2;
    const offset = -thumbCenter * MAGNIFY_SCALE + THUMB_WIDTH / 2;
    return {
      transform: [{ translateX: offset }],
    };
  });

  const magnifiedFilledStyle = useAnimatedStyle(() => {
    const thumbCenter = translateX.value + THUMB_WIDTH / 2;
    const filledWidth = thumbCenter * MAGNIFY_SCALE;
    return {
      width: Math.max(0, filledWidth),
    };
  });

  const magnifiedUnfilledStyle = useAnimatedStyle(() => {
    const thumbCenter = translateX.value + THUMB_WIDTH / 2;
    const fillPoint = thumbCenter * MAGNIFY_SCALE;
    const trackEnd = trackWidth.value * MAGNIFY_SCALE;
    return {
      width: Math.max(0, trackEnd - fillPoint),
      left: fillPoint,
    };
  });

  // Use theme colors for track - filled portion is text color, unfilled is muted
  const trackLeftColor = colors.text.primary;
  const trackRightColor = `${colors.text.primary}40`;

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <GestureDetector gesture={gesture}>
        <View style={styles.touchArea}>
          {/* Track background (unfilled) */}
          <View style={[styles.track, { backgroundColor: trackRightColor }]} />
          
          {/* Track filled portion */}
          <Animated.View style={[styles.trackFilled, { backgroundColor: trackLeftColor }, filledTrackStyle]} />

          {/* Thumb */}
          <Animated.View style={[styles.thumbContainer, thumbStyle]}>
            {/* Magnified track clipped to pill shape */}
            <View style={styles.magnifyContainer}>
              <Animated.View style={[styles.magnifiedTrackWrapper, magnifiedTrackStyle]}>
                {/* Magnified unfilled track */}
                <Animated.View style={[styles.magnifiedTrack, { backgroundColor: trackRightColor }, magnifiedUnfilledStyle]} />
                {/* Magnified filled track */}
                <Animated.View style={[styles.magnifiedTrackFilled, { backgroundColor: trackLeftColor }, magnifiedFilledStyle]} />
              </Animated.View>
            </View>
            
            {/* SVG glass overlay with shadow */}
            <View style={styles.svgContainer}>
              <SvgXml
                xml={THUMB_SVG}
                width={SVG_WIDTH * SVG_SCALE}
                height={SVG_HEIGHT * SVG_SCALE}
              />
            </View>
          </Animated.View>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: CONTAINER_HEIGHT,
    justifyContent: 'center',
    overflow: 'visible',
  },
  touchArea: {
    height: CONTAINER_HEIGHT,
    justifyContent: 'center',
    overflow: 'visible',
  },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
  },
  trackFilled: {
    position: 'absolute',
    left: 0,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
  },
  thumbContainer: {
    position: 'absolute',
    left: 0,
    top: (CONTAINER_HEIGHT - THUMB_HEIGHT) / 2,
    width: THUMB_WIDTH,
    height: THUMB_HEIGHT,
    overflow: 'visible',
  },
  magnifyContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: THUMB_HEIGHT / 2,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  magnifiedTrackWrapper: {
    position: 'absolute',
    left: 0,
    width: 2000,
    height: MAGNIFIED_TRACK_HEIGHT,
  },
  magnifiedTrack: {
    position: 'absolute',
    height: MAGNIFIED_TRACK_HEIGHT,
  },
  magnifiedTrackFilled: {
    position: 'absolute',
    left: 0,
    height: MAGNIFIED_TRACK_HEIGHT,
  },
  svgContainer: {
    position: 'absolute',
    left: -PILL_X * SVG_SCALE,
    top: -PILL_Y * SVG_SCALE,
    overflow: 'visible',
  },
});

export default LiquidSlider;