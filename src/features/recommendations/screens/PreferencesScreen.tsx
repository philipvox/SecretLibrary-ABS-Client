/**
 * src/features/recommendations/screens/PreferencesScreen.tsx
 * 
 * View and edit preferences from Profile
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { usePreferencesStore } from '../stores/preferencesStore';
import { Icon } from '@/shared/components/Icon';
import { colors, spacing, radius } from '@/shared/theme';

export function PreferencesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const preferences = usePreferencesStore();

  const handleEditPreferences = () => {
    navigation.navigate('PreferencesOnboarding');
  };

  const handleResetPreferences = () => {
    preferences.resetPreferences();
  };

  const lengthLabels = {
    short: 'Quick listens (under 8 hours)',
    medium: 'Medium (8-20 hours)',
    long: 'Epic journeys (20+ hours)',
    any: 'No preference',
  };

  const seriesLabel = preferences.prefersSeries === null 
    ? 'No preference' 
    : preferences.prefersSeries 
      ? 'Prefers series' 
      : 'Prefers standalones';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={colors.textPrimary} set="ionicons" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reading Preferences</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {!preferences.hasCompletedOnboarding ? (
          <View style={styles.emptyState}>
            <Icon name="sparkles" size={48} color={colors.accent} set="ionicons" />
            <Text style={styles.emptyTitle}>Set up your preferences</Text>
            <Text style={styles.emptySubtitle}>
              Answer a few questions to get personalized recommendations
            </Text>
            <TouchableOpacity style={styles.setupButton} onPress={handleEditPreferences}>
              <Text style={styles.setupButtonText}>Get Started</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Moods */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Reading Moods</Text>
              <View style={styles.tagsRow}>
                {preferences.moods.length > 0 ? (
                  preferences.moods.map(mood => (
                    <View key={mood} style={styles.tag}>
                      <Text style={styles.tagText}>{mood}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>None selected</Text>
                )}
              </View>
            </View>

            {/* Genres */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Favorite Genres</Text>
              <View style={styles.tagsRow}>
                {preferences.favoriteGenres.length > 0 ? (
                  preferences.favoriteGenres.map(genre => (
                    <View key={genre} style={styles.tag}>
                      <Text style={styles.tagText}>{genre}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>None selected</Text>
                )}
              </View>
            </View>

            {/* Length */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Preferred Length</Text>
              <Text style={styles.valueText}>{lengthLabels[preferences.preferredLength]}</Text>
            </View>

            {/* Series */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Series Preference</Text>
              <Text style={styles.valueText}>{seriesLabel}</Text>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity style={styles.editButton} onPress={handleEditPreferences}>
                <Icon name="create-outline" size={20} color={colors.accent} set="ionicons" />
                <Text style={styles.editButtonText}>Edit Preferences</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.resetButton} onPress={handleResetPreferences}>
                <Icon name="refresh-outline" size={20} color={colors.textTertiary} set="ionicons" />
                <Text style={styles.resetButtonText}>Reset All</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundPrimary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyTitle: {
    marginTop: spacing.md,
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  setupButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  setupButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tag: {
    backgroundColor: colors.accentSubtle,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.xl,
  },
  tagText: {
    fontSize: 14,
    color: colors.accentDark,
    fontWeight: '500',
  },
  valueText: {
    fontSize: 16,
    color: colors.textPrimary,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textTertiary,
    fontStyle: 'italic',
  },
  actions: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSubtle,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.accent,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  resetButtonText: {
    fontSize: 14,
    color: colors.textTertiary,
  },
});