/**
 * src/features/browse/components/MeaningToReadSection.tsx
 *
 * "You've been meaning to read this" — two categories:
 *   - Abandoned: started but not played in 30+ days → "X% · STALLED"
 *   - Unstarted: in library 30+ days, never opened → "ADDED X MO AGO"
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { scale, wp, useSecretLibraryColors } from '@/shared/theme';
import { LibraryItem, BookMetadata } from '@/core/types';
import { useCoverUrl } from '@/core/cache';
import { CoverStars } from '@/shared/components/CoverStars';
import { useProgressStore } from '@/core/stores/progressStore';
import { SectionHeader } from './SectionHeader';
import { useMeaningToRead } from '../hooks/useMeaningToRead';

const CARD_WIDTH = Math.floor(wp(100) * 0.36);
const COVER_HEIGHT = Math.floor(CARD_WIDTH * 0.55);

interface MeaningToReadSectionProps {
  items: LibraryItem[];
  onBookPress: (bookId: string) => void;
  onBookLongPress?: (bookId: string) => void;
}

function getMetadata(item: LibraryItem): BookMetadata | Record<string, never> {
  if (item.mediaType !== 'book' || !item.media?.metadata) return {};
  return item.media.metadata as BookMetadata;
}

function formatTimeSince(timestamp: number): string {
  if (!timestamp) return '';
  const months = Math.floor((Date.now() - timestamp) / (30 * 24 * 60 * 60 * 1000));
  if (months < 1) return 'RECENTLY';
  if (months === 1) return '1 MO AGO';
  return `${months} MO AGO`;
}

const MeaningCard = React.memo(function MeaningCard({
  item,
  onPress,
  onLongPress,
}: {
  item: LibraryItem;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const colors = useSecretLibraryColors();
  const coverUrl = useCoverUrl(item.id, { width: 200 });
  const metadata = getMetadata(item);
  const title = (metadata as any).title || 'Untitled';
  const author = (metadata as any).authorName || (metadata as any).authors?.[0]?.name || '';

  // Get progress to determine abandoned vs unstarted
  const progress = useProgressStore((s) => s.getProgress(item.id));
  const isAbandoned = (progress?.progress ?? 0) > 0.01;
  const pct = Math.round((progress?.progress ?? 0) * 100);

  let statusLabel: string;
  if (isAbandoned) {
    statusLabel = `${pct}% · STALLED`;
  } else {
    const addedAt = progress?.addedToLibraryAt || (item.addedAt ? new Date(item.addedAt).getTime() : 0);
    statusLabel = `ADDED ${formatTimeSince(addedAt)}`;
  }

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} onLongPress={onLongPress} activeOpacity={0.8}>
      <View style={[styles.coverContainer, { backgroundColor: colors.grayLine }]}>
        <Image
          source={coverUrl}
          style={styles.cover}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={200}
        />
        <CoverStars bookId={item.id} starSize={scale(20)} />
      </View>
      <Text style={[styles.cardTitle, { color: colors.black }]} numberOfLines={2}>
        {title.toUpperCase()}
      </Text>
      {author && (
        <Text style={[styles.cardAuthor, { color: colors.gray }]} numberOfLines={1}>
          {author}
        </Text>
      )}
      <Text style={[styles.cardAge, { color: colors.black }]}>
        {statusLabel}
      </Text>
    </TouchableOpacity>
  );
});

export const MeaningToReadSection = React.memo(function MeaningToReadSection({
  items,
  onBookPress,
  onBookLongPress,
}: MeaningToReadSectionProps) {
  const colors = useSecretLibraryColors();
  const meaningBooks = useMeaningToRead(items);

  if (meaningBooks.length < 2) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.white }]}>
      <SectionHeader label="You've been meaning to read this" />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {meaningBooks.map((item) => (
          <MeaningCard
            key={item.id}
            item={item}
            onPress={() => onBookPress(item.id)}
            onLongPress={onBookLongPress ? () => onBookLongPress(item.id) : undefined}
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
    marginBottom: scale(6),
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  cardTitle: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(9),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: scale(2),
    lineHeight: scale(13),
  },
  cardAuthor: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(8),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: scale(3),
    opacity: 0.6,
  },
  cardAge: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(8),
    textTransform: 'uppercase',
    letterSpacing: 1,
    opacity: 0.8,
  },
});
