/**
 * src/features/discover/components/TopAuthorsSection.tsx
 *
 * Horizontal carousel of top authors with avatars/initials and book counts
 */

import React, { useCallback, useMemo } from 'react';
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
import { Icon } from '@/shared/components/Icon';
import { colors, scale, spacing, radius, layout } from '@/shared/theme';

const COLORS = { playButton: colors.accent, textPrimary: colors.textPrimary, textTertiary: colors.textTertiary };
const DIMENSIONS = { sectionGap: layout.sectionGap };
const TYPOGRAPHY = { sectionTitle: { fontSize: scale(13), fontWeight: '600' as const }, cardTitle: { fontSize: scale(14), fontWeight: '500' as const } };
const LAYOUT = { carouselPaddingHorizontal: layout.screenPaddingH, sectionHeaderMarginBottom: spacing.md };

const AVATAR_SIZE = scale(80);
const CARD_WIDTH = AVATAR_SIZE + scale(20);
const CARD_GAP = scale(16);

// getItemLayout for horizontal scroll optimization
const getItemLayout = (_data: any, index: number) => ({
  length: CARD_WIDTH,
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

// Get initials from name
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
}

const AuthorCard = React.memo(function AuthorCard({ author, onPress }: AuthorCardProps) {
  const hasImage = author.id && author.imagePath;
  const avatarUrl = hasImage ? apiClient.getAuthorImageUrl(author.id!) : null;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Avatar */}
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

      {/* Author info */}
      <Text style={styles.authorName} numberOfLines={2}>
        {author.name}
      </Text>
      <Text style={styles.bookCount}>
        {author.bookCount} {author.bookCount === 1 ? 'book' : 'books'}
      </Text>
    </TouchableOpacity>
  );
});

interface TopAuthorsSectionProps {
  limit?: number;
}

export function TopAuthorsSection({ limit = 10 }: TopAuthorsSectionProps) {
  const navigation = useNavigation<any>();
  const { isLoaded } = useLibraryCache();

  // Get top authors (sorted by book count)
  const topAuthors = useMemo(() => {
    if (!isLoaded) return [];
    const allAuthors = getAllAuthors();
    // Filter authors with at least 2 books
    return allAuthors
      .filter(a => a.bookCount >= 2)
      .slice(0, limit);
  }, [isLoaded, limit]);

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
    />
  ), [handleAuthorPress]);

  const keyExtractor = useCallback((item: typeof topAuthors[0]) => item.name, []);

  if (!isLoaded || topAuthors.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Top Authors</Text>
        <TouchableOpacity
          style={styles.viewAllButton}
          onPress={handleViewAll}
          activeOpacity={0.7}
        >
          <Text style={styles.viewAllText}>View All</Text>
          <Icon name="chevron-forward" size={scale(14)} color={COLORS.playButton} set="ionicons" />
        </TouchableOpacity>
      </View>

      {/* Horizontal carousel */}
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
    marginTop: scale(8),
    marginBottom: DIMENSIONS.sectionGap,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: LAYOUT.carouselPaddingHorizontal,
    marginBottom: LAYOUT.sectionHeaderMarginBottom,
  },
  title: {
    ...TYPOGRAPHY.sectionTitle,
    color: COLORS.textPrimary,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  viewAllText: {
    fontSize: scale(13),
    fontWeight: '500',
    color: COLORS.playButton,
  },
  listContent: {
    paddingHorizontal: LAYOUT.carouselPaddingHorizontal,
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
    marginBottom: scale(8),
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
    fontSize: scale(24),
    fontWeight: '700',
    color: '#fff',
  },
  authorName: {
    ...TYPOGRAPHY.cardTitle,
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: scale(2),
  },
  bookCount: {
    fontSize: scale(11),
    color: COLORS.textTertiary,
    textAlign: 'center',
  },
});
