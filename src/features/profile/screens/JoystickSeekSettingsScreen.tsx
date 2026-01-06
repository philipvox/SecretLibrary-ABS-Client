/**
 * src/features/profile/screens/JoystickSeekSettingsScreen.tsx
 *
 * Settings screen for customizing joystick-style seek control behavior.
 * Allows users to configure speed range, response curve, deadzone, and haptic feedback.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  ChevronLeft,
  ArrowUpDown,
  Gamepad2,
  Maximize,
  TrendingUp,
  Activity,
  Play,
  SkipForward,
  SkipBack,
} from 'lucide-react-native';
import Svg, { Path, Line, Text as SvgText, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  useJoystickSeekStore,
  CURVE_PRESETS,
  calculateSeekSpeed,
  formatSpeedLabel,
  formatSpeedShort,
  applyDeadzone,
  type CurvePreset,
} from '@/features/player/stores/joystickSeekStore';
import { haptics } from '@/core/native/haptics';
import { SCREEN_BOTTOM_PADDING } from '@/constants/layout';
import { accentColors, scale, wp, typography, fontWeight, spacing } from '@/shared/theme';
import { useThemeColors, ThemeColors } from '@/shared/theme';

const ACCENT = accentColors.gold;

// Helper to create theme-aware colors
function createColors(themeColors: ThemeColors) {
  return {
    accent: ACCENT,
    background: themeColors.backgroundSecondary,
    text: themeColors.text,
    textSecondary: themeColors.textSecondary,
    textTertiary: themeColors.textTertiary,
    card: themeColors.border,
    border: themeColors.border,
    iconBg: themeColors.border,
  };
}

// ============================================================================
// CURVE PREVIEW COMPONENT
// ============================================================================

interface CurvePreviewProps {
  minSpeed: number;
  maxSpeed: number;
  exponent: number;
  testPosition?: number;
  /** Callback when user drags to adjust exponent (makes curve interactive) */
  onExponentChange?: (exponent: number) => void;
}

function CurvePreview({ minSpeed, maxSpeed, exponent, testPosition, onExponentChange }: CurvePreviewProps) {
  const width = wp(92);
  const height = wp(50); // Taller for better dragging
  const padding = { top: 20, right: 45, bottom: 35, left: 45 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  // Drag state for interactive curve editing
  const isDragging = useSharedValue(false);
  const startExponent = useSharedValue(exponent);

  // Wrapper function for haptics (runOnJS can't handle object methods directly)
  const triggerHaptic = useCallback(() => {
    haptics.selection();
  }, []);

  // Handle drag gesture on curve
  const panGesture = useMemo(() => {
    if (!onExponentChange) return null;

    return Gesture.Pan()
      .onStart(() => {
        isDragging.value = true;
        startExponent.value = exponent;
        runOnJS(triggerHaptic)();
      })
      .onUpdate((e) => {
        // Dragging up = lower exponent (more linear), down = higher exponent (more curved)
        // Map vertical movement to exponent change
        const deltaY = -e.translationY / graphHeight;
        const newExponent = Math.max(0.2, Math.min(4.0, startExponent.value + deltaY * 3.0));
        runOnJS(onExponentChange)(newExponent);
      })
      .onEnd(() => {
        isDragging.value = false;
        runOnJS(triggerHaptic)();
      });
  }, [onExponentChange, exponent, graphHeight, triggerHaptic]);

  // Generate curve path
  const curvePath = useMemo(() => {
    const points: string[] = [];
    for (let i = 0; i <= 100; i++) {
      const x = i / 100;
      const y = Math.pow(x, exponent);
      const px = padding.left + x * graphWidth;
      const py = padding.top + graphHeight - y * graphHeight;
      points.push(`${i === 0 ? 'M' : 'L'} ${px} ${py}`);
    }
    return points.join(' ');
  }, [exponent, graphWidth, graphHeight]);

  // Generate fill path
  const fillPath = useMemo(() => {
    const bottomRight = `L ${padding.left + graphWidth} ${padding.top + graphHeight}`;
    const bottomLeft = `L ${padding.left} ${padding.top + graphHeight}`;
    return `${curvePath} ${bottomRight} ${bottomLeft} Z`;
  }, [curvePath, graphWidth, graphHeight]);

  // Test point position
  const testPoint = useMemo(() => {
    if (testPosition === undefined) return null;
    const x = padding.left + testPosition * graphWidth;
    const y = padding.top + graphHeight - Math.pow(testPosition, exponent) * graphHeight;
    return { x, y };
  }, [testPosition, exponent, graphWidth, graphHeight]);

  const content = (
    <View style={styles.curvePreviewContainer}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="fillGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={ACCENT} stopOpacity="0.25" />
            <Stop offset="100%" stopColor={ACCENT} stopOpacity="0.02" />
          </LinearGradient>
        </Defs>

        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((pct) => (
          <React.Fragment key={`grid-${pct}`}>
            <Line
              x1={padding.left}
              y1={padding.top + (1 - pct) * graphHeight}
              x2={padding.left + graphWidth}
              y2={padding.top + (1 - pct) * graphHeight}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1"
            />
            <Line
              x1={padding.left + pct * graphWidth}
              y1={padding.top}
              x2={padding.left + pct * graphWidth}
              y2={padding.top + graphHeight}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1"
            />
          </React.Fragment>
        ))}

        {/* Axes */}
        <Line
          x1={padding.left}
          y1={padding.top + graphHeight}
          x2={padding.left + graphWidth}
          y2={padding.top + graphHeight}
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="1"
        />
        <Line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={padding.top + graphHeight}
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="1"
        />

        {/* Fill under curve */}
        <Path d={fillPath} fill="url(#fillGradient)" />

        {/* Curve line */}
        <Path d={curvePath} stroke={ACCENT} strokeWidth="2.5" fill="none" />

        {/* Test position indicator */}
        {testPoint && (
          <>
            <Line
              x1={testPoint.x}
              y1={padding.top + graphHeight}
              x2={testPoint.x}
              y2={testPoint.y}
              stroke={ACCENT}
              strokeWidth="1"
              strokeDasharray="4,4"
            />
            <Line
              x1={padding.left}
              y1={testPoint.y}
              x2={testPoint.x}
              y2={testPoint.y}
              stroke={ACCENT}
              strokeWidth="1"
              strokeDasharray="4,4"
            />
            <Circle cx={testPoint.x} cy={testPoint.y} r="6" fill={ACCENT} />
          </>
        )}

        {/* Speed labels */}
        <SvgText
          x={padding.left - 8}
          y={padding.top + 4}
          fill="rgba(255,255,255,0.6)"
          fontSize="10"
          textAnchor="end"
        >
          {formatSpeedShort(maxSpeed)}
        </SvgText>
        <SvgText
          x={padding.left - 8}
          y={padding.top + graphHeight + 4}
          fill="rgba(255,255,255,0.6)"
          fontSize="10"
          textAnchor="end"
        >
          {formatSpeedShort(minSpeed)}
        </SvgText>

        {/* Axis labels */}
        <SvgText
          x={padding.left + graphWidth / 2}
          y={height - 4}
          fill="rgba(255,255,255,0.4)"
          fontSize="10"
          textAnchor="middle"
        >
          Drag Distance
        </SvgText>

        {/* Exponent value display (when interactive) */}
        {onExponentChange && (
          <SvgText
            x={padding.left + graphWidth - 5}
            y={padding.top + 15}
            fill="rgba(255,255,255,0.6)"
            fontSize="11"
            fontWeight="600"
            textAnchor="end"
          >
            {exponent.toFixed(2)}
          </SvgText>
        )}
      </Svg>

      {/* Drag hint (when interactive) */}
      {onExponentChange && (
        <View style={styles.dragHint}>
          <ArrowUpDown size={12} color="rgba(255,255,255,0.4)" strokeWidth={2} />
          <Text style={styles.dragHintText}>Drag to adjust curve</Text>
        </View>
      )}
    </View>
  );

  // Wrap with gesture detector if interactive
  if (panGesture) {
    return (
      <GestureDetector gesture={panGesture}>
        {content}
      </GestureDetector>
    );
  }

  return content;
}

// ============================================================================
// PRESET PILLS COMPONENT
// ============================================================================

interface PresetPillsProps {
  selected: CurvePreset;
  onSelect: (preset: CurvePreset) => void;
}

const PRESET_LABELS: Record<CurvePreset, string> = {
  fine: 'Fine',
  swift: 'Swift',
  even: 'Even',
  rush: 'Rush',
  custom: 'Cust.',
};

function PresetPills({ selected, onSelect }: PresetPillsProps) {
  const presets: CurvePreset[] = ['fine', 'swift', 'even', 'rush'];

  const handleSelect = useCallback(
    (preset: CurvePreset) => {
      haptics.selection();
      onSelect(preset);
    },
    [onSelect]
  );

  return (
    <View style={styles.presetContainer}>
      <Text style={styles.presetLabel}>Response Curve</Text>
      <View style={styles.presetPills}>
        {presets.map((preset) => {
          const isSelected = selected === preset;
          return (
            <TouchableOpacity
              key={preset}
              style={[styles.presetPill, isSelected && styles.presetPillSelected]}
              onPress={() => handleSelect(preset)}
              activeOpacity={0.7}
            >
              <Text style={[styles.presetPillText, isSelected && styles.presetPillTextSelected]}>
                {PRESET_LABELS[preset]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {selected === 'custom' && (
        <Text style={styles.customNote}>Custom curve (manually adjusted)</Text>
      )}
    </View>
  );
}

// ============================================================================
// SPEED SLIDER COMPONENT
// ============================================================================

interface SpeedSliderProps {
  label: string;
  note: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

function SpeedSlider({ label, note, value, min, max, step, onChange }: SpeedSliderProps) {
  const [localValue, setLocalValue] = useState(value);

  const handleValueChange = useCallback(
    (newValue: number) => {
      const stepped = Math.round(newValue / step) * step;
      const clamped = Math.max(min, Math.min(max, stepped));
      setLocalValue(clamped);
    },
    [min, max, step]
  );

  const handleSlidingComplete = useCallback(
    (newValue: number) => {
      const stepped = Math.round(newValue / step) * step;
      const clamped = Math.max(min, Math.min(max, stepped));
      onChange(clamped);
      haptics.selection();
    },
    [onChange, min, max, step]
  );

  // Update local value when prop changes
  React.useEffect(() => {
    setLocalValue(value);
  }, [value]);

  return (
    <View style={styles.sliderContainer}>
      <View style={styles.sliderHeader}>
        <Text style={styles.sliderLabel}>{label}</Text>
        <Text style={styles.sliderValue}>{formatSpeedShort(localValue)}</Text>
      </View>
      <Text style={styles.sliderNote}>{note}</Text>

      <Slider
        style={styles.slider}
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={localValue}
        onValueChange={handleValueChange}
        onSlidingComplete={handleSlidingComplete}
        minimumTrackTintColor={colors.accent}
        maximumTrackTintColor="rgba(255,255,255,0.15)"
        thumbTintColor={colors.accent}
      />

      <View style={styles.sliderLabels}>
        <Text style={styles.sliderMinMax}>{formatSpeedShort(min)}</Text>
        <Text style={styles.sliderMinMax}>{formatSpeedShort(max)}</Text>
      </View>

      <Text style={styles.sliderDescription}>{formatSpeedLabel(localValue)}</Text>
    </View>
  );
}

// ============================================================================
// TEST AREA COMPONENT
// ============================================================================

interface TestAreaProps {
  settings: {
    minSpeed: number;
    maxSpeed: number;
    curvePreset: CurvePreset;
    curveExponent: number;
    deadzone: number;
    hapticEnabled: boolean;
  };
  onTestPositionChange: (position: number | undefined) => void;
}

function TestArea({ settings, onTestPositionChange }: TestAreaProps) {
  const [isTesting, setIsTesting] = useState(false);
  const [testSpeed, setTestSpeed] = useState(0);
  const [testDirection, setTestDirection] = useState<'forward' | 'backward' | null>(null);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const buttonScale = useSharedValue(1);

  const TEST_RADIUS = scale(80);
  const MAX_DISPLACEMENT = scale(100);

  // Wrapper functions for haptics (can't access haptics object in worklet)
  const triggerHaptic = useCallback(() => {
    if (settings.hapticEnabled) {
      haptics.impact('medium');
    }
  }, [settings.hapticEnabled]);

  const updateTestState = useCallback(
    (tx: number, ty: number) => {
      const distance = Math.sqrt(tx * tx + ty * ty);
      const normalizedDistance = applyDeadzone(distance, MAX_DISPLACEMENT, settings.deadzone);

      if (normalizedDistance > 0) {
        const speed = calculateSeekSpeed(normalizedDistance, {
          ...settings,
          enabled: true,
        });
        const direction = tx >= 0 ? 'forward' : 'backward';

        setTestSpeed(speed);
        setTestDirection(direction);
        onTestPositionChange(normalizedDistance);

        // Haptic at thresholds
        if (settings.hapticEnabled && Math.floor(speed / 50) !== Math.floor(testSpeed / 50)) {
          haptics.selection();
        }
      } else {
        setTestSpeed(0);
        setTestDirection(null);
        onTestPositionChange(undefined);
      }
    },
    [settings, testSpeed, onTestPositionChange]
  );

  const gesture = Gesture.Pan()
    .onStart(() => {
      'worklet';
      buttonScale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
      runOnJS(setIsTesting)(true);
      runOnJS(triggerHaptic)();
    })
    .onUpdate((e) => {
      'worklet';
      // Limit displacement
      const distance = Math.sqrt(e.translationX ** 2 + e.translationY ** 2);
      const limitedDistance = Math.min(distance, MAX_DISPLACEMENT);
      const angle = Math.atan2(e.translationY, e.translationX);

      translateX.value = limitedDistance * Math.cos(angle);
      translateY.value = limitedDistance * Math.sin(angle);

      runOnJS(updateTestState)(translateX.value, translateY.value);
    })
    .onEnd(() => {
      'worklet';
      translateX.value = withSpring(0, { damping: 20, stiffness: 300 });
      translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
      buttonScale.value = withSpring(1, { damping: 15, stiffness: 300 });
      runOnJS(setIsTesting)(false);
      runOnJS(setTestSpeed)(0);
      runOnJS(setTestDirection)(null);
      runOnJS(onTestPositionChange)(undefined);
    });

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: buttonScale.value },
    ],
  }));

  return (
    <View style={styles.testAreaContainer}>
      <Text style={styles.testAreaTitle}>Test Your Settings</Text>
      <Text style={styles.testAreaSubtitle}>Drag from center to test</Text>

      <View style={styles.testAreaCircle}>
        <GestureDetector gesture={gesture}>
          <Animated.View style={[styles.testButton, buttonStyle]}>
            {isTesting ? (
              testDirection === 'forward' ? (
                <SkipForward size={scale(24)} color="#000" strokeWidth={2} />
              ) : (
                <SkipBack size={scale(24)} color="#000" strokeWidth={2} />
              )
            ) : (
              <Play size={scale(24)} color="#000" fill="#000" strokeWidth={0} />
            )}
          </Animated.View>
        </GestureDetector>
      </View>

      <View style={styles.testStats}>
        <View style={styles.testStat}>
          <Text style={styles.testStatLabel}>Speed</Text>
          <Text style={[styles.testStatValue, isTesting && styles.testStatValueActive]}>
            {isTesting ? formatSpeedShort(testSpeed) : '--'}
          </Text>
        </View>
        <View style={styles.testStatDivider} />
        <View style={styles.testStat}>
          <Text style={styles.testStatLabel}>Direction</Text>
          <Text style={[styles.testStatValue, isTesting && styles.testStatValueActive]}>
            {isTesting && testDirection ? (testDirection === 'forward' ? 'Forward' : 'Backward') : '--'}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function JoystickSeekSettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const themeColors = useThemeColors();
  const colors = createColors(themeColors);

  // Store
  const enabled = useJoystickSeekStore((s) => s.enabled);
  const minSpeed = useJoystickSeekStore((s) => s.minSpeed);
  const maxSpeed = useJoystickSeekStore((s) => s.maxSpeed);
  const curvePreset = useJoystickSeekStore((s) => s.curvePreset);
  const curveExponent = useJoystickSeekStore((s) => s.curveExponent);
  const deadzone = useJoystickSeekStore((s) => s.deadzone);
  const hapticEnabled = useJoystickSeekStore((s) => s.hapticEnabled);

  const setEnabled = useJoystickSeekStore((s) => s.setEnabled);
  const setMinSpeed = useJoystickSeekStore((s) => s.setMinSpeed);
  const setMaxSpeed = useJoystickSeekStore((s) => s.setMaxSpeed);
  const setCurvePreset = useJoystickSeekStore((s) => s.setCurvePreset);
  const setCurveExponent = useJoystickSeekStore((s) => s.setCurveExponent);
  const setDeadzone = useJoystickSeekStore((s) => s.setDeadzone);
  const setHapticEnabled = useJoystickSeekStore((s) => s.setHapticEnabled);
  const resetToDefaults = useJoystickSeekStore((s) => s.resetToDefaults);

  // Test position for curve preview
  const [testPosition, setTestPosition] = useState<number | undefined>(undefined);

  // Handlers
  const handleReset = useCallback(() => {
    Alert.alert(
      'Reset to Defaults',
      'Reset all joystick seek settings to their default values?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            resetToDefaults();
            haptics.buttonPress();
          },
        },
      ]
    );
  }, [resetToDefaults]);

  const settings = useMemo(
    () => ({
      minSpeed,
      maxSpeed,
      curvePreset,
      curveExponent,
      deadzone,
      hapticEnabled,
    }),
    [minSpeed, maxSpeed, curvePreset, curveExponent, deadzone, hapticEnabled]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <StatusBar barStyle={themeColors.statusBar} backgroundColor={colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ChevronLeft size={scale(24)} color={colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Joystick Seek</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Description */}
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          Hold and drag from the play button to seek through your audiobook at variable speeds.
          Drag further for faster seeking.
        </Text>

        {/* Enable Toggle */}
        <View style={styles.section}>
          <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
            <View style={[styles.settingsRow, { borderBottomColor: colors.border }]}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconContainer, { backgroundColor: colors.iconBg }]}>
                  <Gamepad2 size={scale(18)} color={colors.textSecondary} strokeWidth={2} />
                </View>
                <View style={styles.rowContent}>
                  <Text style={[styles.rowLabel, { color: colors.text }]}>Enable Joystick Seek</Text>
                </View>
              </View>
              <Switch
                value={enabled}
                onValueChange={setEnabled}
                trackColor={{ false: colors.border, true: ACCENT }}
                thumbColor="#fff"
              />
            </View>
          </View>
        </View>

        {enabled && (
          <>
            {/* Curve Preview - Interactive: drag to adjust exponent */}
            <CurvePreview
              minSpeed={minSpeed}
              maxSpeed={maxSpeed}
              exponent={curveExponent}
              testPosition={testPosition}
              onExponentChange={setCurveExponent}
            />

            {/* Preset Pills */}
            <PresetPills selected={curvePreset} onSelect={setCurvePreset} />

            {/* Speed Range Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionHeader, { color: colors.textTertiary }]}>Speed Range</Text>

              <SpeedSlider
                label="Minimum Speed"
                note="Precision seeking (slight drag)"
                value={minSpeed}
                min={0.1}
                max={30}
                step={0.1}
                onChange={setMinSpeed}
              />

              <SpeedSlider
                label="Maximum Speed"
                note="Fast scanning (full drag)"
                value={maxSpeed}
                min={30}
                max={600}
                step={30}
                onChange={setMaxSpeed}
              />
            </View>

            {/* Advanced Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionHeader, { color: colors.textTertiary }]}>Advanced</Text>
              <View style={[styles.sectionCard, { backgroundColor: colors.card }]}>
                {/* Deadzone Slider */}
                <View style={[styles.sliderRow, { borderBottomColor: colors.border }]}>
                  <View style={styles.sliderHeader}>
                    <View style={styles.rowLeft}>
                      <View style={[styles.iconContainer, { backgroundColor: colors.iconBg }]}>
                        <Maximize size={scale(18)} color={colors.textSecondary} strokeWidth={2} />
                      </View>
                      <View style={styles.rowContent}>
                        <Text style={[styles.rowLabel, { color: colors.text }]}>Deadzone</Text>
                        <Text style={[styles.rowNote, { color: colors.textTertiary }]}>Distance before seeking starts</Text>
                      </View>
                    </View>
                    <Text style={[styles.rowValue, { color: colors.accent }]}>{deadzone}pt</Text>
                  </View>
                  <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={30}
                    step={1}
                    value={deadzone}
                    onValueChange={(value) => {
                      setDeadzone(value);
                    }}
                    minimumTrackTintColor={ACCENT}
                    maximumTrackTintColor={colors.border}
                    thumbTintColor="#fff"
                  />
                </View>

                {/* Curve Exponent Slider */}
                <View style={[styles.sliderRow, { borderBottomColor: colors.border }]}>
                  <View style={styles.sliderHeader}>
                    <View style={styles.rowLeft}>
                      <View style={[styles.iconContainer, { backgroundColor: colors.iconBg }]}>
                        <TrendingUp size={scale(18)} color={colors.textSecondary} strokeWidth={2} />
                      </View>
                      <View style={styles.rowContent}>
                        <Text style={[styles.rowLabel, { color: colors.text }]}>Curve Exponent</Text>
                        <Text style={[styles.rowNote, { color: colors.textTertiary }]}>Fine-tune response curve</Text>
                      </View>
                    </View>
                    <Text style={[styles.rowValue, { color: colors.accent }]}>{curveExponent.toFixed(2)}</Text>
                  </View>
                  <Slider
                    style={styles.slider}
                    minimumValue={0.2}
                    maximumValue={4.0}
                    step={0.05}
                    value={curveExponent}
                    onValueChange={(value) => {
                      setCurveExponent(value);
                    }}
                    minimumTrackTintColor={ACCENT}
                    maximumTrackTintColor={colors.border}
                    thumbTintColor="#fff"
                  />
                </View>

                {/* Haptic Feedback */}
                <View style={[styles.settingsRow, styles.settingsRowLast, { borderBottomColor: colors.border }]}>
                  <View style={styles.rowLeft}>
                    <View style={[styles.iconContainer, { backgroundColor: colors.iconBg }]}>
                      <Activity size={scale(18)} color={colors.textSecondary} strokeWidth={2} />
                    </View>
                    <View style={styles.rowContent}>
                      <Text style={[styles.rowLabel, { color: colors.text }]}>Haptic Feedback</Text>
                      <Text style={[styles.rowNote, { color: colors.textTertiary }]}>Vibrate during seeking</Text>
                    </View>
                  </View>
                  <Switch
                    value={hapticEnabled}
                    onValueChange={setHapticEnabled}
                    trackColor={{ false: colors.border, true: ACCENT }}
                    thumbColor="#fff"
                  />
                </View>
              </View>
            </View>

            {/* Test Area */}
            <TestArea settings={settings} onTestPositionChange={setTestPosition} />

            {/* Reset Button */}
            <TouchableOpacity style={[styles.resetButton, { borderColor: colors.border }]} onPress={handleReset} activeOpacity={0.7}>
              <Text style={[styles.resetButtonText, { color: colors.textSecondary }]}>Reset to Defaults</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: SCREEN_BOTTOM_PADDING + insets.bottom }} />
      </ScrollView>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor set via colors.background in JSX
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  backButton: {
    width: scale(40),
    height: scale(40),
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    ...typography.headlineLarge,
    fontWeight: fontWeight.semibold,
    // color set via colors.text in JSX
  },
  headerSpacer: {
    width: scale(40),
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: scale(20),
  },
  description: {
    ...typography.bodyLarge,
    // color set via colors.textSecondary in JSX
    lineHeight: scale(20),
    marginHorizontal: spacing.xl,
    marginBottom: spacing.xl,
  },

  // Sections
  section: {
    marginBottom: spacing.xxl,
  },
  sectionHeader: {
    ...typography.bodyMedium,
    fontWeight: fontWeight.semibold,
    // color set via colors.textTertiary in JSX
    letterSpacing: 0.5,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.sm,
  },
  sectionCard: {
    marginHorizontal: spacing.lg,
    // backgroundColor set via colors.card in JSX
    borderRadius: scale(12),
    overflow: 'hidden',
  },

  // Settings Row
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: scale(14),
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    // borderBottomColor set via colors.border in JSX
  },
  settingsRowLast: {
    borderBottomWidth: 0,
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
    // backgroundColor set via colors.iconBg in JSX
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  rowLabel: {
    ...typography.headlineMedium,
    fontWeight: fontWeight.medium,
    // color set via colors.text in JSX
  },
  rowNote: {
    ...typography.bodySmall,
    // color set via colors.textTertiary in JSX
    marginTop: scale(2),
  },
  rowValue: {
    ...typography.bodyLarge,
    fontWeight: fontWeight.medium,
    // color set via colors.accent in JSX
  },

  // Curve Preview
  curvePreviewContainer: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: scale(12),
    padding: spacing.md,
    alignItems: 'center',
  },
  dragHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    marginTop: scale(4),
  },
  dragHintText: {
    ...typography.labelSmall,
    color: 'rgba(255,255,255,0.4)',
  },

  // Preset Pills
  presetContainer: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xxl,
  },
  presetLabel: {
    ...typography.bodyMedium,
    fontWeight: fontWeight.semibold,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
    marginBottom: scale(10),
    marginLeft: scale(4),
  },
  presetPills: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  presetPill: {
    flex: 1,
    paddingVertical: scale(10),
    paddingHorizontal: scale(12),
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: scale(20),
    alignItems: 'center',
  },
  presetPillSelected: {
    backgroundColor: ACCENT,
  },
  presetPillText: {
    ...typography.bodySmall,
    fontWeight: fontWeight.semibold,
    color: 'rgba(255,255,255,0.7)',
  },
  presetPillTextSelected: {
    color: '#000',
  },
  customNote: {
    ...typography.labelMedium,
    color: 'rgba(255,255,255,0.4)',
    marginTop: spacing.sm,
    marginLeft: scale(4),
  },

  // Speed Slider
  sliderContainer: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xxl,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(4),
  },
  sliderLabel: {
    ...typography.bodyLarge,
    fontWeight: fontWeight.medium,
    color: '#fff',
  },
  sliderValue: {
    ...typography.headlineLarge,
    fontWeight: fontWeight.bold,
    color: ACCENT,
  },
  sliderNote: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: scale(12),
  },
  sliderRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  slider: {
    width: '100%',
    height: scale(40),
    marginVertical: scale(8),
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  sliderMinMax: {
    ...typography.labelMedium,
    color: 'rgba(255,255,255,0.4)',
  },
  sliderDescription: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.5)',
    marginTop: spacing.sm,
    textAlign: 'center',
  },

  // Test Area
  testAreaContainer: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xxl,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: scale(12),
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderStyle: 'dashed',
  },
  testAreaTitle: {
    ...typography.bodyLarge,
    fontWeight: fontWeight.semibold,
    color: '#fff',
    marginBottom: scale(4),
  },
  testAreaSubtitle: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: spacing.xl,
  },
  testAreaCircle: {
    width: scale(160),
    height: scale(160),
    borderRadius: scale(80),
    backgroundColor: 'rgba(255,255,255,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  testButton: {
    width: scale(64),
    height: scale(64),
    borderRadius: scale(32),
    backgroundColor: ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  testStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(20),
  },
  testStat: {
    alignItems: 'center',
  },
  testStatLabel: {
    ...typography.labelMedium,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: scale(4),
  },
  testStatValue: {
    ...typography.headlineLarge,
    fontWeight: fontWeight.bold,
    color: 'rgba(255,255,255,0.3)',
  },
  testStatValueActive: {
    color: ACCENT,
  },
  testStatDivider: {
    width: 1,
    height: scale(30),
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  // Reset Button
  resetButton: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingVertical: scale(14),
    borderRadius: scale(12),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
  },
  resetButtonText: {
    ...typography.headlineMedium,
    fontWeight: fontWeight.medium,
    color: 'rgba(255,255,255,0.6)',
  },
});

export default JoystickSeekSettingsScreen;
