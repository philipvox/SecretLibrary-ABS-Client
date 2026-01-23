/**
 * src/features/browse/components/BrowseTopNav.tsx
 *
 * Top navigation bar for the Browse screen.
 * Uses the standard TopNav component with mood indicator pill.
 */

import React, { useMemo, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { secretLibraryColors as staticColors } from '@/shared/theme/secretLibrary';
import { TopNav, TopNavCloseIcon, Icon } from '@/shared/components';
import {
  useActiveSession,
  useHasActiveSession,
  useMoodSessionStore,
} from '@/features/mood-discovery/stores/moodSessionStore';
import { MOODS } from '@/features/mood-discovery/types';

interface BrowseTopNavProps {
  onMoodPress?: () => void;
  onClose?: () => void;
  onLogoPress?: () => void;
  onLogoLongPress?: () => void;
}

export function BrowseTopNav({ onMoodPress, onClose, onLogoPress, onLogoLongPress }: BrowseTopNavProps) {
  // Mood session hooks
  const hasActiveSession = useHasActiveSession();
  const session = useActiveSession();
  const clearSession = useMoodSessionStore((state) => state.clearSession);

  // Get active mood config for display
  const activeMoodConfig = useMemo(() => {
    if (!session?.mood) return null;
    return MOODS.find((m) => m.id === session.mood) || null;
  }, [session?.mood]);

  const handleClearMood = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    clearSession();
  }, [clearSession]);

  // Build pills array - always show mood pill, different style when active
  const pills = useMemo(() => {
    if (hasActiveSession && activeMoodConfig) {
      // Active mood: filled pill with label and X to cancel
      return [
        {
          key: 'mood',
          label: activeMoodConfig.label,
          icon: (
            <Icon
              name={activeMoodConfig.icon}
              size={12}
              color={staticColors.black}
              set={activeMoodConfig.iconSet as any}
            />
          ),
          active: true,
          onPress: handleClearMood, // Tap to cancel
          showClose: true, // Show X indicator
        },
      ];
    }
    // No active mood: outline white pill with filled icon
    return [
      {
        key: 'mood',
        label: 'Mood',
        icon: (
          <Icon
            name="Sparkles"
            size={12}
            color={staticColors.white}
            fill={staticColors.white}
          />
        ),
        active: false,
        outline: true, // White outline style
        onPress: onMoodPress,
      },
    ];
  }, [hasActiveSession, activeMoodConfig, onMoodPress, handleClearMood]);

  return (
    <View style={[styles.container, { backgroundColor: staticColors.black }]}>
      <TopNav
        variant="dark"
        showLogo={true}
        onLogoPress={onLogoPress}
        onLogoLongPress={onLogoLongPress}
        style={{ backgroundColor: 'transparent' }}
        includeSafeArea={false}
        pills={pills}
        circleButtons={[
          {
            key: 'close',
            icon: <TopNavCloseIcon color={staticColors.cream} size={14} />,
            onPress: onClose,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: staticColors.black,
  },
});
