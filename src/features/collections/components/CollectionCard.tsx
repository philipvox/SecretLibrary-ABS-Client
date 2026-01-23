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
import { LayoutGrid, BookOpen } from 'lucide-react-native';
import { Collection } from '@/core/types';
import { apiClient } from '@/core/api';
import { scale, spacing, radius, elevation, useTheme } from '@/shared/theme';

interface CollectionCardProps {
  collection: Collection;
}

export const CollectionCard = memo(function CollectionCard({ collection }: CollectionCardProps) {
  const navigation = useNavigation();
  const { colors } = useTheme();

  const handlePress = () => {
    (navigation as any).navigate('CollectionDetail', { collectionId: collection.id });
  };

  const books = collection.books || [];
  const bookCount = books.length;

  // Get first book cover
  const coverUrl = useMemo(() => {
    return books[0] ? apiClient.getItemCoverUrl(books[0].id, { width: 400, height: 400 }) : undefined;
  }, [books]);

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={0.7}>
      <View style={[styles.coverContainer, { backgroundColor: colors.background.elevated }]}>
        {coverUrl ? (
          <Image source={coverUrl} style={styles.cover} contentFit="cover" transition={200} />
        ) : (
          <View style={[styles.cover, styles.placeholderCover, { backgroundColor: colors.background.elevated }]}>
            <LayoutGrid size={scale(32)} color={colors.text.tertiary} strokeWidth={1.5} />
          </View>
        )}

        <View style={[styles.countBadge, { backgroundColor: colors.accent.primary }]}>
          <BookOpen size={scale(10)} color={colors.text.inverse} strokeWidth={2.5} />
          <Text style={[styles.countText, { color: colors.text.inverse }]}>{bookCount}</Text>
        </View>
      </View>

      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.text.primary }]} numberOfLines={2}>
          {collection.name}
        </Text>
        {collection.description && (
          <Text style={[styles.description, { color: colors.text.tertiary }]} numberOfLines={1}>
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
    // backgroundColor set via themeColors in JSX
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
    // backgroundColor set via themeColors in JSX
  },
  countBadge: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    // backgroundColor set via accentColors in JSX
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  countText: {
    fontSize: scale(11),
    fontWeight: '700',
    // color set via themeColors in JSX
  },
  info: {
    marginTop: spacing.sm,
  },
  name: {
    fontSize: scale(14),
    fontWeight: '600',
    // color set via themeColors in JSX
    marginBottom: spacing.xxs,
    lineHeight: scale(18),
  },
  description: {
    fontSize: scale(12),
    // color set via themeColors in JSX
  },
});
