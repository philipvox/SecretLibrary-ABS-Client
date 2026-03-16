/**
 * src/features/profile/screens/DeveloperSettingsScreen.tsx
 *
 * Developer settings screen accessible via 5 taps on version.
 * Contains toggles and tools for development/debugging.
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  ChevronRight,
  RefreshCw,
  Paintbrush,
  Bug,
  type LucideIcon,
} from 'lucide-react-native';
import { SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { scale } from '@/shared/theme';
import {
  secretLibraryColors as colors,
  secretLibraryFonts as fonts,
} from '@/shared/theme/secretLibrary';
import { SettingsHeader } from '../components/SettingsHeader';
import { imageCacheService } from '@/core/services/imageCacheService';

// =============================================================================
// COMPONENTS
// =============================================================================

interface SettingsRowProps {
  Icon: LucideIcon;
  label: string;
  value?: string;
  onPress?: () => void;
  switchValue?: boolean;
  onSwitchChange?: (value: boolean) => void;
  description?: string;
}

function SettingsRow({
  Icon,
  label,
  value,
  onPress,
  switchValue,
  onSwitchChange,
  description,
}: SettingsRowProps) {
  const content = (
    <View style={styles.settingsRow}>
      <View style={styles.rowLeft}>
        <View style={styles.iconContainer}>
          <Icon size={scale(18)} color={colors.gray} strokeWidth={1.5} />
        </View>
        <View style={styles.rowContent}>
          <Text style={styles.rowLabel}>{label}</Text>
          {description && <Text style={styles.rowDescription}>{description}</Text>}
        </View>
      </View>
      <View style={styles.rowRight}>
        {value && <Text style={styles.rowValue}>{value}</Text>}
        {onSwitchChange !== undefined && (
          <Switch
            value={switchValue}
            onValueChange={onSwitchChange}
            trackColor={{ false: 'rgba(0,0,0,0.1)', true: colors.black }}
            thumbColor={colors.white}
            ios_backgroundColor="rgba(0,0,0,0.1)"
          />
        )}
        {onPress && <ChevronRight size={scale(16)} color={colors.gray} strokeWidth={1.5} />}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <View style={styles.sectionHeaderContainer}>
      <Text style={styles.sectionHeader}>{title}</Text>
      {description && <Text style={styles.sectionDescription}>{description}</Text>}
    </View>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function DeveloperSettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const handleResetCachePrompt = useCallback(async () => {
    try {
      await imageCacheService.resetCachePromptSeen();
      Alert.alert('Done', 'Cache prompt will show again on next app launch.');
    } catch {
      Alert.alert('Error', 'Failed to reset cache prompt.');
    }
  }, []);

  const handleOpenSpinePlayground = useCallback(() => {
    navigation.navigate('SpinePlayground');
  }, [navigation]);

  const handleOpenDebugStressTest = useCallback(() => {
    navigation.navigate('DebugStressTest');
  }, [navigation]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.grayLight} />
      <SettingsHeader title="Developer" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: SCREEN_BOTTOM_PADDING + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Dev Notice */}
        <View style={styles.devNotice}>
          <Bug size={scale(20)} color={colors.gray} strokeWidth={1.5} />
          <Text style={styles.devNoticeText}>
            These settings are for development and testing. Use with caution.
          </Text>
        </View>

        {/* Onboarding Section */}
        <View style={styles.section}>
          <SectionHeader
            title="Onboarding"
            description="Reset first-launch prompts and flows"
          />
          <View style={styles.sectionCard}>
            <SettingsRow
              Icon={RefreshCw}
              label="Reset Cache Prompt"
              onPress={handleResetCachePrompt}
              description="Show the image cache prompt again on next launch"
            />
          </View>
        </View>

        {/* Debug Tools Section */}
        <View style={styles.section}>
          <SectionHeader
            title="Debug Tools"
            description="Development and testing utilities"
          />
          <View style={styles.sectionCard}>
            <SettingsRow
              Icon={Paintbrush}
              label="Spine Playground"
              onPress={handleOpenSpinePlayground}
              description="Test spine templates and styles"
            />
            <SettingsRow
              Icon={Bug}
              label="Stress Test"
              onPress={handleOpenDebugStressTest}
              description="Memory and performance testing"
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.grayLight,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
  },
  // Dev Notice
  devNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,200,0,0.15)',
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  devNoticeText: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(10),
    color: colors.gray,
    flex: 1,
    lineHeight: scale(16),
  },
  // Sections
  section: {
    marginBottom: 24,
  },
  sectionHeaderContainer: {
    marginBottom: 12,
    paddingLeft: 4,
  },
  sectionHeader: {
    fontFamily: fonts.playfair.regular,
    fontSize: scale(16),
    color: colors.black,
    marginBottom: 4,
  },
  sectionDescription: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(11),
    color: colors.gray,
    lineHeight: scale(16),
  },
  sectionCard: {
    backgroundColor: colors.white,
  },
  // Settings Row
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(8),
    backgroundColor: colors.grayLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowContent: {
    flex: 1,
    marginLeft: 12,
  },
  rowLabel: {
    fontFamily: fonts.playfair.regular,
    fontSize: scale(15),
    color: colors.black,
  },
  rowDescription: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(9),
    color: colors.gray,
    marginTop: 2,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowValue: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(11),
    color: colors.black,
  },
});
