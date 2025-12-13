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
import { useAllLibraryItems } from '@/features/search/hooks/useAllLibraryItems';
import { useDefaultLibrary } from '@/features/library/hooks/useDefaultLibrary';
import { extractGenres } from '@/shared/utils/genreUtils';
import { Icon } from '@/shared/components/Icon';
import { colors, spacing, radius } from '@/shared/theme';

// Create theme compat object for styles that use old theme structure
const theme = {
  colors: {
    text: { primary: colors.textPrimary, secondary: colors.textSecondary, tertiary: colors.textTertiary },
    background: { primary: colors.backgroundPrimary, secondary: colors.backgroundSecondary },
    border: { light: colors.borderLight },
    neutral: { 200: colors.progressTrack },
    primary: { 50: colors.accentSubtle, 500: colors.accent, 700: colors.accentDark },
  },
  spacing: { 2: spacing.xs, 3: spacing.sm, 4: spacing.md, 5: spacing.lg, 6: spacing.xl, 8: spacing.xxl },
  radius: { medium: radius.md },
};

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
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const scrollRef = useRef<ScrollView>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  
  const { library } = useDefaultLibrary();
  const { items } = useAllLibraryItems(library?.id || '');
  const availableGenres = extractGenres(items);

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
  const progress = (currentStep + 1) / questions.length;

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
      // Navigate to recommendations after completing preferences
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }, { name: 'Browse' }],
      });
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={theme.colors.text.primary} set="ionicons" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <Animated.View 
            style={[
              styles.progressFill,
              { 
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]} 
          />
        </View>
        <Text style={styles.stepText}>{currentStep + 1} of {questions.length}</Text>
      </View>

      <ScrollView 
        ref={scrollRef}
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Question */}
        <Text style={styles.question}>{currentQuestion.question}</Text>
        {currentQuestion.subtitle && (
          <Text style={styles.subtitle}>{currentQuestion.subtitle}</Text>
        )}

        {/* Options */}
        <View style={styles.optionsContainer}>
          {currentQuestion.options.map((option) => {
            const selected = isOptionSelected(option.value);
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.option, selected && styles.optionSelected]}
                onPress={() => handleOptionPress(option.value)}
                activeOpacity={0.7}
              >
                <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                  {option.label}
                </Text>
                {selected && (
                  <Icon
                    name="checkmark-circle"
                    size={20}
                    color={theme.colors.primary[500]}
                    set="ionicons"
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.nextButton, !canProceed() && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={!canProceed()}
        >
          <Text style={styles.nextButtonText}>
            {isLastStep ? 'Get Recommendations' : 'Continue'}
          </Text>
          <Icon 
            name={isLastStep ? "sparkles" : "arrow-forward"} 
            size={20} 
            color="#FFFFFF" 
            set="ionicons" 
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipText: {
    fontSize: 15,
    color: theme.colors.text.secondary,
  },
  progressContainer: {
    paddingHorizontal: theme.spacing[5],
    marginBottom: theme.spacing[4],
  },
  progressTrack: {
    height: 6,
    backgroundColor: theme.colors.neutral[200],
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary[500],
    borderRadius: 3,
  },
  stepText: {
    fontSize: 12,
    color: theme.colors.text.tertiary,
    marginTop: theme.spacing[2],
    textAlign: 'right',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: theme.spacing[5],
    paddingBottom: theme.spacing[8],
  },
  question: {
    fontSize: 26,
    fontWeight: '700',
    color: theme.colors.text.primary,
    lineHeight: 34,
    marginBottom: theme.spacing[2],
  },
  subtitle: {
    fontSize: 15,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing[6],
  },
  optionsContainer: {
    gap: theme.spacing[3],
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.radius.medium,
    padding: theme.spacing[4],
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionSelected: {
    borderColor: theme.colors.primary[500],
    backgroundColor: theme.colors.primary[50],
  },
  optionLabel: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text.primary,
    fontWeight: '500',
  },
  optionLabelSelected: {
    color: theme.colors.primary[700],
  },
  footer: {
    paddingHorizontal: theme.spacing[5],
    paddingTop: theme.spacing[3],
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.light,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary[500],
    borderRadius: theme.radius.medium,
    paddingVertical: theme.spacing[4],
    gap: theme.spacing[2],
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});