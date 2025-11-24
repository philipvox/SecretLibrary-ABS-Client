/**
 * src/features/author/components/AuthorCard.tsx
 * 
 * Card displaying author information with book count.
 */

import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Author } from '@/core/types';
import { apiClient } from '@/core/api';
import { theme } from '@/shared/theme';

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

export function AuthorCard({ author }: AuthorCardProps) {
  const navigation = useNavigation();

  const handlePress = () => {
    navigation.navigate('AuthorDetail' as never, { authorId: author.id } as never);
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
    theme.colors.primary[500],
    theme.colors.semantic.success,
    theme.colors.semantic.warning,
    theme.colors.semantic.info,
    theme.colors.neutral[600],
  ];

  const bookCount = (author as AuthorInfo).bookCount;

  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      onPress={handlePress}
    >
      <View style={styles.avatarContainer}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.avatar} resizeMode="cover" />
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

const styles = StyleSheet.create({
  container: {
    width: '48%',
    marginBottom: theme.spacing[4],
  },
  pressed: {
    opacity: 0.7,
  },
  avatarContainer: {
    aspectRatio: 1,
    borderRadius: theme.radius.large,
    overflow: 'hidden',
    backgroundColor: theme.colors.neutral[200],
    ...theme.elevation.small,
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
    color: theme.colors.text.inverse,
  },
  info: {
    marginTop: theme.spacing[2],
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: theme.spacing[1],
    lineHeight: 20,
  },
  bookCount: {
    fontSize: 13,
    color: theme.colors.text.secondary,
  },
});