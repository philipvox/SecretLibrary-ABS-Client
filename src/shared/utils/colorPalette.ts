/**
 * src/shared/utils/colorPalette.ts
 * 
 * Match extracted colors to a predefined palette.
 */

// Your color palette
export const COLOR_PALETTE = [
  { name: 'Soft Clay', hex: '#C9A28A', rgb: [201, 162, 138] },
  { name: 'Faded Coral', hex: '#E28B7C', rgb: [226, 139, 124] },
  { name: 'Dusky Orchid', hex: '#C7A1C9', rgb: [199, 161, 201] },
  { name: 'Fog Blue', hex: '#A7B8C8', rgb: [167, 184, 200] },
  { name: 'Muted Teal', hex: '#4E8E84', rgb: [78, 142, 132] },
  { name: 'Golden Oat', hex: '#D6C27A', rgb: [214, 194, 122] },
  { name: 'Warm Umber', hex: '#8A6A4C', rgb: [138, 106, 76] },
  { name: 'Olive Mist', hex: '#9A9F7A', rgb: [154, 159, 122] },
  { name: 'Smoky Mint', hex: '#B5D5C0', rgb: [181, 213, 192] },
  { name: 'Wintergreen', hex: '#80C7B8', rgb: [128, 199, 184] },
  { name: 'Deep Moss', hex: '#3C5A48', rgb: [60, 90, 72] },
  { name: 'Quiet Navy', hex: '#2E496A', rgb: [46, 73, 106] },
  { name: 'Distant Lavender', hex: '#D7CAE8', rgb: [215, 202, 232] },
  { name: 'Velvet Grape', hex: '#6B4A72', rgb: [107, 74, 114] },
  { name: 'Muted Saffron', hex: '#E8C063', rgb: [232, 192, 99] },
  { name: 'Honey Peach', hex: '#E7B390', rgb: [231, 179, 144] },
  { name: 'Antique Rose', hex: '#C9A0A4', rgb: [201, 160, 164] },
  { name: 'Moonlit Grey', hex: '#D9DADB', rgb: [217, 218, 219] },
  { name: 'Ash Blue', hex: '#6A8BA0', rgb: [106, 139, 160] },
  { name: 'Patina Bronze', hex: '#8D765A', rgb: [141, 118, 90] },
  { name: 'Soft Nickel', hex: '#C7C8CB', rgb: [199, 200, 203] },
  { name: 'Porcelain Mist', hex: '#E3E4E5', rgb: [227, 228, 229] },
  { name: 'Marble Dust', hex: '#D8D9D7', rgb: [216, 217, 215] },
  { name: 'Storm Cloud', hex: '#A1A4A7', rgb: [161, 164, 167] },
  { name: 'Frosted Pewter', hex: '#B5B6B8', rgb: [181, 182, 184] },
  { name: 'Chalkstone', hex: '#EEEDE9', rgb: [238, 237, 233] },
  { name: 'Soft Flint', hex: '#B3B2A8', rgb: [179, 178, 168] },
  { name: 'Pale Mushroom', hex: '#D7D4C9', rgb: [215, 212, 201] },
  { name: 'Quiet Ash', hex: '#C4C6C1', rgb: [196, 198, 193] },
  { name: 'Mist Grey', hex: '#D5D7DA', rgb: [213, 215, 218] },
  { name: 'Fogstone', hex: '#A9ABA7', rgb: [169, 171, 167] },
  { name: 'Warm Clay Grey', hex: '#BDB7B0', rgb: [189, 183, 176] },
  { name: 'Pale Wisteria', hex: '#DCCCEB', rgb: [220, 204, 235] },
  { name: 'Faint Lilac', hex: '#E9DFF5', rgb: [233, 223, 245] },
  { name: 'Powder Violet', hex: '#DAB8E6', rgb: [218, 184, 230] },
  { name: 'Soft Blush Pink', hex: '#F3D0D4', rgb: [243, 208, 212] },
  { name: 'Cool Shell', hex: '#F2E8E5', rgb: [242, 232, 229] },
  { name: 'Pale Poppy', hex: '#F3B8B4', rgb: [243, 184, 180] },
  { name: 'Petal Rose', hex: '#E8C1C3', rgb: [232, 193, 195] },
  { name: 'Milk Lavender', hex: '#E3D6EE', rgb: [227, 214, 238] },
  { name: 'Lilac Haze', hex: '#CAB7D8', rgb: [202, 183, 216] },
  { name: 'Tidal Ice', hex: '#CFE8E7', rgb: [207, 232, 231] },
  { name: 'Mint Drizzle', hex: '#CBEDE4', rgb: [203, 237, 228] },
  { name: 'Seasalt Aqua', hex: '#D7F1EB', rgb: [215, 241, 235] },
  { name: 'Quiet Pine', hex: '#5C7F6F', rgb: [92, 127, 111] },
  { name: 'Soft Spruce', hex: '#6A9586', rgb: [106, 149, 134] },
  { name: 'Thyme Leaf', hex: '#7F9274', rgb: [127, 146, 116] },
  { name: 'Eucalyptus Mist', hex: '#A5C3B7', rgb: [165, 195, 183] },
  { name: 'Cedar Grey', hex: '#758679', rgb: [117, 134, 121] },
  { name: 'Sea Moss', hex: '#8AA895', rgb: [138, 168, 149] },
  { name: 'Soft Fern', hex: '#AFCDA5', rgb: [175, 205, 165] },
  { name: 'Pale Olive', hex: '#C3C9A5', rgb: [195, 201, 165] },
  { name: 'Old Avocado', hex: '#867E55', rgb: [134, 126, 85] },
  { name: 'Underbrush', hex: '#6F7458', rgb: [111, 116, 88] },
  { name: 'Herbal Smoke', hex: '#9BAF9C', rgb: [155, 175, 156] },
  { name: 'Green Patina', hex: '#7BA39A', rgb: [123, 163, 154] },
  { name: 'Blue Haze', hex: '#8FA4BA', rgb: [143, 164, 186] },
  { name: 'Horizon Blue', hex: '#9BB4C9', rgb: [155, 180, 201] },
  { name: 'Cloudwater', hex: '#AFC8D1', rgb: [175, 200, 209] },
  { name: 'Dusty Sky', hex: '#7D97AB', rgb: [125, 151, 171] },
  { name: 'Steelwash', hex: '#6C8A9E', rgb: [108, 138, 158] },
  { name: 'Quiet Lagoon', hex: '#8BC4C2', rgb: [139, 196, 194] },
  { name: 'Faded Azure', hex: '#7BA8C7', rgb: [123, 168, 199] },
  { name: 'Silk Petrol', hex: '#4F6D81', rgb: [79, 109, 129] },
  { name: 'Slate Ice', hex: '#8EA3AB', rgb: [142, 163, 171] },
  { name: 'Pale Fjord', hex: '#C2DCE0', rgb: [194, 220, 224] },
  { name: 'Winter Blue', hex: '#AEC3E0', rgb: [174, 195, 224] },
  { name: 'Dawn Mist Blue', hex: '#CAD8E3', rgb: [202, 216, 227] },
  { name: 'Toasted Wheat', hex: '#D9C59A', rgb: [217, 197, 154] },
  { name: 'Warm Linen', hex: '#E8D8BA', rgb: [232, 216, 186] },
  { name: 'Clay Ochre', hex: '#C7A46E', rgb: [199, 164, 110] },
  { name: 'Sienna Fog', hex: '#B58A73', rgb: [181, 138, 115] },
  { name: 'Soft Bronze', hex: '#9F8761', rgb: [159, 135, 97] },
  { name: 'Umber Tan', hex: '#BA9B7A', rgb: [186, 155, 122] },
  { name: 'Muted Copper', hex: '#C78D66', rgb: [199, 141, 102] },
  { name: 'Faded Terracotta', hex: '#DDA98D', rgb: [221, 169, 141] },
  { name: 'Desert Pink', hex: '#CD9C9A', rgb: [205, 156, 154] },
  { name: 'Canyon Clay', hex: '#B2765E', rgb: [178, 118, 94] },
  { name: 'Worn Saddle', hex: '#8A6C52', rgb: [138, 108, 82] },
  { name: 'Muted Ember', hex: '#D89F7A', rgb: [216, 159, 122] },
  { name: 'Ink Plum', hex: '#50364F', rgb: [80, 54, 79] },
  { name: 'Deep Maroon Smoke', hex: '#5F3C3F', rgb: [95, 60, 63] },
  { name: 'Obsidian Blue', hex: '#2E3F52', rgb: [46, 63, 82] },
  { name: 'Shadow Green', hex: '#32483F', rgb: [50, 72, 63] },
  { name: 'Underlake', hex: '#2F4E55', rgb: [47, 78, 85] },
  { name: 'Old Navy', hex: '#23344A', rgb: [35, 52, 74] },
  { name: 'Smoked Merlot', hex: '#6A4750', rgb: [106, 71, 80] },
  { name: 'Muted Garnet', hex: '#7A4A4A', rgb: [122, 74, 74] },
  { name: 'Dusty Aubergine', hex: '#5E4664', rgb: [94, 70, 100] },
  { name: 'Charcoal Moss', hex: '#394A45', rgb: [57, 74, 69] },
  { name: 'Deep Khaki Green', hex: '#4F5A3A', rgb: [79, 90, 58] },
  { name: 'Vintage Teal', hex: '#2E5B5E', rgb: [46, 91, 94] },
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