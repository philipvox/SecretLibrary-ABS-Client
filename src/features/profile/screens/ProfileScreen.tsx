/**
 * src/features/profile/screens/ProfileScreen.tsx
 *
 * Profile screen with dark theme matching app style
 */

import React, { useEffect, useState } from 'react';
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
import { autoDownloadService } from '@/features/downloads';
import { Icon } from '@/shared/components/Icon';

// Dark theme colors
const COLORS = {
  background: '#303030',
  card: '#404040',
  cardBorder: '#505050',
  text: '#FFFFFF',
  textSecondary: '#AAAAAA',
  textTertiary: '#888888',
  accent: '#CCFF00',
  danger: '#FF6B6B',
  success: '#22c55e',
};

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
        <Icon name={icon} size={20} color={COLORS.textSecondary} set="ionicons" />
        <Text style={styles.settingsLabel}>{label}</Text>
      </View>
      <View style={styles.settingsRowRight}>
        {value && <Text style={[styles.settingsValue, valueColor && { color: valueColor }]}>{value}</Text>}
        {showChevron && (
          <Icon name="chevron-forward" size={18} color={COLORS.textTertiary} set="ionicons" />
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

// Format bytes to human readable
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user, serverUrl, logout, isLoading } = useAuth();

  // Download stats from autoDownloadService
  const [downloadCount, setDownloadCount] = useState(0);
  const [totalStorage, setTotalStorage] = useState(0);

  // Safe access to preferences store
  const hasCompletedOnboarding = usePreferencesStore?.()?.hasCompletedOnboarding ?? false;

  useEffect(() => {
    // Load download stats
    const loadStats = async () => {
      const downloads = autoDownloadService.getDownloads();
      setDownloadCount(downloads.length);

      // Calculate total storage
      let total = 0;
      for (const d of downloads) {
        total += d.fileSize || 0;
      }
      setTotalStorage(total);
    };
    loadStats();
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
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

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

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account</Text>
          <SettingsRow icon="server-outline" label="Server" value={serverUrl || ''} />
          <SettingsRow icon="person-outline" label="Username" value={user?.username} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recommendations</Text>
          <SettingsRow
            icon="sparkles-outline"
            label="Reading Preferences"
            value={hasCompletedOnboarding ? 'Configured' : 'Set up'}
            valueColor={hasCompletedOnboarding ? COLORS.success : COLORS.accent}
            onPress={handlePreferencesPress}
            showChevron
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Storage</Text>
          <SettingsRow
            icon="download-outline"
            label="Downloads"
            value={`${downloadCount} book${downloadCount !== 1 ? 's' : ''}`}
            onPress={handleDownloadsPress}
            showChevron
          />
          <SettingsRow icon="folder-outline" label="Storage Used" value={formatBytes(totalStorage)} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Playback</Text>
          <SettingsRow icon="speedometer-outline" label="Default Speed" value="1.0x" />
          <SettingsRow icon="time-outline" label="Skip Forward" value="30s" />
          <SettingsRow icon="time-outline" label="Skip Back" value="15s" />
        </View>

        <View style={styles.logoutSection}>
          <TouchableOpacity
            style={[styles.logoutButton, isLoading && styles.logoutButtonDisabled]}
            onPress={handleLogout}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
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
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 140,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.5,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#000000',
  },
  username: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  accountType: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  card: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingsLabel: {
    fontSize: 15,
    color: COLORS.text,
    marginLeft: 12,
  },
  settingsValue: {
    fontSize: 15,
    color: COLORS.textSecondary,
    maxWidth: 180,
    textAlign: 'right',
  },
  logoutSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  logoutButton: {
    backgroundColor: COLORS.danger,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  logoutButtonDisabled: {
    opacity: 0.6,
  },
  logoutButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  versionSection: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  versionText: {
    fontSize: 13,
    color: COLORS.textTertiary,
  },
});