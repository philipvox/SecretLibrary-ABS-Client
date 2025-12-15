/**
 * src/features/library/components/LibraryEmptyState.tsx
 *
 * Contextual empty states for My Library tabs.
 * Each tab has tailored messaging and CTAs.
 *
 * UX Pattern: Help & Documentation (NNGroup Heuristic #10)
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, scale, spacing } from '@/shared/theme';

type TabType = 'all' | 'downloaded' | 'in-progress' | 'favorites';

interface LibraryEmptyStateProps {
  /** Current tab to show contextual message */
  tab: TabType;
  /** Called when the action button is pressed */
  onAction: () => void;
}

interface EmptyStateConfig {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  actionText: string;
  actionIcon: keyof typeof Ionicons.glyphMap;
}

// Compass/browse icon for CTA
const BrowseIcon = ({ size = 20, color = '#000' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx={12} cy={12} r={10} stroke={color} strokeWidth={2} />
    <Path
      d="M14.31 8l-5.31 2.16L12 15.31l5.31-2.16L14.31 8z"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const getConfig = (tab: TabType): EmptyStateConfig => {
  switch (tab) {
    case 'all':
      return {
        icon: <Ionicons name="library-outline" size={scale(48)} color="rgba(255,255,255,0.25)" />,
        title: 'Your library is empty',
        subtitle: 'Download or favorite books to build your personal collection and listen offline.',
        actionText: 'Browse Library',
        actionIcon: 'compass-outline',
      };
    case 'downloaded':
      return {
        icon: <Ionicons name="cloud-download-outline" size={scale(48)} color="rgba(255,255,255,0.25)" />,
        title: 'No downloads yet',
        subtitle: 'Download books to listen offline, anytime and anywhere.',
        actionText: 'Browse Library',
        actionIcon: 'compass-outline',
      };
    case 'in-progress':
      return {
        icon: <Ionicons name="play-circle-outline" size={scale(48)} color="rgba(255,255,255,0.25)" />,
        title: 'Nothing in progress',
        subtitle: 'Start listening to track your progress. Your partially-read books will appear here.',
        actionText: 'Start Listening',
        actionIcon: 'play',
      };
    case 'favorites':
      return {
        icon: <Ionicons name="heart-outline" size={scale(48)} color="rgba(255,255,255,0.25)" />,
        title: 'No favorites yet',
        subtitle: 'Tap the heart icon on books, authors, series, or narrators to save them here.',
        actionText: 'Browse Library',
        actionIcon: 'compass-outline',
      };
    default:
      return {
        icon: <Ionicons name="book-outline" size={scale(48)} color="rgba(255,255,255,0.25)" />,
        title: 'Nothing here yet',
        subtitle: 'Browse the library to discover audiobooks.',
        actionText: 'Browse Library',
        actionIcon: 'compass-outline',
      };
  }
};

export function LibraryEmptyState({ tab, onAction }: LibraryEmptyStateProps) {
  const config = getConfig(tab);

  return (
    <View style={styles.container}>
      {config.icon}

      <Text style={styles.title}>{config.title}</Text>
      <Text style={styles.subtitle}>{config.subtitle}</Text>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={onAction}
        activeOpacity={0.8}
      >
        {tab === 'all' || tab === 'downloaded' || tab === 'favorites' ? (
          <BrowseIcon size={scale(18)} color="#000" />
        ) : (
          <Ionicons name={config.actionIcon} size={scale(18)} color="#000" />
        )}
        <Text style={styles.actionText}>{config.actionText}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: scale(60),
    paddingHorizontal: scale(40),
  },
  title: {
    fontSize: scale(18),
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: scale(16),
    marginBottom: scale(8),
    textAlign: 'center',
  },
  subtitle: {
    fontSize: scale(14),
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: scale(20),
    marginBottom: scale(24),
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: scale(24),
    paddingVertical: scale(12),
    borderRadius: scale(24),
    gap: scale(8),
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  actionText: {
    fontSize: scale(15),
    fontWeight: '600',
    color: '#000',
  },
});

export default LibraryEmptyState;
