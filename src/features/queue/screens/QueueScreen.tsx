/**
 * src/features/queue/screens/QueueScreen.tsx
 *
 * Enhanced queue management screen with header stats, play next action,
 * and improved empty state.
 */

import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueue, useQueueStore } from '../stores/queueStore';
import { SwipeableQueueItem } from '../components/SwipeableQueueItem';
import { TOP_NAV_HEIGHT, SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { colors, scale, spacing, radius } from '@/shared/theme';

const ACCENT = colors.accent;

// Format duration to human readable
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function QueueScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const queue = useQueue();
  const removeFromQueue = useQueueStore((state) => state.removeFromQueue);
  const reorderQueue = useQueueStore((state) => state.reorderQueue);
  const clearQueue = useQueueStore((state) => state.clearQueue);

  // Calculate total duration
  const totalDuration = useMemo(() => {
    return queue.reduce((sum, item) => {
      const duration = (item.book.media as any)?.duration || 0;
      return sum + duration;
    }, 0);
  }, [queue]);

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleRemove = useCallback(
    (bookId: string) => {
      removeFromQueue(bookId);
    },
    [removeFromQueue]
  );

  const handlePlayNext = useCallback(
    (bookId: string, bookTitle: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Find current position
      const currentIndex = queue.findIndex((item) => item.bookId === bookId);
      if (currentIndex > 0) {
        // Move to position 0
        reorderQueue(currentIndex, 0);
      }
    },
    [queue, reorderQueue]
  );

  const handleClearAll = useCallback(() => {
    Alert.alert(
      'Clear Queue',
      `Remove all ${queue.length} book${queue.length !== 1 ? 's' : ''} from your queue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            clearQueue();
          },
        },
      ]
    );
  }, [queue.length, clearQueue]);

  const handleBrowseLibrary = useCallback(() => {
    navigation.navigate('Main', { screen: 'LibraryTab' });
  }, [navigation]);

  const handleBookPress = useCallback(
    (bookId: string) => {
      const item = queue.find((q) => q.bookId === bookId);
      if (item) {
        navigation.navigate('BookDetail', { book: item.book });
      }
    },
    [queue, navigation]
  );

  // Empty state
  if (queue.length === 0) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />

        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + TOP_NAV_HEIGHT + scale(12) }]}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="chevron-back" size={scale(24)} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Queue</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Empty State */}
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons name="headset-outline" size={scale(48)} color="rgba(255,255,255,0.3)" />
          </View>
          <Text style={styles.emptyTitle}>Nothing in your queue</Text>
          <Text style={styles.emptySubtitle}>
            Add books from your library to plan your listening journey.
          </Text>
          <TouchableOpacity style={styles.browseButton} onPress={handleBrowseLibrary}>
            <Text style={styles.browseButtonText}>Browse Library</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + TOP_NAV_HEIGHT + scale(12) }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="chevron-back" size={scale(24)} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Queue</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Stats Header */}
      <View style={styles.statsHeader}>
        <View style={styles.statsInfo}>
          <Text style={styles.statsText}>
            {queue.length} book{queue.length !== 1 ? 's' : ''} · {formatDuration(totalDuration)} total
          </Text>
        </View>
        <TouchableOpacity style={styles.clearButton} onPress={handleClearAll}>
          <Text style={styles.clearButtonText}>Clear Queue</Text>
        </TouchableOpacity>
      </View>

      {/* Queue list */}
      <FlatList
        data={queue}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => (
          <SwipeableQueueItem
            book={item.book}
            position={index}
            onRemove={() => handleRemove(item.bookId)}
            onPlayNext={() => handlePlayNext(item.bookId, (item.book.media?.metadata as any)?.title || 'Book')}
            onPress={() => handleBookPress(item.bookId)}
            showPlayNext={index > 0}
          />
        )}
        ListFooterComponent={
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Swipe left to remove · Tap ▲ to play next
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(16),
    paddingVertical: scale(12),
  },
  backButton: {
    width: scale(40),
    height: scale(40),
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    flex: 1,
    fontSize: scale(18),
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  headerSpacer: {
    width: scale(40),
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(16),
    paddingVertical: scale(12),
    marginHorizontal: scale(16),
    marginBottom: scale(8),
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: scale(10),
  },
  statsInfo: {
    flex: 1,
  },
  statsText: {
    fontSize: scale(14),
    color: 'rgba(255,255,255,0.7)',
  },
  clearButton: {
    paddingHorizontal: scale(12),
    paddingVertical: scale(6),
    backgroundColor: 'rgba(255,75,75,0.15)',
    borderRadius: scale(6),
  },
  clearButtonText: {
    fontSize: scale(13),
    fontWeight: '500',
    color: '#ff4b4b',
  },
  listContent: {
    paddingHorizontal: scale(16),
    paddingTop: scale(8),
    paddingBottom: SCREEN_BOTTOM_PADDING,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(40),
  },
  emptyIcon: {
    width: scale(80),
    height: scale(80),
    borderRadius: scale(40),
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: scale(20),
  },
  emptyTitle: {
    fontSize: scale(18),
    fontWeight: '600',
    color: '#fff',
    marginBottom: scale(8),
  },
  emptySubtitle: {
    fontSize: scale(14),
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: scale(20),
    marginBottom: scale(24),
  },
  browseButton: {
    paddingHorizontal: scale(24),
    paddingVertical: scale(12),
    backgroundColor: ACCENT,
    borderRadius: scale(20),
  },
  browseButtonText: {
    fontSize: scale(14),
    fontWeight: '600',
    color: '#000',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: scale(20),
  },
  footerText: {
    fontSize: scale(12),
    color: 'rgba(255,255,255,0.4)',
  },
});
