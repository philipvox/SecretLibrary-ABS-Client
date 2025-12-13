/**
 * src/features/collections/components/CollectionCard.tsx
 *
 * Simple collection card component for use in lists.
 * Now matches dark theme design pattern.
 */

import React, { memo, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Collection } from '@/core/types';
import { apiClient } from '@/core/api';
import { colors, scale, spacing, radius, elevation } from '@/shared/theme';

interface CollectionCardProps {
  collection: Collection;
}

export const CollectionCard = memo(function CollectionCard({ collection }: CollectionCardProps) {
  const navigation = useNavigation();

  const handlePress = () => {
    navigation.navigate('CollectionDetail' as never, { collectionId: collection.id } as never);
  };

  const books = collection.books || [];
  const bookCount = books.length;

  // Get first book cover
  const coverUrl = useMemo(() => {
    return books[0] ? apiClient.getItemCoverUrl(books[0].id) : undefined;
  }, [books]);

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={0.7}>
      <View style={styles.coverContainer}>
        {coverUrl ? (
          <Image source={coverUrl} style={styles.cover} contentFit="cover" transition={200} />
        ) : (
          <View style={[styles.cover, styles.placeholderCover]}>
            <Ionicons name="albums" size={scale(32)} color="rgba(255,255,255,0.3)" />
          </View>
        )}

        <View style={styles.countBadge}>
          <Ionicons name="book" size={scale(10)} color="#000" />
          <Text style={styles.countText}>{bookCount}</Text>
        </View>
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>
          {collection.name}
        </Text>
        {collection.description && (
          <Text style={styles.description} numberOfLines={1}>
            {collection.description}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    width: scale(160),
    marginBottom: spacing.lg,
  },
  coverContainer: {
    position: 'relative',
    width: scale(160),
    height: scale(160),
    borderRadius: radius.lg,
    backgroundColor: colors.backgroundElevated,
    overflow: 'hidden',
    ...elevation.small,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  placeholderCover: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
  },
  countBadge: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  countText: {
    fontSize: scale(11),
    fontWeight: '700',
    color: colors.backgroundPrimary,
  },
  info: {
    marginTop: spacing.sm,
  },
  name: {
    fontSize: scale(14),
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xxs,
    lineHeight: scale(18),
  },
  description: {
    fontSize: scale(12),
    color: colors.textTertiary,
  },
});
