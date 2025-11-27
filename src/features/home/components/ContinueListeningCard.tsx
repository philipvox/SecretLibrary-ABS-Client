/**
 * src/features/home/components/ContinueListeningCard.tsx
 */

import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LibraryItem } from '@/core/types';
import { apiClient } from '@/core/api';
import { usePlayerStore } from '@/features/player';
import { LibraryHeartButton } from '@/features/library';
import { Icon } from '@/shared/components/Icon';
import { theme } from '@/shared/theme';
import { getTitle, getAuthorName } from '@/shared/utils/metadata';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 60) / 2.2;

interface ContinueListeningCardProps {
  book: LibraryItem & { 
    progressLastUpdate?: number;
    userMediaProgress?: {
      progress?: number;
      currentTime?: number;
    };
  };
}

export function ContinueListeningCard({ book }: ContinueListeningCardProps) {
  const navigation = useNavigation<any>();
  const { loadBook } = usePlayerStore();
  
  const coverUrl = apiClient.getItemCoverUrl(book.id);
  const title = getTitle(book);
  const author = getAuthorName(book);
  
  // Get progress - might be in userMediaProgress or we calculate from progressLastUpdate existence
  const progress = book.userMediaProgress?.progress ?? 0;
  const progressPercent = Math.round(progress * 100);

  const handlePress = () => {
    navigation.navigate('BookDetail', { bookId: book.id });
  };

  const handlePlay = async () => {
    try {
      await loadBook(book);
    } catch (err) {
      console.error('Failed to start playback:', err);
    }
  };

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.8}>
      <View style={styles.coverContainer}>
        <Image source={{ uri: coverUrl }} style={styles.cover} resizeMode="cover" />
        
        {/* Progress bar */}
        {progressPercent > 0 && (
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBar, { width: `${progressPercent}%` }]} />
          </View>
        )}

        {/* Play button */}
        <TouchableOpacity style={styles.playButton} onPress={handlePlay} activeOpacity={0.8}>
          <Icon name="play" size={20} color="#FFFFFF" set="ionicons" />
        </TouchableOpacity>

        {/* Heart button */}
        <View style={styles.heartPosition}>
          <LibraryHeartButton bookId={book.id} size="small" />
        </View>
      </View>

      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <Text style={styles.author} numberOfLines={1}>{author}</Text>
        {progressPercent > 0 && (
          <Text style={styles.progress}>{progressPercent}% complete</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
  },
  coverContainer: {
    width: CARD_WIDTH,
    height: CARD_WIDTH,
    borderRadius: theme.radius.medium,
    overflow: 'hidden',
    backgroundColor: theme.colors.neutral[200],
    marginBottom: theme.spacing[2],
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  progressBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  progressBar: {
    height: '100%',
    backgroundColor: theme.colors.primary[500],
  },
  playButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heartPosition: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  info: {
    paddingRight: theme.spacing[2],
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  author: {
    fontSize: 11,
    color: theme.colors.text.secondary,
    marginTop: 2,
  },
  progress: {
    fontSize: 10,
    color: theme.colors.primary[500],
    marginTop: 4,
    fontWeight: '500',
  },
});