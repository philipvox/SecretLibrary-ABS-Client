/**
 * src/navigation/components/TopNavBar.tsx
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@/core/auth';
import { Icon } from '@/shared/components/Icon';
import { theme } from '@/shared/theme';

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
      <TouchableOpacity style={styles.avatarButton} onPress={handleProfilePress}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.searchBar} onPress={handleSearchPress} activeOpacity={0.8}>
        <Icon name="search" size={20} color={theme.colors.text.tertiary} set="ionicons" />
        <Text style={styles.searchPlaceholder}>Search</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.notificationButton}>
        <Icon name="notifications-outline" size={24} color={theme.colors.text.primary} set="ionicons" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing[5],
    paddingVertical: theme.spacing[2],
  },
  avatarButton: {},
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
    color: theme.colors.primary[500],
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[2] + 2,
    marginHorizontal: theme.spacing[3],
    gap: theme.spacing[2],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  searchPlaceholder: {
    fontSize: 15,
    color: theme.colors.text.tertiary,
    fontWeight: '500',
  },
  notificationButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});