/**
 * src/features/discover/components/HeroSection.tsx
 *
 * Hero section content (no background - background is rendered in BrowseScreen).
 * Uses design system constants and cached cover URLs.
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { useCoverUrl } from '@/core/cache';
import { Icon } from '@/shared/components/Icon';
import { CircularDownloadButton } from '@/shared/components';
import { COLORS, DIMENSIONS, LAYOUT, SHADOWS } from '@/features/home/homeDesign';
import { HeroRecommendation } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = (size: number) => (size / 402) * SCREEN_WIDTH;

const MONO_FONT = Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' });
const COVER_SIZE = scale(90);

// Format duration
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

interface HeroSectionProps {
  hero: HeroRecommendation;
}

export function HeroSection({ hero }: HeroSectionProps) {
  const navigation = useNavigation<any>();

  // Use cached cover URL
  const coverUrl = useCoverUrl(hero.book.id);

  const handlePress = useCallback(() => {
    navigation.navigate('BookDetail', { id: hero.book.id });
  }, [navigation, hero.book.id]);

  const { book, reason } = hero;

  return (
    <TouchableOpacity
      style={styles.content}
      onPress={handlePress}
      activeOpacity={0.9}
    >
      {/* Cover Image */}
      <View style={styles.coverContainer}>
        <Image
          source={coverUrl || book.coverUrl}
          style={styles.cover}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={200}
        />
      </View>

      {/* Info */}
      <View style={styles.info}>
        {/* Recommendation Label */}
        <View style={styles.labelRow}>
          <Icon name="sparkles" size={scale(10)} color={COLORS.playButton} set="ionicons" />
          <Text style={styles.label}>RECOMMENDED</Text>
        </View>

        <Text style={styles.title} numberOfLines={2}>{book.title}</Text>
        <Text style={styles.author} numberOfLines={1}>{book.author}</Text>

        <View style={styles.meta}>
          <Text style={styles.duration}>{formatDuration(book.duration)}</Text>
          {book.genres[0] && (
            <>
              <Text style={styles.dot}>•</Text>
              <Text style={styles.genre}>{book.genres[0]}</Text>
            </>
          )}
        </View>
      </View>

      {/* Download button */}
      <CircularDownloadButton
        book={{ id: book.id } as any}
        size={scale(36)}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: LAYOUT.carouselPaddingHorizontal,
    paddingVertical: scale(12),
    marginBottom: DIMENSIONS.sectionGap,
  },
  coverContainer: {
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: DIMENSIONS.coverRadius,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  info: {
    flex: 1,
    marginLeft: scale(14),
    justifyContent: 'center',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    marginBottom: scale(4),
  },
  label: {
    fontSize: scale(9),
    fontFamily: MONO_FONT,
    color: COLORS.playButton,
    letterSpacing: 1,
  },
  title: {
    fontSize: scale(14),
    fontFamily: MONO_FONT,
    fontWeight: '600',
    color: COLORS.textPrimary,
    lineHeight: scale(18),
  },
  author: {
    fontSize: scale(11),
    fontFamily: MONO_FONT,
    color: COLORS.textSecondary,
    marginTop: scale(2),
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: scale(6),
  },
  duration: {
    fontSize: scale(10),
    fontFamily: MONO_FONT,
    color: COLORS.textTertiary,
  },
  dot: {
    fontSize: scale(10),
    color: COLORS.textTertiary,
    marginHorizontal: scale(4),
  },
  genre: {
    fontSize: scale(10),
    fontFamily: MONO_FONT,
    color: COLORS.textTertiary,
  },
});
