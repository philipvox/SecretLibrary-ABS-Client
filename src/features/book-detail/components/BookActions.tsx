/**
 * Book actions with updated design
 */

import React from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { LibraryItem } from '@/core/types';
import { usePlayerStore } from '@/features/player';
import { Button } from '@/shared/components';
import { theme } from '@/shared/theme';

interface BookActionsProps {
  book: LibraryItem;
}

export function BookActions({ book }: BookActionsProps) {
  const { loadBook } = usePlayerStore();
  const isFinished = book.userMediaProgress?.isFinished || false;

  const handlePlay = async () => {
    try {
      await loadBook(book);
    } catch (error) {
      console.error('Failed to start playback:', error);
      Alert.alert('Playback Error', 'Failed to start playback. Please try again.');
    }
  };

  const handleDownload = () => {
    Alert.alert(
      'Coming Soon',
      'Offline downloads will be implemented in a future update!',
      [{ text: 'OK' }]
    );
  };

  const handleMarkFinished = () => {
    Alert.alert(
      'Coming Soon',
      'Mark as finished will be fully implemented soon!',
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={styles.container}>
      <Button
        title={isFinished ? '▶ Play Again' : '▶ Play'}
        onPress={handlePlay}
        variant="primary"
        size="large"
        fullWidth
        style={styles.primaryButton}
      />

      <View style={styles.secondaryActions}>
        <Button
          title="⬇ Download"
          onPress={handleDownload}
          variant="secondary"
          size="medium"
          style={styles.secondaryButton}
        />

        {!isFinished && (
          <Button
            title="✓ Finished"
            onPress={handleMarkFinished}
            variant="secondary"
            size="medium"
            style={styles.secondaryButton}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing[5],
    paddingTop: 0,
    backgroundColor: theme.colors.background.primary,
  },
  primaryButton: {
    marginBottom: theme.spacing[3],
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: theme.spacing[3],
  },
  secondaryButton: {
    flex: 1,
  },
});