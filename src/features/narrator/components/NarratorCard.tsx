/**
 * src/features/narrator/components/NarratorCard.tsx
 * 
 * Card displaying narrator information with book count.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NarratorInfo } from '../services/narratorAdapter';
import { theme } from '@/shared/theme';
import { Icon } from '@/shared/components/Icon';

interface NarratorCardProps {
  narrator: NarratorInfo;
}

export function NarratorCard({ narrator }: NarratorCardProps) {
  const navigation = useNavigation();

  const handlePress = () => {
    navigation.navigate('NarratorDetail' as never, { narratorId: narrator.id } as never);
  };

  // Generate initials for avatar
  const initials = narrator.name
    .split(' ')
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // Generate a consistent color based on name
  const colorIndex = narrator.name.charCodeAt(0) % 5;
  const avatarColors = [
    theme.colors.primary[500],
    theme.colors.semantic.success,
    theme.colors.semantic.warning,
    theme.colors.semantic.info,
    theme.colors.neutral[600],
  ];

  return (
    <Pressable
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      onPress={handlePress}
    >
      <View style={[styles.avatar, { backgroundColor: avatarColors[colorIndex] }]}>
        <Text style={styles.initials}>{initials}</Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>
          {narrator.name}
        </Text>
        <Text style={styles.bookCount}>
          {narrator.bookCount} {narrator.bookCount === 1 ? 'book' : 'books'}
        </Text>
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
  avatar: {
    aspectRatio: 1,
    borderRadius: theme.radius.large,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.elevation.small,
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