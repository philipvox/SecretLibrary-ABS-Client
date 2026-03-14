/**
 * src/features/profile/components/SettingsRow.tsx
 *
 * Unified settings row component used across all settings screens.
 * Supports switches, navigation (chevron), danger styling, loading, and disabled states.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { scale, useSecretLibraryColors } from '@/shared/theme';
import { secretLibraryFonts as fonts } from '@/shared/theme/secretLibrary';

export interface SettingsRowProps {
  Icon: LucideIcon;
  label: string;
  /** Small helper text below label */
  description?: string;
  /** Current value shown on right side */
  value?: string;
  /** Tap handler (shows chevron when set) */
  onPress?: () => void;
  /** Switch toggle state */
  switchValue?: boolean;
  /** Switch toggle handler */
  onSwitchChange?: (value: boolean) => void;
  /** Red destructive styling */
  danger?: boolean;
  /** Grayed out disabled state */
  disabled?: boolean;
  /** Show loading spinner in right area */
  loading?: boolean;
}

export function SettingsRow({
  Icon,
  label,
  description,
  value,
  onPress,
  switchValue,
  onSwitchChange,
  danger,
  disabled,
  loading,
}: SettingsRowProps) {
  const colors = useSecretLibraryColors();

  const content = (
    <View
      style={[
        styles.settingsRow,
        { borderBottomColor: colors.borderLight },
        disabled && styles.settingsRowDisabled,
      ]}
    >
      <View style={styles.rowLeft}>
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: colors.grayLight },
            danger && styles.iconContainerDanger,
            disabled && { opacity: 0.5 },
          ]}
        >
          <Icon
            size={scale(18)}
            color={danger ? '#ff4b4b' : colors.gray}
            strokeWidth={1.5}
          />
        </View>
        <View style={styles.rowContent}>
          <Text
            style={[
              styles.rowLabel,
              { color: colors.black },
              danger && styles.rowLabelDanger,
              disabled && { color: colors.gray },
            ]}
          >
            {label}
          </Text>
          {description && (
            <Text
              style={[
                styles.rowDescription,
                { color: colors.gray },
                disabled && { opacity: 0.6 },
              ]}
            >
              {description}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.rowRight}>
        {loading && <ActivityIndicator size="small" color={colors.gray} />}
        {value && !loading && (
          <Text
            style={[
              styles.rowValue,
              { color: colors.black },
              danger && styles.rowValueDanger,
            ]}
          >
            {value}
          </Text>
        )}
        {onSwitchChange !== undefined && (
          <Switch
            value={switchValue}
            onValueChange={onSwitchChange}
            trackColor={{ false: colors.borderLight, true: colors.black }}
            thumbColor="#CCCCCC"
            ios_backgroundColor={colors.borderLight}
            disabled={disabled}
          />
        )}
        {onPress && !loading && (
          <ChevronRight size={scale(16)} color={colors.gray} strokeWidth={1.5} />
        )}
      </View>
    </View>
  );

  if (onPress && !loading) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} disabled={disabled}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  settingsRowDisabled: {
    opacity: 0.5,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(8),
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainerDanger: {
    backgroundColor: 'rgba(255,75,75,0.1)',
  },
  rowContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  rowLabel: {
    fontFamily: fonts.playfair.regular,
    fontSize: scale(15),
  },
  rowLabelDanger: {
    color: '#ff4b4b',
  },
  rowDescription: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(9),
    marginTop: 2,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowValue: {
    fontFamily: fonts.jetbrainsMono.regular,
    fontSize: scale(11),
  },
  rowValueDanger: {
    color: '#888888',
  },
});
