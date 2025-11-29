/**
 * src/shared/utils/colorPalette.ts
 * 
 * Match extracted colors to a predefined palette.
 */

// Your color palette
export const COLOR_PALETTE = [
  { name: 'Silver', hex: '#BCBCBD', rgb: [188, 188, 189] },
  { name: 'Alabaster Grey', hex: '#E7E8E9', rgb: [231, 232, 233] },
  { name: 'Lobster Pink', hex: '#E94D59', rgb: [233, 77, 89] },
  { name: 'Seagrass', hex: '#4F9A79', rgb: [79, 154, 121] },
  { name: 'Lime Yellow', hex: '#D5FB2A', rgb: [213, 251, 42] },
  { name: 'Lime Cream', hex: '#EBFDA1', rgb: [235, 253, 161] },
  { name: 'Mauve', hex: '#E0BFF8', rgb: [224, 191, 248] },
  { name: 'Pearl Aqua', hex: '#9FDACC', rgb: [159, 218, 204] },
  { name: 'Aquamarine', hex: '#9EFEE8', rgb: [158, 254, 232] },
  { name: 'Cornflower Blue', hex: '#72A0F8', rgb: [114, 160, 248] },
  { name: 'Medium Jungle', hex: '#12B15B', rgb: [18, 177, 91] },
  { name: 'Bright Amber', hex: '#FED132', rgb: [254, 209, 50] },
  { name: 'Dark Goldenrod', hex: '#AE8946', rgb: [174, 137, 70] },
  { name: 'Plum', hex: '#EEB1E6', rgb: [238, 177, 230] },
  { name: 'white', hex: '#fff', rgb: [255, 255, 255] },
  { name: 'Burgundy', hex: '#8B3D3D', rgb: [139, 61, 61] },
  { name: 'Sage', hex: '#A09A78', rgb: [160, 154, 120] },
  { name: 'Steel Blue', hex: '#3D7A9C', rgb: [61, 122, 156] },
  { name: 'Tangerine', hex: '#F5A623', rgb: [245, 166, 35] },
  { name: 'Dusty Rose', hex: '#9C7A7A', rgb: [156, 122, 122] },
] as const;

export type PaletteColor = typeof COLOR_PALETTE[number];

/**
 * Convert hex to RGB array
 */
export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return [r, g, b];
}

/**
 * Calculate Euclidean distance between two RGB colors
 */
function colorDistance(rgb1: number[], rgb2: number[]): number {
  return Math.sqrt(
    Math.pow(rgb1[0] - rgb2[0], 2) +
    Math.pow(rgb1[1] - rgb2[1], 2) +
    Math.pow(rgb1[2] - rgb2[2], 2)
  );
}

/**
 * Convert RGB to LAB for perceptually accurate matching
 */
function rgbToLab(rgb: number[]): [number, number, number] {
  // RGB to XYZ
  let r = rgb[0] / 255;
  let g = rgb[1] / 255;
  let b = rgb[2] / 255;

  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.0;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;

  // XYZ to LAB
  const fx = x > 0.008856 ? Math.pow(x, 1/3) : (7.787 * x) + 16/116;
  const fy = y > 0.008856 ? Math.pow(y, 1/3) : (7.787 * y) + 16/116;
  const fz = z > 0.008856 ? Math.pow(z, 1/3) : (7.787 * z) + 16/116;

  const L = (116 * fy) - 16;
  const a = 500 * (fx - fy);
  const bLab = 200 * (fy - fz);

  return [L, a, bLab];
}

/**
 * Calculate Delta E (CIE76) - perceptual color difference
 */
function deltaE(lab1: [number, number, number], lab2: [number, number, number]): number {
  return Math.sqrt(
    Math.pow(lab1[0] - lab2[0], 2) +
    Math.pow(lab1[1] - lab2[1], 2) +
    Math.pow(lab1[2] - lab2[2], 2)
  );
}

/**
 * Find the closest color from the palette using perceptual matching (LAB)
 */
export function findClosestColor(hex: string): PaletteColor {
  const inputRgb = hexToRgb(hex);
  const inputLab = rgbToLab(inputRgb);
  
  let closest = COLOR_PALETTE[0];
  let minDistance = Infinity;
  
  for (const color of COLOR_PALETTE) {
    const colorLab = rgbToLab(color.rgb as unknown as number[]);
    const distance = deltaE(inputLab, colorLab);
    
    if (distance < minDistance) {
      minDistance = distance;
      closest = color;
    }
  }
  
  return closest;
}

/**
 * Find closest color using simple RGB distance (faster, less accurate)
 */
export function findClosestColorRgb(hex: string): PaletteColor {
  const inputRgb = hexToRgb(hex);
  
  let closest = COLOR_PALETTE[0];
  let minDistance = Infinity;
  
  for (const color of COLOR_PALETTE) {
    const distance = colorDistance(inputRgb, color.rgb as unknown as number[]);
    
    if (distance < minDistance) {
      minDistance = distance;
      closest = color;
    }
  }
  
  return closest;
}

/**
 * Match extracted color to palette and return hex
 */
export function matchToPalette(extractedHex: string): string {
  const match = findClosestColor(extractedHex);
  return match.hex;
}

/**
 * Get palette color with name
 */
export function matchToPaletteWithName(extractedHex: string): { hex: string; name: string } {
  const match = findClosestColor(extractedHex);
  return { hex: match.hex, name: match.name };
}