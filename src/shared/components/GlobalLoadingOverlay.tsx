/**
 * src/shared/components/GlobalLoadingOverlay.tsx
 *
 * Global loading overlay that can be triggered from anywhere.
 * Uses Modal to render ABOVE native navigation stack.
 * Use globalLoading.show()/hide() to control it.
 */

import React, { memo } from 'react';
import { StyleSheet, Modal, View } from 'react-native';
import { useTheme } from '@/shared/theme';
import { useGlobalLoadingStore } from '@/shared/stores/globalLoadingStore';
import { CandleLoading } from './Loading';

export const GlobalLoadingOverlay = memo(function GlobalLoadingOverlay() {
  const { colors } = useTheme();
  const isLoading = useGlobalLoadingStore((s) => s.isLoading);

  // Don't render Modal at all when not loading - prevents touch blocking issues
  if (!isLoading) {
    return null;
  }

  return (
    <Modal
      visible={true}
      transparent={false}
      animationType="none"
      statusBarTranslucent={true}
      presentationStyle="fullScreen"
    >
      <View style={[styles.overlay, { backgroundColor: colors.background.primary }]}>
        <CandleLoading size={100} />
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
