/**
 * src/features/player/panels/SettingsPanel.tsx
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Icon } from '@/shared/components/Icon';
import { spacing, radius } from '@/shared/theme';

// =============================================================================
// TYPES
// =============================================================================

interface SettingsPanelProps {
  controlMode: 'rewind' | 'chapter';
  progressMode: 'bar' | 'chapters';
  onControlModeChange: (mode: 'rewind' | 'chapter') => void;
  onProgressModeChange: (mode: 'bar' | 'chapters') => void;
  onViewChapters: () => void;
  onViewDetails: () => void;
  isLight: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function SettingsPanel({
  controlMode,
  progressMode,
  onControlModeChange,
  onProgressModeChange,
  onViewChapters,
  onViewDetails,
  isLight,
}: SettingsPanelProps) {
  const textColor = isLight ? '#000000' : '#FFFFFF';
  const secondaryColor = isLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)';
  const buttonBg = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.15)';
  const activeButtonBg = isLight ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.95)';
  const activeButtonText = isLight ? '#FFFFFF' : '#000000';

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Title */}
      <Text style={[styles.title, { color: textColor }]}>Settings</Text>

      {/* Control Mode Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: secondaryColor }]}>
          Skip Buttons
        </Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[
              styles.toggleOption,
              { backgroundColor: controlMode === 'rewind' ? activeButtonBg : buttonBg },
            ]}
            onPress={() => onControlModeChange('rewind')}
            activeOpacity={0.7}
          >
            <Icon
              name="play-back"
              size={20}
              color={controlMode === 'rewind' ? activeButtonText : textColor}
              set="ionicons"
            />
            <Text
              style={[
                styles.toggleText,
                { color: controlMode === 'rewind' ? activeButtonText : textColor },
              ]}
            >
              Time Skip
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleOption,
              { backgroundColor: controlMode === 'chapter' ? activeButtonBg : buttonBg },
            ]}
            onPress={() => onControlModeChange('chapter')}
            activeOpacity={0.7}
          >
            <Icon
              name="play-skip-forward"
              size={20}
              color={controlMode === 'chapter' ? activeButtonText : textColor}
              set="ionicons"
            />
            <Text
              style={[
                styles.toggleText,
                { color: controlMode === 'chapter' ? activeButtonText : textColor },
              ]}
            >
              Chapter
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Progress Mode Section */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: secondaryColor }]}>
          Progress Display
        </Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[
              styles.toggleOption,
              { backgroundColor: progressMode === 'chapters' ? activeButtonBg : buttonBg },
            ]}
            onPress={() => onProgressModeChange('chapters')}
            activeOpacity={0.7}
          >
            <Icon
              name="bookmark-outline"
              size={20}
              color={progressMode === 'chapters' ? activeButtonText : textColor}
              set="ionicons"
            />
            <Text
              style={[
                styles.toggleText,
                { color: progressMode === 'chapters' ? activeButtonText : textColor },
              ]}
            >
              Chapter
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleOption,
              { backgroundColor: progressMode === 'bar' ? activeButtonBg : buttonBg },
            ]}
            onPress={() => onProgressModeChange('bar')}
            activeOpacity={0.7}
          >
            <Icon
              name="book-outline"
              size={20}
              color={progressMode === 'bar' ? activeButtonText : textColor}
              set="ionicons"
            />
            <Text
              style={[
                styles.toggleText,
                { color: progressMode === 'bar' ? activeButtonText : textColor },
              ]}
            >
              Full Book
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Links */}
      <View style={styles.linksSection}>
        <TouchableOpacity
          style={[styles.linkButton, { backgroundColor: buttonBg }]}
          onPress={onViewChapters}
          activeOpacity={0.7}
        >
          <Icon name="list" size={20} color={textColor} set="ionicons" />
          <Text style={[styles.linkText, { color: textColor }]}>View Chapters</Text>
          <Icon name="chevron-forward" size={18} color={secondaryColor} set="ionicons" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.linkButton, { backgroundColor: buttonBg }]}
          onPress={onViewDetails}
          activeOpacity={0.7}
        >
          <Icon name="information-circle-outline" size={20} color={textColor} set="ionicons" />
          <Text style={[styles.linkText, { color: textColor }]}>Book Details</Text>
          <Icon name="chevron-forward" size={18} color={secondaryColor} set="ionicons" />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 0,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  toggleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  toggleText: {
    fontSize: 15,
    fontWeight: '600',
  },
  linksSection: {
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    gap: spacing.md,
  },
  linkText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
});

export default SettingsPanel;