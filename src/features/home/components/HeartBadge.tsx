/**
 * src/features/home/components/HeartBadge.tsx
 *
 * Heart badge component for favorite indication on cards
 */

import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Icon } from '@/shared/components/Icon';
import { COLORS, HEART_BADGE } from '../constants';
import { HeartBadgeProps } from '../types';

export function HeartBadge({
  isFavorite,
  size = HEART_BADGE.size,
  onPress,
  style,
}: HeartBadgeProps) {
  const iconSize = Math.round(size * 0.64); // Icon is ~64% of badge size

  const content = (
    <Icon
      name={isFavorite ? 'heart' : 'heart-outline'}
      size={iconSize}
      color={isFavorite ? COLORS.heartFill : COLORS.heartOutline}
    />
  );

  if (onPress) {
    return (
      <TouchableOpacity
        style={[styles.badge, { width: size, height: size }, style]}
        onPress={onPress}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.7}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.badge, { width: size, height: size }, style] as ViewStyle[]}
      activeOpacity={1}
      disabled
    >
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  badge: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
