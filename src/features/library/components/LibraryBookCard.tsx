/**
 * src/features/library/components/LibraryBookCard.tsx
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
import { useMyLibraryStore } from '../stores/myLibraryStore';
import { LibraryHeartButton } from './LibraryHeartButton';
import { Icon } from '@/shared/components/Icon';
import { theme } from '@/shared/theme';
import { getTitle, getAuthorName } from '@/shared/utils/metadata';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_SIZE = (SCREEN_WIDTH - 48 - 24) / 3;

interface LibraryBookCardProps {
  book: LibraryItem;
  showAddButton?: boolean;
}

export function LibraryBookCard({ book, showAddButton = false }: LibraryBookCardProps) {
  const navigation = useNavigation<any>();
  const { 
    isSelecting, 
    selectedIds, 
    toggleSelection, 
    startSelecting,
  } = useMyLibraryStore();

  const coverUrl = apiClient.getItemCoverUrl(book.id);
  const title = getTitle(book);
  const author = getAuthorName(book);
  const isSelected = selectedIds.includes(book.id);

  const handlePress = () => {
    if (isSelecting) {
      toggleSelection(book.id);
    } else {
      navigation.navigate('BookDetail', { bookId: book.id });
    }
  };

  const handleLongPress = () => {
    if (!isSelecting) {
      startSelecting();
      toggleSelection(book.id);
    }
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      onLongPress={handleLongPress}
      activeOpacity={0.7}
      delayLongPress={300}
    >
      <View style={styles.coverContainer}>
        <Image
          source={{ uri: coverUrl }}
          style={styles.cover}
          resizeMode="cover"
        />
        
        {/* Selection checkbox */}
        {isSelecting && (
          <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
            {isSelected && (
              <Icon name="checkmark" size={14} color="#FFFFFF" set="ionicons" />
            )}
          </View>
        )}

        {/* Add to library button */}
        {showAddButton && !isSelecting && (
          <View style={styles.heartPosition}>
            <LibraryHeartButton bookId={book.id} size="medium" />
          </View>
        )}
      </View>

      <Text style={styles.title} numberOfLines={1}>{title}</Text>
      <Text style={styles.author} numberOfLines={1}>{author}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: CARD_SIZE,
  },
  coverContainer: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: theme.radius.medium,
    overflow: 'hidden',
    backgroundColor: theme.colors.neutral[200],
    marginBottom: theme.spacing[2],
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  checkbox: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 2,
    borderColor: theme.colors.neutral[400],
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: theme.colors.primary[500],
    borderColor: theme.colors.primary[500],
  },
  heartPosition: {
    position: 'absolute',
    bottom: 8,
    right: 8,
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  author: {
    fontSize: 10,
    color: theme.colors.text.secondary,
    marginTop: 2,
  },
});