/**
 * src/shared/components/ZoomableCoverModal.tsx
 *
 * Fullscreen cover zoom modal with pinch-to-zoom and two-finger pan.
 * Triggered by pinch gesture on a cover image, displays the cover
 * in a fullscreen overlay with interactive zoom controls.
 */

import React, { useCallback } from 'react';
import { Modal, View, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  clamp,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';

interface ZoomableCoverModalProps {
  visible: boolean;
  coverUrl: string | null;
  onClose: () => void;
}

// Gentle spring — settles quickly with minimal overshoot
const SPRING_CONFIG = { damping: 28, stiffness: 300, mass: 0.8 };
const MIN_SCALE = 1;
const MAX_SCALE = 3;

export function ZoomableCoverModal({ visible, coverUrl, onClose }: ZoomableCoverModalProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const coverSize = Math.min(screenWidth, screenHeight * 0.8);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Clamp translation so the image edge can't go past the screen center
  const clampTranslation = useCallback(() => {
    'worklet';
    const maxX = (coverSize * scale.value - coverSize) / 2;
    const maxY = (coverSize * scale.value - coverSize) / 2;
    translateX.value = clamp(translateX.value, -Math.max(maxX, 0), Math.max(maxX, 0));
    translateY.value = clamp(translateY.value, -Math.max(maxY, 0), Math.max(maxY, 0));
    savedTranslateX.value = translateX.value;
    savedTranslateY.value = translateY.value;
  }, [coverSize]);

  const resetTransform = useCallback(() => {
    'worklet';
    scale.value = withSpring(1, SPRING_CONFIG);
    translateX.value = withSpring(0, SPRING_CONFIG);
    translateY.value = withSpring(0, SPRING_CONFIG);
    savedScale.value = 1;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }, []);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      'worklet';
      const newScale = savedScale.value * e.scale;
      // Allow slight pinch below 1 for rubber-band feel, hard cap at MAX
      scale.value = Math.min(Math.max(newScale, MIN_SCALE * 0.8), MAX_SCALE);
    })
    .onEnd(() => {
      'worklet';
      if (scale.value < MIN_SCALE) {
        // Animate back to 1x, then close when spring settles
        translateX.value = withSpring(0, SPRING_CONFIG);
        translateY.value = withSpring(0, SPRING_CONFIG);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        scale.value = withSpring(1, SPRING_CONFIG, (finished) => {
          if (finished) runOnJS(onClose)();
        });
      } else if (scale.value > MAX_SCALE) {
        scale.value = withSpring(MAX_SCALE, SPRING_CONFIG);
        savedScale.value = MAX_SCALE;
        clampTranslation();
      } else {
        savedScale.value = scale.value;
        clampTranslation();
      }
    });

  // Two-finger pan — only active when zoomed in
  const panGesture = Gesture.Pan()
    .minPointers(2)
    .onUpdate((e) => {
      'worklet';
      if (scale.value > 1) {
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
      }
    })
    .onEnd(() => {
      'worklet';
      clampTranslation();
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      'worklet';
      if (scale.value > 1.2) {
        // Animate back to 1x, then close
        translateX.value = withSpring(0, SPRING_CONFIG);
        translateY.value = withSpring(0, SPRING_CONFIG);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        scale.value = withSpring(1, SPRING_CONFIG, (finished) => {
          if (finished) runOnJS(onClose)();
        });
      } else {
        // Zoom to 2x — modest, comfortable zoom
        scale.value = withSpring(2, SPRING_CONFIG);
        savedScale.value = 2;
      }
    });

  const composedGesture = Gesture.Simultaneous(
    pinchGesture,
    panGesture,
    doubleTapGesture,
  );

  const animatedImageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const handleClose = useCallback(() => {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    onClose();
  }, [onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={styles.root}>
        <Pressable style={styles.backdrop} onPress={handleClose}>
          <View style={styles.container}>
            <GestureDetector gesture={composedGesture}>
              <Animated.View style={[styles.imageWrap, animatedImageStyle]}>
                <Pressable onPress={(e) => e.stopPropagation()}>
                  <Image
                    source={coverUrl ? { uri: coverUrl } : undefined}
                    style={{ width: coverSize, height: coverSize }}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                  />
                </Pressable>
              </Animated.View>
            </GestureDetector>
          </View>
        </Pressable>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.80)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
