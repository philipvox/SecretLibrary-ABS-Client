/**
 * src/features/browse/components/AwardWinnersSection.tsx
 *
 * Award Winners section for CURATED tab.
 * Horizontal cover art cards with collection names and book counts.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { scale, wp, useSecretLibraryColors } from '@/shared/theme';
import { Collection } from '@/core/types';
import { useCollections } from '@/features/collections';
import { useCoverUrl } from '@/core/cache';
import { CoverStars } from '@/shared/components/CoverStars';
import { SectionHeader } from './SectionHeader';

const CARD_WIDTH = Math.floor(wp(100) * 0.38);
const COVER_HEIGHT = CARD_WIDTH;

interface AwardWinnersSectionProps {
  onCollectionPress: (collectionId: string) => void;
  onViewAll: () => void;
}

const CollectionCard = React.memo(function CollectionCard({
  collection,
  onPress,
}: {
  collection: Collection;
  onPress: () => void;
}) {
  const colors = useSecretLibraryColors();
  const firstBookId = collection.books?.[0]?.id;
  const coverUrl = useCoverUrl(firstBookId || '', { width: 200 });
  const bookCount = collection.books?.length || 0;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.coverContainer, { backgroundColor: colors.grayLine }]}>
        {firstBookId && (
          <Image
            source={coverUrl}
            style={styles.cover}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={200}
          />
        )}
        {firstBookId && <CoverStars bookId={firstBookId} />}
        {/* Book count badge */}
        <View style={[styles.badge, { backgroundColor: colors.black }]}>
          <Text style={[styles.badgeText, { color: colors.white }]}>{bookCount}</Text>
        </View>
      </View>
      <Text style={[styles.cardTitle, { color: colors.black }]} numberOfLines={1}>
        {collection.name}
      </Text>
      <Text style={[styles.cardDesc, { color: colors.gray }]} numberOfLines={1}>
        {collection.description || 'Collection'}
      </Text>
    </TouchableOpacity>
  );
});

export const AwardWinnersSection = React.memo(function AwardWinnersSection({ onCollectionPress, onViewAll }: AwardWinnersSectionProps) {
  const colors = useSecretLibraryColors();
  const { collections } = useCollections();

  // Filter for award-type collections (skip the first one, shown as FeaturedCollectionCard)
  const awardCollections = useMemo(() => {
    if (!collections?.length) return [];
    return collections.slice(1, 8); // Skip featured, show up to 7
  }, [collections]);

  if (awardCollections.length === 0) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.white }]}>
      <SectionHeader
        label="Award Winners"
        count={awardCollections.length}
        onViewAll={onViewAll}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {awardCollections.map((collection) => (
          <CollectionCard
            key={collection.id}
            collection={collection}
            onPress={() => onCollectionPress(collection.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingBottom: scale(16),
  },
  scrollContent: {
    paddingHorizontal: 24,
    gap: 12,
  },
  card: {
    width: CARD_WIDTH,
  },
  coverContainer: {
    width: CARD_WIDTH,
    height: COVER_HEIGHT,
    borderRadius: scale(4),
    overflow: 'hidden',
    marginBottom: scale(8),
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    bottom: scale(6),
    right: scale(6),
    paddingHorizontal: scale(6),
    paddingVertical: scale(2),
    borderRadius: scale(4),
  },
  badgeText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.medium,
    fontSize: scale(9),
    fontWeight: '500',
  },
  cardTitle: {
    fontFamily: secretLibraryFonts.playfair.bold,
    fontSize: scale(13),
    fontWeight: '700',
    marginBottom: scale(2),
  },
  cardDesc: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(9),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
