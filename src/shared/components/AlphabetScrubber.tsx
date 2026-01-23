/**
 * src/shared/components/AlphabetScrubber.tsx
 *
 * iOS-style alphabet scrubber for A-Z list navigation.
 * Features:
 * - Tap-to-jump: tap any letter to instantly scroll to that section
 * - Drag scrubbing: drag finger along bar to quickly navigate
 * - Haptic feedback on letter changes
 * - Even distribution of letters
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  LayoutChangeEvent,
  Vibration,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { scale, useTheme } from '@/shared/theme';

interface AlphabetScrubberProps {
  /** Available letters to display */
  letters: string[];
  /** Currently active/highlighted letter */
  activeLetter?: string;
  /** Callback when a letter is selected */
  onLetterSelect: (letter: string) => void;
  /** Whether to show the scrubber */
  visible?: boolean;
  /** Style overrides */
  style?: object;
}

export function AlphabetScrubber({
  letters,
  activeLetter,
  onLetterSelect,
  visible = true,
  style,
}: AlphabetScrubberProps) {
  const { colors } = useTheme();
  const containerRef = useRef<View>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const lastLetterRef = useRef<string>('');

  // Calculate letter height for mapping touch position to letter
  const letterHeight = letters.length > 0 ? containerHeight / letters.length : 0;

  // Trigger haptic feedback
  const triggerHaptic = useCallback(() => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      Vibration.vibrate(5);
    }
  }, []);

  // Convert Y position to letter index
  const getLetterFromY = useCallback((y: number): string | null => {
    if (letterHeight === 0 || letters.length === 0) return null;
    const index = Math.floor(y / letterHeight);
    const clampedIndex = Math.max(0, Math.min(letters.length - 1, index));
    return letters[clampedIndex];
  }, [letters, letterHeight]);

  // Handle touch/drag events
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const y = evt.nativeEvent.locationY;
        const letter = getLetterFromY(y);
        if (letter && letter !== lastLetterRef.current) {
          lastLetterRef.current = letter;
          triggerHaptic();
          onLetterSelect(letter);
        }
      },
      onPanResponderMove: (evt) => {
        const y = evt.nativeEvent.locationY;
        const letter = getLetterFromY(y);
        if (letter && letter !== lastLetterRef.current) {
          lastLetterRef.current = letter;
          triggerHaptic();
          onLetterSelect(letter);
        }
      },
      onPanResponderRelease: () => {
        lastLetterRef.current = '';
      },
    })
  ).current;

  // Handle layout to calculate letter positions
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setContainerHeight(event.nativeEvent.layout.height);
  }, []);

  // Return empty View on Android to prevent SafeAreaProvider crash
  if (!visible || letters.length <= 1) {
    return Platform.OS === 'android' ? <View /> : null;
  }

  return (
    <View
      ref={containerRef}
      style={[styles.container, style]}
      onLayout={handleLayout}
      {...panResponder.panHandlers}
    >
      {letters.map((letter) => (
        <View
          key={letter}
          style={[
            styles.letterContainer,
            activeLetter === letter && { backgroundColor: colors.accent.primary, borderRadius: scale(12) },
          ]}
        >
          <Text
            style={[
              styles.letter,
              { color: colors.accent.primary },
              activeLetter === letter && { color: colors.background.primary },
            ]}
          >
            {letter}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 2,
    top: 8,
    width: 24,
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 100,
  },
  letterContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: 24,
    minHeight: 14,
  },
  letter: {
    fontSize: scale(10),
    fontWeight: '700',
  },
});
