/**
 * src/features/profile/components/SettingsHeader.tsx
 *
 * Reusable header component for settings sub-pages.
 * Secret Library design with back button and title.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { scale, useSecretLibraryColors } from '@/shared/theme';
import { secretLibraryFonts as fonts } from '@/shared/theme/secretLibrary';

interface SettingsHeaderProps {
  title: string;
}

export function SettingsHeader({ title }: SettingsHeaderProps) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const colors = useSecretLibraryColors();

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.grayLight }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronLeft size={scale(24)} color={colors.black} strokeWidth={1.5} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.black }]}>{title}</Text>
        <View style={styles.spacer} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontFamily: fonts.playfair.regular,
    fontSize: scale(18),
    textAlign: 'center',
  },
  spacer: {
    width: 44,
  },
});
