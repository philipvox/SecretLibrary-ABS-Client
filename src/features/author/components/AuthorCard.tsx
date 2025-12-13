/**
 * src/features/author/components/AuthorCard.tsx
 * 
 * Card displaying author information with book count.
 */

import React, { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { Author } from '@/core/types';
import { apiClient } from '@/core/api';
import { colors, spacing, radius, elevation } from '@/shared/theme';

interface AuthorInfo {
  id: string;
  name: string;
  description?: string;
  imagePath?: string;
  bookCount?: number;
}

interface AuthorCardProps {
  author: AuthorInfo | Author;
}

function AuthorCardComponent({ author }: AuthorCardProps) {
  const navigation = useNavigation();

  const handlePress = () => {
    navigation.navigate('AuthorDetail' as never, { authorName: author.name } as never);
  };

  const imageUrl = author.imagePath
    ? apiClient.getAuthorImageUrl(author.id)
    : undefined;

  // Generate initials for avatar
  const initials = author.name
    .split(' ')
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Generate a consistent color based on name
  const colorIndex = author.name.charCodeAt(0) % 5;
  const avatarColors = [
    colors.accent,
    '#4CAF50',
    '#FF9800',
    '#2196F3',
    colors.progressTrack,
  ];

  const bookCount = (author as AuthorInfo).bookCount;

  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      onPress={handlePress}
    >
      <View style={styles.avatarContainer}>
        {imageUrl ? (
          <Image source={imageUrl} style={styles.avatar} contentFit="cover" transition={200} />
        ) : (
          <View style={[styles.avatar, styles.initialsAvatar, { backgroundColor: avatarColors[colorIndex] }]}>
            <Text style={styles.initials}>{initials}</Text>
          </View>
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>
          {author.name}
        </Text>
        {bookCount !== undefined && bookCount > 0 && (
          <Text style={styles.bookCount}>
            {bookCount} {bookCount === 1 ? 'book' : 'books'}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

// Memoize to prevent unnecessary re-renders in lists
export const AuthorCard = memo(AuthorCardComponent);

const styles = StyleSheet.create({
  container: {
    width: '48%',
    marginBottom: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
  avatarContainer: {
    aspectRatio: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.progressTrack,
    ...elevation.small,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  initialsAvatar: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  info: {
    marginTop: spacing.xs,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
    lineHeight: 20,
  },
  bookCount: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});