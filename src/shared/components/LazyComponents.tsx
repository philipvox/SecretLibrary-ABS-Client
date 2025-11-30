/**
 * src/shared/components/LazyComponents.tsx
 *
 * Lazy loading utilities for heavy components.
 * Defers rendering until component is visible or app is idle.
 */

import React, {
  Suspense,
  lazy,
  useState,
  useEffect,
  useRef,
  useCallback,
  ComponentType,
} from 'react';
import { View, InteractionManager, ViewStyle } from 'react-native';
import { LoadingSpinner } from './LoadingSpinner';
import { Shimmer } from './Skeleton';

// ============================================================================
// DEFER RENDER
// ============================================================================

interface DeferRenderProps {
  children: React.ReactNode;
  placeholder?: React.ReactNode;
  delay?: number;
}

/**
 * Defers rendering until after initial mount
 * Useful for components that aren't immediately visible
 */
export function DeferRender({
  children,
  placeholder = null,
  delay = 0,
}: DeferRenderProps) {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    // Wait for interactions to complete (animations, etc.)
    const handle = InteractionManager.runAfterInteractions(() => {
      if (delay > 0) {
        setTimeout(() => setShouldRender(true), delay);
      } else {
        setShouldRender(true);
      }
    });

    return () => handle.cancel();
  }, [delay]);

  if (!shouldRender) {
    return <>{placeholder}</>;
  }

  return <>{children}</>;
}

// ============================================================================
// LAZY COMPONENT WRAPPER
// ============================================================================

interface LazyWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Wrapper for React.lazy components with consistent loading state
 */
export function LazyWrapper({
  children,
  fallback = <LoadingSpinner />,
}: LazyWrapperProps) {
  return <Suspense fallback={fallback}>{children}</Suspense>;
}

// ============================================================================
// VISIBILITY OBSERVER
// ============================================================================

interface OnVisibleProps {
  children: React.ReactNode;
  placeholder?: React.ReactNode;
  rootMargin?: number;
  style?: ViewStyle;
}

/**
 * Renders children only when scrolled into view
 * Uses a simple measurement approach (no native intersection observer)
 */
export function OnVisible({
  children,
  placeholder = <Shimmer width="100%" height={100} />,
  rootMargin = 100,
  style,
}: OnVisibleProps) {
  const [isVisible, setIsVisible] = useState(false);
  const viewRef = useRef<View>(null);
  const hasBeenVisible = useRef(false);

  const checkVisibility = useCallback(() => {
    if (hasBeenVisible.current) return;

    viewRef.current?.measureInWindow((x, y, width, height) => {
      // Check if element is in viewport (with margin)
      const screenHeight =
        require('react-native').Dimensions.get('window').height;

      const isInView =
        y + height > -rootMargin && y < screenHeight + rootMargin;

      if (isInView) {
        hasBeenVisible.current = true;
        setIsVisible(true);
      }
    });
  }, [rootMargin]);

  useEffect(() => {
    // Initial check
    const timeout = setTimeout(checkVisibility, 100);

    // Check periodically (simplified scroll listener)
    const interval = setInterval(checkVisibility, 500);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [checkVisibility]);

  return (
    <View ref={viewRef} style={style} onLayout={checkVisibility}>
      {isVisible ? children : placeholder}
    </View>
  );
}

// ============================================================================
// PROGRESSIVE LOADING
// ============================================================================

interface ProgressiveLoadProps {
  low: React.ReactNode; // Low quality / placeholder
  high: React.ReactNode; // High quality / full content
  delay?: number;
}

/**
 * Shows low quality content first, then switches to high quality
 * Good for images or heavy components
 */
export function ProgressiveLoad({
  low,
  high,
  delay = 100,
}: ProgressiveLoadProps) {
  const [showHigh, setShowHigh] = useState(false);

  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() => {
      setTimeout(() => setShowHigh(true), delay);
    });
    return () => handle.cancel();
  }, [delay]);

  return <>{showHigh ? high : low}</>;
}

// ============================================================================
// BATCH RENDER
// ============================================================================

interface BatchRenderProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string;
  batchSize?: number;
  batchDelay?: number;
  placeholder?: React.ReactNode;
}

/**
 * Renders items in batches to avoid blocking the UI
 * Useful for long lists that don't use virtualization
 */
export function BatchRender<T>({
  items,
  renderItem,
  keyExtractor,
  batchSize = 10,
  batchDelay = 50,
  placeholder = null,
}: BatchRenderProps<T>) {
  const [renderedCount, setRenderedCount] = useState(batchSize);

  useEffect(() => {
    if (renderedCount >= items.length) return;

    const timeout = setTimeout(() => {
      setRenderedCount((prev) => Math.min(prev + batchSize, items.length));
    }, batchDelay);

    return () => clearTimeout(timeout);
  }, [renderedCount, items.length, batchSize, batchDelay]);

  return (
    <>
      {items.slice(0, renderedCount).map((item, index) => (
        <React.Fragment key={keyExtractor(item, index)}>
          {renderItem(item, index)}
        </React.Fragment>
      ))}
      {renderedCount < items.length && placeholder}
    </>
  );
}

// ============================================================================
// IDLE CALLBACK
// ============================================================================

/**
 * Hook to run code when browser/app is idle
 */
export function useIdleCallback(
  callback: () => void,
  deps: React.DependencyList = []
) {
  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() => {
      callback();
    });
    return () => handle.cancel();
  }, deps);
}

/**
 * Hook to defer state update until idle
 */
export function useDeferredValue<T>(value: T, delay: number = 0): T {
  const [deferredValue, setDeferredValue] = useState(value);

  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() => {
      if (delay > 0) {
        setTimeout(() => setDeferredValue(value), delay);
      } else {
        setDeferredValue(value);
      }
    });
    return () => handle.cancel();
  }, [value, delay]);

  return deferredValue;
}

// ============================================================================
// LAZY SCREEN FACTORY
// ============================================================================

/**
 * Factory function to create lazy-loaded screens
 * Usage: const LazyPlayerScreen = createLazyScreen(() => import('./PlayerScreen'))
 */
export function createLazyScreen<P extends object>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  LoadingComponent: ComponentType = LoadingSpinner
) {
  const LazyComponent = lazy(importFn);

  return function LazyScreen(props: P) {
    return (
      <Suspense fallback={<LoadingComponent />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

// ============================================================================
// PRELOAD UTILITY
// ============================================================================

const preloadedComponents = new Set<string>();

/**
 * Preload a lazy component in the background
 */
export function preloadComponent(
  key: string,
  importFn: () => Promise<any>
): void {
  if (preloadedComponents.has(key)) return;

  InteractionManager.runAfterInteractions(() => {
    importFn()
      .then(() => {
        preloadedComponents.add(key);
        console.log(`[Preload] Component "${key}" preloaded`);
      })
      .catch((err) => {
        console.warn(`[Preload] Failed to preload "${key}":`, err);
      });
  });
}
