/**
 * src/features/discover/components/PreferencesPromoCard.tsx
 *
 * Promo card encouraging users to fill out preferences questionnaire
 * to get personalized recommendations.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { Sparkles, ChevronRight } from 'lucide-react-native';
import { spacing, radius, scale, layout, useTheme } from '@/shared/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PreferencesPromoCard() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();

  const scaleValue = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleValue.value }],
  }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('PreferencesOnboarding');
  };

  const handlePressIn = () => {
    scaleValue.value = withSpring(0.98, { damping: 15, stiffness: 200 });
  };

  const handlePressOut = () => {
    scaleValue.value = withSpring(1, { damping: 15, stiffness: 200 });
  };

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.container, animatedStyle]}
    >
      <View style={[styles.card, { backgroundColor: colors.background.secondary }]}>
        <View style={[styles.iconContainer, { backgroundColor: colors.accent.primarySubtle }]}>
          <Sparkles size={scale(24)} color={colors.accent.primary} />
        </View>

        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: colors.text.primary }]}>
            Get Personalized Recommendations
          </Text>
          <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
            Answer a few questions about your preferences
          </Text>
        </View>

        <View style={[styles.arrowContainer, { backgroundColor: colors.accent.primary }]}>
          <ChevronRight size={scale(18)} color={colors.accent.textOnAccent} strokeWidth={2.5} />
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: layout.screenPaddingH,
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radius.lg,
    gap: spacing.md,
  },
  iconContainer: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(22),
    // backgroundColor set dynamically via colors.accent.primarySubtle
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: scale(15),
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: scale(13),
  },
  arrowContainer: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    justifyContent: 'center',
    alignItems: 'center',
  },
});
