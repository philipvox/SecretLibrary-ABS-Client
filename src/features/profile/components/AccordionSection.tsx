/**
 * src/features/profile/components/AccordionSection.tsx
 *
 * Animated accordion section for settings screens.
 * Based on CollapsibleSection pattern with adaptations for settings context:
 * - Shows status text when collapsed
 * - Supports controlled expand/collapse for single-open behavior
 * - Haptic feedback on toggle
 */

import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { scale, useSecretLibraryColors } from '@/shared/theme';
import { secretLibraryFonts as fonts } from '@/shared/theme/secretLibrary';
import { haptics } from '@/core/native/haptics';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface AccordionSectionProps {
  title: string;
  /** Status text shown on the right when collapsed (e.g., "3 books") */
  status?: string;
  children: React.ReactNode;
  /** Controlled expanded state */
  isExpanded: boolean;
  /** Callback when expand/collapse toggled */
  onToggle: () => void;
}

export function AccordionSection({
  title,
  status,
  children,
  isExpanded,
  onToggle,
}: AccordionSectionProps) {
  const colors = useSecretLibraryColors();
  const rotateAnim = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;

  // Animate chevron rotation
  useEffect(() => {
    Animated.timing(rotateAnim, {
      toValue: isExpanded ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isExpanded, rotateAnim]);

  const handleToggle = () => {
    haptics.toggle();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onToggle();
  };

  const chevronRotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-90deg', '0deg'],
  });

  return (
    <View style={styles.container}>
      {/* Header row */}
      <Pressable
        onPress={handleToggle}
        style={[styles.header, { backgroundColor: colors.white }]}
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
        accessibilityLabel={`${isExpanded ? 'Collapse' : 'Expand'} ${title} section`}
      >
        <View style={styles.headerLeft}>
          <Animated.View style={{ transform: [{ rotate: chevronRotation }] }}>
            <ChevronDown size={scale(16)} color={colors.gray} strokeWidth={2} />
          </Animated.View>
          <Text style={[styles.headerTitle, { color: colors.black }]}>{title}</Text>
        </View>
        {!isExpanded && status ? (
          <Text style={[styles.headerStatus, { color: colors.gray }]}>{status}</Text>
        ) : null}
      </Pressable>

      {/* Content */}
      {isExpanded && (
        <View style={[styles.content, { backgroundColor: colors.white }]}>
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontFamily: fonts.playfair.regular,
    fontSize: scale(16),
  },
  headerStatus: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(10),
  },
  content: {
    // Content rendered directly below header
  },
});
