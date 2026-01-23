/**
 * src/shared/hooks/useAutoHideLoading.ts
 *
 * Hook that automatically hides the global loading overlay when:
 * 1. The screen is focused
 * 2. Data is ready
 *
 * This is essential for tab screens that stay mounted - we only want to hide
 * loading when the screen is actually visible to the user.
 *
 * @example
 * // In a tab screen component
 * const isDataReady = mounted && cacheReady && !isLoading;
 * useAutoHideLoading(isDataReady);
 */

import { useRef, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { globalLoading, useGlobalLoadingStore } from '@/shared/stores/globalLoadingStore';

/**
 * Automatically hides global loading when screen is focused AND data is ready.
 *
 * Handles the complexity of tab screens that stay mounted:
 * - Only hides loading when THIS screen is focused (not other tabs)
 * - Handles data becoming ready after screen focuses
 * - Handles screen focusing after data is ready
 *
 * @param isDataReady - Boolean indicating if the screen's data is ready to display
 * @param options - Optional configuration
 */
export function useAutoHideLoading(
  isDataReady: boolean,
  options?: {
    /**
     * Enable debug logging. Default: false
     */
    debug?: boolean;
    /**
     * Tag for debug logs. Default: 'Screen'
     */
    debugTag?: string;
  }
): void {
  const { debug = false, debugTag = 'Screen' } = options ?? {};

  // Subscribe to loading state
  const isGlobalLoading = useGlobalLoadingStore((s) => s.isLoading);

  // Track if this screen is currently focused
  const isFocusedRef = useRef(false);

  // Log helper
  const log = useCallback(
    (message: string) => {
      if (debug && __DEV__) {
        console.log(`[AutoHideLoading:${debugTag}] ${message}`);
      }
    },
    [debug, debugTag]
  );

  // Handle focus state and hide loading when focused AND data ready
  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      log(`Focused (dataReady=${isDataReady}, loading=${isGlobalLoading})`);

      if (isDataReady && isGlobalLoading) {
        log('Hiding loading on focus');
        globalLoading.hide();
      }

      return () => {
        isFocusedRef.current = false;
        log('Unfocused');
      };
    }, [isDataReady, isGlobalLoading, log])
  );

  // Handle data becoming ready WHILE screen is focused
  // This covers the case where:
  // - User navigates to screen (focus fires, but data not ready yet)
  // - Data finishes loading (this effect fires and hides loading)
  useEffect(() => {
    if (isDataReady && isGlobalLoading && isFocusedRef.current) {
      log('Hiding loading on data ready');
      globalLoading.hide();
    }
  }, [isDataReady, isGlobalLoading, log]);
}

/**
 * Variant that returns the focus state for additional control.
 *
 * @example
 * const { isFocused } = useAutoHideLoadingWithState(isDataReady);
 * // Use isFocused for conditional rendering
 */
export function useAutoHideLoadingWithState(
  isDataReady: boolean,
  options?: {
    debug?: boolean;
    debugTag?: string;
  }
): { isFocused: boolean } {
  const { debug = false, debugTag = 'Screen' } = options ?? {};

  const isGlobalLoading = useGlobalLoadingStore((s) => s.isLoading);
  const isFocusedRef = useRef(false);

  const log = useCallback(
    (message: string) => {
      if (debug && __DEV__) {
        console.log(`[AutoHideLoading:${debugTag}] ${message}`);
      }
    },
    [debug, debugTag]
  );

  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      log(`Focused (dataReady=${isDataReady}, loading=${isGlobalLoading})`);

      if (isDataReady && isGlobalLoading) {
        log('Hiding loading on focus');
        globalLoading.hide();
      }

      return () => {
        isFocusedRef.current = false;
        log('Unfocused');
      };
    }, [isDataReady, isGlobalLoading, log])
  );

  useEffect(() => {
    if (isDataReady && isGlobalLoading && isFocusedRef.current) {
      log('Hiding loading on data ready');
      globalLoading.hide();
    }
  }, [isDataReady, isGlobalLoading, log]);

  return { isFocused: isFocusedRef.current };
}
