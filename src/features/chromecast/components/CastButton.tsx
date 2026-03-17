/**
 * Cast icon button that appears in the player header when Cast devices are available.
 * Tapping shows the native Cast device picker.
 */

import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Cast } from 'lucide-react-native';
import { useCastStore } from '../stores/castStore';
import { scale, useTheme } from '@/shared/theme';

interface CastButtonProps {
  size?: number;
}

export function CastButton({ size = 22 }: CastButtonProps) {
  const { colors } = useTheme();
  const isAvailable = useCastStore((s) => s.isAvailable);
  const isConnected = useCastStore((s) => s.isConnected);
  const showPicker = useCastStore((s) => s.showPicker);

  if (!isAvailable) return null;

  return (
    <TouchableOpacity
      onPress={showPicker}
      style={styles.button}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Cast
        size={scale(size)}
        color={isConnected ? String(colors.accent) : String(colors.text.secondary)}
        strokeWidth={2}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 4,
    minHeight: scale(44),
    minWidth: scale(44),
    justifyContent: 'center',
    alignItems: 'center',
  },
});
