/**
 * src/features/discover/components/TopAuthorsSection.tsx
 *
 * Top authors section sorted by user reading history
 * Authors you've read more books from appear first
 */

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { getAllAuthors, useLibraryCache } from '@/core/cache';
import { apiClient } from '@/core/api';
import { sqliteCache } from '@/core/services/sqliteCache';
import { scale, spacing, layout, useTheme } from '@/shared/theme';

// Compact circular avatar
const AVATAR_SIZE = scale(56);
const CARD_WIDTH = scale(72);
const CARD_GAP = scale(12);

const getItemLayout = (_data: any, index: number) => ({
  length: CARD_WIDTH + CARD_GAP,
  offset: (CARD_WIDTH + CARD_GAP) * index,
  index,
});

// Generate consistent color from name
function getAvatarColor(name: string): string {
  const colors = [
    '#e57373', '#81c784', '#64b5f6', '#ffb74d', '#ba68c8',
    '#4db6ac', '#f06292', '#7986cb', '#a1887f', '#90a4ae',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

interface AuthorCardProps {
  author: {
    id?: string;
    name: string;
    bookCount: number;
    imagePath?: string;
  };
  onPress: () => void;
  textColor: string;
  textTertiaryColor: string;
}

const AuthorCard = React.memo(function AuthorCard({ author, onPress, textColor, textTertiaryColor }: AuthorCardProps) {
  const hasImage = author.id && author.imagePath;
  const avatarUrl = hasImage ? apiClient.getAuthorImageUrl(author.id!) : null;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.avatarContainer}>
        {avatarUrl ? (
          <Image
            source={avatarUrl}
            style={styles.avatar}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={[styles.initialsAvatar, { backgroundColor: getAvatarColor(author.name) }]}>
            <Text style={styles.initialsText}>{getInitials(author.name)}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.authorName, { color: textColor }]} numberOfLines={1}>
        {author.name.split(' ').pop()}
      </Text>
      <Text style={[styles.bookCount, { color: textTertiaryColor }]}>
        {author.bookCount}
      </Text>
    </TouchableOpacity>
  );
});

interface TopAuthorsSectionProps {
  limit?: number;
}

export function TopAuthorsSection({ limit = 10 }: TopAuthorsSectionProps) {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const { isLoaded } = useLibraryCache();

  // Load user's reading history to boost authors they've read
  const [favoriteAuthorMap, setFavoriteAuthorMap] = useState<Map<string, number>>(new Map());
  const [hasHistory, setHasHistory] = useState(false);

  useEffect(() => {
    sqliteCache.getReadHistoryStats().then(stats => {
      if (stats.favoriteAuthors.length > 0) {
        const map = new Map<string, number>();
        stats.favoriteAuthors.forEach((a, idx) => {
          // Higher score for authors read more, with position boost
          map.set(a.name.toLowerCase(), a.count * 10 + (10 - idx));
        });
        setFavoriteAuthorMap(map);
        setHasHistory(true);
      }
    }).catch(() => {});
  }, []);

  const topAuthors = useMemo(() => {
    if (!isLoaded) return [];
    const allAuthors = getAllAuthors();

    // Sort by reading history first, then by book count
    return allAuthors
      .filter(a => a.bookCount >= 2)
      .map(a => ({
        ...a,
        historyScore: favoriteAuthorMap.get(a.name.toLowerCase()) || 0,
      }))
      .sort((a, b) => {
        // Authors from reading history first
        if (a.historyScore !== b.historyScore) {
          return b.historyScore - a.historyScore;
        }
        // Then by book count
        return b.bookCount - a.bookCount;
      })
      .slice(0, limit);
  }, [isLoaded, limit, favoriteAuthorMap]);

  // Title changes based on whether we have history
  const sectionTitle = hasHistory ? 'Your Authors' : 'Authors';

  const handleViewAll = useCallback(() => {
    navigation.navigate('AuthorsList');
  }, [navigation]);

  const handleAuthorPress = useCallback((authorName: string, authorId?: string) => {
    navigation.navigate('AuthorDetail', { authorName, authorId });
  }, [navigation]);

  const renderItem = useCallback(({ item }: { item: typeof topAuthors[0] }) => (
    <AuthorCard
      author={item}
      onPress={() => handleAuthorPress(item.name, item.id)}
      textColor={colors.text.primary}
      textTertiaryColor={colors.text.tertiary}
    />
  ), [handleAuthorPress, colors.text.primary, colors.text.tertiary]);

  const keyExtractor = useCallback((item: typeof topAuthors[0]) => item.name, []);

  if (!isLoaded || topAuthors.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text.primary }]}>{sectionTitle}</Text>
        <TouchableOpacity
          style={styles.viewAllButton}
          onPress={handleViewAll}
          activeOpacity={0.7}
        >
          <Text style={[styles.viewAllText, { color: colors.text.secondary }]}>View All</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={topAuthors}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        getItemLayout={getItemLayout}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: layout.screenPaddingH,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: scale(18),
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  viewAllButton: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  viewAllText: {
    fontSize: scale(14),
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: layout.screenPaddingH,
    gap: CARD_GAP,
  },
  card: {
    alignItems: 'center',
    width: CARD_WIDTH,
  },
  avatarContainer: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  initialsAvatar: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    fontSize: scale(18),
    fontWeight: '700',
    // White text on colored avatar backgrounds for visibility
    color: '#FFFFFF',
  },
  authorName: {
    fontSize: scale(11),
    fontWeight: '500',
    textAlign: 'center',
    marginTop: scale(6),
  },
  bookCount: {
    fontSize: scale(10),
    textAlign: 'center',
    marginTop: scale(1),
  },
});
