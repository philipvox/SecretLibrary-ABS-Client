/**
 * src/features/queue/components/SwipeableQueueItem.tsx
 *
 * Enhanced swipeable queue item with delete and play next actions.
 * Swipe left to reveal remove button.
 * Tap ▲ button to move to top of queue.
 */

import React, { useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, TouchableOpacity, Animated as RNAnimated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCoverUrl } from '@/core/cache';
import { LibraryItem } from '@/core/types';
import { colors, scale } from '@/shared/theme';

const ACTION_WIDTH = 80;
const ACCENT = colors.accent;

interface SwipeableQueueItemProps {
  book: LibraryItem;
  position: number;
  onRemove: () => void;
  onPlayNext?: () => void;
  onPress?: () => void;
  showPlayNext?: boolean;
}

export function SwipeableQueueItem({
  book,
  position,
  onRemove,
  onPlayNext,
  onPress,
  showPlayNext = true,
}: SwipeableQueueItemProps) {
  const swipeableRef = useRef<Swipeable>(null);
  const coverUrl = useCoverUrl(book.id);
  const metadata = book.media?.metadata as any;
  const title = metadata?.title || 'Untitled';
  const author = metadata?.authorName || metadata?.authors?.[0]?.name || 'Unknown Author';

  // Calculate duration using consistent format
  const duration = (book.media as any)?.duration || 0;
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  const durationText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  // Subtitle in "Author · Duration" format
  const subtitle = duration > 0 ? `${author} · ${durationText}` : author;

  const handleRemove = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    swipeableRef.current?.close();
    onRemove();
  }, [onRemove]);

  const handlePlayNext = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPlayNext?.();
  }, [onPlayNext]);

  const renderRightActions = useCallback(
    (
      progress: RNAnimated.AnimatedInterpolation<number>,
      dragX: RNAnimated.AnimatedInterpolation<number>
    ) => {
      const translateX = dragX.interpolate({
        inputRange: [-ACTION_WIDTH, 0],
        outputRange: [0, ACTION_WIDTH],
        extrapolate: 'clamp',
      });

      const opacity = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1],
      });

      return (
        <RNAnimated.View
          style={[styles.rightAction, { transform: [{ translateX }], opacity }]}
        >
          <Pressable style={styles.removeAction} onPress={handleRemove}>
            <Ionicons name="trash-outline" size={scale(22)} color="#fff" />
            <Text style={styles.actionText}>Remove</Text>
          </Pressable>
        </RNAnimated.View>
      );
    },
    [handleRemove]
  );

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      rightThreshold={40}
      overshootRight={false}
      friction={2}
      onSwipeableWillOpen={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
    >
      <Pressable style={styles.container} onPress={onPress}>
        {/* Drag handle */}
        <View style={styles.dragHandle}>
          <Ionicons name="menu" size={scale(18)} color="rgba(255,255,255,0.4)" />
        </View>

        {/* Cover */}
        <Image source={coverUrl} style={styles.cover} contentFit="cover" />

        {/* Info */}
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          {showPlayNext && onPlayNext ? (
            <TouchableOpacity
              style={styles.playNextButton}
              onPress={handlePlayNext}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="arrow-up" size={scale(16)} color={ACCENT} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={styles.removeButton}
            onPress={handleRemove}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close" size={scale(18)} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        </View>
      </Pressable>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(10),
    paddingHorizontal: scale(12),
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: scale(12),
    marginBottom: scale(8),
    gap: scale(10),
  },
  dragHandle: {
    padding: scale(4),
  },
  cover: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(6),
    backgroundColor: '#262626',
  },
  info: {
    flex: 1,
  },
  title: {
    fontSize: scale(14),
    fontWeight: '500',
    color: '#fff',
    marginBottom: scale(2),
  },
  subtitle: {
    fontSize: scale(12),
    color: 'rgba(255,255,255,0.6)',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  playNextButton: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    backgroundColor: 'rgba(193,244,12,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButton: {
    width: scale(32),
    height: scale(32),
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightAction: {
    width: ACTION_WIDTH,
    marginBottom: scale(8),
  },
  removeAction: {
    flex: 1,
    backgroundColor: '#ff4b4b',
    justifyContent: 'center',
    alignItems: 'center',
    borderTopRightRadius: scale(12),
    borderBottomRightRadius: scale(12),
  },
  actionText: {
    fontSize: scale(11),
    fontWeight: '500',
    color: '#fff',
    marginTop: 4,
  },
});

export default SwipeableQueueItem;
