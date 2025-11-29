/**
 * src/features/player/components/liquid-glass/LiquidGlassSlider.tsx
 * iOS 26 Liquid Glass slider with visible refraction distortion
 */

import React, { useCallback } from 'react';
import { StyleSheet, View, Text, LayoutChangeEvent } from 'react-native';
import {
  Canvas,
  RoundedRect,
  vec,
  LinearGradient,
  Group,
  BackdropFilter,
  RuntimeShader,
  Skia,
} from '@shopify/react-native-skia';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
  runOnJS,
  clamp,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

// Liquid Glass Refraction Shader with visible distortion
const LIQUID_GLASS_SHADER = Skia.RuntimeEffect.Make(`
uniform shader image;
uniform vec2 uSize;
uniform float uRadius;
uniform float uRefraction;
uniform float uAberration;

// SDF for rounded rectangle / pill
float sdRoundedBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

half4 main(vec2 xy) {
  vec2 uv = xy / uSize;
  vec2 center = vec2(0.5, 0.5);
  vec2 p = uv - center;
  
  // Pill shape
  float r = uRadius;
  vec2 boxSize = vec2(0.5 - r, 0.5 - r);
  float d = sdRoundedBox(p, boxSize, r);
  
  // Inside mask
  float inside = 1.0 - smoothstep(-0.005, 0.005, d);
  
  // Distance from center (0 at center, 1 at edge)
  float distFromCenter = length(p) * 2.0;
  
  // Lens distortion - parabolic falloff creates magnification
  // Stronger at edges, pulling inward (barrel distortion)
  float lensStrength = (1.0 - distFromCenter * distFromCenter) * uRefraction;
  
  // Direction from center
  vec2 dir = normalize(p + 0.0001);
  
  // Offset pulls samples toward center = magnification effect
  vec2 offset = dir * lensStrength * 0.08;
  
  // Chromatic aberration - split RGB
  vec2 offsetR = offset * (1.0 + uAberration * 0.5);
  vec2 offsetG = offset;
  vec2 offsetB = offset * (1.0 - uAberration * 0.5);
  
  // Sample backdrop with distortion
  vec2 sampleR = xy - offsetR * uSize;
  vec2 sampleG = xy - offsetG * uSize;
  vec2 sampleB = xy - offsetB * uSize;
  
  float red = image.eval(sampleR).r;
  float green = image.eval(sampleG).g;
  float blue = image.eval(sampleB).b;
  
  vec3 col = vec3(red, green, blue);
  
  // Brightness boost in center (light focusing)
  float centerBright = (1.0 - distFromCenter * 0.5) * inside * 0.12;
  col += centerBright;
  
  // Edge fresnel highlight
  float edge = smoothstep(0.1, 0.0, abs(d)) * inside;
  float fresnel = pow(edge, 1.5) * 0.2;
  col += fresnel;
  
  // Top specular highlight
  float topLight = smoothstep(0.2, -0.25, p.y) * inside * 0.12;
  col += topLight;
  
  return half4(col, 1.0);
}
`)!;

interface LiquidGlassSliderProps {
  value: number;
  onValueChange: (value: number) => void;
  minimumValue?: number;
  maximumValue?: number;
  step?: number;
  thumbWidth?: number;
  thumbHeight?: number;
  trackHeight?: number;
  tint?: 'light' | 'dark';
  labels?: { value: number; label: string }[];
}

const THUMB_WIDTH = 48;
const THUMB_HEIGHT = 32;
const TRACK_HEIGHT = 4;

export function LiquidGlassSlider({
  value,
  onValueChange,
  minimumValue = 0,
  maximumValue = 1,
  step = 0.05,
  thumbWidth = THUMB_WIDTH,
  thumbHeight = THUMB_HEIGHT,
  trackHeight = TRACK_HEIGHT,
  tint = 'light',
  labels,
}: LiquidGlassSliderProps) {
  const isLight = tint === 'light';
  const trackWidth = useSharedValue(280);
  const thumbX = useSharedValue(0);
  const pressed = useSharedValue(false);
  const thumbScale = useSharedValue(1);
  const startX = useSharedValue(0);

  const trackBg = isLight ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)';
  const trackFill = isLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)';
  const labelColor = isLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)';

  const updateValue = useCallback((newValue: number) => {
    onValueChange(newValue);
  }, [onValueChange]);

  const valueToPosition = (val: number, width: number) => {
    'worklet';
    const percent = (val - minimumValue) / (maximumValue - minimumValue);
    return percent * (width - thumbWidth);
  };

  const positionToValue = (pos: number, width: number) => {
    'worklet';
    const percent = clamp(pos / (width - thumbWidth), 0, 1);
    const rawValue = minimumValue + percent * (maximumValue - minimumValue);
    return Math.round(rawValue / step) * step;
  };

  React.useEffect(() => {
    const newPos = valueToPosition(value, trackWidth.value);
    thumbX.value = withSpring(newPos, { damping: 20, stiffness: 300 });
  }, [value]);

  const gesture = Gesture.Pan()
    .onBegin(() => {
      pressed.value = true;
      thumbScale.value = withSpring(1.05, { damping: 15, stiffness: 400 });
      startX.value = thumbX.value;
    })
    .onUpdate((e) => {
      const newX = clamp(
        startX.value + e.translationX,
        0,
        trackWidth.value - thumbWidth
      );
      thumbX.value = newX;
      const newValue = positionToValue(newX, trackWidth.value);
      runOnJS(updateValue)(newValue);
    })
    .onEnd(() => {
      pressed.value = false;
      thumbScale.value = withSpring(1, { damping: 15, stiffness: 400 });
    });

  const thumbAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: thumbX.value },
      { scale: thumbScale.value },
    ],
  }));

  const fillWidth = useDerivedValue(() => thumbX.value + thumbWidth / 2);

  const onLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    trackWidth.value = width;
    thumbX.value = valueToPosition(value, width);
  };

  const pillRadius = thumbHeight / 2;

  // Shader uniforms - increased refraction for visible effect
  const shaderUniforms = {
    uSize: vec(thumbWidth, thumbHeight),
    uRadius: pillRadius / thumbHeight,
    uRefraction: 1.0,      // Lens strength
    uAberration: 0.4,      // Chromatic aberration
  };

  return (
    <View style={styles.container} onLayout={onLayout}>
      {/* Track */}
      <View style={[styles.trackContainer, { height: thumbHeight }]}>
        <Canvas style={[styles.track, { height: trackHeight }]}>
          <RoundedRect
            x={0}
            y={0}
            width={trackWidth}
            height={trackHeight}
            r={trackHeight / 2}
            color={trackBg}
          />
          <RoundedRect
            x={0}
            y={0}
            width={fillWidth}
            height={trackHeight}
            r={trackHeight / 2}
            color={trackFill}
          />
        </Canvas>

        {/* Liquid Glass Thumb */}
        <GestureDetector gesture={gesture}>
          <Animated.View style={[styles.thumbWrapper, thumbAnimatedStyle]}>
            <View style={[styles.thumbOuter, { width: thumbWidth, height: thumbHeight }]}>
              <Canvas style={StyleSheet.absoluteFill}>
                {/* BackdropFilter with refraction shader */}
                <BackdropFilter
                  clip={{ x: 0, y: 0, width: thumbWidth, height: thumbHeight }}
                  filter={
                    <RuntimeShader
                      source={LIQUID_GLASS_SHADER}
                      uniforms={shaderUniforms}
                    />
                  }
                >
                  <RoundedRect
                    x={0}
                    y={0}
                    width={thumbWidth}
                    height={thumbHeight}
                    r={pillRadius}
                    color="rgba(255,255,255,0.01)"
                  />
                </BackdropFilter>

                {/* Top highlight arc */}
                <RoundedRect
                  x={3}
                  y={1.5}
                  width={thumbWidth - 6}
                  height={thumbHeight * 0.38}
                  r={(thumbHeight * 0.38) / 2}
                >
                  <LinearGradient
                    start={vec(thumbWidth / 2, 0)}
                    end={vec(thumbWidth / 2, thumbHeight * 0.38)}
                    colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
                  />
                </RoundedRect>

                {/* Subtle edge border */}
                <RoundedRect
                  x={0.5}
                  y={0.5}
                  width={thumbWidth - 1}
                  height={thumbHeight - 1}
                  r={pillRadius - 0.5}
                  style="stroke"
                  strokeWidth={0.5}
                  color="rgba(255,255,255,0.35)"
                />
              </Canvas>
            </View>
          </Animated.View>
        </GestureDetector>
      </View>

      {/* Labels */}
      {labels && (
        <View style={styles.labelsContainer}>
          {labels.map((item) => (
            <Text key={item.value} style={[styles.label, { color: labelColor }]}>
              {item.label}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  trackContainer: {
    justifyContent: 'center',
  },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    marginTop: -TRACK_HEIGHT / 2,
  },
  thumbWrapper: {
    position: 'absolute',
    top: 0,
  },
  thumbOuter: {
    borderRadius: THUMB_HEIGHT / 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  labelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingHorizontal: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
  },
});