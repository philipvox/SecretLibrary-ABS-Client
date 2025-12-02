/**
 * src/shared/components/SyncStatusBadge.tsx
 *
 * Displays current sync and network status.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSyncStatus } from '@/core/hooks/useSyncStatus';
import { theme } from '@/shared/theme';
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

interface SyncStatusBadgeProps {
  showText?: boolean;
  size?: 'small' | 'medium';
  onPress?: () => void;
}

export function SyncStatusBadge({
  showText = true,
  size = 'small',
  onPress,
}: SyncStatusBadgeProps) {
  const { status, pendingCount, isOnline, triggerSync } = useSyncStatus();

  const iconSize = size === 'small' ? 14 : 18;
  const fontSize = size === 'small' ? 11 : 13;

  const spinStyle = useAnimatedStyle(() => {
    if (status === 'syncing') {
      return {
        transform: [
          {
            rotate: withRepeat(
              withTiming('360deg', {
                duration: 1000,
                easing: Easing.linear,
              }),
              -1,
              false
            ),
          },
        ],
      };
    }
    return { transform: [{ rotate: '0deg' }] };
  });

  const getStatusConfig = () => {
    switch (status) {
      case 'syncing':
        return {
          icon: (
            <Animated.View style={spinStyle}>
              <Feather name="refresh-cw" size={iconSize} color="#4CAF50" />
            </Animated.View>
          ),
          text: 'Syncing...',
          color: '#4CAF50',
          bgColor: 'rgba(76, 175, 80, 0.15)',
        };
      case 'offline':
        return {
          icon: <Feather name="cloud-off" size={iconSize} color="#FF9800" />,
          text: pendingCount > 0 ? `Offline (${pendingCount})` : 'Offline',
          color: '#FF9800',
          bgColor: 'rgba(255, 152, 0, 0.15)',
        };
      case 'error':
        return {
          icon: <Feather name="alert-circle" size={iconSize} color="#F44336" />,
          text: 'Sync error',
          color: '#F44336',
          bgColor: 'rgba(244, 67, 54, 0.15)',
        };
      default:
        if (pendingCount > 0) {
          return {
            icon: <Feather name="cloud" size={iconSize} color={theme.colors.text.secondary} />,
            text: `${pendingCount} pending`,
            color: theme.colors.text.secondary,
            bgColor: 'rgba(255, 255, 255, 0.08)',
          };
        }
        return {
          icon: <Feather name="check" size={iconSize} color="#4CAF50" />,
          text: 'Synced',
          color: '#4CAF50',
          bgColor: 'rgba(76, 175, 80, 0.1)',
        };
    }
  };

  const config = getStatusConfig();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (isOnline && status !== 'syncing') {
      triggerSync();
    }
  };

  const content = (
    <View style={[styles.container, { backgroundColor: config.bgColor }]}>
      {config.icon}
      {showText && (
        <Text style={[styles.text, { color: config.color, fontSize }]}>{config.text}</Text>
      )}
    </View>
  );

  if (onPress || (isOnline && status !== 'syncing')) {
    return (
      <TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  text: {
    fontWeight: '500',
  },
});
