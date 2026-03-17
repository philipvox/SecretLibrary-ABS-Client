/**
 * Bottom sheet displaying connected Cast device info and disconnect option.
 * Shown when tapping the Cast button while connected.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Cast, X } from 'lucide-react-native';
import { useCastStore } from '../stores/castStore';
import { spacing, radius, scale, useTheme } from '@/shared/theme';

interface CastDeviceSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function CastDeviceSheet({ visible, onClose }: CastDeviceSheetProps) {
  const { colors } = useTheme();
  const deviceName = useCastStore((s) => s.deviceName);
  const isPlaying = useCastStore((s) => s.isPlaying);
  const disconnect = useCastStore((s) => s.disconnect);

  const handleDisconnect = async () => {
    await disconnect();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.sheet, { backgroundColor: colors.background.secondary }]}>
          <View style={styles.header}>
            <Cast size={scale(24)} color={String(colors.accent)} strokeWidth={2} />
            <Text style={[styles.title, { color: colors.text.primary }]}>
              Casting to {deviceName || 'device'}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={scale(20)} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.status, { color: colors.text.secondary }]}>
            {isPlaying ? 'Playing' : 'Paused'}
          </Text>

          <TouchableOpacity
            onPress={handleDisconnect}
            style={[styles.disconnectButton, { borderColor: colors.text.secondary }]}
          >
            <Text style={[styles.disconnectText, { color: colors.text.primary }]}>
              Disconnect
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
    paddingBottom: spacing.xl + 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  status: {
    fontSize: 14,
    marginBottom: spacing.xl,
  },
  disconnectButton: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  disconnectText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
