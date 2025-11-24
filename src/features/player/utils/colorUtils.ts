export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  if (!hex) return null;
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

export function darkenColor(hex: string, factor: number = 0.2): string {
  if (!hex) return '#1A1A2E';
  const rgb = hexToRgb(hex);
  if (!rgb) return '#1A1A2E';
  return rgbToHex(
    rgb.r * (1 - factor),
    rgb.g * (1 - factor),
    rgb.b * (1 - factor)
  );
}

export function lightenColor(hex: string, factor: number = 0.2): string {
  if (!hex) return '#FFFFFF';
  const rgb = hexToRgb(hex);
  if (!rgb) return '#FFFFFF';
  return rgbToHex(
    rgb.r + (255 - rgb.r) * factor,
    rgb.g + (255 - rgb.g) * factor,
    rgb.b + (255 - rgb.b) * factor
  );
}

export function isLightColor(hex: string): boolean {
  if (!hex) return false;
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.5;
}

export function getAccentColor(hex: string): string {
  if (!hex) return '#FF6B6B';
  const rgb = hexToRgb(hex);
  if (!rgb) return '#FF6B6B';
  
  // Convert to HSV
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  
  if (d !== 0) {
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  
  // Rotate hue 180 degrees for complementary
  h = (h + 0.5) % 1;
  
  // Boost saturation and value for vibrant accent
  const newS = Math.min(1, s + 0.3);
  const newV = Math.min(1, v + 0.2);
  
  // Convert back to RGB
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = newV * (1 - newS);
  const q = newV * (1 - f * newS);
  const t = newV * (1 - (1 - f) * newS);
  
  let newR = 0, newG = 0, newB = 0;
  switch (i % 6) {
    case 0: newR = newV; newG = t; newB = p; break;
    case 1: newR = q; newG = newV; newB = p; break;
    case 2: newR = p; newG = newV; newB = t; break;
    case 3: newR = p; newG = q; newB = newV; break;
    case 4: newR = t; newG = p; newB = newV; break;
    case 5: newR = newV; newG = p; newB = q; break;
  }
  
  return rgbToHex(newR * 255, newG * 255, newB * 255);
}

const FALLBACK_PALETTES = [
  { bg: '#1A1A2E', accent: '#E94560' },
  { bg: '#16213E', accent: '#0F3460' },
  { bg: '#1B262C', accent: '#3282B8' },
  { bg: '#2C3333', accent: '#395B64' },
  { bg: '#222831', accent: '#00ADB5' },
  { bg: '#352F44', accent: '#5C5470' },
  { bg: '#1A1A2E', accent: '#E94560' },
  { bg: '#0F0E17', accent: '#FF8906' },
  { bg: '#232946', accent: '#EEBBC3' },
  { bg: '#121212', accent: '#BB86FC' },
  { bg: '#1F1B24', accent: '#03DAC6' },
  { bg: '#2D2D2D', accent: '#FF7597' },
];

export function getFallbackColors(bookId: string): { bg: string; accent: string } {
  if (!bookId) return FALLBACK_PALETTES[0];
  let hash = 0;
  for (let i = 0; i < bookId.length; i++) {
    hash = ((hash << 5) - hash) + bookId.charCodeAt(i);
    hash = hash & hash;
  }
  const index = Math.abs(hash) % FALLBACK_PALETTES.length;
  return FALLBACK_PALETTES[index];
}