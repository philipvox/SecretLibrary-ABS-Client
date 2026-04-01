/**
 * src/shared/components/LocalStorageNoticeModal.tsx
 *
 * Modal that notifies users that their library data is stored locally on their device.
 * Shows on fresh login and after app updates.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { Info, X, Settings } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { haptics } from '@/core/native/haptics';
import { spacing, scale, useTheme } from '@/shared/theme';
import { useLocalStorageNoticeStore } from '@/core/stores/localStorageNoticeStore';

interface LocalStorageNoticeModalProps {
  visible: boolean;
  onDismiss: () => void;
}

export function LocalStorageNoticeModal({ visible, onDismiss }: LocalStorageNoticeModalProps) {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const [neverShowAgain, setNeverShowAgain] = useState(false);
  const dismissNotice = useLocalStorageNoticeStore((s) => s.dismissNotice);

  const handleDismiss = () => {
    haptics.selection();
    dismissNotice(neverShowAgain);
    onDismiss();
  };

  const handleGoToSettings = () => {
    haptics.impact('light');
    dismissNotice(neverShowAgain);
    onDismiss();
    // Navigate to storage settings
    navigation.navigate('DataStorageSettings');
  };

  const toggleNeverShow = () => {
    haptics.selection();
    setNeverShowAgain((prev) => !prev);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.background.elevated }]}>
          {/* Header with icon */}
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: colors.accent.primary + '20' }]}>
              <Info size={24} color={colors.accent.primary} strokeWidth={2} />
            </View>
            <TouchableOpacity onPress={handleDismiss} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Close">
              <X size={20} color={colors.text.secondary} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.text.primary }]}>
            Local Library Storage
          </Text>

          {/* Body text */}
          <Text style={[styles.body, { color: colors.text.secondary }]}>
            Your library data and reading progress are stored locally on this device.
          </Text>
          <Text style={[styles.body, { color: colors.text.secondary, marginTop: spacing.sm }]}>
            If you reinstall the app or clear app data, your library will need to sync again from the server.
          </Text>
          <Text style={[styles.body, { color: colors.text.secondary, marginTop: spacing.sm }]}>
            To configure storage and backup options, visit Settings.
          </Text>

          {/* Never show again checkbox */}
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={toggleNeverShow}
            activeOpacity={0.7}
            accessibilityRole="checkbox"
            accessibilityLabel="Don't show this again"
            accessibilityState={{ checked: neverShowAgain }}
          >
            <View style={[
              styles.checkbox,
              { borderColor: colors.border.default },
              neverShowAgain && { backgroundColor: colors.accent.primary, borderColor: colors.accent.primary },
            ]}>
              {neverShowAgain && (
                <Text style={styles.checkmark}>✓</Text>
              )}
            </View>
            <Text style={[styles.checkboxLabel, { color: colors.text.secondary }]}>
              Don't show this again
            </Text>
          </TouchableOpacity>

          {/* Action buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton, { borderColor: colors.border.default }]}
              onPress={handleDismiss}
              accessibilityRole="button"
              accessibilityLabel="Got it, dismiss"
            >
              <Text style={[styles.buttonText, { color: colors.text.primary }]}>Got it</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton, { backgroundColor: colors.text.primary }]}
              onPress={handleGoToSettings}
              accessibilityRole="button"
              accessibilityLabel="Go to storage settings"
            >
              <Settings size={16} color={colors.background.primary} strokeWidth={2} />
              <Text style={[styles.buttonText, { color: colors.background.primary, marginLeft: spacing.xs }]}>
                Settings
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  container: {
    width: '100%',
    maxWidth: 360,
    borderRadius: scale(16),
    padding: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  iconContainer: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(24),
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: scale(20),
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  body: {
    fontSize: scale(14),
    lineHeight: scale(20),
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  checkbox: {
    width: scale(20),
    height: scale(20),
    borderRadius: scale(4),
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  checkmark: {
    color: '#000',
    fontSize: scale(12),
    fontWeight: '700',
  },
  checkboxLabel: {
    fontSize: scale(14),
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: scale(8),
  },
  secondaryButton: {
    borderWidth: 1,
  },
  primaryButton: {
    // Background set dynamically
  },
  buttonText: {
    fontSize: scale(15),
    fontWeight: '600',
  },
});

export default LocalStorageNoticeModal;
