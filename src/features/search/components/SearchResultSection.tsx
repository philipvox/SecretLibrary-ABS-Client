/**
 * src/features/search/components/SearchResultSection.tsx
 * 
 * Search result components with colored card design
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getColors } from 'react-native-image-colors';
import { LibraryItem } from '@/core/types';
import { apiClient } from '@/core/api';
import { usePlayerStore } from '@/features/player';
import { Icon } from '@/shared/components/Icon';
import { BookCard } from '@/shared/components/BookCard';
import { getTitle, getAuthorName } from '@/shared/utils/metadata';
import { matchToPalette } from '@/shared/utils/colorPalette';
import { isColorLight, pickMostSaturated } from '@/features/player/utils';
import { wp } from '@/shared/theme';

const SCREEN_WIDTH = wp(100);
const GAP = 5;
const CARD_SIZE = (SCREEN_WIDTH - GAP * 4) / 3;
const CARD_RADIUS = 5;

// ========================================
// Color extraction hook
// ========================================

function useExtractedColor(imageUrl: string, id: string) {
  const [bgColor, setBgColor] = useState('#2a2a3e');
  const [textIsLight, setTextIsLight] = useState(false);
  
  useEffect(() => {
    if (!imageUrl || !id) return;
    let mounted = true;
    
    const extractColors = async () => {
      try {
        const result = await getColors(imageUrl, { 
          fallback: '#2a2a3e', 
          cache: true, 
          key: id 
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
  }, [imageUrl, id]);
  
  return { bgColor, textIsLight };
}

// ========================================
// Section Header
// ========================================

interface SearchResultSectionProps {
  title: string;
  count?: number;
  onViewAll?: () => void;
  children: React.ReactNode;
}

export function SearchResultSection({ 
  title, 
  count, 
  onViewAll, 
  children 
}: SearchResultSectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {count !== undefined && (
            <Text style={styles.sectionCount}>{count}</Text>
          )}
        </View>
        {onViewAll && (
          <TouchableOpacity onPress={onViewAll}>
            <Text style={styles.viewAllLink}>View All</Text>
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );
}

// ========================================
// Book Result Card (New colored design)
// ========================================

interface BookResultCardProps {
  book: LibraryItem;
}

export function BookResultCard({ book }: BookResultCardProps) {
  const { loadBook, currentBook, isPlaying } = usePlayerStore();
  const coverUrl = apiClient.getItemCoverUrl(book.id);
  const title = getTitle(book);
  const author = getAuthorName(book);
  const isThisPlaying = currentBook?.id === book.id && isPlaying;

  const { bgColor, textIsLight } = useExtractedColor(coverUrl, book.id);
  const textColor = textIsLight ? '#000000' : '#FFFFFF';
  const secondaryColor = textIsLight ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)';

  const handlePress = async () => {
    try {
      const fullBook = await apiClient.getItem(book.id);
      await loadBook(fullBook);
    } catch (err) {
      console.error('Failed to load book:', err);
    }
  };

  return (
    <TouchableOpacity 
      style={[styles.bookCard, { backgroundColor: bgColor }]} 
      onPress={handlePress} 
      activeOpacity={0.9}
    >
      {/* Cover at top */}
      <View style={styles.bookCardCoverRow}>
        {coverUrl ? (
          <Image source={{ uri: coverUrl }} style={styles.bookCardCover} resizeMode="cover" />
        ) : (
          <View style={[styles.bookCardCover, styles.bookCardCoverPlaceholder]} />
        )}
        <View style={styles.bookCardPlay}>
          <Icon 
            name={isThisPlaying ? 'pause' : 'play'} 
            size={20} 
            color={textColor} 
            set="ionicons"
          />
        </View>
      </View>
      
      {/* Text below */}
      <View style={styles.bookCardText}>
        <Text style={[styles.bookCardAuthor, { color: secondaryColor }]} numberOfLines={1}>
          {author}
        </Text>
        <Text style={[styles.bookCardTitle, { color: textColor }]} numberOfLines={2}>
          {title}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ========================================
// Book Results Row (List View)
// ========================================

interface BookResultsRowProps {
  books: LibraryItem[];
}

export function BookResultsRow({ books }: BookResultsRowProps) {
  const navigation = useNavigation<any>();

  const handleBookPress = useCallback((bookId: string) => {
    navigation.navigate('BookDetail', { id: bookId });
  }, [navigation]);

  return (
    <View style={styles.bookResultsList}>
      {books.map((book) => (
        <BookCard
          key={book.id}
          book={book}
          onPress={() => handleBookPress(book.id)}
          showListeningProgress={true}
        />
      ))}
    </View>
  );
}

// ========================================
// Series Card
// ========================================

interface SeriesCardProps {
  name: string;
  bookCount: number;
  books: LibraryItem[];
  onPress: () => void;
}

export function SeriesCard({ name, bookCount, books, onPress }: SeriesCardProps) {
  const firstBook = books[0];
  const coverUrl = firstBook ? apiClient.getItemCoverUrl(firstBook.id) : '';

  const { bgColor, textIsLight } = useExtractedColor(coverUrl, name);
  const textColor = textIsLight ? '#000000' : '#FFFFFF';
  const secondaryColor = textIsLight ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)';

  return (
    <TouchableOpacity 
      style={[styles.bookCard, { backgroundColor: bgColor }]} 
      onPress={onPress} 
      activeOpacity={0.9}
    >
      {/* Cover at top */}
      <View style={styles.bookCardCoverRow}>
        {coverUrl ? (
          <Image source={{ uri: coverUrl }} style={styles.bookCardCover} resizeMode="cover" />
        ) : (
          <View style={[styles.bookCardCover, styles.bookCardCoverPlaceholder]} />
        )}
      </View>
      
      {/* Text below */}
      <View style={styles.bookCardText}>
        <Text style={[styles.bookCardAuthor, { color: secondaryColor }]} numberOfLines={1}>
          {bookCount} books
        </Text>
        <Text style={[styles.bookCardTitle, { color: textColor }]} numberOfLines={2}>
          {name}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ========================================
// Series Results Row
// ========================================

interface SeriesResultsRowProps {
  series: { name: string; bookCount: number; books: LibraryItem[] }[];
  onPress: (name: string) => void;
}

export function SeriesResultsRow({ series, onPress }: SeriesResultsRowProps) {
  return (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.horizontalList}
    >
      {series.map((s) => (
        <SeriesCard
          key={s.name}
          name={s.name}
          bookCount={s.bookCount}
          books={s.books}
          onPress={() => onPress(s.name)}
        />
      ))}
    </ScrollView>
  );
}

// ========================================
// Group Result Card (Authors/Narrators)
// ========================================

interface GroupResultCardProps {
  name: string;
  bookCount: number;
  books: LibraryItem[];
  onPress: () => void;
  compact?: boolean;
}

export function GroupResultCard({ name, bookCount, books, onPress, compact }: GroupResultCardProps) {
  const firstBook = books[0];
  const coverUrl = firstBook ? apiClient.getItemCoverUrl(firstBook.id) : '';

  const { bgColor, textIsLight } = useExtractedColor(coverUrl, name);
  const textColor = textIsLight ? '#000000' : '#FFFFFF';
  const secondaryColor = textIsLight ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)';

  if (compact) {
    return (
      <TouchableOpacity 
        style={[styles.groupCardCompact, { backgroundColor: bgColor }]} 
        onPress={onPress} 
        activeOpacity={0.9}
      >
        {coverUrl ? (
          <Image source={{ uri: coverUrl }} style={styles.groupCardCover} resizeMode="cover" />
        ) : (
          <View style={[styles.groupCardCover, styles.bookCardCoverPlaceholder]} />
        )}
        <View style={styles.groupCardContent}>
          <Text style={[styles.groupCardName, { color: textColor }]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[styles.groupCardCount, { color: secondaryColor }]}>
            {bookCount} books
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity 
      style={[styles.bookCard, { backgroundColor: bgColor }]} 
      onPress={onPress} 
      activeOpacity={0.9}
    >
      {/* Cover at top */}
      <View style={styles.bookCardCoverRow}>
        {coverUrl ? (
          <Image source={{ uri: coverUrl }} style={styles.bookCardCover} resizeMode="cover" />
        ) : (
          <View style={[styles.bookCardCover, styles.bookCardCoverPlaceholder]} />
        )}
      </View>
      
      {/* Text below */}
      <View style={styles.bookCardText}>
        <Text style={[styles.bookCardAuthor, { color: secondaryColor }]} numberOfLines={1}>
          {bookCount} books
        </Text>
        <Text style={[styles.bookCardTitle, { color: textColor }]} numberOfLines={2}>
          {name}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ========================================
// Group Results Row
// ========================================

interface GroupResultsRowProps {
  groups: { name: string; bookCount: number; books: LibraryItem[] }[];
  onPress: (name: string) => void;
  compact?: boolean;
}

export function GroupResultsRow({ groups, onPress, compact }: GroupResultsRowProps) {
  if (compact) {
    return (
      <View style={styles.groupRowCompact}>
        {groups.map((group) => (
          <GroupResultCard
            key={group.name}
            name={group.name}
            bookCount={group.bookCount}
            books={group.books}
            onPress={() => onPress(group.name)}
            compact
          />
        ))}
      </View>
    );
  }

  return (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.horizontalList}
    >
      {groups.map((group) => (
        <GroupResultCard
          key={group.name}
          name={group.name}
          bookCount={group.bookCount}
          books={group.books}
          onPress={() => onPress(group.name)}
        />
      ))}
    </ScrollView>
  );
}

// ========================================
// Book List Item (for All Results)
// ========================================

interface BookListItemProps {
  book: LibraryItem;
}

export function BookListItem({ book }: BookListItemProps) {
  const { loadBook, currentBook, isPlaying } = usePlayerStore();
  const coverUrl = apiClient.getItemCoverUrl(book.id);
  const title = getTitle(book);
  const author = getAuthorName(book);
  const duration = book.media?.duration || 0;
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  const durationText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  const isThisPlaying = currentBook?.id === book.id && isPlaying;

  const { bgColor, textIsLight } = useExtractedColor(coverUrl, book.id);
  const textColor = textIsLight ? '#000000' : '#FFFFFF';
  const secondaryColor = textIsLight ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)';

  const handlePress = async () => {
    try {
      const fullBook = await apiClient.getItem(book.id);
      await loadBook(fullBook);
    } catch (err) {
      console.error('Failed to load book:', err);
    }
  };

  return (
    <TouchableOpacity 
      style={[styles.listItem, { backgroundColor: bgColor }]} 
      onPress={handlePress} 
      activeOpacity={0.9}
    >
      <View style={styles.listItemContent}>
        {/* Cover thumbnail */}
        {coverUrl ? (
          <Image source={{ uri: coverUrl }} style={styles.listItemCover} resizeMode="cover" />
        ) : (
          <View style={[styles.listItemCover, styles.bookCardCoverPlaceholder]} />
        )}
        
        <View style={styles.listItemText}>
          <Text style={[styles.listItemTitle, { color: textColor }]} numberOfLines={2}>
            {title}
          </Text>
          <Text style={[styles.listItemSubtitle, { color: secondaryColor }]} numberOfLines={1}>
            {author} • {durationText}
          </Text>
        </View>
        
        <View style={styles.listItemPlay}>
          <Icon 
            name={isThisPlaying ? 'pause' : 'play'} 
            size={22} 
            color={textColor} 
            set="ionicons"
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ========================================
// All Results List
// ========================================

interface AllResultsListProps {
  books: LibraryItem[];
}

export function AllResultsList({ books }: AllResultsListProps) {
  const navigation = useNavigation<any>();

  const handleBookPress = useCallback((bookId: string) => {
    navigation.navigate('BookDetail', { id: bookId });
  }, [navigation]);

  return (
    <View style={styles.allResultsList}>
      {books.map((book) => (
        <BookCard
          key={book.id}
          book={book}
          onPress={() => handleBookPress(book.id)}
          showListeningProgress={true}
        />
      ))}
    </View>
  );
}

// ========================================
// Styles
// ========================================

const styles = StyleSheet.create({
  // Section
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: GAP,
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionCount: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  viewAllLink: {
    fontSize: 14,
    color: '#007AFF',
  },

  // Horizontal list
  horizontalList: {
    paddingHorizontal: GAP,
    gap: GAP,
  },

  // Book Card (cover on top, text below)
  bookCard: {
    width: CARD_SIZE,
    height: CARD_SIZE * 1.4,
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
    padding: 10,
  },
  bookCardCoverRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bookCardCover: {
    width: 60,
    height: 60,
    borderRadius: 4,
  },
  bookCardCoverPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  bookCardPlay: {
    marginTop: 2,
  },
  bookCardText: {
    flex: 1,
  },
  bookCardAuthor: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
  },
  bookCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
  },

  // Group card compact
  groupCardCompact: {
    flex: 1,
    height: 70,
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
    marginHorizontal: GAP / 2,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  groupCardCover: {
    width: 44,
    height: 44,
    borderRadius: 4,
    marginRight: 10,
  },
  groupCardContent: {
    flex: 1,
    justifyContent: 'center',
  },
  groupCardName: {
    fontSize: 13,
    fontWeight: '700',
  },
  groupCardCount: {
    fontSize: 11,
    marginTop: 2,
  },
  groupRowCompact: {
    flexDirection: 'row',
    paddingHorizontal: GAP / 2,
  },

  // List item
  listItem: {
    height: 72,
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
    marginHorizontal: GAP,
    marginBottom: GAP,
  },
  listItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  listItemCover: {
    width: 48,
    height: 48,
    borderRadius: 4,
    marginRight: 12,
  },
  listItemText: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  listItemSubtitle: {
    fontSize: 12,
  },
  listItemPlay: {
    marginLeft: 12,
  },

  // All results
  allResultsList: {
    gap: 0,
  },
  // Book results list (vertical)
  bookResultsList: {
    gap: 0,
  },
});