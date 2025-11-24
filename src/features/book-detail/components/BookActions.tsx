import React from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { LibraryItem } from '@/core/types';
import { usePlayerStore } from '@/features/player';
import { Icon } from '@/shared/components/Icon';
import { theme } from '@/shared/theme';

interface BookActionsProps {
  book: LibraryItem;
}

export function BookActions({ book }: BookActionsProps) {
  const { loadBook } = usePlayerStore();
  const isFinished = book.userMediaProgress?.isFinished || false;
  const progress = book.userMediaProgress?.progress || 0;
  const hasProgress = progress > 0 && progress < 1;

  const handlePlay = async () => {
    try {
      await loadBook(book);
    } catch (error) {
      console.error('Failed to start playback:', error);
      Alert.alert('Playback Error', 'Failed to start playback. Please try again.');
    }
  };

  const handleDownload = () => {
    Alert.alert('Coming Soon', 'Offline downloads will be available in a future update.');
  };

  const handleMarkFinished = () => {
    Alert.alert('Coming Soon', 'Mark as finished will be fully implemented soon.');
  };

  const playButtonText = isFinished ? 'Play Again' : hasProgress ? 'Continue' : 'Play';

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.playButton} onPress={handlePlay} activeOpacity={0.8}>
        <Icon name="play" size={20} color="#FFFFFF" set="ionicons" />
        <Text style={styles.playButtonText}>{playButtonText}</Text>
      </TouchableOpacity>

      <View style={styles.secondaryRow}>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleDownload} activeOpacity={0.7}>
          <Icon name="download-outline" size={18} color={theme.colors.text.secondary} set="ionicons" />
          <Text style={styles.secondaryButtonText}>Download</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.secondaryButton, isFinished && styles.finishedButton]} 
          onPress={handleMarkFinished} 
          activeOpacity={0.7}
        >
          <Icon 
            name="checkmark" 
            size={18} 
            color={isFinished ? theme.colors.primary[500] : theme.colors.text.secondary} 
            set="ionicons" 
          />
          <Text style={[styles.secondaryButtonText, isFinished && styles.finishedButtonText]}>
            Finished
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: theme.spacing[5],
    paddingBottom: theme.spacing[5],
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary[500],
    borderRadius: theme.radius.large,
    paddingVertical: theme.spacing[4],
    marginBottom: theme.spacing[3],
    gap: theme.spacing[2],
    ...theme.elevation.small,
  },
  playButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: theme.spacing[3],
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.neutral[100],
    borderRadius: theme.radius.large,
    paddingVertical: theme.spacing[3],
    gap: theme.spacing[2],
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.text.secondary,
  },
  finishedButton: {
    backgroundColor: theme.colors.primary[50],
  },
  finishedButtonText: {
    color: theme.colors.primary[500],
  },
});