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
  Switch,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// App logo
const APP_LOGO = require('../../../../assets/login-logo.png');
import { useNavigation } from '@react-navigation/native';
import {
  Server,
  Download,
  BarChart3,
  PlayCircle,
  Folder,
  Type,
  LogOut,
  ChevronRight,
  Bug,
  Moon,
  Sun,
  Library,
  Sparkles,
  EyeOff,
  Baby,
  Heart,
  type LucideIcon,
} from 'lucide-react-native';
import { useThemeStore, useThemeColors, useIsDarkMode } from '@/shared/theme/themeStore';
import { useAuth } from '@/core/auth';
import { useDownloads } from '@/core/hooks/useDownloads';
import { useMyLibraryStore } from '@/shared/stores/myLibraryStore';
import { useKidModeStore } from '@/shared/stores/kidModeStore';
import { useWishlistStore } from '@/features/wishlist/stores/wishlistStore';
import { useDismissedCount } from '@/features/recommendations/stores/dismissedItemsStore';
import { haptics } from '@/core/native/haptics';
import { TOP_NAV_HEIGHT, SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { APP_VERSION, BUILD_NUMBER, VERSION_DATE } from '@/constants/version';
import { accentColors, scale, typography, fontWeight, spacing, layout } from '@/shared/theme';
import { useScreenLoadTime } from '@/core/hooks/useScreenLoadTime';
import { generateErrorReport, exportErrorReportJSON } from '@/utils/runtimeMonitor';
import { logger } from '@/shared/utils/logger';

const ACCENT = accentColors.red;  // Red accent for primary interactive

// Format bytes to human readable
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Theme colors type
type ThemeColorsType = ReturnType<typeof useThemeColors>;

// Profile Link Component
interface ProfileLinkProps {
  Icon: LucideIcon;
  label: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  onPress: () => void;
  themeColors: ThemeColorsType;
  iconBgColor?: string;
  isDarkMode?: boolean;
}

function ProfileLink({ Icon, label, subtitle, badge, badgeColor, onPress, themeColors, iconBgColor, isDarkMode }: ProfileLinkProps) {
  const iconContainerBg = iconBgColor || (isDarkMode ? 'rgba(255,255,255,0.08)' : themeColors.border);
  return (
    <TouchableOpacity style={[styles.profileLink, { borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.06)' : themeColors.border }]} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.linkIconContainer, { backgroundColor: iconContainerBg }]}>
        <Icon size={scale(20)} color={themeColors.text} strokeWidth={2} />
      </View>
      <View style={styles.linkContent}>
        <Text style={[styles.linkLabel, { color: themeColors.text }]}>{label}</Text>
        {subtitle ? <Text style={[styles.linkSubtitle, { color: themeColors.textSecondary }]}>{subtitle}</Text> : null}
      </View>
      {badge ? (
        <View style={[styles.badge, { borderColor: badgeColor || ACCENT }]}>
          <Text style={[styles.badgeText, { color: badgeColor || ACCENT }]}>{badge}</Text>
        </View>
      ) : null}
      <ChevronRight size={scale(18)} color={themeColors.textTertiary} strokeWidth={2} />
    </TouchableOpacity>
  );
}

// Profile Toggle Component (for settings with on/off switch)
interface ProfileToggleProps {
  Icon: LucideIcon;
  label: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  themeColors: ThemeColorsType;
  isDarkMode?: boolean;
}

function ProfileToggle({ Icon, label, subtitle, value, onValueChange, themeColors, isDarkMode }: ProfileToggleProps) {
  const iconContainerBg = isDarkMode ? 'rgba(255,255,255,0.08)' : themeColors.border;
  return (
    <View style={[styles.profileLink, { borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.06)' : themeColors.border }]}>
      <View style={[styles.linkIconContainer, { backgroundColor: iconContainerBg }]}>
        <Icon size={scale(20)} color={themeColors.text} strokeWidth={2} />
      </View>
      <View style={styles.linkContent}>
        <Text style={[styles.linkLabel, { color: themeColors.text }]}>{label}</Text>
        {subtitle ? <Text style={[styles.linkSubtitle, { color: themeColors.textSecondary }]}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={(newValue) => {
          haptics.selection();
          onValueChange(newValue);
        }}
        trackColor={{ false: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)', true: accentColors.gold }}
        thumbColor="#fff"
      />
    </View>
  );
}

// Section Group Component
interface SectionGroupProps {
  title: string;
  children: React.ReactNode;
  themeColors: ThemeColorsType;
  bgColor?: string;
  isDarkMode?: boolean;
}

function SectionGroup({ title, children, themeColors, bgColor, isDarkMode }: SectionGroupProps) {
  return (
    <View style={styles.sectionGroup}>
      <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{title}</Text>
      <View style={[
        styles.sectionContent,
        {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
        }
      ]}>
        {children}
      </View>
    </View>
  );
}

export function ProfileScreen() {
  useScreenLoadTime('ProfileScreen');
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user, serverUrl, logout, isLoading } = useAuth();
  const themeColors = useThemeColors();
  const isDarkMode = useIsDarkMode();

  // Download stats
  const { downloads } = useDownloads();
  const completedDownloads = downloads.filter(d => d.status === 'complete');
  const downloadCount = completedDownloads.length;
  const totalStorage = completedDownloads.reduce((sum, d) => sum + (d.totalBytes || 0), 0);

  // Theme
  const { mode: themeMode, toggleMode: toggleTheme } = useThemeStore();

  // Library preferences
  const { hideSingleBookSeries, setHideSingleBookSeries } = useMyLibraryStore();

  // Kid Mode
  const kidModeEnabled = useKidModeStore((s) => s.enabled);

  // Hidden items count for badge
  const hiddenItemsCount = useDismissedCount();

  // Wishlist count
  const wishlistItems = useWishlistStore((s) => s.items);
  const wishlistCount = wishlistItems.length;

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          haptics.destructiveConfirm();
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

  // In dark mode, use pure black background
  const bgColor = isDarkMode ? '#000000' : themeColors.backgroundSecondary;
  const sectionBgColor = isDarkMode ? 'rgba(255,255,255,0.05)' : themeColors.border;
  const iconContainerBgColor = isDarkMode ? 'rgba(255,255,255,0.08)' : themeColors.border;
  const userHeaderBgColor = isDarkMode ? 'rgba(255,255,255,0.05)' : themeColors.border;

  return (
    <View style={[styles.container, { paddingTop: insets.top + TOP_NAV_HEIGHT, backgroundColor: bgColor }]}>
      <StatusBar barStyle={themeColors.statusBar} backgroundColor={bgColor} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: themeColors.text }]}>Profile</Text>
        </View>

        {/* User Header with quick sign out */}
        <View style={[styles.userHeader, { backgroundColor: 'transparent', borderWidth: 1, borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.username || 'User').split(' ').map((word) => word[0]).slice(0, 2).join('').toUpperCase() || '?'}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={[styles.username, { color: themeColors.text }]}>{user?.username || 'User'}</Text>
            <Text style={[styles.userRole, { color: themeColors.textSecondary }]}>{formatAccountType(user?.type)}</Text>
            <View style={styles.serverRow}>
              <Server size={scale(12)} color={themeColors.textTertiary} strokeWidth={2} />
              <Text style={[styles.serverText, { color: themeColors.textTertiary }]} numberOfLines={1}>{(serverUrl || '').replace(/^https?:\/\//, '').replace(/\/$/, '')}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.headerSignOut, isLoading && styles.headerSignOutDisabled]}
            onPress={handleLogout}
            disabled={isLoading}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <LogOut size={scale(18)} color="#ff4b4b" strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* My Stuff Section */}
        <SectionGroup title="My Stuff" themeColors={themeColors} bgColor={sectionBgColor} isDarkMode={isDarkMode}>
          <ProfileLink
            Icon={Download}
            label="Downloads"
            subtitle={`${downloadCount} book${downloadCount !== 1 ? 's' : ''} · ${formatBytes(totalStorage)}`}
            onPress={() => navigation.navigate('Downloads')}
            themeColors={themeColors}
            isDarkMode={isDarkMode}
          />
          <ProfileLink
            Icon={BarChart3}
            label="Listening Stats"
            subtitle="Track your listening activity"
            onPress={() => navigation.navigate('Stats')}
            themeColors={themeColors}
            isDarkMode={isDarkMode}
          />
          <ProfileLink
            Icon={Heart}
            label="Wishlist"
            subtitle={wishlistCount > 0 ? `${wishlistCount} item${wishlistCount !== 1 ? 's' : ''}` : 'Track books you want'}
            badge={wishlistCount > 0 ? String(wishlistCount) : undefined}
            badgeColor={accentColors.gold}
            onPress={() => navigation.navigate('Wishlist')}
            themeColors={themeColors}
            isDarkMode={isDarkMode}
          />
        </SectionGroup>

        {/* Settings Section */}
        <SectionGroup title="Settings" themeColors={themeColors} bgColor={sectionBgColor} isDarkMode={isDarkMode}>
          <ProfileLink
            Icon={PlayCircle}
            label="Playback"
            subtitle="Speed, skip intervals, sleep timer"
            onPress={() => navigation.navigate('PlaybackSettings')}
            themeColors={themeColors}
            isDarkMode={isDarkMode}
          />
          <ProfileLink
            Icon={Folder}
            label="Storage"
            subtitle="Downloads, cache, WiFi-only"
            onPress={() => navigation.navigate('StorageSettings')}
            themeColors={themeColors}
            isDarkMode={isDarkMode}
          />
          <ProfileLink
            Icon={Type}
            label="Chapter Names"
            subtitle="Clean up messy chapter names"
            onPress={() => navigation.navigate('ChapterCleaningSettings')}
            themeColors={themeColors}
            isDarkMode={isDarkMode}
          />
          <ProfileToggle
            Icon={themeMode === 'dark' ? Moon : Sun}
            label="Dark Mode"
            subtitle={themeMode === 'dark' ? 'Using dark theme' : 'Using light theme'}
            value={themeMode === 'dark'}
            onValueChange={toggleTheme}
            themeColors={themeColors}
            isDarkMode={isDarkMode}
          />
          <ProfileToggle
            Icon={Library}
            label="Hide Single-Book Series"
            subtitle="Hide series with only 1 book from browse"
            value={hideSingleBookSeries}
            onValueChange={setHideSingleBookSeries}
            themeColors={themeColors}
            isDarkMode={isDarkMode}
          />
          <ProfileLink
            Icon={Baby}
            label="Kid Mode"
            subtitle={kidModeEnabled ? 'Active - filtering content' : 'Off - showing all content'}
            badge={kidModeEnabled ? 'ON' : undefined}
            badgeColor={kidModeEnabled ? '#34C759' : undefined}
            onPress={() => navigation.navigate('KidModeSettings' as never)}
            themeColors={themeColors}
            iconBgColor={kidModeEnabled ? accentColors.gold : undefined}
            isDarkMode={isDarkMode}
          />
        </SectionGroup>

        {/* Recommendations Section */}
        <SectionGroup title="Recommendations" themeColors={themeColors} bgColor={sectionBgColor} isDarkMode={isDarkMode}>
          <ProfileLink
            Icon={Sparkles}
            label="Preferences"
            subtitle="Tune your recommendations"
            onPress={() => navigation.navigate('Preferences')}
            themeColors={themeColors}
            isDarkMode={isDarkMode}
          />
          <ProfileLink
            Icon={EyeOff}
            label="Hidden Books"
            subtitle={hiddenItemsCount > 0 ? `${hiddenItemsCount} hidden from recommendations` : 'No hidden books'}
            badge={hiddenItemsCount > 0 ? String(hiddenItemsCount) : undefined}
            badgeColor={themeColors.textSecondary}
            onPress={() => navigation.navigate('HiddenItems')}
            themeColors={themeColors}
            isDarkMode={isDarkMode}
          />
        </SectionGroup>

        {/* Developer Section - keep for testing */}
        {__DEV__ && (
          <SectionGroup title="Developer" themeColors={themeColors} bgColor={sectionBgColor} isDarkMode={isDarkMode}>
            <ProfileLink
              Icon={Bug}
              label="Stress Tests"
              subtitle="Runtime monitoring & diagnostics"
              onPress={() => navigation.navigate('DebugStressTest')}
              themeColors={themeColors}
              isDarkMode={isDarkMode}
            />
            <ProfileLink
              Icon={BarChart3}
              label="Export Performance Report"
              subtitle="FPS, memory, errors as JSON"
              onPress={async () => {
                try {
                  const report = await exportErrorReportJSON();
                  logger.info('\n=== PERFORMANCE REPORT ===');
                  logger.info(report);
                  logger.info('=== END REPORT ===\n');
                  haptics.selection();
                  Alert.alert('Report Exported', 'Performance report logged to console. Check your terminal.');
                } catch (e) {
                  Alert.alert('Export Failed', String(e));
                }
              }}
              themeColors={themeColors}
              isDarkMode={isDarkMode}
            />
          </SectionGroup>
        )}

        {/* Sign Out Button */}
        <View style={styles.signOutSection}>
          <TouchableOpacity
            style={[
              styles.signOutButton,
              {
                backgroundColor: isDarkMode ? 'rgba(255,75,75,0.15)' : 'rgba(220,38,38,0.08)',
                borderColor: isDarkMode ? 'rgba(255,75,75,0.3)' : 'rgba(220,38,38,0.2)',
              },
              isLoading && styles.signOutButtonDisabled
            ]}
            onPress={handleLogout}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            <LogOut size={scale(20)} color={isDarkMode ? '#ff4b4b' : '#dc2626'} strokeWidth={2} />
            <Text style={[styles.signOutText, { color: isDarkMode ? '#ff4b4b' : '#dc2626' }]}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* App Footer */}
        <View style={styles.footer}>
          <View style={[
            styles.footerLogoContainer,
            { backgroundColor: isDarkMode ? 'transparent' : 'rgba(0,0,0,0.05)' }
          ]}>
            <Image
              source={APP_LOGO}
              style={[styles.footerLogo, { opacity: isDarkMode ? 0.6 : 1 }]}
              contentFit="contain"
            />
          </View>
          <Text style={[styles.appName, { color: themeColors.textSecondary }]}>Secret Library</Text>
          <Text style={[styles.versionText, { color: themeColors.textTertiary }]}>v{APP_VERSION} ({BUILD_NUMBER})</Text>
          <Text style={[styles.buildDate, { color: themeColors.textTertiary }]}>{VERSION_DATE}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor set via themeColors.backgroundSecondary in JSX
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: SCREEN_BOTTOM_PADDING,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    ...typography.displayLarge,
    fontWeight: fontWeight.bold,
    // color set via themeColors.text in JSX
    letterSpacing: -0.5,
  },
  // User Header
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xxl,
    // backgroundColor set via themeColors.border in JSX
    borderRadius: spacing.lg,
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
    ...typography.displayMedium,
    fontWeight: fontWeight.bold,
    color: '#000', // Black on gold accent (intentional)
  },
  userInfo: {
    flex: 1,
    marginLeft: spacing.lg,
  },
  username: {
    ...typography.displaySmall,
    fontWeight: fontWeight.bold,
    // color set via themeColors.text in JSX
    marginBottom: scale(2),
  },
  userRole: {
    ...typography.bodyLarge,
    // color set via themeColors.textSecondary in JSX
    marginBottom: scale(6),
  },
  serverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
  },
  serverText: {
    ...typography.bodySmall,
    // color set via themeColors.textTertiary in JSX
    flex: 1,
  },
  headerSignOut: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    backgroundColor: 'rgba(255,75,75,0.15)', // Red tint (intentional)
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  headerSignOutDisabled: {
    opacity: 0.5,
  },
  // Section Group
  sectionGroup: {
    marginBottom: spacing.xxl,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    fontWeight: fontWeight.semibold,
    // color set via themeColors.textSecondary in JSX
    letterSpacing: 0.5,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
  },
  sectionContent: {
    marginHorizontal: spacing.lg,
    // backgroundColor set via themeColors.border in JSX
    borderRadius: spacing.md,
    overflow: 'hidden',
  },
  // Profile Link
  profileLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(14),
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    // borderBottomColor set via themeColors.border in JSX
  },
  linkIconContainer: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(10),
    // backgroundColor set via themeColors.border in JSX
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  linkLabel: {
    ...typography.headlineMedium,
    fontWeight: fontWeight.medium,
    // color set via themeColors.text in JSX
    marginBottom: scale(2),
  },
  linkSubtitle: {
    ...typography.bodySmall,
    // color set via themeColors.textSecondary in JSX
  },
  badge: {
    backgroundColor: 'transparent',
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
    borderRadius: scale(6),
    marginRight: scale(8),
    borderWidth: 1,
    borderColor: ACCENT,
  },
  badgeText: {
    ...typography.labelMedium,
    fontWeight: fontWeight.semibold,
    color: ACCENT,
  },
  // Sign Out
  signOutSection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.xxl,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: scale(14),
    backgroundColor: 'rgba(255,75,75,0.15)', // Red tint (intentional)
    borderRadius: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,75,75,0.3)', // Red tint (intentional)
  },
  signOutButtonDisabled: {
    opacity: 0.5,
  },
  signOutText: {
    ...typography.headlineMedium,
    fontWeight: fontWeight.semibold,
    color: '#ff4b4b', // Red (intentional for destructive action)
  },
  // Footer
  footer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  footerLogoContainer: {
    width: scale(80),
    height: scale(80),
    borderRadius: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  footerLogo: {
    width: scale(64),
    height: scale(64),
    borderRadius: scale(14),
  },
  appName: {
    ...typography.headlineMedium,
    fontWeight: fontWeight.semibold,
    // color set via themeColors.textSecondary in JSX
    marginBottom: scale(4),
  },
  versionText: {
    ...typography.bodySmall,
    // color set via themeColors.textTertiary in JSX
  },
  buildDate: {
    ...typography.labelSmall,
    // color set via themeColors.textTertiary in JSX
    marginTop: scale(2),
  },
});
