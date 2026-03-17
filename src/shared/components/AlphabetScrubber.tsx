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
import { usePlayerStore } from '@/features/player';
import { GLOBAL_MINI_PLAYER_HEIGHT } from '@/navigation/components/GlobalMiniPlayer';
import { BOTTOM_NAV_HEIGHT } from '@/constants/layout';

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
  const hasMiniPlayer = usePlayerStore((s) => !!s.currentBook);

  // Use refs so PanResponder always accesses latest values
  const lettersRef = useRef(letters);
  lettersRef.current = letters;
  const containerHeightRef = useRef(containerHeight);
  containerHeightRef.current = containerHeight;
  const onLetterSelectRef = useRef(onLetterSelect);
  onLetterSelectRef.current = onLetterSelect;

  // Trigger haptic feedback
  const triggerHaptic = useCallback(() => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      Vibration.vibrate(5);
    }
  }, []);

  // Convert Y position to letter index (uses refs for fresh values)
  const getLetterFromY = useCallback((y: number): string | null => {
    const currentLetters = lettersRef.current;
    const height = containerHeightRef.current;
    const letterH = currentLetters.length > 0 ? height / currentLetters.length : 0;
    if (letterH === 0 || currentLetters.length === 0) return null;
    const index = Math.floor(y / letterH);
    const clampedIndex = Math.max(0, Math.min(currentLetters.length - 1, index));
    return currentLetters[clampedIndex];
  }, []);

  // Handle touch/drag events — stable because getLetterFromY uses refs
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
          onLetterSelectRef.current(letter);
        }
      },
      onPanResponderMove: (evt) => {
        const y = evt.nativeEvent.locationY;
        const letter = getLetterFromY(y);
        if (letter && letter !== lastLetterRef.current) {
          lastLetterRef.current = letter;
          triggerHaptic();
          onLetterSelectRef.current(letter);
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
      style={[styles.container, hasMiniPlayer && { bottom: GLOBAL_MINI_PLAYER_HEIGHT + BOTTOM_NAV_HEIGHT }, style]}
      onLayout={handleLayout}
      {...panResponder.panHandlers}
    >
      {letters.map((letter) => {
        const isActive = activeLetter === letter;
        return (
          <View
            key={letter}
            style={[
              styles.letterContainer,
              isActive && styles.activeLetterContainer,
            ]}
          >
            <Text
              style={[
                styles.letter,
                { color: 'rgba(255,255,255,0.5)' },
                isActive && styles.activeLetter,
              ]}
            >
              {letter}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 2,
    top: 0,
    bottom: 0,
    width: 24,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  letterContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: 22,
  },
  activeLetterContainer: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 11,
  },
  letter: {
    fontSize: scale(9),
    fontWeight: '600',
  },
  activeLetter: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
