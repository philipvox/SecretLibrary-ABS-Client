/**
 * src/features/mood-discovery/screens/MoodDiscoveryScreen.tsx
 *
 * 3-Step Discovery Quiz Screen:
 * 1. Mood (required) - What emotional experience (4 moods in 2x2 grid)
 * 2. Flavor (optional) - Sub-category drill-down based on mood
 * 3. Seed Book (optional) - "What book do you wish you could read again?"
 *
 * Design features:
 * - Italic serif titles with gray subtitles
 * - "Surprise me" button at top of Screen 1
 * - Mood chip header on Screens 2 and 3
 * - Card tap inversion with auto-advance
 * - Adults only toggle with divider
 */

import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  FadeIn,
} from 'react-native-reanimated';

// Layout animations crash on Android in ScrollViews - use regular View on Android
const isIOS = Platform.OS === 'ios';

import { Icon } from '@/shared/components/Icon';
import { haptics } from '@/core/native/haptics';
import { spacing, radius, scale, useTheme } from '@/shared/theme';
import { secretLibraryFonts, secretLibraryColors } from '@/shared/theme/secretLibrary';
import {
  MOODS,
  MOOD_FLAVORS,
  TOTAL_QUIZ_STEPS,
  Mood,
  FlavorConfig,
} from '../types';
import {
  useMoodDraft,
  useQuizActions,
  useHasActiveSession,
} from '../stores/moodSessionStore';
import { MoodScoringOverlay } from '../components/MoodScoringOverlay';
import { SeedBookPicker } from '../components/SeedBookPicker';
import { ScreenLoadingOverlay } from '@/shared/components';

// Auto-advance delay after selection (ms)
const AUTO_ADVANCE_DELAY = 400;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ============================================================================
// STEP QUESTIONS
// ============================================================================

/**
 * Get step config based on current step and selected mood.
 * Step 1: Mood selection - "What are you in the mood for?"
 * Step 2: Flavor drill-down - Sub-categories for chosen mood
 * Step 3: Seed book - "What book do you wish you could read again?"
 */
function getStepConfig(step: number, mood: Mood | null) {
  switch (step) {
    case 1:
      return {
        question: 'What are you in the mood for?',
        subtitle: 'Pick one',
        label: 'MOOD',
      };

    case 2:
      return {
        question: 'What flavor?',
        subtitle: 'Pick your vibe',
        label: 'FLAVOR',
      };

    case 3:
      return {
        question: 'Which book do you wish you could read for the first time again?',
        subtitle: 'This helps us find similar gems',
        label: 'SEED',
      };

    default:
      return {
        question: 'Refine your search',
        subtitle: 'Optional',
        label: 'DETAILS',
      };
  }
}

// ============================================================================
// MOOD CARD COMPONENT (2x2 grid, black & white design)
// ============================================================================

interface MoodCardProps<T> {
  config: { id: T; label: string; icon: string; iconSet: string; description: string; isDefault?: boolean };
  selected: boolean;
  onSelect: () => void;
}

function MoodCard<T>({ config, selected, onSelect }: MoodCardProps<T>) {
  const { colors } = useTheme();
  const cardScale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));

  const handlePressIn = () => {
    cardScale.value = withSpring(0.97, { damping: 45 });
  };

  const handlePressOut = () => {
    cardScale.value = withSpring(1, { damping: 45 });
  };

  const handlePress = () => {
    haptics.impact('light');
    onSelect();
  };

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.moodCard,
        { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.1)' },
        selected && styles.moodCardSelected,
        animatedStyle,
      ]}
    >
      <Text style={[
        styles.moodCardTitle,
        { color: '#FFFFFF' },
        selected && { color: '#000000' },
      ]}>
        {config.label}
      </Text>
      <Text style={[
        styles.moodCardDesc,
        { color: 'rgba(255,255,255,0.45)' },
        selected && { color: 'rgba(0,0,0,0.5)' },
      ]}>
        {config.description}
      </Text>
    </AnimatedPressable>
  );
}

// ============================================================================
// MOOD CHIP COMPONENT (shows selected mood on screens 2 and 3)
// ============================================================================

interface MoodChipProps {
  mood: Mood;
  onClear: () => void;
}

function MoodChip({ mood, onClear }: MoodChipProps) {
  const moodConfig = MOODS.find((m) => m.id === mood);
  if (!moodConfig) return null;

  return (
    <View style={styles.moodChip}>
      <Text style={styles.moodChipText}>
        {moodConfig.label.toUpperCase()}
      </Text>
      <TouchableOpacity onPress={onClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.moodChipRemove}>×</Text>
      </TouchableOpacity>
    </View>
  );
}

// ============================================================================
// PROGRESS INDICATOR
// ============================================================================

function ProgressIndicator({ current, total }: { current: number; total: number }) {
  return (
    <View style={styles.progressContainer}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            styles.progressDot,
            { backgroundColor: 'rgba(255,255,255,0.2)' },
            i + 1 <= current && { backgroundColor: '#FFFFFF' },
          ]}
        />
      ))}
    </View>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function MoodDiscoveryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const accentColor = secretLibraryColors.gold;
  const hasActiveSession = useHasActiveSession();

  // Loading state for initial mount
  const [mounted, setMounted] = useState(false);

  // Loading state for scoring overlay
  const [isScoring, setIsScoring] = useState(false);
  const [scoringProgress, setScoringProgress] = useState(0);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Mark as mounted after first render
  useEffect(() => {
    // Small delay to ensure layout is complete
    const timer = setTimeout(() => setMounted(true), 50);
    return () => {
      clearTimeout(timer);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  // Quiz state
  const draft = useMoodDraft();
  const {
    setMood,
    setFlavor,
    setSeedBook,
    setExcludeChildrens,
    nextStep,
    prevStep,
    resetDraft,
    commitSession,
  } = useQuizActions();

  // Animation for button
  const buttonScale = useSharedValue(1);
  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  // Auto-advance timer ref
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Scoring animation timer ref (for cleanup on unmount)
  const scoringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear all timers on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
      }
      if (scoringTimerRef.current) {
        clearTimeout(scoringTimerRef.current);
      }
    };
  }, []);

  const handleClose = useCallback(() => {
    resetDraft();
    navigation.goBack();
  }, [navigation, resetDraft]);

  // Handle "Surprise me — any mood" - randomly picks a mood and advances
  const handleSurpriseMe = useCallback(() => {
    haptics.impact('medium');
    const randomMood = MOODS[Math.floor(Math.random() * MOODS.length)].id;
    setMood(randomMood);

    // Show scoring animation immediately for surprise me
    setIsScoring(true);
    setScoringProgress(0);

    let progress = 0;
    progressIntervalRef.current = setInterval(() => {
      progress += 0.05;
      if (progress >= 1) {
        progress = 1;
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
        }
      }
      setScoringProgress(progress);
    }, 75);

    commitSession();
    scoringTimerRef.current = setTimeout(() => {
      setIsScoring(false);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      navigation.goBack();
    }, 1500);
  }, [setMood, commitSession, navigation]);

  // Handle mood selection (no auto-advance - user navigates manually)
  const handleMoodSelect = useCallback((moodId: Mood) => {
    setMood(moodId);
  }, [setMood]);

  // Handle flavor selection (no auto-advance - user navigates manually)
  const handleFlavorSelect = useCallback((flavorId: string) => {
    setFlavor(flavorId);
  }, [setFlavor]);

  // Handle clearing mood chip (go back to step 1)
  const handleClearMood = useCallback(() => {
    haptics.impact('light');
    resetDraft();
  }, [resetDraft]);

  const handleNext = useCallback(() => {
    haptics.impact('light');
    if (draft.currentStep === TOTAL_QUIZ_STEPS) {
      // Final step - show scoring overlay, commit, then navigate
      haptics.impact('medium');
      setIsScoring(true);
      setScoringProgress(0);

      // Animate progress smoothly over ~1.5 seconds
      let progress = 0;
      progressIntervalRef.current = setInterval(() => {
        progress += 0.05;
        if (progress >= 1) {
          progress = 1;
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
          }
        }
        setScoringProgress(progress);
      }, 75);

      // Commit session and navigate after showing animation
      commitSession();
      scoringTimerRef.current = setTimeout(() => {
        setIsScoring(false);
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
        }
        navigation.goBack();
      }, 1500);
    } else {
      nextStep();
    }
  }, [draft.currentStep, nextStep, commitSession, navigation]);

  const handleBack = useCallback(() => {
    haptics.impact('light');
    prevStep();
  }, [prevStep]);

  const handleSkip = useCallback(() => {
    // Skip remaining steps and commit with current selections
    if (draft.mood) {
      haptics.impact('medium');
      setIsScoring(true);
      setScoringProgress(0);

      // Animate progress smoothly over ~1.5 seconds
      let progress = 0;
      progressIntervalRef.current = setInterval(() => {
        progress += 0.05;
        if (progress >= 1) {
          progress = 1;
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
          }
        }
        setScoringProgress(progress);
      }, 75);

      // Commit session and navigate after showing animation
      commitSession();
      scoringTimerRef.current = setTimeout(() => {
        setIsScoring(false);
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
        }
        navigation.goBack();
      }, 1500);
    }
  }, [draft.mood, commitSession, navigation]);

  // Determine if we can proceed
  // Step 1: Mood required, Steps 2-3: Optional (can skip)
  const canProceed = draft.currentStep === 1 ? draft.mood !== null : true;

  // Get current step config
  const stepConfig = getStepConfig(draft.currentStep, draft.mood);

  // Get flavor options for current mood
  const flavorOptions = draft.mood ? MOOD_FLAVORS[draft.mood] : [];

  // Render options based on current step
  // Use Animated.View with FadeIn only on iOS - Android crashes with layout animations in ScrollView
  const renderOptions = () => {
    const Container = isIOS ? Animated.View : View;
    const animProps = isIOS ? { entering: FadeIn.duration(150) } : {};

    switch (draft.currentStep) {
      // Step 1: Mood selection - 2x2 grid with surprise button
      case 1:
        return (
          <View>
            {/* Surprise me button */}
            <TouchableOpacity
              style={styles.surpriseButton}
              onPress={handleSurpriseMe}
              activeOpacity={0.7}
            >
              <Text style={styles.surpriseButtonText}>
                Surprise me — any mood
              </Text>
            </TouchableOpacity>

            {/* 2x2 Mood Grid */}
            <Container {...animProps} style={styles.cardGrid}>
              {MOODS.map((mood) => (
                <MoodCard
                  key={mood.id}
                  config={mood}
                  selected={draft.mood === mood.id}
                  onSelect={() => handleMoodSelect(mood.id)}
                />
              ))}
            </Container>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Adults only toggle */}
            <Pressable
              style={styles.toggleRow}
              onPress={() => {
                haptics.toggle();
                setExcludeChildrens(!draft.excludeChildrens);
              }}
            >
              <View style={styles.toggleTextContainer}>
                <Text style={styles.toggleLabel}>Adults only</Text>
                <Text style={styles.toggleSublabel}>Skip children's books</Text>
              </View>
              <View style={[styles.toggle, draft.excludeChildrens && styles.toggleActive]}>
                <View style={[styles.toggleThumb, draft.excludeChildrens && styles.toggleThumbActive]} />
              </View>
            </Pressable>
          </View>
        );

      // Step 2: Flavor drill-down - 2x2 grid
      case 2:
        return (
          <View>
            {/* Surprise me button */}
            <TouchableOpacity
              style={[styles.surpriseButton, !draft.flavor && styles.surpriseButtonSelected]}
              onPress={() => {
                haptics.impact('light');
                setFlavor(null);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.surpriseButtonText, !draft.flavor && styles.surpriseButtonTextSelected]}>
                Surprise me — any flavor
              </Text>
            </TouchableOpacity>

            {/* 2x2 Flavor Grid */}
            <Container {...animProps} style={styles.cardGrid}>
              {flavorOptions.map((flavor) => (
                <MoodCard
                  key={flavor.id}
                  config={flavor}
                  selected={draft.flavor === flavor.id}
                  onSelect={() => handleFlavorSelect(flavor.id)}
                />
              ))}
            </Container>
          </View>
        );

      // Step 3 is handled separately outside ScrollView to avoid VirtualizedList nesting
      default:
        // Return empty View instead of null - Android crashes with null children in SafeAreaProvider
        return <View />;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top - 10, 0), backgroundColor: colors.background.primary }]}>
      {/* Initial load overlay */}
      <ScreenLoadingOverlay visible={!mounted} />

      {/* Scoring overlay */}
      <MoodScoringOverlay
        visible={isScoring}
        progress={scoringProgress}
        statusText="Finding your perfect reads..."
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <Icon name="X" size={24} color={colors.text.primary} />
        </TouchableOpacity>

        <ProgressIndicator current={draft.currentStep} total={TOTAL_QUIZ_STEPS} />

        {draft.currentStep > 1 && draft.mood ? (
          <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
            <Text style={[styles.skipText, { color: colors.text.tertiary }]}>Skip</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.skipButton} />
        )}
      </View>

      {/* Mood chip header (screens 2 and 3) */}
      {draft.currentStep > 1 && draft.mood && (
        <View style={styles.moodChipContainer}>
          <MoodChip mood={draft.mood} onClear={handleClearMood} />
        </View>
      )}

      {/* Session indicator */}
      {hasActiveSession && draft.currentStep === 1 && (
        <View style={[styles.sessionBanner, { backgroundColor: 'rgba(243, 182, 12, 0.15)', borderColor: accentColor }]}>
          <Icon name="Clock" size={16} color={accentColor} />
          <Text style={[styles.sessionText, { color: accentColor }]}>
            You have an active session. Edit or start fresh.
          </Text>
        </View>
      )}

      {/* Content - Step 3 uses flex layout to avoid VirtualizedList nesting in ScrollView */}
      {draft.currentStep === 3 ? (
        // Step 3: SeedBookPicker with FlatList - no ScrollView wrapper
        <View style={[styles.content, styles.contentContainer]}>
          {/* Step indicator */}
          <Text style={[styles.stepIndicator, { color: colors.text.tertiary }]}>
            STEP {draft.currentStep} OF {TOTAL_QUIZ_STEPS} · {stepConfig.label}
          </Text>

          {/* Question */}
          <Text style={[styles.question, { color: colors.text.primary }]}>{stepConfig.question}</Text>
          <Text style={[styles.subtitle, { color: colors.text.tertiary }]}>{stepConfig.subtitle}</Text>

          {/* Seed Book Picker (contains FlatList) */}
          <View style={styles.seedBookContainer}>
            <SeedBookPicker
              selectedBookId={draft.seedBookId}
              onSelectBook={setSeedBook}
              mood={draft.mood}
            />
          </View>

          {/* Footer */}
          <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
            {/* FIND BOOKS button - enabled when book selected */}
            <AnimatedPressable
              onPress={handleNext}
              onPressIn={() => {
                buttonScale.value = withSpring(0.97, { damping: 55 });
              }}
              onPressOut={() => {
                buttonScale.value = withSpring(1, { damping: 55 });
              }}
              disabled={!draft.seedBookId}
              style={[
                styles.findBooksButton,
                { backgroundColor: '#FFFFFF' },
                !draft.seedBookId && { backgroundColor: 'rgba(255,255,255,0.1)' },
                buttonAnimatedStyle,
              ]}
            >
              <Text style={[
                styles.findBooksText,
                { color: '#000000' },
                !draft.seedBookId && { color: 'rgba(255,255,255,0.3)' },
              ]}>
                FIND BOOKS
              </Text>
              <Icon
                name="Sparkles"
                size={18}
                color={draft.seedBookId ? '#000000' : 'rgba(255,255,255,0.3)'}
              />
            </AnimatedPressable>

            {/* Skip — surprise me link */}
            <TouchableOpacity onPress={handleSkip} style={styles.skipLinkContainer}>
              <Text style={[styles.skipLinkText, { color: colors.text.tertiary }]}>
                Skip — surprise me
              </Text>
            </TouchableOpacity>

            {/* Back button */}
            <TouchableOpacity onPress={handleBack} style={styles.backButtonCentered}>
              <Icon name="ArrowLeft" size={16} color={colors.text.tertiary} />
              <Text style={[styles.backText, { color: colors.text.tertiary }]}>Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        // Steps 1-2: ScrollView wrapper
        <ScrollView
          style={styles.content}
          contentContainerStyle={[
            styles.contentContainer,
            { paddingBottom: insets.bottom + spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Step indicator */}
          <Text style={[styles.stepIndicator, { color: colors.text.tertiary }]}>
            STEP {draft.currentStep} OF {TOTAL_QUIZ_STEPS} · {stepConfig.label}
          </Text>

          {/* Question */}
          <Text style={[styles.question, { color: colors.text.primary }]}>{stepConfig.question}</Text>
          <Text style={[styles.subtitle, { color: colors.text.tertiary }]}>{stepConfig.subtitle}</Text>

          {/* Options */}
          {renderOptions()}

          {/* Footer - inside scroll */}
          <View style={styles.footer}>
            <View style={styles.footerButtons}>
              {draft.currentStep > 1 && (
                <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                  <Icon name="ArrowLeft" size={20} color={colors.text.tertiary} />
                  <Text style={[styles.backText, { color: colors.text.tertiary }]}>Back</Text>
                </TouchableOpacity>
              )}

              <AnimatedPressable
                onPress={handleNext}
                onPressIn={() => {
                  buttonScale.value = withSpring(0.97, { damping: 55 });
                }}
                onPressOut={() => {
                  buttonScale.value = withSpring(1, { damping: 55 });
                }}
                disabled={!canProceed}
                style={[
                  styles.nextButton,
                  { backgroundColor: '#FFFFFF' },
                  !canProceed && { backgroundColor: 'rgba(255,255,255,0.1)' },
                  draft.currentStep === 1 && styles.nextButtonFull,
                  buttonAnimatedStyle,
                ]}
              >
                <Text style={[styles.nextText, { color: '#000000' }, !canProceed && { color: 'rgba(255,255,255,0.3)' }]}>
                  {draft.currentStep === TOTAL_QUIZ_STEPS ? 'FIND BOOKS' : 'NEXT'}
                </Text>
                <Icon
                  name={draft.currentStep === TOTAL_QUIZ_STEPS ? 'Sparkles' : 'ArrowRight'}
                  size={18}
                  color={canProceed ? '#000000' : 'rgba(255,255,255,0.3)'}
                />
              </AnimatedPressable>
            </View>

            {!canProceed && draft.currentStep === 1 && (
              <Text style={[styles.hint, { color: colors.text.tertiary }]}>Select a mood to continue</Text>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor set dynamically via colors.background.primary
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  skipText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(11),
    // color set dynamically via colors.text.tertiary
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Progress
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 'auto',
    paddingTop: 24,
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // Session Banner
  sessionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    // backgroundColor and borderColor set dynamically via accent
    marginHorizontal: 24,
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    gap: spacing.sm,
    borderWidth: 1,
  },
  sessionText: {
    flex: 1,
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(10),
    // color set dynamically via accentColor
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Content
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingTop: 0,
  },

  // Step
  stepIndicator: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(10),
    color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  question: {
    fontFamily: secretLibraryFonts.playfair.regularItalic, // Italic serif as requested
    fontSize: scale(32),
    color: '#FFFFFF',
    marginBottom: 12,
    lineHeight: scale(32) * 1.15,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(10),
    // color set dynamically via colors.text.tertiary (gray)
    marginBottom: 40,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 24,
  },

  // Mood chip header
  moodChipContainer: {
    paddingHorizontal: 24,
    marginBottom: spacing.xs,
  },
  moodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    gap: 10,
  },
  moodChipText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(11),
    fontWeight: '500',
    letterSpacing: 1,
    color: '#FFFFFF',
  },
  moodChipRemove: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 16,
  },

  // Surprise me button
  surpriseButton: {
    width: '100%',
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    marginBottom: 16,
  },
  surpriseButtonSelected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  surpriseButtonText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(14),
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  surpriseButtonTextSelected: {
    color: '#000000',
  },

  // 2x2 Card Grid
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 40,
  },

  // Mood Card (2x2 grid item)
  moodCard: {
    width: '47.5%',
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  moodCardSelected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  moodCardTitle: {
    fontFamily: secretLibraryFonts.playfair.regular,
    fontSize: scale(17),
    fontWeight: '500',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  moodCardDesc: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(12),
    lineHeight: scale(16),
  },

  // Toggle Row
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  toggleTextContainer: {
    flex: 1,
  },
  toggleLabel: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(14),
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 4,
  },
  toggleSublabel: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(12),
    color: 'rgba(255,255,255,0.3)',
  },
  toggle: {
    width: 52,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleActive: {
    backgroundColor: '#FFFFFF',
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  toggleThumbActive: {
    backgroundColor: '#000000',
    alignSelf: 'flex-end',
  },

  // Footer
  footer: {
    marginTop: spacing.xl,
  },
  footerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  backText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(11),
    // color set dynamically via colors.text.tertiary
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    // backgroundColor set dynamically via accentColor
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  nextButtonFull: {
    flex: 1,
  },
  nextText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(12),
    fontWeight: '600',
    // color set dynamically via colors.text.inverse or tertiary
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  hint: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(10),
    // color set dynamically via colors.text.tertiary
    textAlign: 'center',
    marginTop: spacing.sm,
  },

  // Seed book container (Step 3)
  seedBookContainer: {
    flex: 1,
    minHeight: 400,
  },

  // Step 3 footer styles
  findBooksButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  findBooksText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(13),
    fontWeight: '600',
    letterSpacing: 1.5,
  },
  skipLinkContainer: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  skipLinkText: {
    fontFamily: secretLibraryFonts.jetbrainsMono.regular,
    fontSize: scale(12),
    textDecorationLine: 'underline',
  },
  backButtonCentered: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
});
