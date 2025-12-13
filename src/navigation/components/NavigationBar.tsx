/**
 * src/navigation/components/NavigationBar.tsx
 *
 * Re-exports FloatingTabBar as NavigationBar for backward compatibility.
 * Uses the Figma-based design with gradient, Search | Player | Home buttons.
 */

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '@/shared/theme';
import { FloatingTabBar } from './FloatingTabBar';

export { FloatingTabBar as NavigationBar };

// Tab bar height constant
const TAB_BAR_HEIGHT = 82;

/** Total height of navigation bar (for content padding) */
export function useNavigationBarHeight(): number {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, spacing.lg) + spacing.sm;
  return TAB_BAR_HEIGHT + bottomPadding;
}
