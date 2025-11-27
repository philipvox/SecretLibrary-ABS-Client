/**
 * src/features/browse/components/BrowseBookCard.tsx
 * 
 * Book card for browse/discover with add to library button
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
import { useMyLibraryStore } from '@/features/library';
import { Icon } from '@/shared/components/Icon';
import { theme } from '@/shared/theme';
import { getTitle, getAuthorName } from '@/shared/utils/metadata';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_SIZE = (SCREEN_WIDTH - 48 - 24) / 3;

interface BrowseBookCardProps {
  book: LibraryItem;
}

export function BrowseBookCard({ book }: BrowseBookCardProps) {
  const navigation = useNavigation<any>();
  const { isInLibrary, addToLibrary, removeFromLibrary } = useMyLibraryStore();

  const coverUrl = apiClient.getItemCoverUrl(book.id);
  const title = getTitle(book);
  const author = getAuthorName(book);
  const inLibrary = isInLibrary(book.id);

  const handlePress = () => {
    navigation.navigate('BookDetail', { bookId: book.id });
  };

  const handleAddPress = () => {
    if (inLibrary) {
      removeFromLibrary(book.id);
    } else {
      addToLibrary(book.id);
    }
  };

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={0.7}>
      <View style={styles.coverContainer}>
        <Image source={{ uri: coverUrl }} style={styles.cover} resizeMode="cover" />
        
        // Update the icon in the add button:

        <TouchableOpacity 
          style={styles.addButton}
          onPress={handleAddPress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon 
            name={inLibrary ? "heart" : "heart-outline"} 
            size={16} 
            color={inLibrary ? "#EF4444" : theme.colors.text.secondary} 
            set="ionicons" 
          />
        </TouchableOpacity>
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
  addButton: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  addButtonActive: {
    backgroundColor: theme.colors.primary[500],
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