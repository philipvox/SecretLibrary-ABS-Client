/**
 * src/navigation/components/TopNavBar.tsx
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@/core/auth';
import { Icon } from '@/shared/components/Icon';
import { colors, spacing, radius } from '@/shared/theme';

export function TopNavBar() {
  const navigation = useNavigation();
  const { user } = useAuth();

  const initials = (user?.username?.slice(0, 1) || 'U').toUpperCase();

  const handleSearchPress = () => {
    navigation.navigate('Search' as never);
  };

  const handleProfilePress = () => {
    navigation.navigate('ProfileTab' as never);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.avatarButton}
        onPress={handleProfilePress}
        accessibilityLabel="Profile"
        accessibilityRole="button"
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.searchBar}
        onPress={handleSearchPress}
        activeOpacity={0.8}
        accessibilityLabel="Search audiobooks"
        accessibilityRole="search"
      >
        <Icon name="search" size={20} color={colors.textTertiary} set="ionicons" />
        <Text style={styles.searchPlaceholder}>Search</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.notificationButton}
        accessibilityLabel="Notifications"
        accessibilityRole="button"
      >
        <Icon name="notifications-outline" size={24} color={colors.textPrimary} set="ionicons" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  // NN/g: 44px minimum touch targets
  avatarButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#D4E8FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.accent,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    marginHorizontal: spacing.sm,
    gap: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  searchPlaceholder: {
    fontSize: 15,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  notificationButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});