/**
 * src/features/profile/screens/ProfileScreen.tsx
 *
 * Clean profile hub screen with grouped navigation links.
 */

import React from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/core/auth';
import { useDownloads } from '@/core/hooks/useDownloads';
import { TOP_NAV_HEIGHT, SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { APP_VERSION, BUILD_NUMBER, VERSION_DATE } from '@/constants/version';
import { colors, scale } from '@/shared/theme';

const ACCENT = colors.accent;

// Safe import - store may not exist yet
let usePreferencesStore: any;
try {
  usePreferencesStore = require('@/features/recommendations').usePreferencesStore;
} catch {
  usePreferencesStore = null;
}

// Format bytes to human readable
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// User Header Component
interface UserHeaderProps {
  username: string;
  role: string;
  serverUrl: string;
}

function UserHeader({ username, role, serverUrl }: UserHeaderProps) {
  const initials = username
    .split(' ')
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

  // Format server URL for display
  const displayServer = serverUrl
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');

  return (
    <View style={styles.userHeader}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.username}>{username}</Text>
        <Text style={styles.userRole}>{role}</Text>
        <View style={styles.serverRow}>
          <Ionicons name="server-outline" size={scale(12)} color="rgba(255,255,255,0.4)" />
          <Text style={styles.serverText} numberOfLines={1}>{displayServer}</Text>
        </View>
      </View>
    </View>
  );
}

// Profile Link Component
interface ProfileLinkProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  onPress: () => void;
}

function ProfileLink({ icon, label, subtitle, badge, badgeColor, onPress }: ProfileLinkProps) {
  return (
    <TouchableOpacity style={styles.profileLink} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.linkIconContainer}>
        <Ionicons name={icon} size={scale(20)} color="rgba(255,255,255,0.8)" />
      </View>
      <View style={styles.linkContent}>
        <Text style={styles.linkLabel}>{label}</Text>
        {subtitle ? <Text style={styles.linkSubtitle}>{subtitle}</Text> : null}
      </View>
      {badge ? (
        <View style={[styles.badge, badgeColor ? { backgroundColor: badgeColor } : null]}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={scale(18)} color="rgba(255,255,255,0.3)" />
    </TouchableOpacity>
  );
}

// Section Group Component
interface SectionGroupProps {
  title: string;
  children: React.ReactNode;
}

function SectionGroup({ title, children }: SectionGroupProps) {
  return (
    <View style={styles.sectionGroup}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>
        {children}
      </View>
    </View>
  );
}

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user, serverUrl, logout, isLoading } = useAuth();

  // Download stats
  const { downloads } = useDownloads();
  const completedDownloads = downloads.filter(d => d.status === 'complete');
  const downloadCount = completedDownloads.length;
  const totalStorage = completedDownloads.reduce((sum, d) => sum + (d.totalBytes || 0), 0);

  // Safe access to preferences store
  const hasCompletedOnboarding = usePreferencesStore?.()?.hasCompletedOnboarding ?? false;

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await logout();
          } catch {
            Alert.alert('Error', 'Failed to sign out. Please try again.');
          }
        },
      },
    ]);
  };

  const formatAccountType = (type?: string) => {
    if (!type) return 'User';
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + TOP_NAV_HEIGHT }]}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        {/* User Header */}
        <UserHeader
          username={user?.username || 'User'}
          role={formatAccountType(user?.type)}
          serverUrl={serverUrl || ''}
        />

        {/* My Stuff Section */}
        <SectionGroup title="My Stuff">
          <ProfileLink
            icon="download-outline"
            label="Downloads"
            subtitle={`${downloadCount} book${downloadCount !== 1 ? 's' : ''} · ${formatBytes(totalStorage)}`}
            onPress={() => navigation.navigate('Downloads')}
          />
          <ProfileLink
            icon="stats-chart-outline"
            label="Listening Stats"
            subtitle="Track your listening activity"
            onPress={() => navigation.navigate('Stats')}
          />
          <ProfileLink
            icon="sparkles-outline"
            label="Reading Preferences"
            subtitle="Personalize recommendations"
            badge={hasCompletedOnboarding ? undefined : 'Set up'}
            badgeColor={ACCENT}
            onPress={() => navigation.navigate('Preferences')}
          />
        </SectionGroup>

        {/* Settings Section */}
        <SectionGroup title="Settings">
          <ProfileLink
            icon="play-circle-outline"
            label="Playback"
            subtitle="Speed, skip intervals, sleep timer"
            onPress={() => navigation.navigate('PlaybackSettings')}
          />
          <ProfileLink
            icon="folder-outline"
            label="Storage"
            subtitle="Downloads, cache, WiFi-only"
            onPress={() => navigation.navigate('StorageSettings')}
          />
          <ProfileLink
            icon="radio-button-on-outline"
            label="Haptic Feedback"
            subtitle="Vibration and tactile feedback"
            onPress={() => navigation.navigate('HapticSettings')}
          />
        </SectionGroup>

        {/* Developer Section - keep for testing */}
        <SectionGroup title="Developer">
          <ProfileLink
            icon="musical-notes-outline"
            label="Cassette Player Test"
            subtitle="Test the retro cassette UI"
            onPress={() => navigation.navigate('CassetteTest')}
          />
        </SectionGroup>

        {/* Sign Out Button */}
        <View style={styles.signOutSection}>
          <TouchableOpacity
            style={[styles.signOutButton, isLoading && styles.signOutButtonDisabled]}
            onPress={handleLogout}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={scale(20)} color="#fff" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* App Footer */}
        <View style={styles.footer}>
          <Text style={styles.appName}>AudiobookShelf</Text>
          <Text style={styles.versionText}>v{APP_VERSION} ({BUILD_NUMBER})</Text>
          <Text style={styles.buildDate}>{VERSION_DATE}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: SCREEN_BOTTOM_PADDING,
  },
  header: {
    paddingHorizontal: scale(20),
    paddingVertical: scale(12),
  },
  headerTitle: {
    fontSize: scale(32),
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
  },
  // User Header
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(20),
    paddingVertical: scale(20),
    marginHorizontal: scale(16),
    marginBottom: scale(24),
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: scale(16),
  },
  avatar: {
    width: scale(64),
    height: scale(64),
    borderRadius: scale(32),
    backgroundColor: ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: scale(24),
    fontWeight: '700',
    color: '#000',
  },
  userInfo: {
    flex: 1,
    marginLeft: scale(16),
  },
  username: {
    fontSize: scale(20),
    fontWeight: '700',
    color: '#fff',
    marginBottom: scale(2),
  },
  userRole: {
    fontSize: scale(14),
    color: 'rgba(255,255,255,0.6)',
    marginBottom: scale(6),
  },
  serverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  serverText: {
    fontSize: scale(12),
    color: 'rgba(255,255,255,0.4)',
    flex: 1,
  },
  // Section Group
  sectionGroup: {
    marginBottom: scale(24),
  },
  sectionTitle: {
    fontSize: scale(13),
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
    marginHorizontal: scale(20),
    marginBottom: scale(8),
  },
  sectionContent: {
    marginHorizontal: scale(16),
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: scale(12),
    overflow: 'hidden',
  },
  // Profile Link
  profileLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(14),
    paddingHorizontal: scale(16),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  linkIconContainer: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(10),
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkContent: {
    flex: 1,
    marginLeft: scale(12),
  },
  linkLabel: {
    fontSize: scale(15),
    fontWeight: '500',
    color: '#fff',
    marginBottom: scale(2),
  },
  linkSubtitle: {
    fontSize: scale(12),
    color: 'rgba(255,255,255,0.5)',
  },
  badge: {
    backgroundColor: 'rgba(193,244,12,0.2)',
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
    borderRadius: scale(6),
    marginRight: scale(8),
  },
  badgeText: {
    fontSize: scale(11),
    fontWeight: '600',
    color: ACCENT,
  },
  // Sign Out
  signOutSection: {
    paddingHorizontal: scale(16),
    marginTop: scale(8),
    marginBottom: scale(24),
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    paddingVertical: scale(14),
    backgroundColor: 'rgba(255,75,75,0.15)',
    borderRadius: scale(12),
    borderWidth: 1,
    borderColor: 'rgba(255,75,75,0.3)',
  },
  signOutButtonDisabled: {
    opacity: 0.5,
  },
  signOutText: {
    fontSize: scale(15),
    fontWeight: '600',
    color: '#ff4b4b',
  },
  // Footer
  footer: {
    alignItems: 'center',
    paddingVertical: scale(16),
  },
  appName: {
    fontSize: scale(14),
    fontWeight: '600',
    color: 'rgba(255,255,255,0.3)',
    marginBottom: scale(4),
  },
  versionText: {
    fontSize: scale(12),
    color: 'rgba(255,255,255,0.2)',
  },
  buildDate: {
    fontSize: scale(10),
    color: 'rgba(255,255,255,0.15)',
    marginTop: scale(2),
  },
});
