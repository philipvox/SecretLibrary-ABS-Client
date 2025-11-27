/**
 * src/features/profile/screens/ProfileScreen.tsx
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@/core/auth';
import { useDownloads, formatBytes } from '@/features/downloads';
import { Button, Card } from '@/shared/components';
import { Icon } from '@/shared/components/Icon';
import { theme } from '@/shared/theme';

// Safe import - store may not exist yet
let usePreferencesStore: any;
try {
  usePreferencesStore = require('@/features/recommendations').usePreferencesStore;
} catch {
  usePreferencesStore = null;
}

interface SettingsRowProps {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
  valueColor?: string;
}

function SettingsRow({ icon, label, value, onPress, showChevron, valueColor }: SettingsRowProps) {
  const content = (
    <View style={styles.settingsRow}>
      <View style={styles.settingsRowLeft}>
        <Icon name={icon} size={20} color={theme.colors.text.secondary} set="ionicons" />
        <Text style={styles.settingsLabel}>{label}</Text>
      </View>
      <View style={styles.settingsRowRight}>
        {value && <Text style={[styles.settingsValue, valueColor && { color: valueColor }]}>{value}</Text>}
        {showChevron && (
          <Icon name="chevron-forward" size={18} color={theme.colors.text.tertiary} set="ionicons" />
        )}
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

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user, serverUrl, logout, isLoading } = useAuth();
  const { downloads, totalStorageUsed, loadDownloads } = useDownloads();
  
  // Safe access to preferences store
  const hasCompletedOnboarding = usePreferencesStore?.() ?.hasCompletedOnboarding ?? false;

  useEffect(() => {
    loadDownloads();
  }, []);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
          } catch {
            Alert.alert('Logout Failed', 'Please try again');
          }
        },
      },
    ]);
  };

  const handleDownloadsPress = () => {
    navigation.navigate('Downloads');
  };

  const handlePreferencesPress = () => {
    navigation.navigate('Preferences');
  };

  const initials = user?.username
    ? user.username
        .split(' ')
        .map((word) => word[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?';

  const formatAccountType = (type?: string) => {
    if (!type) return 'User';
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background.primary} />
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.username}>{user?.username}</Text>
          <Text style={styles.accountType}>{formatAccountType(user?.type)}</Text>
        </View>

        <Card variant="elevated" padding={5} style={styles.card}>
          <Text style={styles.cardTitle}>Account</Text>
          <SettingsRow icon="server-outline" label="Server" value={serverUrl || ''} />
          <SettingsRow icon="person-outline" label="Username" value={user?.username} />
        </Card>

        <Card variant="elevated" padding={5} style={styles.card}>
          <Text style={styles.cardTitle}>Recommendations</Text>
          <SettingsRow 
            icon="sparkles-outline" 
            label="Reading Preferences" 
            value={hasCompletedOnboarding ? 'Configured' : 'Set up'}
            valueColor={hasCompletedOnboarding ? theme.colors.success?.[500] || '#22c55e' : theme.colors.primary[500]}
            onPress={handlePreferencesPress}
            showChevron
          />
        </Card>

        <Card variant="elevated" padding={5} style={styles.card}>
          <Text style={styles.cardTitle}>Storage</Text>
          <SettingsRow
            icon="download-outline"
            label="Downloads"
            value={`${downloads.length} book${downloads.length !== 1 ? 's' : ''}`}
            onPress={handleDownloadsPress}
            showChevron
          />
          <SettingsRow icon="folder-outline" label="Storage Used" value={formatBytes(totalStorageUsed)} />
        </Card>

        <Card variant="elevated" padding={5} style={styles.card}>
          <Text style={styles.cardTitle}>Playback</Text>
          <SettingsRow icon="speedometer-outline" label="Default Speed" value="1.0x" />
          <SettingsRow icon="time-outline" label="Skip Forward" value="30s" />
          <SettingsRow icon="time-outline" label="Skip Back" value="15s" />
        </Card>

        <View style={styles.logoutSection}>
          <Button
            title="Logout"
            onPress={handleLogout}
            variant="danger"
            size="large"
            fullWidth
            loading={isLoading}
          />
        </View>

        <View style={styles.versionSection}>
          <Text style={styles.versionText}>AudiobookShelf Mobile v1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: theme.spacing[32] + 60,
  },
  header: {
    paddingHorizontal: theme.spacing[5],
    paddingVertical: theme.spacing[3],
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: theme.colors.text.primary,
    letterSpacing: -0.5,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: theme.spacing[6],
    paddingHorizontal: theme.spacing[5],
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing[4],
    ...theme.elevation.medium,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '700',
    color: theme.colors.text.inverse,
  },
  username: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginBottom: theme.spacing[1],
  },
  accountType: {
    fontSize: 15,
    color: theme.colors.text.secondary,
  },
  card: {
    marginHorizontal: theme.spacing[5],
    marginBottom: theme.spacing[4],
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: theme.spacing[3],
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.light,
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing[2],
  },
  settingsLabel: {
    fontSize: 15,
    color: theme.colors.text.primary,
    marginLeft: theme.spacing[3],
  },
  settingsValue: {
    fontSize: 15,
    color: theme.colors.text.secondary,
    maxWidth: 180,
    textAlign: 'right',
  },
  logoutSection: {
    paddingHorizontal: theme.spacing[5],
    paddingTop: theme.spacing[4],
    paddingBottom: theme.spacing[4],
  },
  versionSection: {
    alignItems: 'center',
    paddingVertical: theme.spacing[4],
  },
  versionText: {
    fontSize: 13,
    color: theme.colors.text.tertiary,
  },
});