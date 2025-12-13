// File: src/features/narrator/components/NarratorCard.tsx
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NarratorInfo } from '../services/narratorAdapter';
import { colors, spacing, radius, elevation } from '@/shared/theme';
import { Icon } from '@/shared/components/Icon';

interface NarratorCardProps {
  narrator: NarratorInfo;
}

export function NarratorCard({ narrator }: NarratorCardProps) {
  const navigation = useNavigation();

  const handlePress = () => {
    navigation.navigate('NarratorDetail' as never, { narratorName: narrator.name } as never);
  };

  const initials = narrator.name
    .split(' ')
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const colorIndex = narrator.name.charCodeAt(0) % 5;
  const avatarColors = [
    colors.accent,
    '#4CAF50',
    '#FF9800',
    '#2196F3',
    colors.progressTrack,
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
    marginBottom: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
  avatar: {
    aspectRatio: 1,
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    ...elevation.small,
  },
  initials: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  info: {
    marginTop: spacing.xs,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
    lineHeight: 20,
  },
  bookCount: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});