/**
 * Icon component wrapper for consistent icon usage
 */

import React from 'react';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@/shared/theme';

type IconSet = 'ionicons' | 'feather' | 'material';

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  set?: IconSet;
}

export function Icon({ name, size = 24, color = theme.colors.text.primary, set = 'ionicons' }: IconProps) {
  const IconComponent = {
    ionicons: Ionicons,
    feather: Feather,
    material: MaterialCommunityIcons,
  }[set];

  return <IconComponent name={name as any} size={size} color={color} />;
}