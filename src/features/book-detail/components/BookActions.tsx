/**
 * src/features/book-detail/components/BookActions.tsx
 *
 * Action buttons for playing, downloading, and marking book as finished.
 * All buttons show placeholder alerts for now (Stage 5 will implement).
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { LibraryItem } from '@/core/types';

interface BookActionsProps {
  book: LibraryItem;
}

/**
 * Display action buttons for the book
 */
export function BookActions({ book }: BookActionsProps) {
  const isFinished = book.userMediaProgress?.isFinished || false;

  /**
   * Handle play button press
   */
  const handlePlay = () => {
    console.log('Play button pressed for book:', book.id);
    Alert.alert(
      'Coming Soon',
      'Audio playback will be implemented in Stage 5!',
      [{ text: 'OK' }]
    );
  };

  /**
   * Handle download button press
   */
  const handleDownload = () => {
    console.log('Download button pressed for book:', book.id);
    Alert.alert(
      'Coming Soon',
      'Offline downloads will be implemented in a future update!',
      [{ text: 'OK' }]
    );
  };

  /**
   * Handle mark as finished button press
   */
  const handleMarkFinished = () => {
    console.log('Mark finished button pressed for book:', book.id);
    Alert.alert(
      'Coming Soon',
      'Progress tracking will be fully implemented in Stage 5!',
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={styles.container}>
      {/* Primary Action: Play */}
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={handlePlay}
        activeOpacity={0.8}
      >
        <Text style={styles.primaryButtonText}>
          {isFinished ? '▶ Play Again' : '▶ Play'}
        </Text>
      </TouchableOpacity>

      {/* Secondary Actions */}
      <View style={styles.secondaryActions}>
        {/* Download Button */}
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleDownload}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryButtonText}>⬇ Download</Text>
        </TouchableOpacity>

        {/* Mark Finished Button */}
        {!isFinished && (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleMarkFinished}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryButtonText}>✓ Mark Finished</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 0,
    backgroundColor: '#FFFFFF',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#333333',
    fontSize: 14,
    fontWeight: '600',
  },
});
