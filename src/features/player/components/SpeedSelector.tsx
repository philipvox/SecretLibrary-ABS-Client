// File: src/features/player/components/SpeedSelector.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePlayerStore } from '../stores/playerStore';
import { Icon } from '@/shared/components/Icon';
import { theme } from '@/shared/theme';

const SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

interface SpeedSelectorProps {
  visible: boolean;
  onClose: () => void;
}

export function SpeedSelector({ visible, onClose }: SpeedSelectorProps) {
  const insets = useSafeAreaInsets();
  const { playbackRate, setPlaybackRate } = usePlayerStore();

  const handleSelect = async (speed: number) => {
    await setPlaybackRate(speed);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <View style={styles.handle} />
          <Text style={styles.title}>Playback Speed</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="close" size={24} color={theme.colors.text.primary} set="ionicons" />
          </TouchableOpacity>
        </View>

        <View style={styles.speedList}>
          {SPEEDS.map((speed) => (
            <TouchableOpacity
              key={speed}
              style={[styles.speedItem, playbackRate === speed && styles.speedItemActive]}
              onPress={() => handleSelect(speed)}
            >
              <Text style={[styles.speedItemText, playbackRate === speed && styles.speedItemTextActive]}>
                {speed}x
              </Text>
              {playbackRate === speed && (
                <Icon name="checkmark" size={20} color={theme.colors.primary[500]} set="ionicons" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  header: {
    alignItems: 'center',
    paddingVertical: theme.spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.light,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: theme.colors.neutral[300],
    borderRadius: theme.radius.small,
    marginBottom: theme.spacing[3],
  },
  title: {
    ...theme.textStyles.h4,
    color: theme.colors.text.primary,
  },
  closeButton: {
    position: 'absolute',
    right: theme.spacing[4],
    top: theme.spacing[5],
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  speedList: {
    padding: theme.spacing[4],
  },
  speedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing[4],
    paddingHorizontal: theme.spacing[4],
    borderRadius: theme.radius.medium,
    marginBottom: theme.spacing[2],
  },
  speedItemActive: {
    backgroundColor: theme.colors.primary[50],
  },
  speedItemText: {
    ...theme.textStyles.body,
    color: theme.colors.text.primary,
  },
  speedItemTextActive: {
    color: theme.colors.primary[500],
    fontWeight: '600',
  },
});