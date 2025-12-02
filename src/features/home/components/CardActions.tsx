/**
 * src/features/home/components/CardActions.tsx
 * 
 * Action buttons below the main card:
 * - View Series (left)
 * - Restart (right)
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

// Default config
const DEFAULT_CONFIG = {
  mainCard: {
    width: Math.min(339, SCREEN_WIDTH - 32),
  },
  actions: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginBottom: 16,
    fontSize: 14,
    iconSize: 18,
    iconGap: 8,
  },
  colors: {
    textTertiary: 'rgba(255,255,255,0.5)',
  },
};

interface CardActionsProps {
  onViewSeries?: () => void;
  onRestart?: () => void;
  showViewSeries?: boolean;
  config?: typeof DEFAULT_CONFIG;
}

// Icons
function MenuIcon({ size = 18, color = 'rgba(255,255,255,0.5)' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 6H21M3 12H21M3 18H21"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function RestartIcon({ size = 18, color = 'rgba(255,255,255,0.5)' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 12H7M7 12L4 9M7 12L4 15"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M7 12C7 8.13401 10.134 5 14 5C17.866 5 21 8.13401 21 12C21 15.866 17.866 19 14 19C11.5 19 9.31 17.73 8 15.8"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
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
  actionText: {},
});

export default CardActions;