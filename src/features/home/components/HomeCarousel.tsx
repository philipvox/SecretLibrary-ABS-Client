/**
 * src/features/home/components/HomeCarousel.tsx
 * 
 * Carousel component that:
 * - Centers the active card on screen
 * - Active card at 100% scale, others at 80%
 * - Swipe to navigate between cards
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
Dimensions,
} from 'react-native';
import {
  GestureDetector,
  Gesture,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { LibraryItem } from '@/core/types';
import { HomeCard } from './HomeCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Card dimensions
const CARD_WIDTH = Math.min(340, SCREEN_WIDTH );
const SCALE_FACTOR = 0.8;
const GAP = 12;

interface HomeCarouselProps {
  books: Array<LibraryItem & {
    userMediaProgress?: {
      progress?: number;
      currentTime?: number;
      duration?: number;
    };
  }>;
  onBookSelect?: (book: LibraryItem) => void;
}

export function HomeCarousel({ books, onBookSelect }: HomeCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const translateX = useSharedValue(0);

  const updateIndex = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  const animateToIndex = useCallback((index: number) => {
    'worklet';
    // Each card takes up CARD_WIDTH + GAP, slide by that amount
    const offset = index * (CARD_WIDTH + GAP);
    translateX.value = withTiming(-offset, { duration: 400 });
    runOnJS(updateIndex)(index);
  }, [translateX, updateIndex]);

  const handleCardPress = useCallback((index: number) => {
    if (index !== currentIndex) {
      animateToIndex(index);
    } else if (onBookSelect) {
      onBookSelect(books[index]);
    }
  }, [currentIndex, animateToIndex, onBookSelect, books]);

  // Swipe gesture
  const panGesture = Gesture.Pan()
    .onEnd((event) => {
      'worklet';
      const threshold = 50;
      
      if (event.velocityX < -500 || event.translationX < -threshold) {
        if (currentIndex < books.length - 1) {
          runOnJS(animateToIndex)(currentIndex + 1);
        }
      } else if (event.velocityX > 500 || event.translationX > threshold) {
        if (currentIndex > 0) {
          runOnJS(animateToIndex)(currentIndex - 1);
        }
      }
    });

  const trackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  if (books.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.track, trackStyle]}>
          {books.map((book, index) => (
            <View
              key={book.id}
              style={[
                styles.cardWrapper,
                index > 0 && { marginLeft: GAP },
              ]}
            >
              <HomeCard
                book={book}
                isExpanded={index === currentIndex}
                onPress={() => handleCardPress(index)}
                index={index}
              />
            </View>
          ))}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    overflow: 'visible',
  },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardWrapper: {
    // Cards handle their own sizing
  },
});

export default HomeCarousel;