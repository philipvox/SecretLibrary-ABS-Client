/**
 * src/features/recommendations/screens/PreferencesOnboardingScreen.tsx
 * 
 * Q&A style onboarding to collect user preferences
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { usePreferencesStore } from '../stores/preferencesStore';
import { useLibraryCache, getGenresByPopularity } from '@/core/cache';
import { Icon } from '@/shared/components/Icon';
import { spacing, radius, useTheme, ACCENT } from '@/shared/theme';

interface Question {
  id: string;
  question: string;
  subtitle?: string;
  type: 'multi-select' | 'single-select';
  options: { label: string; value: string; emoji?: string }[];
}

const MOOD_OPTIONS = [
  { label: 'Adventurous', value: 'Adventurous' },
  { label: 'Relaxing', value: 'Relaxing' },
  { label: 'Thoughtful', value: 'Thoughtful' },
  { label: 'Escapist', value: 'Escapist' },
  { label: 'Suspenseful', value: 'Suspenseful' },
  { label: 'Romantic', value: 'Romantic' },
  { label: 'Educational', value: 'Educational' },
  { label: 'Funny', value: 'Funny' },
];

const LENGTH_OPTIONS = [
  { label: 'Quick listens (under 8 hours)', value: 'short' },
  { label: 'Medium (8-20 hours)', value: 'medium' },
  { label: 'Epic journeys (20+ hours)', value: 'long' },
  { label: 'No preference', value: 'any' },
];

const SERIES_OPTIONS = [
  { label: 'Yes, I love getting invested!', value: 'true' },
  { label: 'No, standalones for me', value: 'false' },
  { label: 'Both are great', value: 'null' },
];

export function PreferencesOnboardingScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const scrollRef = useRef<ScrollView>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Get genres from library cache (already populated)
  const { isLoaded } = useLibraryCache();
  const availableGenres = isLoaded ? getGenresByPopularity().map(g => g.name) : [];

  const {
    favoriteGenres,
    toggleGenre,
    preferredLength,
    setPreferredLength,
    prefersSeries,
    setPrefersSeries,
    moods,
    toggleMood,
    completeOnboarding,
  } = usePreferencesStore();

  const [currentStep, setCurrentStep] = useState(0);

  const questions: Question[] = [
    {
      id: 'moods',
      question: 'What kind of reading mood are you usually in?',
      subtitle: 'Select all that apply',
      type: 'multi-select',
      options: MOOD_OPTIONS,
    },
    {
      id: 'genres',
      question: 'What genres do you enjoy?',
      subtitle: 'Pick your favorites',
      type: 'multi-select',
      options: availableGenres.slice(0, 20).map(g => ({
        label: g,
        value: g,
      })),
    },
    {
      id: 'length',
      question: 'How long do you like your audiobooks?',
      type: 'single-select',
      options: LENGTH_OPTIONS,
    },
    {
      id: 'series',
      question: 'Do you enjoy book series?',
      type: 'single-select',
      options: SERIES_OPTIONS,
    },
  ];

  const currentQuestion = questions[currentStep];
  const isLastStep = currentStep === questions.length - 1;
  const _progress = (currentStep + 1) / questions.length;

  const animateProgress = (toValue: number) => {
    Animated.timing(progressAnim, {
      toValue,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const handleNext = () => {
    if (isLastStep) {
      completeOnboarding();
      // Close the modal - user returns to previous screen with preferences now active
      navigation.goBack();
    } else {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      animateProgress((nextStep + 1) / questions.length);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      animateProgress((prevStep + 1) / questions.length);
    } else {
      navigation.goBack();
    }
  };

  const handleSkip = () => {
    completeOnboarding();
    navigation.goBack();
  };

  const isOptionSelected = (value: string): boolean => {
    switch (currentQuestion.id) {
      case 'moods':
        return moods.includes(value);
      case 'genres':
        return favoriteGenres.includes(value);
      case 'length':
        return preferredLength === value;
      case 'series':
        if (value === 'null') return prefersSeries === null;
        return prefersSeries === (value === 'true');
      default:
        return false;
    }
  };

  const handleOptionPress = (value: string) => {
    switch (currentQuestion.id) {
      case 'moods':
        toggleMood(value);
        break;
      case 'genres':
        toggleGenre(value);
        break;
      case 'length':
        setPreferredLength(value as any);
        break;
      case 'series':
        if (value === 'null') setPrefersSeries(null);
        else setPrefersSeries(value === 'true');
        break;
    }
  };

  const canProceed = (): boolean => {
    switch (currentQuestion.id) {
      case 'moods':
        return moods.length > 0;
      case 'genres':
        return favoriteGenres.length > 0;
      default:
        return true;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background.primary }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Icon name="ArrowLeft" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSkip}>
          <Text style={[styles.skipText, { color: colors.text.secondary }]}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressTrack, { backgroundColor: colors.border.default }]}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                backgroundColor: colors.accent.primary,
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
        <Text style={[styles.stepText, { color: colors.text.tertiary }]}>{currentStep + 1} of {questions.length}</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Question */}
        <Text style={[styles.question, { color: colors.text.primary }]}>{currentQuestion.question}</Text>
        {currentQuestion.subtitle && (
          <Text style={[styles.subtitle, { color: colors.text.secondary }]}>{currentQuestion.subtitle}</Text>
        )}

        {/* Options */}
        <View style={styles.optionsContainer}>
          {currentQuestion.options.map((option) => {
            const selected = isOptionSelected(option.value);
            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.option,
                  { backgroundColor: colors.background.secondary },
                  selected && [styles.optionSelected, { borderColor: colors.accent.primary, backgroundColor: 'rgba(243, 182, 12, 0.1)' }]
                ]}
                onPress={() => handleOptionPress(option.value)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.optionLabel,
                  { color: colors.text.primary },
                  selected && { color: colors.accent.primary }
                ]}>
                  {option.label}
                </Text>
                {selected && (
                  <Icon
                    name="CircleCheck"
                    size={20}
                    color={colors.accent.primary}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16, borderTopColor: colors.border.default }]}>
        <TouchableOpacity
          style={[styles.nextButton, !canProceed() && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={!canProceed()}
        >
          <Text style={[styles.nextButtonText, { color: colors.text.inverse }]}>
            {isLastStep ? 'Get Recommendations' : 'Continue'}
          </Text>
          <Icon
            name={isLastStep ? "Sparkles" : "ArrowRight"}
            size={20}
            color={colors.text.inverse}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor set via themeColors in JSX
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipText: {
    fontSize: 15,
    // color set via themeColors in JSX
  },
  progressContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  progressTrack: {
    height: 6,
    // backgroundColor set via themeColors in JSX
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    // backgroundColor set via accentColors in JSX
    borderRadius: 3,
  },
  stepText: {
    fontSize: 12,
    // color set via themeColors in JSX
    marginTop: spacing.xs,
    textAlign: 'right',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  question: {
    fontSize: 26,
    fontWeight: '700',
    // color set via themeColors in JSX
    lineHeight: 34,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 15,
    // color set via themeColors in JSX
    marginBottom: spacing.xl,
  },
  optionsContainer: {
    gap: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    // backgroundColor set via themeColors in JSX
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionSelected: {
    // borderColor and backgroundColor set via themeColors in JSX
  },
  optionLabel: {
    flex: 1,
    fontSize: 16,
    // color set via themeColors in JSX
    fontWeight: '500',
  },
  optionLabelSelected: {
    // color set via accentColors in JSX
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    // borderTopColor set via themeColors in JSX
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    // color set via colors.text.inverse in JSX
  },
});