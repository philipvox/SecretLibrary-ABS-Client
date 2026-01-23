/**
 * src/shared/accessibility/index.ts
 *
 * Accessibility utilities exports
 */

export {
  // Constants
  MIN_TOUCH_TARGET,
  HIT_SLOP,
  // Hit slop
  calculateHitSlop,
  // Accessibility props builders
  buildButtonAccessibility,
  buildSliderAccessibility,
  buildProgressAccessibility,
  buildImageAccessibility,
  buildHeadingAccessibility,
  buildLinkAccessibility,
  buildToggleAccessibility,
  buildTabAccessibility,
  buildListItemAccessibility,
  // Formatters
  formatTimeForAccessibility,
  formatProgressForAccessibility,
  buildBookDescription,
  // Color contrast
  checkColorContrast,
} from './accessibilityUtils';
