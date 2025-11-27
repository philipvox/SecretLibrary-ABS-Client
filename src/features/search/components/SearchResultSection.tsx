/**
 * src/features/search/components/SearchResultSection.tsx
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LibraryItem } from '@/core/types';
import { apiClient } from '@/core/api';
import { LibraryHeartButton } from '@/features/library';
import { Icon } from '@/shared/components/Icon';
import { theme } from '@/shared/theme';
import { getTitle, getAuthorName } from '@/shared/utils/metadata';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_SIZE = (SCREEN_WIDTH - 60) / 3;

interface SearchResultSectionProps {
  title: string;
  count: number;
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
          <Text style={styles.sectionCount}>{count} results</Text>
        </View>
        {onViewAll && (
          <TouchableOpacity onPress={onViewAll}>
            <Text style={styles.viewAllLink}>View Results</Text>
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );
}

interface BookResultCardProps {
  book: LibraryItem;
}

export function BookResultCard({ book }: BookResultCardProps) {
  const navigation = useNavigation<any>();
  const coverUrl = apiClient.getItemCoverUrl(book.id);
  const title = getTitle(book);
  const author = getAuthorName(book);

  const handlePress = () => {
    navigation.navigate('BookDetail', { bookId: book.id });
  };

  return (
    <TouchableOpacity style={styles.bookCard} onPress={handlePress} activeOpacity={0.7}>
      <View style={styles.bookCoverContainer}>
        <Image source={{ uri: coverUrl }} style={styles.bookCover} resizeMode="cover" />
        <View style={styles.heartPosition}>
          <LibraryHeartButton bookId={book.id} size="small" />
        </View>
      </View>
      <Text style={styles.bookTitle} numberOfLines={1}>{title}</Text>
      <Text style={styles.bookAuthor} numberOfLines={1}>{author}</Text>
    </TouchableOpacity>
  );
}

interface BookResultsRowProps {
  books: LibraryItem[];
}

export function BookResultsRow({ books }: BookResultsRowProps) {
  return (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.horizontalList}
    >
      {books.map((book) => (
        <BookResultCard key={book.id} book={book} />
      ))}
    </ScrollView>
  );
}

interface SeriesCardProps {
  name: string;
  bookCount: number;
  books: LibraryItem[];
  onPress: () => void;
}

export function SeriesCard({ name, bookCount, books, onPress }: SeriesCardProps) {
  const firstBook = books[0];
  const coverUrl = firstBook ? apiClient.getItemCoverUrl(firstBook.id) : '';

  return (
    <TouchableOpacity style={styles.bookCard} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.bookCoverContainer}>
        <Image source={{ uri: coverUrl }} style={styles.bookCover} resizeMode="cover" />
        <View style={styles.seriesBadge}>
          <Text style={styles.seriesBadgeText}>{bookCount}</Text>
        </View>
      </View>
      <Text style={styles.bookTitle} numberOfLines={1}>{name}</Text>
      <Text style={styles.bookAuthor} numberOfLines={1}>{bookCount} books</Text>
    </TouchableOpacity>
  );
}

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

interface GroupResultCardProps {
  name: string;
  bookCount: number;
  books: LibraryItem[];
  onPress: () => void;
  compact?: boolean;
}

export function GroupResultCard({ name, bookCount, books, onPress, compact }: GroupResultCardProps) {
  const previewCovers = books.slice(0, 3);

  if (compact) {
    return (
      <TouchableOpacity style={styles.groupCardCompact} onPress={onPress} activeOpacity={0.7}>
        <View style={styles.groupCoversCompact}>
          {previewCovers.map((book, index) => (
            <Image
              key={book.id}
              source={{ uri: apiClient.getItemCoverUrl(book.id) }}
              style={[
                styles.groupCoverCompact,
                { left: index * 10, zIndex: 3 - index },
              ]}
              resizeMode="cover"
            />
          ))}
        </View>
        <View style={styles.groupInfoCompact}>
          <Text style={styles.groupNameCompact} numberOfLines={1}>{name}</Text>
          <Text style={styles.groupCountCompact}>{bookCount} books</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.groupCard} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.groupCoverContainer}>
        <View style={styles.groupCovers}>
          {previewCovers.map((book, index) => (
            <Image
              key={book.id}
              source={{ uri: apiClient.getItemCoverUrl(book.id) }}
              style={[
                styles.groupCover,
                { left: index * 16, zIndex: 3 - index },
              ]}
              resizeMode="cover"
            />
          ))}
        </View>
      </View>
      <Text style={styles.groupName} numberOfLines={1}>{name}</Text>
      <Text style={styles.groupCount}>{bookCount} books</Text>
    </TouchableOpacity>
  );
}

interface GroupResultsRowProps {
  groups: { name: string; bookCount: number; books: LibraryItem[] }[];
  onPress: (name: string) => void;
  compact?: boolean;
}

export function GroupResultsRow({ groups, onPress, compact }: GroupResultsRowProps) {
  return (
    <View style={compact ? styles.groupRowCompact : styles.groupRow}>
      {groups.map((group) => (
        <GroupResultCard
          key={group.name}
          name={group.name}
          bookCount={group.bookCount}
          books={group.books}
          onPress={() => onPress(group.name)}
          compact={compact}
        />
      ))}
    </View>
  );
}

interface BookListItemProps {
  book: LibraryItem;
}

export function BookListItem({ book }: BookListItemProps) {
  const navigation = useNavigation<any>();
  const coverUrl = apiClient.getItemCoverUrl(book.id);
  const title = getTitle(book);
  const author = getAuthorName(book);
  const duration = book.media?.duration || 0;
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  const durationText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  const handlePress = () => {
    navigation.navigate('BookDetail', { bookId: book.id });
  };

  return (
    <TouchableOpacity style={styles.listItem} onPress={handlePress} activeOpacity={0.7}>
      <View style={styles.listItemCoverContainer}>
        <Image source={{ uri: coverUrl }} style={styles.listItemCover} resizeMode="cover" />
      </View>
      <View style={styles.listItemInfo}>
        <Text style={styles.listItemTitle} numberOfLines={2}>{title}</Text>
        <Text style={styles.listItemSubtitle} numberOfLines={1}>{author}</Text>
        <Text style={styles.listItemMeta}>{durationText}</Text>
      </View>
      <LibraryHeartButton bookId={book.id} size="large" variant="plain" />
    </TouchableOpacity>
  );
}

interface AllResultsListProps {
  books: LibraryItem[];
}

export function AllResultsList({ books }: AllResultsListProps) {
  return (
    <View style={styles.allResultsList}>
      {books.map((book) => (
        <BookListItem key={book.id} book={book} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: theme.spacing[5],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing[5],
    marginBottom: theme.spacing[3],
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: theme.spacing[2],
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  sectionCount: {
    fontSize: 13,
    color: theme.colors.text.tertiary,
  },
  viewAllLink: {
    fontSize: 14,
    color: theme.colors.primary[500],
    fontWeight: '500',
  },
  horizontalList: {
    paddingHorizontal: theme.spacing[5],
    gap: theme.spacing[3],
  },
  bookCard: {
    width: CARD_SIZE,
  },
  bookCoverContainer: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: theme.radius.medium,
    overflow: 'hidden',
    backgroundColor: theme.colors.neutral[200],
    marginBottom: theme.spacing[2],
  },
  bookCover: {
    width: '100%',
    height: '100%',
  },
  heartPosition: {
    position: 'absolute',
    bottom: 6,
    right: 6,
  },
  seriesBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  seriesBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  bookTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  bookAuthor: {
    fontSize: 11,
    color: theme.colors.text.secondary,
    marginTop: 2,
  },
  groupRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing[5],
    gap: theme.spacing[3],
  },
  groupRowCompact: {
    gap: theme.spacing[2],
  },
  groupCard: {
    flex: 1,
  },
  groupCardCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[2],
    paddingVertical: theme.spacing[1],
  },
  groupCoverContainer: {
    height: 60,
    marginBottom: theme.spacing[2],
  },
  groupCovers: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  groupCoversCompact: {
    position: 'relative',
    width: 50,
    height: 36,
  },
  groupCover: {
    position: 'absolute',
    width: 45,
    height: 60,
    borderRadius: theme.radius.small,
    backgroundColor: theme.colors.neutral[200],
    borderWidth: 2,
    borderColor: theme.colors.background.primary,
  },
  groupCoverCompact: {
    position: 'absolute',
    width: 26,
    height: 36,
    borderRadius: 4,
    backgroundColor: theme.colors.neutral[200],
    borderWidth: 1.5,
    borderColor: theme.colors.background.primary,
  },
  groupName: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  groupCount: {
    fontSize: 11,
    color: theme.colors.text.tertiary,
    marginTop: 2,
  },
  groupInfoCompact: {
    flex: 1,
  },
  groupNameCompact: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  groupCountCompact: {
    fontSize: 10,
    color: theme.colors.text.tertiary,
    marginTop: 1,
  },
  allResultsList: {
    paddingHorizontal: theme.spacing[5],
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.light,
  },
  listItemCoverContainer: {
    width: 50,
    height: 50,
    borderRadius: theme.radius.small,
    overflow: 'hidden',
    backgroundColor: theme.colors.neutral[200],
  },
  listItemCover: {
    width: '100%',
    height: '100%',
  },
  listItemInfo: {
    flex: 1,
    marginLeft: theme.spacing[3],
    justifyContent: 'center',
  },
  listItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  listItemSubtitle: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    marginTop: 2,
  },
  listItemMeta: {
    fontSize: 11,
    color: theme.colors.text.tertiary,
    marginTop: 2,
  },
});