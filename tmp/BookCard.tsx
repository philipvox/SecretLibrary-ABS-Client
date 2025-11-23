/**
 * src/features/library/components/BookCard.tsx
 *
 * Reusable book card component displaying cover, title, author, and progress.
 * Used in library grid and list views. Navigates to book detail screen on press.
 */

import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LibraryItem } from '@/core/types';
import { apiClient } from '@/core/api';

interface BookCardProps {
  book: LibraryItem;
}

/**
 * Display a book card with cover, title, author, and progress bar
 */
export function BookCard({ book }: BookCardProps) {
  const navigation = useNavigation();
  
  // Extract book metadata
  const metadata = book.media.metadata;
  const title = metadata.title || 'Unknown Title';
  const author = metadata.authors?.[0]?.name || 'Unknown Author';
  
  // Get progress (0-1)
  const progress = book.userMediaProgress?.progress || 0;
  const hasProgress = progress > 0 && progress < 1;
  
  // Get cover URL
  const coverUrl = apiClient.getItemCoverUrl(book.id);

  /**
   * Navigate to book detail screen
   */
  const handlePress = () => {
    navigation.navigate('BookDetail' as never, { bookId: book.id } as never);
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
      ]}
      onPress={handlePress}
    >
      <View style={styles.coverContainer}>
        <Image
          source={{ uri: coverUrl }}
          style={styles.cover}
          resizeMode="cover"
          // defaultSource={require('../../../../assets/placeholder-book.png')} // Placeholder for missing covers
        />
        {hasProgress && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
          </View>
        )}
      </View>
      
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.author} numberOfLines={1}>
          {author}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 150,
    marginBottom: 20,
  },
  pressed: {
    opacity: 0.7,
  },
  coverContainer: {
    position: 'relative',
    width: 150,
    height: 200,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
    overflow: 'hidden',
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
  },
  info: {
    marginTop: 8,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    lineHeight: 18,
    marginBottom: 4,
  },
  author: {
    fontSize: 12,
    color: '#666666',
    lineHeight: 16,
  },
});
