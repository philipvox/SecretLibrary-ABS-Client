/**
 * src/features/book-detail/components/StarRatingSheet.tsx
 *
 * Bottom sheet for selecting a 1-5 star rating.
 * Uses gold star PNG stickers as the rating icons.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scale, useSecretLibraryColors } from '@/shared/theme';

// Star PNG for the rating row
const STAR_IMAGE = require('@assets/stars/star1.png');

interface StarRatingSheetProps {
  visible: boolean;
  currentRating: number | null;
  onSubmit: (rating: number) => void;
  onClose: () => void;
}

export function StarRatingSheet({ visible, currentRating, onSubmit, onClose }: StarRatingSheetProps) {
  const insets = useSafeAreaInsets();
  const colors = useSecretLibraryColors();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [selectedRating, setSelectedRating] = useState<number>(currentRating || 0);

  // Reset selection when sheet opens
  useEffect(() => {
    if (visible) {
      setSelectedRating(currentRating || 0);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 12 }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const handleClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start(() => onClose());
  }, [onClose, slideAnim, fadeAnim]);

  const handleStarPress = useCallback((index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedRating(index);
  }, []);

  const handleSubmit = useCallback(() => {
    if (selectedRating < 1) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSubmit(selectedRating);
    handleClose();
  }, [selectedRating, onSubmit, handleClose]);

  const handleClear = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSubmit(0);
    handleClose();
  }, [onSubmit, handleClose]);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });

  const starSize = scale(44);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
          <TouchableWithoutFeedback>
            <Animated.View
              style={[
                styles.sheet,
                {
                  backgroundColor: colors.isDark ? '#1a1a1a' : '#FFFFFF',
                  transform: [{ translateY }],
                  paddingBottom: insets.bottom + scale(16),
                },
              ]}
            >
              {/* Handle bar */}
              <View style={[styles.handleBar, { backgroundColor: colors.isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }]} />

              {/* Title */}
              <Text style={[styles.title, { color: colors.black }]}>
                Rate this book
              </Text>

              {/* Star row */}
              <View style={styles.starRow}>
                {[1, 2, 3, 4, 5].map((index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => handleStarPress(index)}
                    style={styles.starTouchable}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                  >
                    <Image
                      source={STAR_IMAGE}
                      style={{
                        width: starSize,
                        height: starSize,
                        opacity: index <= selectedRating ? 1 : 0.2,
                      }}
                      contentFit="contain"
                    />
                  </TouchableOpacity>
                ))}
              </View>

              {/* Buttons */}
              <View style={styles.buttonRow}>
                {currentRating && currentRating > 0 ? (
                  <TouchableOpacity
                    style={[styles.clearButton, { borderColor: colors.isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }]}
                    onPress={handleClear}
                  >
                    <Text style={[styles.clearButtonText, { color: colors.gray }]}>
                      Clear
                    </Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    { opacity: selectedRating < 1 ? 0.4 : 1 },
                  ]}
                  onPress={handleSubmit}
                  disabled={selectedRating < 1}
                >
                  <Text style={styles.submitButtonText}>
                    Submit
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: scale(16),
    borderTopRightRadius: scale(16),
    padding: scale(20),
    paddingTop: scale(12),
    alignItems: 'center',
  },
  handleBar: {
    width: scale(36),
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: scale(16),
  },
  title: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: scale(20),
    fontWeight: '400',
    marginBottom: scale(20),
  },
  starRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: scale(8),
    marginBottom: scale(24),
  },
  starTouchable: {
    padding: scale(4),
  },
  buttonRow: {
    flexDirection: 'row',
    gap: scale(12),
    alignSelf: 'stretch',
  },
  clearButton: {
    flex: 1,
    paddingVertical: scale(12),
    borderRadius: scale(8),
    alignItems: 'center',
    borderWidth: 1,
  },
  clearButtonText: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: scale(13),
    fontWeight: '500',
  },
  submitButton: {
    flex: 2,
    backgroundColor: '#F3B60C',
    paddingVertical: scale(12),
    borderRadius: scale(8),
    alignItems: 'center',
  },
  submitButtonText: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    fontSize: scale(13),
    fontWeight: '600',
    color: '#000000',
  },
});
