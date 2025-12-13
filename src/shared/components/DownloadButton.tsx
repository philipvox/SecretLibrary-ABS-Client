/**
 * src/shared/components/DownloadButton.tsx
 *
 * Button to download/manage offline audio files.
 */

import React from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useDownloadStatus } from '@/core/hooks/useDownloads';
import { downloadManager } from '@/core/services/downloadManager';
import { LibraryItem } from '@/core/types';
import { colors } from '@/shared/theme';
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

interface DownloadButtonProps {
  item: LibraryItem;
  size?: 'small' | 'medium' | 'large';
  variant?: 'icon' | 'button';
  showProgress?: boolean;
}

const SIZES = {
  small: { icon: 16, button: 28 },
  medium: { icon: 20, button: 36 },
  large: { icon: 24, button: 44 },
};

export function DownloadButton({
  item,
  size = 'medium',
  variant = 'icon',
  showProgress = true,
}: DownloadButtonProps) {
  const { isDownloaded, isDownloading, isPending, isPaused, hasError, progress, error } =
    useDownloadStatus(item.id);

  const { icon: iconSize, button: buttonSize } = SIZES[size];

  const handlePress = async () => {
    if (isDownloaded) {
      // Show delete confirmation or toggle menu
      await downloadManager.deleteDownload(item.id);
    } else if (isDownloading) {
      await downloadManager.pauseDownload(item.id);
    } else if (isPaused) {
      await downloadManager.resumeDownload(item.id);
    } else if (hasError) {
      // Retry download
      await downloadManager.queueDownload(item, 10);
    } else {
      await downloadManager.queueDownload(item);
    }
  };

  const getIconAndColor = () => {
    if (isDownloaded) {
      return {
        icon: <Feather name="check-circle" size={iconSize} color="#4CAF50" />,
        color: '#4CAF50',
        label: 'Downloaded',
      };
    }
    if (isDownloading) {
      const progressPct = Math.round(progress * 100);
      return {
        icon: <Feather name="pause" size={iconSize} color={colors.accent} />,
        color: colors.accent,
        label: progressPct === 0 ? 'Preparing...' : `${progressPct}%`,
      };
    }
    if (isPending) {
      return {
        icon: <ActivityIndicator size="small" color={colors.textSecondary} />,
        color: colors.textSecondary,
        label: 'Queued',
      };
    }
    if (isPaused) {
      return {
        icon: <Feather name="play" size={iconSize} color="#FF9800" />,
        color: '#FF9800',
        label: 'Paused',
      };
    }
    if (hasError) {
      return {
        icon: <Feather name="alert-circle" size={iconSize} color="#F44336" />,
        color: '#F44336',
        label: 'Retry',
      };
    }
    return {
      icon: <Feather name="download" size={iconSize} color={colors.textSecondary} />,
      color: colors.textSecondary,
      label: 'Download',
    };
  };

  const config = getIconAndColor();

  // Progress ring for downloading state
  const progressStyle = useAnimatedStyle(() => {
    return {
      strokeDashoffset: withTiming((1 - progress) * 100, { duration: 200 }),
    };
  });

  if (variant === 'icon') {
    return (
      <TouchableOpacity
        onPress={handlePress}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={styles.iconContainer}
      >
        {isDownloading && showProgress ? (
          <View style={[styles.progressContainer, { width: buttonSize, height: buttonSize }]}>
            <View style={styles.progressBackground}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${progress * 100}%`,
                    backgroundColor: config.color,
                  },
                ]}
              />
            </View>
            {config.icon}
          </View>
        ) : (
          config.icon
        )}
      </TouchableOpacity>
    );
  }

  // Button variant
  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[
        styles.button,
        {
          backgroundColor: isDownloaded
            ? 'rgba(76, 175, 80, 0.15)'
            : 'rgba(255, 255, 255, 0.1)',
          borderColor: config.color,
        },
      ]}
    >
      {config.icon}
      <Text style={[styles.buttonText, { color: config.color }]}>{config.label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    padding: 4,
  },
  progressContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  progressBackground: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 1,
  },
  progressFill: {
    height: '100%',
    borderRadius: 1,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
