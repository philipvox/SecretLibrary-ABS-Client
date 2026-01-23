/**
 * src/shared/hooks/useNavigationWithLoading.ts
 *
 * Hook that provides navigation methods with global loading overlay.
 * Consolidates the common pattern of showing loading, delaying, then navigating.
 *
 * Eliminates the need for inline `globalLoading.show(); setTimeout(...)` patterns
 * throughout the codebase, centralizing timing and making it easier to adjust.
 *
 * @example
 * const { navigateWithLoading, goBackWithLoading } = useNavigationWithLoading();
 *
 * // Simple navigation
 * navigateWithLoading('BookDetail', { id: '123' });
 *
 * // Tab navigation
 * navigateWithLoading('Main', { screen: 'DiscoverTab' });
 *
 * // Go back (useful after modals)
 * goBackWithLoading();
 */

import { useCallback, useRef, useEffect } from 'react';
import { useNavigation, NavigationProp, ParamListBase } from '@react-navigation/native';
import { globalLoading } from '@/shared/stores/globalLoadingStore';
import {
  LOADING_NAVIGATION_DELAY_MS,
  LOADING_MODAL_RETURN_DELAY_MS,
} from '@/constants/loading';

/**
 * Navigation options for customizing behavior.
 */
interface NavigateOptions {
  /**
   * Use longer delay for modal returns. Default: false
   * When true, uses LOADING_MODAL_RETURN_DELAY_MS (200ms) instead of standard delay.
   */
  modalReturn?: boolean;

  /**
   * Custom delay override (ms). Use sparingly - prefer standard delays.
   */
  delay?: number;
}

/**
 * Hook that provides navigation methods with global loading overlay.
 * Handles timing, cleanup on unmount, and centralizes the loading pattern.
 */
export function useNavigationWithLoading<
  T extends ParamListBase = ParamListBase
>() {
  const navigation = useNavigation<NavigationProp<T>>();

  // Track timeouts for cleanup on unmount
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  /**
   * Navigate to a route with loading overlay.
   * Shows loading, waits for delay, then navigates.
   *
   * @param routeName - The route to navigate to
   * @param params - Optional route params (can include `screen` for nested navigation)
   * @param options - Navigation options
   */
  const navigateWithLoading = useCallback(
    <RouteName extends keyof T & string>(
      routeName: RouteName,
      params?: T[RouteName],
      options?: NavigateOptions
    ) => {
      // Determine delay
      const delay = options?.delay ??
        (options?.modalReturn ? LOADING_MODAL_RETURN_DELAY_MS : LOADING_NAVIGATION_DELAY_MS);

      // Show loading overlay
      globalLoading.show();

      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Navigate after delay
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        // @ts-expect-error - React Navigation types are complex with nested navigators
        navigation.navigate(routeName, params);
      }, delay);
    },
    [navigation]
  );

  /**
   * Go back with loading overlay.
   * Useful when returning from modals that trigger data loading.
   *
   * @param options - Navigation options
   */
  const goBackWithLoading = useCallback(
    (options?: NavigateOptions) => {
      // Default to modal return delay for goBack since it's typically used with modals
      const delay = options?.delay ??
        (options?.modalReturn !== false ? LOADING_MODAL_RETURN_DELAY_MS : LOADING_NAVIGATION_DELAY_MS);

      // Show loading overlay
      globalLoading.show();

      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Navigate back after delay
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        navigation.goBack();
      }, delay);
    },
    [navigation]
  );

  /**
   * Jump to a tab with loading overlay.
   * Handles the parent navigator pattern for tab navigation.
   *
   * @param tabName - The tab screen to jump to
   * @param options - Navigation options
   */
  const jumpToTabWithLoading = useCallback(
    (tabName: string, options?: NavigateOptions) => {
      const delay = options?.delay ??
        (options?.modalReturn ? LOADING_MODAL_RETURN_DELAY_MS : LOADING_NAVIGATION_DELAY_MS);

      // Show loading overlay
      globalLoading.show();

      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Jump to tab after delay
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        // Try to use parent navigator's jumpTo for tabs
        // Type assertion needed because jumpTo only exists on tab navigators
        const parent = navigation.getParent?.() as { jumpTo?: (name: string) => void } | undefined;
        if (parent?.jumpTo) {
          parent.jumpTo(tabName);
        } else {
          // Fallback to navigate with screen param
          (navigation as any).navigate('Main', { screen: tabName });
        }
      }, delay);
    },
    [navigation]
  );

  return {
    navigateWithLoading,
    goBackWithLoading,
    jumpToTabWithLoading,
    /** Direct access to navigation for non-loading operations */
    navigation,
  };
}

/**
 * Re-export loading constants for convenience.
 * Allows callers to check timing values without additional imports.
 */
export { LOADING_NAVIGATION_DELAY_MS, LOADING_MODAL_RETURN_DELAY_MS };
