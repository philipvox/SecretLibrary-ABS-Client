/**
 * src/features/book-detail/components/BookHeader.tsx
 *
 * Hero section displaying book cover, title, author, narrator, and progress.
 */

import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LibraryItem } from '@/core/types';
import { apiClient } from '@/core/api';

interface BookHeaderProps {
  book: LibraryItem;
}

/**
 * Display book cover and primary information
 */
export function BookHeader({ book }: BookHeaderProps) {
  const metadata = book.media.metadata;
  const title = metadata.title || 'Unknown Title';
  const author = metadata.authors?.[0]?.name || 'Unknown Author';
  const narrator = metadata.narrators?.[0] || null;
  
  // Get progress
  const progress = book.userMediaProgress?.progress || 0;
  const hasProgress = progress > 0;
  
  // Get cover URL
  const coverUrl = apiClient.getItemCoverUrl(book.id);

  return (
    <View style={styles.container}>
      {/* Cover Image */}
      <View style={styles.coverContainer}>
        <Image
          source={{ uri: coverUrl }}
          style={styles.cover}
          resizeMode="cover"
        />
      </View>

      {/* Title and Author */}
      <View style={styles.infoContainer}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.author}>{author}</Text>
        {narrator && <Text style={styles.narrator}>Narrated by {narrator}</Text>}

        {/* Progress Bar */}
        {hasProgress && (
          <View style={styles.progressSection}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
            <Text style={styles.progressText}>{Math.round(progress * 100)}% Complete</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  coverContainer: {
    width: 250,
    height: 350,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
    overflow: 'hidden',
    marginBottom: 20,
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    elevation: 5,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  infoContainer: {
    width: '100%',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 32,
  },
  author: {
    fontSize: 18,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 4,
  },
  narrator: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
    marginBottom: 16,
  },
  progressSection: {
    width: '100%',
    marginTop: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
  },
  progressText: {
    fontSize: 12,
    color: '#888888',
    textAlign: 'center',
  },
});
