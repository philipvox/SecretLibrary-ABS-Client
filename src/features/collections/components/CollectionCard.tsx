import React, { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { Collection } from '@/core/types';
import { apiClient } from '@/core/api';
import { theme } from '@/shared/theme';

interface CollectionCardProps {
  collection: Collection;
}

export function CollectionCard({ collection }: CollectionCardProps) {
  const navigation = useNavigation();

  const handlePress = () => {
    navigation.navigate('CollectionDetail' as never, { collectionId: collection.id } as never);
  };

  const bookCount = collection.books?.length || 0;
  const firstBook = collection.books?.[0];
  const coverUrl = firstBook ? apiClient.getItemCoverUrl(firstBook.id) : undefined;

  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      onPress={handlePress}
    >
      <View style={styles.coverContainer}>
        {coverUrl ? (
          <Image source={coverUrl} style={styles.cover} contentFit="cover" transition={200} />
        ) : (
          <View style={[styles.cover, styles.placeholderCover]}>
            <Text style={styles.placeholderText}>📚</Text>
          </View>
        )}
        
        <View style={styles.countBadge}>
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 160,
    marginBottom: theme.spacing[4],
  },
  pressed: {
    opacity: 0.7,
  },
  coverContainer: {
    position: 'relative',
    width: 160,
    height: 160,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.neutral[200],
    overflow: 'hidden',
    ...theme.elevation.small,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  placeholderCover: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.neutral[300],
  },
  placeholderText: {
    fontSize: 48,
  },
  countBadge: {
    position: 'absolute',
    bottom: theme.spacing[2],
    right: theme.spacing[2],
    backgroundColor: theme.colors.primary[500],
    paddingHorizontal: theme.spacing[2],
    paddingVertical: theme.spacing[1],
    borderRadius: theme.radius.medium,
    minWidth: 28,
    alignItems: 'center',
  },
  countText: {
    fontSize: 12,
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
  description: {
    fontSize: 13,
    color: theme.colors.text.secondary,
  },
});