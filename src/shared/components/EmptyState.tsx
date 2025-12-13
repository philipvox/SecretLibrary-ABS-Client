/**
 * src/shared/components/EmptyState.tsx
 *
 * Empty state display with optional action.
 * NN/g: Clear guidance on what to do next.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, ViewStyle } from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import {
  colors,
  spacing,
  radius,
  layout,
  typography,
  scale,
} from '@/shared/theme';

// Built-in icon components
const BookIcon = ({ size = 64, color = colors.textMuted }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M4 19.5A2.5 2.5 0 016.5 17H20"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const SearchIcon = ({ size = 64, color = colors.textMuted }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="11" cy="11" r="8" stroke={color} strokeWidth={1.5} />
    <Path d="M21 21l-4.35-4.35" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
  </Svg>
);

const HeartIcon = ({ size = 64, color = colors.textMuted }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const DownloadIcon = ({ size = 64, color = colors.textMuted }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M7 10l5 5 5-5" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M12 15V3" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const ListIcon = ({ size = 64, color = colors.textMuted }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="3" y="3" width="7" height="7" rx="1" stroke={color} strokeWidth={1.5} />
    <Rect x="14" y="3" width="7" height="7" rx="1" stroke={color} strokeWidth={1.5} />
    <Rect x="3" y="14" width="7" height="7" rx="1" stroke={color} strokeWidth={1.5} />
    <Rect x="14" y="14" width="7" height="7" rx="1" stroke={color} strokeWidth={1.5} />
  </Svg>
);

export type EmptyStateIcon = 'book' | 'search' | 'heart' | 'download' | 'list';

const ICONS: Record<EmptyStateIcon, React.FC<{ size?: number; color?: string }>> = {
  book: BookIcon,
  search: SearchIcon,
  heart: HeartIcon,
  download: DownloadIcon,
  list: ListIcon,
};

interface EmptyStateProps {
  /** Main message/title */
  title: string;
  /** Built-in icon name or custom React node */
  icon?: EmptyStateIcon | React.ReactNode;
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
  const renderIcon = () => {
    if (typeof icon === 'string' && icon in ICONS) {
      const IconComponent = ICONS[icon as EmptyStateIcon];
      return <IconComponent size={scale(64)} />;
    }
    if (React.isValidElement(icon)) {
      return icon;
    }
    return <BookIcon size={scale(64)} />;
  };

  return (
    <View style={[styles.container, fullScreen && styles.fullScreen, style]}>
      <View style={styles.iconContainer}>
        {renderIcon()}
      </View>

      <Text style={styles.title}>{title}</Text>

      {description && (
        <Text style={styles.description}>{description}</Text>
      )}

      {(actionTitle && onAction) && (
        <Pressable style={styles.actionButton} onPress={onAction}>
          <Text style={styles.actionButtonText}>{actionTitle}</Text>
        </Pressable>
      )}

      {(secondaryActionTitle && onSecondaryAction) && (
        <Pressable style={styles.secondaryButton} onPress={onSecondaryAction}>
          <Text style={styles.secondaryButtonText}>{secondaryActionTitle}</Text>
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
    backgroundColor: colors.backgroundTertiary,
  },
  iconContainer: {
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.displaySmall,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.bodyMedium,
    color: colors.textTertiary,
    textAlign: 'center',
    maxWidth: scale(280),
    marginBottom: spacing.xxl,
  },
  // NN/g: 44px minimum touch targets
  actionButton: {
    backgroundColor: colors.accent,
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
    color: colors.backgroundPrimary,
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
    color: colors.textSecondary,
  },
});
