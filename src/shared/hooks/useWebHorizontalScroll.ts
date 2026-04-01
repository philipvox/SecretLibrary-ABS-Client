/**
 * src/shared/hooks/useWebHorizontalScroll.ts
 *
 * Hook that enables mouse-wheel and click-drag horizontal scrolling on web.
 * Attaches to a scrollable container ref. No-op on native platforms.
 *
 * Features:
 * - Mouse wheel → horizontal scroll (vertical wheel events scroll horizontally)
 * - Click and drag → horizontal scroll (mouse down + move pans the container)
 * - Cursor changes to 'grab' / 'grabbing' during drag
 * - Momentum/inertia not needed — the browser's native scroll handles smoothness
 */

import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';

interface WebHorizontalScrollOptions {
  /** Multiply wheel deltaY by this factor for scroll speed. Default: 1.5 */
  wheelSpeedMultiplier?: number;
  /** Enable click-and-drag scrolling. Default: true */
  enableDragScroll?: boolean;
}

/**
 * Attach to any horizontal scrollable container on web.
 * Returns a ref callback — pass it to the outermost View wrapping your FlatList.
 *
 * Usage:
 *   const scrollRef = useWebHorizontalScroll();
 *   <View ref={scrollRef}> <FlatList horizontal ... /> </View>
 */
export function useWebHorizontalScroll(options?: WebHorizontalScrollOptions) {
  const containerRef = useRef<any>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);

  const wheelSpeed = options?.wheelSpeedMultiplier ?? 1.5;
  const enableDrag = options?.enableDragScroll ?? true;

  // Find the actual scrollable DOM element inside the RNW View
  const getScrollElement = useCallback((): HTMLElement | null => {
    if (!containerRef.current) return null;
    // React Native Web renders Views as <div>. The FlatList's scroll container
    // is a nested div with overflow set. Find it by looking for the scrollable child.
    const el = containerRef.current as HTMLElement;

    // Check if the element itself is scrollable
    if (el.scrollWidth > el.clientWidth) return el;

    // Look for the first scrollable descendant (FlatList scroll container)
    const scrollable = el.querySelector('[data-testid]') as HTMLElement
      || Array.from(el.querySelectorAll('div')).find(
        (div) => div.scrollWidth > div.clientWidth && getComputedStyle(div).overflowX !== 'hidden'
      ) as HTMLElement;

    return scrollable || el;
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const container = containerRef.current as HTMLElement | null;
    if (!container) return;

    // --- Mouse Wheel → Horizontal Scroll ---
    const handleWheel = (e: WheelEvent) => {
      const scrollEl = getScrollElement();
      if (!scrollEl) return;

      // Only intercept if there's horizontal overflow
      if (scrollEl.scrollWidth <= scrollEl.clientWidth) return;

      // Use deltaY (vertical wheel) to scroll horizontally
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        scrollEl.scrollLeft += e.deltaY * wheelSpeed;
      }
    };

    // --- Click and Drag ---
    const handleMouseDown = (e: MouseEvent) => {
      if (!enableDrag) return;
      // Ignore if clicking on interactive elements
      const target = e.target as HTMLElement;
      if (target.closest('button, a, input, [role="button"]')) return;

      const scrollEl = getScrollElement();
      if (!scrollEl || scrollEl.scrollWidth <= scrollEl.clientWidth) return;

      isDragging.current = true;
      startX.current = e.pageX;
      scrollLeft.current = scrollEl.scrollLeft;
      container.style.cursor = 'grabbing';
      container.style.userSelect = 'none';
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      e.preventDefault();

      const scrollEl = getScrollElement();
      if (!scrollEl) return;

      const dx = e.pageX - startX.current;
      scrollEl.scrollLeft = scrollLeft.current - dx;
    };

    const handleMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      container.style.cursor = enableDrag ? 'grab' : '';
      container.style.userSelect = '';
    };

    // Set initial cursor
    if (enableDrag) {
      container.style.cursor = 'grab';
    }

    // Attach listeners — wheel needs { passive: false } to allow preventDefault
    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      container.style.cursor = '';
    };
  }, [wheelSpeed, enableDrag, getScrollElement]);

  // Return a ref callback that captures the DOM node
  const setRef = useCallback((node: any) => {
    if (Platform.OS !== 'web') return;
    // React Native Web gives us a View instance — get the underlying DOM node
    if (node && typeof node === 'object') {
      // RNW View: node is the component instance, but we need the DOM node
      // In modern RNW, the ref IS the DOM element
      containerRef.current = node;
    }
  }, []);

  return setRef;
}
