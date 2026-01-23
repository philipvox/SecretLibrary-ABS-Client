/**
 * src/features/home/components/SeriesIcons.tsx
 *
 * 12 decorative SVG icons for series identification on book spines.
 * Each series gets a consistent icon based on series name hash.
 */

import React, { memo } from 'react';
import Svg, { Path, Circle, G, Rect } from 'react-native-svg';

// =============================================================================
// TYPES
// =============================================================================

interface IconProps {
  size?: number;
  color?: string;
}

// =============================================================================
// ICONS
// =============================================================================

// 1. Lotus - Eastern, spiritual
export const LotusIcon = memo(({ size = 20, color = '#1a1a1a' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 21c-1.5-1.5-3-4.5-3-7.5 0-2 1-4 3-5 2 1 3 3 3 5 0 3-1.5 6-3 7.5z"
      fill={color}
    />
    <Path
      d="M12 21c-3-2-6-5-6-9 0-2.5 1.5-5 3.5-6.5C11 4.5 12 3 12 3s1 1.5 2.5 2.5C16.5 7 18 9.5 18 12c0 4-3 7-6 9z"
      stroke={color}
      strokeWidth={1.5}
      fill="none"
    />
    <Path
      d="M8 14c-2-1-3.5-3-3.5-5.5 0-1.5.5-3 2-4"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
    />
    <Path
      d="M16 14c2-1 3.5-3 3.5-5.5 0-1.5-.5-3-2-4"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
    />
  </Svg>
));

// 2. Skull - Dark, horror
export const SkullIcon = memo(({ size = 20, color = '#1a1a1a' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 3C7.5 3 4 6.5 4 11c0 2.5 1 4.5 2.5 6v2.5c0 .5.5 1 1 1h9c.5 0 1-.5 1-1V17c1.5-1.5 2.5-3.5 2.5-6 0-4.5-3.5-8-8-8z"
      stroke={color}
      strokeWidth={1.5}
      fill="none"
    />
    <Circle cx={9} cy={11} r={2} fill={color} />
    <Circle cx={15} cy={11} r={2} fill={color} />
    <Path
      d="M10 16v3M12 16v3M14 16v3"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
    />
  </Svg>
));

// 3. Bird/Flamingo - Whimsical
export const BirdIcon = memo(({ size = 20, color = '#1a1a1a' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 4c-2 0-4 2-4 4 0 1 .5 2 1 3l-2 6h2l1-3 2 3h2l2-3 1 3h2l-2-6c.5-1 1-2 1-3 0-2-2-4-4-4h-2z"
      stroke={color}
      strokeWidth={1.5}
      fill="none"
    />
    <Circle cx={10} cy={7} r={1} fill={color} />
    <Path
      d="M7 6.5L5 5"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
    />
  </Svg>
));

// 4. Star - Fantasy, adventure
export const StarIcon = memo(({ size = 20, color = '#1a1a1a' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z"
      stroke={color}
      strokeWidth={1.5}
      strokeLinejoin="round"
      fill="none"
    />
  </Svg>
));

// 5. Moon - Night, mystery
export const MoonIcon = memo(({ size = 20, color = '#1a1a1a' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M20.5 12.5c0 4.7-3.8 8.5-8.5 8.5S3.5 17.2 3.5 12.5 7.3 4 12 4c.3 0 .5 0 .8 0-1.5 1.5-2.3 3.5-2.3 5.7 0 4.4 3.6 8 8 8 .7 0 1.3-.1 2-.2z"
      stroke={color}
      strokeWidth={1.5}
      fill="none"
    />
  </Svg>
));

// 6. Leaf - Nature, literary
export const LeafIcon = memo(({ size = 20, color = '#1a1a1a' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 21c-4-4-7-8-7-12C5 5 8 3 12 3s7 2 7 6c0 4-3 8-7 12z"
      stroke={color}
      strokeWidth={1.5}
      fill="none"
    />
    <Path
      d="M12 21V9M8 13l4-4 4 4"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
));

// 7. Crown - Royal, epic
export const CrownIcon = memo(({ size = 20, color = '#1a1a1a' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 18V8l4 4 5-6 5 6 4-4v10H3z"
      stroke={color}
      strokeWidth={1.5}
      strokeLinejoin="round"
      fill="none"
    />
    <Circle cx={5} cy={6} r={1.5} fill={color} />
    <Circle cx={12} cy={4} r={1.5} fill={color} />
    <Circle cx={19} cy={6} r={1.5} fill={color} />
  </Svg>
));

// 8. Key - Mystery, secrets
export const KeyIcon = memo(({ size = 20, color = '#1a1a1a' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx={8} cy={8} r={4} stroke={color} strokeWidth={1.5} fill="none" />
    <Path
      d="M11 11l9 9M17 17l3-3M14 14l3-3"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
    />
  </Svg>
));

// 9. Feather - Writing, poetry
export const FeatherIcon = memo(({ size = 20, color = '#1a1a1a' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M20 4c-3 0-6 2-8 5l-1 2-6 9 9-6 2-1c3-2 5-5 5-8 0-1-1-1-1-1z"
      stroke={color}
      strokeWidth={1.5}
      fill="none"
    />
    <Path
      d="M4 20l5-5M14 6c-2 2-4 5-4 8"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
    />
  </Svg>
));

// 10. Diamond - Precious, romance
export const DiamondIcon = memo(({ size = 20, color = '#1a1a1a' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 21L3 9l3-5h12l3 5-9 12z"
      stroke={color}
      strokeWidth={1.5}
      strokeLinejoin="round"
      fill="none"
    />
    <Path
      d="M3 9h18M6 4l2 5 4 12 4-12 2-5"
      stroke={color}
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
  </Svg>
));

// 11. Eye - Thriller, vision
export const EyeIcon = memo(({ size = 20, color = '#1a1a1a' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M12 5C6 5 2 12 2 12s4 7 10 7 10-7 10-7-4-7-10-7z"
      stroke={color}
      strokeWidth={1.5}
      fill="none"
    />
    <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={1.5} fill="none" />
    <Circle cx={12} cy={12} r={1} fill={color} />
  </Svg>
));

// 12. Wave - Ocean, adventure
export const WaveIcon = memo(({ size = 20, color = '#1a1a1a' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M2 12c2-2 4-4 6-4s4 2 6 2 4-2 6-2 2 2 2 4"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      fill="none"
    />
    <Path
      d="M2 17c2-2 4-4 6-4s4 2 6 2 4-2 6-2 2 2 2 4"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      fill="none"
    />
    <Path
      d="M2 7c2-2 4-4 6-4s4 2 6 2 4-2 6-2"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      fill="none"
    />
  </Svg>
));

// =============================================================================
// ICON ARRAY & SELECTOR
// =============================================================================

/**
 * Array of all series icons in order
 */
export const SERIES_ICONS = [
  LotusIcon,
  SkullIcon,
  BirdIcon,
  StarIcon,
  MoonIcon,
  LeafIcon,
  CrownIcon,
  KeyIcon,
  FeatherIcon,
  DiamondIcon,
  EyeIcon,
  WaveIcon,
];

/**
 * Get the appropriate icon component for a series
 * Uses iconIndex (typically from series style cache)
 */
export function getSeriesIconComponent(iconIndex: number): React.FC<IconProps> {
  return SERIES_ICONS[iconIndex % SERIES_ICONS.length];
}

/**
 * Render a series icon by index
 */
export const SeriesIcon = memo(({
  iconIndex,
  size = 20,
  color = '#1a1a1a',
}: {
  iconIndex: number;
  size?: number;
  color?: string;
}) => {
  const IconComponent = getSeriesIconComponent(iconIndex);
  return <IconComponent size={size} color={color} />;
});

export default SeriesIcon;
