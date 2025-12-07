/**
 * src/navigation/components/NavigationBar.tsx
 *
 * Re-exports FloatingTabBar as NavigationBar for backward compatibility.
 * Uses the Figma-based design with gradient, Search | Player | Home buttons.
 */

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FloatingTabBar } from './FloatingTabBar';

export { FloatingTabBar as NavigationBar };

/** Total height of navigation bar (for content padding) */
export function useNavigationBarHeight(): number {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 56;
  const safeBottom = Math.max(insets.bottom, 8);
  return tabBarHeight + safeBottom;
}
