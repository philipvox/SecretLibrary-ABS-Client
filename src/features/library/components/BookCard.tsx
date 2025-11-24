/**
 * Book card - square covers in 3-column grid
 */

import React from 'react';
import { View, Text, Image, Pressable, StyleSheet, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LibraryItem } from '@/core/types';
import { apiClient } from '@/core/api';
import { theme } from '@/shared/theme';

interface BookCardProps {
  book: LibraryItem;
}

const SCREEN_PADDING = theme.spacing[5];
const CARD_GAP = theme.spacing[3];
const NUM_COLUMNS = 3;

const screenWidth = Dimensions.get('window').width;
const availableWidth = screenWidth - (SCREEN_PADDING * 2);
const totalGapWidth = CARD_GAP * (NUM_COLUMNS - 1);
const CARD_WIDTH = (availableWidth - totalGapWidth) / NUM_COLUMNS;
const CARD_HEIGHT = CARD_WIDTH; // Square 1:1 aspect ratio

export function BookCard({ book }: BookCardProps) {
  const navigation = useNavigation();
  
  const metadata = book.media.metadata;
  const title = metadata.title || 'Unknown Title';
  const author = metadata.authors?.[0]?.name || 'Unknown Author';
  
  const progress = book.userMediaProgress?.progress || 0;
  const hasProgress = progress > 0 && progress < 1;
  
  const coverUrl = apiClient.getItemCoverUrl(book.id);

  const handlePress = () => {
    navigation.navigate('BookDetail' as never, { bookId: book.id } as never);
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        { width: CARD_WIDTH },
        pressed && styles.pressed,
      ]}
      onPress={handlePress}
    >
      <View style={[styles.coverContainer, { width: CARD_WIDTH, height: CARD_HEIGHT }]}>
        <Image
          source={{ uri: coverUrl }}
          style={styles.cover}
          resizeMode="cover"
        />
        {hasProgress && (
          <View style={styles.progressIndicator}>
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
    marginBottom: theme.spacing[4],
  },
  pressed: {
    opacity: 0.75,
  },
  coverContainer: {
    position: 'relative',
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.neutral[200],
    overflow: 'hidden',
    ...theme.elevation.small,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  progressIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: theme.spacing[2],
  },
  progressBar: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: theme.radius.small,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary[500],
  },
  info: {
    marginTop: theme.spacing[2],
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: theme.spacing[1] / 2,
    lineHeight: 17,
  },
  author: {
    fontSize: 11,
    color: theme.colors.text.secondary,
    lineHeight: 14,
  },
});