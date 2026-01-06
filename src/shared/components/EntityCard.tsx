/**
 * src/shared/components/EntityCard.tsx
 *
 * Unified card for Author/Narrator entities in grid layouts.
 * Uses theme colors, typography tokens, and consistent styling.
 */

import React, { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import {
  spacing,
  radius,
  elevation,
  typography,
  scale,
  interactiveStates,
  cardTokens,
} from '@/shared/theme';
import { useThemeColors } from '@/shared/theme/themeStore';

// Avatar color palette for initials
const AVATAR_COLORS = [
  '#E53935', // Accent red
  '#4CAF50', // Green
  '#FF9800', // Orange
  '#2196F3', // Blue
  '#9C27B0', // Purple
] as const;

/** Entity types supported by this card */
export type EntityType = 'author' | 'narrator';

export interface EntityCardProps {
  /** Entity type - determines navigation and icon */
  type: EntityType;
  /** Entity ID for navigation */
  id?: string;
  /** Display name */
  name: string;
  /** Number of books by this entity */
  bookCount: number;
  /** Image URL (optional - shows initials if not provided) */
  imageUrl?: string;
  /** Callback when card is pressed */
  onPress?: () => void;
}

/**
 * Generate initials from a name (up to 2 characters)
 */
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * Get a consistent color based on the name
 */
function getAvatarColor(name: string): string {
  const colorIndex = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[colorIndex];
}

function EntityCardComponent({
  type,
  name,
  bookCount,
  imageUrl,
  onPress,
}: EntityCardProps) {
  const themeColors = useThemeColors();
  const initials = getInitials(name);
  const avatarColor = getAvatarColor(name);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        pressed && { opacity: interactiveStates.press.opacity },
      ]}
      onPress={onPress}
      accessibilityLabel={`${name}, ${type}, ${bookCount} ${bookCount === 1 ? 'book' : 'books'}`}
      accessibilityRole="button"
      accessibilityHint={`Double tap to view ${type} details`}
    >
      <View
        style={[
          styles.avatarContainer,
          { backgroundColor: themeColors.backgroundSecondary },
        ]}
      >
        {imageUrl ? (
          <Image
            source={imageUrl}
            style={styles.avatar}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View
            style={[
              styles.avatar,
              styles.initialsAvatar,
              { backgroundColor: avatarColor },
            ]}
          >
            <Text style={styles.initials}>{initials}</Text>
          </View>
        )}
      </View>

      <View style={styles.info}>
        <Text
          style={[styles.name, { color: themeColors.text }]}
          numberOfLines={2}
        >
          {name}
        </Text>
        {bookCount > 0 && (
          <Text style={[styles.bookCount, { color: themeColors.textSecondary }]}>
            {bookCount} {bookCount === 1 ? 'book' : 'books'}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

// Memoize to prevent unnecessary re-renders in lists
export const EntityCard = memo(EntityCardComponent);

const styles = StyleSheet.create({
  container: {
    width: '48%',
    marginBottom: spacing.md,
  },
  avatarContainer: {
    aspectRatio: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
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
    fontSize: scale(36),
    fontWeight: '700',
    color: '#FFFFFF', // Always white on colored background
  },
  info: {
    marginTop: spacing.xs,
  },
  name: {
    ...typography.headlineMedium,
    marginBottom: spacing.xxs,
  },
  bookCount: {
    ...typography.bodySmall,
  },
});

export default EntityCard;
