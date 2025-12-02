/**
 * Tab bar component for switching between views
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  runOnJS,
} from 'react-native-reanimated';
import { theme } from '../../theme';

interface TabBarProps<T extends string> {
  tabs: readonly T[];
  activeTab: T;
  onTabChange: (tab: T) => void;
  variant?: 'pills' | 'underline';
  scrollable?: boolean;
  style?: ViewStyle;
}

/**
 * Tab bar with animated indicator
 */
export function TabBar<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  variant = 'pills',
  scrollable = false,
  style,
}: TabBarProps<T>) {
  const [tabWidths, setTabWidths] = React.useState<number[]>([]);
  const [tabPositions, setTabPositions] = React.useState<number[]>([]);
  const activeIndex = tabs.indexOf(activeTab);

  const indicatorPosition = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);

  React.useEffect(() => {
    if (tabPositions.length > 0 && tabWidths.length > 0) {
      indicatorPosition.value = withSpring(tabPositions[activeIndex] || 0, {
        damping: 20,
        stiffness: 200,
      });
      indicatorWidth.value = withSpring(tabWidths[activeIndex] || 0, {
        damping: 20,
        stiffness: 200,
      });
    }
  }, [activeIndex, tabPositions, tabWidths]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorPosition.value }],
    width: indicatorWidth.value,
  }));

  const handleTabLayout = (index: number, width: number, x: number) => {
    setTabWidths((prev) => {
      const newWidths = [...prev];
      newWidths[index] = width;
      return newWidths;
    });
    setTabPositions((prev) => {
      const newPositions = [...prev];
      newPositions[index] = x;
      return newPositions;
    });
  };

  const Container = scrollable ? ScrollView : View;
  const containerProps = scrollable
    ? { horizontal: true, showsHorizontalScrollIndicator: false }
    : {};

  return (
    <View style={[styles.wrapper, style]}>
      <Container
        {...containerProps}
        style={[styles.container, variant === 'underline' && styles.containerUnderline]}
        contentContainerStyle={scrollable && styles.scrollContent}
      >
        {tabs.map((tab, index) => {
          const isActive = tab === activeTab;

          return (
            <TouchableOpacity
              key={tab}
              onPress={() => onTabChange(tab)}
              onLayout={(e) => {
                const { width, x } = e.nativeEvent.layout;
                handleTabLayout(index, width, x);
              }}
              style={[
                styles.tab,
                variant === 'pills' && styles.tabPills,
                variant === 'underline' && styles.tabUnderline,
              ]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.tabText,
                  isActive && styles.tabTextActive,
                  variant === 'underline' && isActive && styles.tabTextUnderlineActive,
                ]}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Animated indicator */}
        <Animated.View
          style={[
            variant === 'pills' ? styles.pillIndicator : styles.underlineIndicator,
            indicatorStyle,
          ]}
        />
      </Container>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: theme.spacing[4],
  },
  container: {
    flexDirection: 'row',
    backgroundColor: theme.colors.neutral[100],
    borderRadius: theme.radius.full,
    padding: theme.spacing[1],
    position: 'relative',
  },
  containerUnderline: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.default,
    padding: 0,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing[2],
  },
  tab: {
    paddingVertical: theme.spacing[2],
    paddingHorizontal: theme.spacing[4],
    zIndex: 1,
  },
  tabPills: {
    borderRadius: theme.radius.full,
  },
  tabUnderline: {
    paddingBottom: theme.spacing[3],
    marginRight: theme.spacing[4],
  },
  tabText: {
    ...theme.textStyles.bodySmall,
    color: theme.colors.text.secondary,
    fontWeight: '500',
    textAlign: 'center',
  },
  tabTextActive: {
    color: theme.colors.text.primary,
    fontWeight: '600',
  },
  tabTextUnderlineActive: {
    color: theme.colors.primary[500],
  },
  pillIndicator: {
    position: 'absolute',
    top: theme.spacing[1],
    bottom: theme.spacing[1],
    backgroundColor: theme.colors.card.background,
    borderRadius: theme.radius.full,
    ...theme.elevation.small,
  },
  underlineIndicator: {
    position: 'absolute',
    bottom: 0,
    height: 2,
    backgroundColor: theme.colors.primary[500],
    borderRadius: 1,
  },
});
