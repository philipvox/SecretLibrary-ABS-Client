/**
 * src/features/search/components/BookSimpleRow.tsx
 *
 * Simple book row for search results.
 * Shows cover thumbnail, title, subtitle, and duration.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { secretLibraryFonts } from '@/shared/theme/secretLibrary';
import { scale, useSecretLibraryColors } from '@/shared/theme';
import { CoverStars } from '@/shared/components/CoverStars';
import { apiClient } from '@/core/api';

export interface BookSimpleRowProps {
  /** Book ID for cover URL */
  id: string;
  /** Book title */
  title: string;
  /** Subtitle (author or series info) */
  subtitle: string;
  /** Duration in seconds */
  duration: number;
  /** Show separator line below */
  showSeparator?: boolean;
  /** Called when row is pressed */
  onPress?: () => void;
  /** Called when row is long-pressed */
  onLongPress?: () => void;
}

// Format duration in hours
function formatDuration(seconds: number): string {
  if (!seconds) return '';
  const hours = Math.round(seconds / 3600);
  return `${hours}h`;
}

export function BookSimpleRow({
  id,
  title,
  subtitle,
  duration,
  showSeparator = true,
  onPress,
  onLongPress,
}: BookSimpleRowProps) {
  const colors = useSecretLibraryColors();
  const coverUrl = apiClient.getItemCoverUrl(id, { width: 120, height: 120 });

  return (
    <Pressable
      style={[styles.container, { backgroundColor: colors.white }]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
    >
      <View style={{ width: scale(48), height: scale(48), borderRadius: 4, overflow: 'hidden' }}>
        <Image source={{ uri: coverUrl }} style={[styles.cover, { backgroundColor: colors.grayLight }]} />
        <CoverStars bookId={id} starSize={scale(14)} />
      </View>
      <View style={styles.info}>
        <Text style={[styles.title, { color: colors.black }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text style={[styles.subtitle, { color: colors.gray }]} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      <Text style={[styles.duration, { color: colors.gray }]}>
        {formatDuration(duration)}
      </Text>
      {showSeparator && (
        <View style={[styles.separator, { backgroundColor: colors.grayLine }]} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  cover: {
    width: scale(48),
    height: scale(48),
    borderRadius: 4,
  },
  info: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  title: {
    fontFamily: secretLibraryFonts.playfair.regular,
    fontSize: scale(16),
    marginBottom: 2,
  },
  subtitle: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(10),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  duration: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(10),
  },
  separator: {
    position: 'absolute',
    bottom: 0,
    left: scale(48) + 12 + 24, // cover + margin + padding
    right: 24,
    height: 1,
  },
});

export default BookSimpleRow;
