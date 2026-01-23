/**
 * src/shared/accessibility/useAccessibility.ts
 *
 * React hooks for accessibility features.
 * Provides real-time detection of accessibility settings.
 */

import { useEffect, useState, useCallback } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

// =============================================================================
// Types
// =============================================================================

export interface AccessibilityState {
  /** Screen reader is active (VoiceOver on iOS, TalkBack on Android) */
  screenReaderEnabled: boolean;
  /** Reduce motion preference is enabled */
  reduceMotionEnabled: boolean;
  /** Bold text preference is enabled (iOS only) */
  boldTextEnabled: boolean;
  /** Grayscale mode is enabled (iOS only) */
  grayscaleEnabled: boolean;
  /** Invert colors is enabled (iOS only) */
  invertColorsEnabled: boolean;
  /** Reduce transparency is enabled (iOS only) */
  reduceTransparencyEnabled: boolean;
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Hook to detect all accessibility settings.
 * Updates in real-time when settings change.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { screenReaderEnabled, reduceMotionEnabled } = useAccessibilityState();
 *
 *   if (screenReaderEnabled) {
 *     // Provide enhanced labels
 *   }
 *
 *   if (reduceMotionEnabled) {
 *     // Skip animations
 *   }
 * }
 * ```
 */
export function useAccessibilityState(): AccessibilityState {
  const [state, setState] = useState<AccessibilityState>({
    screenReaderEnabled: false,
    reduceMotionEnabled: false,
    boldTextEnabled: false,
    grayscaleEnabled: false,
    invertColorsEnabled: false,
    reduceTransparencyEnabled: false,
  });

  useEffect(() => {
    // Check initial states
    const checkStates = async () => {
      const [
        screenReader,
        reduceMotion,
        boldText,
        grayscale,
        invertColors,
        reduceTransparency,
      ] = await Promise.all([
        AccessibilityInfo.isScreenReaderEnabled(),
        AccessibilityInfo.isReduceMotionEnabled(),
        Platform.OS === 'ios' ? AccessibilityInfo.isBoldTextEnabled() : false,
        Platform.OS === 'ios' ? AccessibilityInfo.isGrayscaleEnabled() : false,
        Platform.OS === 'ios' ? AccessibilityInfo.isInvertColorsEnabled() : false,
        Platform.OS === 'ios' ? AccessibilityInfo.isReduceTransparencyEnabled() : false,
      ]);

      setState({
        screenReaderEnabled: screenReader,
        reduceMotionEnabled: reduceMotion,
        boldTextEnabled: boldText,
        grayscaleEnabled: grayscale,
        invertColorsEnabled: invertColors,
        reduceTransparencyEnabled: reduceTransparency,
      });
    };

    checkStates();

    // Subscribe to changes
    const subscriptions = [
      AccessibilityInfo.addEventListener('screenReaderChanged', (enabled) => {
        setState((prev) => ({ ...prev, screenReaderEnabled: enabled }));
      }),
      AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
        setState((prev) => ({ ...prev, reduceMotionEnabled: enabled }));
      }),
    ];

    if (Platform.OS === 'ios') {
      subscriptions.push(
        AccessibilityInfo.addEventListener('boldTextChanged', (enabled) => {
          setState((prev) => ({ ...prev, boldTextEnabled: enabled }));
        }),
        AccessibilityInfo.addEventListener('grayscaleChanged', (enabled) => {
          setState((prev) => ({ ...prev, grayscaleEnabled: enabled }));
        }),
        AccessibilityInfo.addEventListener('invertColorsChanged', (enabled) => {
          setState((prev) => ({ ...prev, invertColorsEnabled: enabled }));
        }),
        AccessibilityInfo.addEventListener('reduceTransparencyChanged', (enabled) => {
          setState((prev) => ({ ...prev, reduceTransparencyEnabled: enabled }));
        })
      );
    }

    return () => {
      subscriptions.forEach((sub) => sub.remove());
    };
  }, []);

  return state;
}

/**
 * Hook to detect if a screen reader is active.
 * Simpler alternative to useAccessibilityState when you only need screen reader status.
 *
 * @example
 * ```tsx
 * function BookCard({ title, author }) {
 *   const screenReaderActive = useScreenReader();
 *
 *   return (
 *     <View accessibilityLabel={screenReaderActive ? `${title} by ${author}` : undefined}>
 *       <Text>{title}</Text>
 *       <Text>{author}</Text>
 *     </View>
 *   );
 * }
 * ```
 */
export function useScreenReader(): boolean {
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isScreenReaderEnabled().then(setIsEnabled);

    const subscription = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      setIsEnabled
    );

    return () => subscription.remove();
  }, []);

  return isEnabled;
}

/**
 * Hook to detect if reduce motion preference is enabled.
 * Re-exported from animation/hooks for convenience.
 *
 * @example
 * ```tsx
 * function AnimatedComponent() {
 *   const reduceMotion = useReduceMotion();
 *
 *   const animationDuration = reduceMotion ? 0 : 300;
 * }
 * ```
 */
export function useReduceMotion(): boolean {
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setIsEnabled);

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setIsEnabled
    );

    return () => subscription.remove();
  }, []);

  return isEnabled;
}

/**
 * Hook to announce text to screen reader.
 * Returns a function that can be called to make announcements.
 *
 * @example
 * ```tsx
 * function DownloadButton() {
 *   const announce = useAnnounce();
 *
 *   const handleDownloadComplete = () => {
 *     announce('Download complete');
 *   };
 * }
 * ```
 */
export function useAnnounce(): (message: string) => void {
  const announce = useCallback((message: string) => {
    AccessibilityInfo.announceForAccessibility(message);
  }, []);

  return announce;
}

/**
 * Hook that provides a function to focus on a specific element.
 * Useful for directing screen reader focus after state changes.
 *
 * @example
 * ```tsx
 * function Modal({ isOpen, onClose }) {
 *   const focusRef = useRef(null);
 *   const setAccessibilityFocus = useAccessibilityFocus();
 *
 *   useEffect(() => {
 *     if (isOpen && focusRef.current) {
 *       setAccessibilityFocus(focusRef.current);
 *     }
 *   }, [isOpen]);
 *
 *   return (
 *     <View ref={focusRef} accessible accessibilityLabel="Modal opened">
 *       ...
 *     </View>
 *   );
 * }
 * ```
 */
export function useAccessibilityFocus(): (node: any) => void {
  const setFocus = useCallback((node: any) => {
    if (node) {
      AccessibilityInfo.setAccessibilityFocus(node);
    }
  }, []);

  return setFocus;
}

/**
 * Hook to announce screen changes for screen readers.
 * Call this when navigating to a new screen.
 *
 * @example
 * ```tsx
 * function BookDetailScreen({ title }) {
 *   useAnnounceScreen(`Book details for ${title}`);
 *
 *   return <View>...</View>;
 * }
 * ```
 */
export function useAnnounceScreen(screenDescription: string): void {
  const screenReaderEnabled = useScreenReader();

  useEffect(() => {
    if (screenReaderEnabled && screenDescription) {
      // Small delay to let the screen render first
      const timer = setTimeout(() => {
        AccessibilityInfo.announceForAccessibility(screenDescription);
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [screenDescription, screenReaderEnabled]);
}
