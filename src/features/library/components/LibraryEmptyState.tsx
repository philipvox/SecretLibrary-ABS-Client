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
import {
  Library,
  CloudDownload,
  PlayCircle,
  BookOpen,
  CheckCircle,
  Heart,
  Compass,
  Play,
  type LucideIcon,
} from 'lucide-react-native';
import { scale, spacing } from '@/shared/theme';
import { useColors } from '@/shared/theme/themeStore';

type TabType = 'all' | 'downloaded' | 'in-progress' | 'not-started' | 'completed' | 'favorites';

interface LibraryEmptyStateProps {
  /** Current tab to show contextual message */
  tab: TabType;
  /** Called when the action button is pressed */
  onAction: () => void;
}

interface EmptyStateConfig {
  Icon: LucideIcon;
  title: string;
  subtitle: string;
  actionText: string;
  ActionIcon: LucideIcon;
}

const getConfig = (tab: TabType): EmptyStateConfig => {
  switch (tab) {
    case 'all':
      return {
        Icon: Library,
        title: 'Your library is empty',
        subtitle: 'Download or favorite books to build your personal collection and listen offline.',
        actionText: 'Browse Library',
        ActionIcon: Compass,
      };
    case 'downloaded':
      return {
        Icon: CloudDownload,
        title: 'No downloads yet',
        subtitle: 'Download books to listen offline, anytime and anywhere.',
        actionText: 'Browse Library',
        ActionIcon: Compass,
      };
    case 'in-progress':
      return {
        Icon: PlayCircle,
        title: 'Nothing in progress',
        subtitle: 'Start listening to track your progress. Your partially-read books will appear here.',
        actionText: 'Start Listening',
        ActionIcon: Play,
      };
    case 'not-started':
      return {
        Icon: BookOpen,
        title: 'All books started',
        subtitle: "Great job! You've started all your downloaded books. Download more to add to your reading list.",
        actionText: 'Browse Library',
        ActionIcon: Compass,
      };
    case 'completed':
      return {
        Icon: CheckCircle,
        title: 'No completed books',
        subtitle: 'Finish listening to a book and it will appear here. Keep going!',
        actionText: 'Continue Listening',
        ActionIcon: Play,
      };
    case 'favorites':
      return {
        Icon: Heart,
        title: 'No favorites yet',
        subtitle: 'Tap the heart icon on books, authors, series, or narrators to save them here.',
        actionText: 'Browse Library',
        ActionIcon: Compass,
      };
    default:
      return {
        Icon: BookOpen,
        title: 'Nothing here yet',
        subtitle: 'Browse the library to discover audiobooks.',
        actionText: 'Browse Library',
        ActionIcon: Compass,
      };
  }
};

export function LibraryEmptyState({ tab, onAction }: LibraryEmptyStateProps) {
  const colors = useColors();
  const config = getConfig(tab);
  const { Icon, ActionIcon } = config;

  return (
    <View style={styles.container}>
      <Icon size={scale(48)} color={colors.text.disabled} strokeWidth={1.5} />

      <Text style={[styles.title, { color: colors.text.primary }]}>
        {config.title}
      </Text>
      <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
        {config.subtitle}
      </Text>

      <TouchableOpacity
        style={[styles.actionButton, {
          backgroundColor: colors.text.accent,
          shadowColor: colors.text.accent,
        }]}
        onPress={onAction}
        activeOpacity={0.8}
      >
        <ActionIcon size={scale(18)} color={colors.text.inverse} strokeWidth={2} />
        <Text style={[styles.actionText, { color: colors.text.inverse }]}>
          {config.actionText}
        </Text>
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
    marginTop: scale(16),
    marginBottom: scale(8),
    textAlign: 'center',
  },
  subtitle: {
    fontSize: scale(14),
    textAlign: 'center',
    lineHeight: scale(20),
    marginBottom: scale(24),
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(24),
    paddingVertical: scale(12),
    borderRadius: scale(24),
    gap: scale(8),
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  actionText: {
    fontSize: scale(15),
    fontWeight: '600',
  },
});

export default LibraryEmptyState;
