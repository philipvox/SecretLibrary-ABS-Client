/**
 * src/features/downloads/components/DownloadButton.tsx
 */

import React from 'react';
import { TouchableOpacity, View, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { useBookDownload } from '../hooks/useDownloads';
import { LibraryItem } from '@/core/types';
import { theme } from '@/shared/theme';

interface DownloadButtonProps {
  item: LibraryItem;
  size?: number;
  color?: string;
}

export function DownloadButton({ item, size = 24, color = theme.colors.text.primary }: DownloadButtonProps) {
  const { downloaded, downloading, progress, download, cancel, remove } = useBookDownload(item.id);

  const handlePress = async () => {
    if (downloading) {
      Alert.alert('Cancel Download', 'Are you sure you want to cancel this download?', [
        { text: 'No', style: 'cancel' },
        { text: 'Yes', onPress: cancel },
      ]);
    } else if (downloaded) {
      Alert.alert('Remove Download', 'This will remove the downloaded file from your device.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: remove },
      ]);
    } else {
      try {
        await download(item);
      } catch (error) {
        Alert.alert('Download Failed', error instanceof Error ? error.message : 'Unknown error');
      }
    }
  };

  const renderIcon = () => {
    if (downloading && progress) {
      const strokeWidth = 2;
      const radius = (size - strokeWidth) / 2;
      const circumference = 2 * Math.PI * radius;
      const strokeDashoffset = circumference * (1 - progress.progress);

      return (
        <View style={styles.progressContainer}>
          <Svg width={size} height={size}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={theme.colors.neutral[200]}
              strokeWidth={strokeWidth}
              fill="none"
            />
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={theme.colors.primary[500]}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          </Svg>
          <View style={[styles.stopIcon, { width: size * 0.3, height: size * 0.3 }]} />
        </View>
      );
    }

    if (downloaded) {
      return <Ionicons name="checkmark-circle" size={size} color={theme.colors.status.success} />;
    }

    return <Ionicons name="cloud-download-outline" size={size} color={color} />;
  };

  return (
    <TouchableOpacity onPress={handlePress} style={styles.button} activeOpacity={0.7}>
      {renderIcon()}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: theme.spacing[2],
  },
  progressContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopIcon: {
    position: 'absolute',
    backgroundColor: theme.colors.primary[500],
    borderRadius: 2,
  },
});