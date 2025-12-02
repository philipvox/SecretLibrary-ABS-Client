/**
 * src/features/home/components/CardActions.tsx
 * 
 * Action buttons below the main card:
 * - View Series (left) - menu/list icon
 * - Restart (right) - skip back icon
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const DEFAULT_CONFIG = {
  mainCard: {
    width: Math.min(339, SCREEN_WIDTH - 32),
  },
  actions: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginBottom: 0,
    fontSize: 14,
    iconSize: 16,
    iconGap: 6,
  },
  colors: {
    textTertiary: 'rgba(255,255,255,0.4)',
  },
};

interface CardActionsProps {
  onViewSeries?: () => void;
  onRestart?: () => void;
  showViewSeries?: boolean;
  config?: typeof DEFAULT_CONFIG;
}

// Menu/List icon (three horizontal lines)
function MenuIcon({ size = 16, color = 'rgba(255,255,255,0.4)' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 6H20M4 12H20M4 18H20"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// Skip back / Restart icon (arrow pointing left with vertical line)
function RestartIcon({ size = 16, color = 'rgba(255,255,255,0.4)' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 5V19"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path
        d="M20 12L8 5V19L20 12Z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CardActions({ 
  onViewSeries, 
  onRestart, 
  showViewSeries = true,
  config = DEFAULT_CONFIG,
}: CardActionsProps) {
  const c = config;
  
  return (
    <View style={[
      styles.container,
      {
        width: c.mainCard.width,
        paddingVertical: c.actions.paddingVertical,
        paddingHorizontal: c.actions.paddingHorizontal,
      }
    ]}>
      {showViewSeries ? (
        <TouchableOpacity 
          onPress={onViewSeries} 
          style={[styles.actionButton, { gap: c.actions.iconGap }]}
        >
          <MenuIcon size={c.actions.iconSize} color={c.colors.textTertiary} />
          <Text style={[styles.actionText, { fontSize: c.actions.fontSize, color: c.colors.textTertiary }]}>
            View Series
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.actionButton} />
      )}
      
      <TouchableOpacity 
        onPress={onRestart} 
        style={[styles.actionButton, { gap: c.actions.iconGap }]}
      >
        <RestartIcon size={c.actions.iconSize} color={c.colors.textTertiary} />
        <Text style={[styles.actionText, { fontSize: c.actions.fontSize, color: c.colors.textTertiary }]}>
          Restart
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  actionText: {
    fontWeight: '500',
  },
});

export default CardActions;