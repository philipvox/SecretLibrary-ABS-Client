/**
 * src/features/library/components/LibraryBookCard.tsx
 * 
 * Library book card with:
 * - Extracted palette color background
 * - Cover image at low opacity
 * - Author, title, play button
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ImageBackground,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getColors } from 'react-native-image-colors';
import { LibraryItem } from '@/core/types';
import { apiClient } from '@/core/api';
import { usePlayerStore } from '@/features/player';
import { useMyLibraryStore } from '../stores/myLibraryStore';
import { Icon } from '@/shared/components/Icon';
import { getTitle, getAuthorName } from '@/shared/utils/metadata';
import { matchToPalette } from '@/shared/utils/colorPalette';
import { isColorLight, pickMostSaturated } from '@/features/player/utils';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GAP = 5;
const NUM_COLUMNS = 3;
const CARD_SIZE = (SCREEN_WIDTH - GAP * (NUM_COLUMNS + 1)) / NUM_COLUMNS;
const CARD_RADIUS = 5;

interface LibraryBookCardProps {
  book: LibraryItem;
}

function useExtractedColor(imageUrl: string, bookId: string) {
  const [bgColor, setBgColor] = useState('#2a2a3e');
  const [textIsLight, setTextIsLight] = useState(false);
  
  useEffect(() => {
    if (!imageUrl) return;
    let mounted = true;
    
    const extractColors = async () => {
      try {
        const result = await getColors(imageUrl, { 
          fallback: '#2a2a3e', 
          cache: true, 
          key: bookId 
        });
        
        if (!mounted) return;
        
        let dominant = '#2a2a3e';
        
        if (result.platform === 'ios') {
          dominant = result.detail || result.primary || result.secondary || '#2a2a3e';
        } else if (result.platform === 'android') {
          const candidates = [
            result.vibrant,
            result.darkVibrant, 
            result.lightVibrant,
            result.muted,
            result.darkMuted,
            result.lightMuted,
            result.dominant,
          ];
          dominant = pickMostSaturated(candidates) || result.dominant || '#2a2a3e';
        }
        
        const paletteHex = matchToPalette(dominant);
        setBgColor(paletteHex);
        setTextIsLight(isColorLight(paletteHex));
      } catch (err) {
        // Silent fail
      }
    };
      
    extractColors();
    return () => { mounted = false; };
  }, [imageUrl, bookId]);
  
  return { bgColor, textIsLight };
}

export function LibraryBookCard({ book }: LibraryBookCardProps) {
  const navigation = useNavigation<any>();
  const { loadBook, currentBook, isPlaying } = usePlayerStore();
  const { isSelecting, selectedIds, toggleSelection, startSelecting } = useMyLibraryStore();

  const coverUrl = apiClient.getItemCoverUrl(book.id);
  const title = getTitle(book);
  const author = getAuthorName(book);
  const isSelected = selectedIds.includes(book.id);
  const isThisPlaying = currentBook?.id === book.id && isPlaying;

  const { bgColor, textIsLight } = useExtractedColor(coverUrl, book.id);
  const textColor = textIsLight ? '#000000' : '#FFFFFF';
  const secondaryColor = textIsLight ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.7)';

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

  const handlePlayPress = useCallback(async () => {
    try {
      const fullBook = await apiClient.getItem(book.id);
      await loadBook(fullBook);
    } catch (err) {
      console.error('Failed to load book:', err);
    }
  }, [book.id, loadBook]);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={handlePress}
      onLongPress={handleLongPress}
      activeOpacity={0.9}
      delayLongPress={300}
    >
      <View style={[styles.card, { backgroundColor: bgColor }]}>
        <ImageBackground
          source={{ uri: coverUrl }}
          style={styles.imageBackground}
          imageStyle={styles.cardImage}
        >
          {/* Selection checkbox */}
          {isSelecting && (
            <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
              {isSelected && (
                <Icon name="checkmark" size={12} color="#FFFFFF" set="ionicons" />
              )}
            </View>
          )}

          {/* Content */}
          <View style={styles.content}>
            <Text style={[styles.author, { color: secondaryColor }]} numberOfLines={1}>
              {author}
            </Text>
            <Text style={[styles.title, { color: textColor }]} numberOfLines={4}>
              {title}
            </Text>
          </View>

          {/* Play button */}
          <TouchableOpacity 
            style={styles.playButton} 
            onPress={handlePlayPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon 
              name={isThisPlaying ? 'pause' : 'play'} 
              size={18} 
              color={textColor} 
              set="ionicons"
            />
          </TouchableOpacity>
        </ImageBackground>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: CARD_SIZE,
    marginBottom: GAP,
  },
  card: {
    width: CARD_SIZE,
    height: CARD_SIZE * 1.1,
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
  },
  imageBackground: {
    flex: 1,
    padding: 10,
    justifyContent: 'space-between',
  },
  cardImage: {
    opacity: 0.3,
    borderRadius: CARD_RADIUS,
  },
  checkbox: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  content: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  author: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  playButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
  },
});

export default LibraryBookCard;