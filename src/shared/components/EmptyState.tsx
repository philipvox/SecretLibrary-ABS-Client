/**
 * src/shared/components/EmptyState.tsx
 *
 * Empty state display with optional action.
 * NN/g: Clear guidance on what to do next.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, ViewStyle } from 'react-native';
import {
  BookOpen,
  Search,
  Heart,
  Download,
  LayoutGrid,
  User,
  Mic,
  Library,
  PartyPopper,
  LayoutDashboard,
} from 'lucide-react-native';
import {
  spacing,
  radius,
  layout,
  typography,
  scale,
  iconSizes,
  useTheme,
} from '@/shared/theme';

export type EmptyStateIcon =
  | 'book'
  | 'search'
  | 'heart'
  | 'download'
  | 'list'
  | 'user'
  | 'mic'
  | 'library'
  | 'celebrate'
  | 'collection';

// Map icon names to Lucide components
const ICONS: Record<EmptyStateIcon, React.ComponentType<{ size?: number; color?: string }>> = {
  book: BookOpen,
  search: Search,
  heart: Heart,
  download: Download,
  list: LayoutGrid,
  user: User,
  mic: Mic,
  library: Library,
  celebrate: PartyPopper,
  collection: LayoutDashboard,
};

// Emoji to icon mapping for backward compatibility
const EMOJI_TO_ICON: Record<string, EmptyStateIcon> = {
  '📚': 'library',
  '📖': 'book',
  '🔍': 'search',
  '👤': 'user',
  '🎙️': 'mic',
  '❤️': 'heart',
  '🎉': 'celebrate',
  '📁': 'collection',
};

interface EmptyStateProps {
  /** Main message/title */
  title: string;
  /** Built-in icon name, emoji (auto-mapped), or custom React node */
  icon?: EmptyStateIcon | string | React.ReactNode;
  /** Optional description below the title */
  description?: string;
  /** Action button title */
  actionTitle?: string;
  /** Action button callback */
  onAction?: () => void;
  /** Secondary action title */
  secondaryActionTitle?: string;
  /** Secondary action callback */
  onSecondaryAction?: () => void;
  /** Whether to take full screen height */
  fullScreen?: boolean;
  /** Custom container style */
  style?: ViewStyle;
}

/**
 * Display an empty state with icon, message, and optional actions.
 * NN/g: Always provide clear next steps for users.
 */
export function EmptyState({
  title,
  icon = 'book',
  description,
  actionTitle,
  onAction,
  secondaryActionTitle,
  onSecondaryAction,
  fullScreen = true,
  style,
}: EmptyStateProps) {
  const { colors } = useTheme();
  const iconColor = colors.text.tertiary;

  const renderIcon = () => {
    if (typeof icon === 'string') {
      // Check if it's a valid icon name
      if (icon in ICONS) {
        const IconComponent = ICONS[icon as EmptyStateIcon];
        return <IconComponent size={iconSizes.xxxl} color={iconColor} />;
      }
      // Check if it's an emoji that can be mapped
      if (icon in EMOJI_TO_ICON) {
        const mappedIcon = EMOJI_TO_ICON[icon];
        const IconComponent = ICONS[mappedIcon];
        return <IconComponent size={iconSizes.xxxl} color={iconColor} />;
      }
      // Fallback for any unrecognized string (including unknown emojis)
      return <BookOpen size={iconSizes.xxxl} color={iconColor} />;
    }
    if (React.isValidElement(icon)) {
      return icon;
    }
    return <BookOpen size={iconSizes.xxxl} color={iconColor} />;
  };

  return (
    <View style={[styles.container, fullScreen && styles.fullScreen, { backgroundColor: fullScreen ? colors.background.secondary : 'transparent' }, style]}>
      <View style={styles.iconContainer}>
        {renderIcon()}
      </View>

      <Text style={[styles.title, { color: colors.text.primary }]}>{title}</Text>

      {description && (
        <Text style={[styles.description, { color: colors.text.tertiary }]}>{description}</Text>
      )}

      {(actionTitle && onAction) && (
        <Pressable style={[styles.actionButton, { backgroundColor: colors.accent.primary }]} onPress={onAction}>
          <Text style={[styles.actionButtonText, { color: colors.background.primary }]}>{actionTitle}</Text>
        </Pressable>
      )}

      {(secondaryActionTitle && onSecondaryAction) && (
        <Pressable style={styles.secondaryButton} onPress={onSecondaryAction}>
          <Text style={[styles.secondaryButtonText, { color: colors.text.secondary }]}>{secondaryActionTitle}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  fullScreen: {
    flex: 1,
  },
  iconContainer: {
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.displaySmall,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.bodyMedium,
    textAlign: 'center',
    maxWidth: scale(280),
    marginBottom: spacing.xxl,
  },
  // NN/g: 44px minimum touch targets
  actionButton: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing['3xl'],
    borderRadius: radius.card,
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  actionButtonText: {
    ...typography.labelLarge,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    ...typography.bodyMedium,
    fontWeight: '500',
  },
});
