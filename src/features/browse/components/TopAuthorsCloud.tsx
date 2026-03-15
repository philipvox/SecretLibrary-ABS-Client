/**
 * src/features/browse/components/TopAuthorsCloud.tsx
 *
 * Tag cloud of top authors — names in varying font sizes based on book count.
 * Superscript count numbers. Tappable with white highlight on press.
 */

import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { scale, useSecretLibraryColors } from '@/shared/theme';
import { useLibraryCache } from '@/core/cache';
import { SectionHeader } from './SectionHeader';

interface TopAuthorsCloudProps {
  onAuthorPress: (authorName: string) => void;
  onViewAll: () => void;
}

export const TopAuthorsCloud = React.memo(function TopAuthorsCloud({ onAuthorPress, onViewAll }: TopAuthorsCloudProps) {
  const colors = useSecretLibraryColors();
  const authorsMap = useLibraryCache((s) => s.authors);

  const topAuthors = useMemo(() => {
    if (!authorsMap || authorsMap.size === 0) return [];

    return Array.from(authorsMap.values())
      .filter((a) => a.bookCount >= 2)
      .sort((a, b) => b.bookCount - a.bookCount)
      .slice(0, 20);
  }, [authorsMap]);

  if (topAuthors.length === 0) return null;

  // Scale font size based on book count — more books = larger text
  const maxCount = topAuthors[0]?.bookCount || 1;
  const minSize = scale(12);
  const maxSize = scale(22);

  return (
    <View style={[styles.container, { backgroundColor: colors.white }]}>
      <SectionHeader
        label="Top Authors"
        count={topAuthors.length}
        onViewAll={onViewAll}
      />

      <View style={styles.cloud}>
        {topAuthors.map((author) => {
          const ratio = author.bookCount / maxCount;
          const fontSize = minSize + (maxSize - minSize) * ratio;

          return (
            <Pressable
              key={author.name}
              onPress={() => onAuthorPress(author.name)}
              style={({ pressed }) => [
                styles.authorItem,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={[styles.authorName, { color: colors.black, fontSize }]}>
                {author.name}
              </Text>
              <Text style={[styles.authorCount, { color: colors.gray }]}>
                {author.bookCount}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingBottom: scale(16),
  },
  cloud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 24,
    gap: scale(4),
    alignItems: 'baseline',
  },
  authorItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginRight: scale(8),
    marginBottom: scale(4),
  },
  authorName: {
    fontFamily: secretLibraryFonts.playfair.regular,
  },
  authorCount: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(8),
    marginLeft: scale(2),
    opacity: 0.5,
  },
});
